import type {
  DiscoveredVote,
  RawMemberVote,
  RawVotePayload,
  ScrapeContext,
  StateVoteAdapter,
  VoteChamber,
} from '@/types/voteRecord';
import { normalizeVoteDate, normalizeVoteOption } from '@/types/voteRecord';

const JURISDICTION = 'ocd-jurisdiction/country:us/state:ny/government';
const API_BASE = 'https://legislation.nysenate.gov/api/3';
const MAX_BILLS_PER_RUN = 75;

interface NyMember {
  memberId?: number;
  fullName?: string;
  shortName?: string;
}

interface NyVoteItem {
  voteType?: string;
  voteDate?: string;
  sequenceNo?: number;
  committee?: { name?: string; chamber?: string };
  memberVotes?: {
    items?: Record<string, { items?: NyMember[] }>;
  };
}

interface NyBillListItem {
  printNo: string;
  session: number;
  status?: { actionDate?: string };
}

function apiKey(): string | undefined {
  return process.env.NY_OPENLEG_API_KEY;
}

/** NY Open Legislation labels sessions by start year (e.g. 2025 for the 2025–26 session). */
function resolveNySession(ctx: ScrapeContext): string {
  const fromCtx = ctx.session.match(/\d{4}/)?.[0];
  if (fromCtx && fromCtx !== String(new Date().getFullYear())) {
    return fromCtx;
  }
  return String(new Date().getFullYear() - 1);
}

function chamberFromVote(vote: NyVoteItem): VoteChamber {
  const c = vote.committee?.chamber ?? '';
  return /assembly/i.test(c) ? 'lower' : 'upper';
}

function organizationFromVote(vote: NyVoteItem): string {
  if (vote.voteType === 'COMMITTEE' && vote.committee?.name) {
    return vote.committee.name;
  }
  return chamberFromVote(vote) === 'lower' ? 'Assembly' : 'Senate';
}

function parseNyMemberVotes(vote: NyVoteItem): RawMemberVote[] {
  const items = vote.memberVotes?.items ?? {};
  const members: RawMemberVote[] = [];
  const optionMap: Record<string, string> = {
    AYE: 'Yea',
    NAY: 'Nay',
    EXC: 'Absent',
    ABD: 'Absent',
    NV: 'NV',
  };

  for (const [key, group] of Object.entries(items)) {
    const option = optionMap[key] ?? key;
    for (const m of group?.items ?? []) {
      members.push({
        name: m.fullName ?? m.shortName ?? 'Unknown',
        option,
        externalId: m.memberId?.toString(),
      });
    }
  }
  return members;
}

export function parseNyBillVotes(
  bill: NyBillListItem,
  votes: NyVoteItem[]
): RawVotePayload[] {
  return votes.map((vote) => {
    const memberVotes = parseNyMemberVotes(vote);
    const counts = aggregateNyCounts(memberVotes);
    const chamber = chamberFromVote(vote);
    const yea = counts.find((c) => c.option === 'yea')?.value ?? 0;
    const nay = counts.find((c) => c.option === 'nay')?.value ?? 0;

    return {
      adapter: 'ny-api',
      jurisdiction: JURISDICTION,
      session: String(bill.session),
      chamber,
      organization: organizationFromVote(vote),
      organizationType: vote.voteType === 'COMMITTEE' ? 'committee' : 'chamber',
      rollCallNumber: `${bill.printNo}-${vote.sequenceNo ?? 0}`,
      motionText: vote.voteType ?? 'Roll call vote',
      date: vote.voteDate ?? new Date().toISOString().split('T')[0],
      result: yea >= nay ? 'pass' : 'fail',
      counts,
      memberVotes,
      billIdentifier: bill.printNo,
      sources: [
        {
          url: `${API_BASE}/bills/${bill.session}/${bill.printNo}`,
          note: 'NY Open Legislation API',
        },
      ],
    };
  });
}

function aggregateNyCounts(memberVotes: RawMemberVote[]) {
  const tally = new Map<string, number>();
  for (const mv of memberVotes) {
    const opt = normalizeVoteOption(mv.option);
    tally.set(opt, (tally.get(opt) ?? 0) + 1);
  }
  return Array.from(tally.entries()).map(([option, value]) => ({
    option: option as 'yea' | 'nay' | 'present' | 'not_voting' | 'absent' | 'other',
    value,
  }));
}

export class NewYorkVoteAdapter implements StateVoteAdapter {
  stateAbbr = 'NY';
  jurisdictionOcdId = JURISDICTION;
  adapterName = 'ny-api';

  async *discoverVotes(ctx: ScrapeContext): AsyncIterable<DiscoveredVote> {
    const key = apiKey();
    if (!key) {
      console.warn(
        '[NY] Skipping: set NY_OPENLEG_API_KEY in .env (free at openleg.nysenate.gov)'
      );
      return;
    }

    const sessionYear = resolveNySession(ctx);
    let offset = 1;
    const limit = 50;
    let keepFetching = true;
    let billsFetched = 0;

    while (keepFetching) {
      await ctx.rateLimiter.wait();
      const listUrl = `${API_BASE}/bills/${sessionYear}?key=${encodeURIComponent(key)}&limit=${limit}&offset=${offset}`;
      let listJson: {
        result?: { items?: NyBillListItem[] };
        offsetEnd?: number;
        total?: number;
      };

      try {
        const body = await ctx.httpClient.get(listUrl);
        listJson = JSON.parse(body);
      } catch {
        break;
      }

      const bills = listJson.result?.items ?? [];
      if (!bills.length) break;

      for (const bill of bills) {
        if (billsFetched >= MAX_BILLS_PER_RUN) {
          keepFetching = false;
          break;
        }

        billsFetched++;
        yield* this.discoverBillVotes(bill, key, ctx);
      }

      const total = listJson.total ?? 0;
      const end = listJson.offsetEnd ?? offset;
      if (end >= total || billsFetched >= MAX_BILLS_PER_RUN) {
        keepFetching = false;
      } else {
        offset = end + 1;
      }

      if (offset > 200 || billsFetched >= MAX_BILLS_PER_RUN) keepFetching = false;
    }
  }

  private async *discoverBillVotes(
    bill: NyBillListItem,
    key: string,
    ctx: ScrapeContext
  ): AsyncIterable<DiscoveredVote> {
    await ctx.rateLimiter.wait();
    const detailUrl = `${API_BASE}/bills/${bill.session}/${bill.printNo}?key=${encodeURIComponent(key)}&view=with_votes`;

    let data: { result?: { votes?: { items?: NyVoteItem[] } } };
    try {
      data = JSON.parse(await ctx.httpClient.get(detailUrl));
    } catch {
      return;
    }

    const votes = data.result?.votes?.items ?? [];
    for (let i = 0; i < votes.length; i++) {
      const vote = votes[i];
      if (vote.voteDate && new Date(vote.voteDate) < ctx.since) continue;

      yield {
        sourceId: `${bill.session}-${bill.printNo}-seq${vote.sequenceNo ?? i}`,
        sourceUrl: detailUrl,
        billIdentifier: bill.printNo,
        date: vote.voteDate,
        rollCallNumber: `${bill.printNo}-${vote.sequenceNo ?? i}`,
        metadata: {
          session: String(bill.session),
          printNo: bill.printNo,
          voteIndex: i,
        },
      };
    }
  }

  async fetchVoteDetail(
    discovered: DiscoveredVote,
    ctx: ScrapeContext
  ): Promise<RawVotePayload> {
    const key = apiKey();
    if (!key) throw new Error('NY_OPENLEG_API_KEY not configured');

    await ctx.rateLimiter.wait();
    const body =
      discovered.metadata?.fixtureContent ??
      (await ctx.httpClient.get(discovered.sourceUrl));
    const data = JSON.parse(body) as {
      result?: { votes?: { items?: NyVoteItem[] }; printNo?: string; session?: number };
    };

    const bill: NyBillListItem = {
      printNo: discovered.metadata?.printNo ?? data.result?.printNo ?? '',
      session: Number(discovered.metadata?.session ?? data.result?.session ?? ctx.session),
    };

    const votes = data.result?.votes?.items ?? [];
    const voteIndex = Number(discovered.metadata?.voteIndex ?? 0);
    const vote = votes[voteIndex] ?? votes[0];
    if (!vote) {
      throw new Error(`No votes on NY bill ${bill.printNo}`);
    }

    const payloads = parseNyBillVotes(bill, [vote]);
    return payloads[0];
  }
}

/** Fetch all votes for a bill (used when one discovered entry maps to multiple votes). */
export async function fetchAllNyBillVotes(
  printNo: string,
  session: string,
  httpGet: (url: string) => Promise<string>
): Promise<RawVotePayload[]> {
  const key = apiKey();
  if (!key) return [];
  const url = `${API_BASE}/bills/${session}/${printNo}?key=${encodeURIComponent(key)}&view=with_votes`;
  const data = JSON.parse(await httpGet(url)) as {
    result?: { votes?: { items?: NyVoteItem[] }; printNo?: string; session?: number };
  };
  const bill: NyBillListItem = {
    printNo,
    session: Number(session),
  };
  const votes = data.result?.votes?.items ?? [];
  return parseNyBillVotes(bill, votes).filter(
    (v) => new Date(normalizeVoteDate(v.date)) >= new Date(0)
  );
}
