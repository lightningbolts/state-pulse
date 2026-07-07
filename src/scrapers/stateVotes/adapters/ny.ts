import type {
  DiscoveredVote,
  RawVotePayload,
  ScrapeContext,
  StateVoteAdapter,
  VoteChamber,
} from '@/types/voteRecord';
import { normalizeVoteDate, normalizeVoteOption } from '@/types/voteRecord';

const JURISDICTION = 'ocd-jurisdiction/country:us/state:ny/government';
const API_BASE = 'https://legislation.nysenate.gov/api/3';

interface NyRollCallMember {
  shortName?: string;
  fullName?: string;
  vote?: string;
  memberId?: number;
}

interface NyRollCallResponse {
  voteType?: string;
  voteDate?: string;
  result?: string;
  bill?: { printNo?: string; sessionYear?: number };
  memberVotes?: {
    memberVotes?:
      | NyRollCallMember[]
      | {
          memberVote?: NyRollCallMember | NyRollCallMember[];
        };
  };
  yesCount?: number;
  noCount?: number;
  absentCount?: number;
  excusedCount?: number;
}

export function parseNyRollCallJson(
  data: NyRollCallResponse,
  rollCallId: string
): RawVotePayload {
  const membersContainer = data.memberVotes?.memberVotes;
  let membersRaw: NyRollCallMember | NyRollCallMember[] | undefined;
  if (Array.isArray(membersContainer)) {
    membersRaw = membersContainer;
  } else {
    membersRaw = membersContainer?.memberVote;
  }
  const members = Array.isArray(membersRaw)
    ? membersRaw
    : membersRaw
      ? [membersRaw]
      : [];

  const memberVotes = members.map((m) => ({
    name: m.fullName ?? m.shortName ?? 'Unknown',
    option: m.vote ?? 'other',
    externalId: m.memberId?.toString(),
  }));

  const counts = [
    { option: normalizeVoteOption('yea'), value: data.yesCount ?? 0 },
    { option: normalizeVoteOption('nay'), value: data.noCount ?? 0 },
    { option: normalizeVoteOption('absent'), value: data.absentCount ?? 0 },
    { option: normalizeVoteOption('not_voting'), value: data.excusedCount ?? 0 },
  ].filter((c) => c.value > 0);

  const billId = data.bill?.printNo
    ? `${data.bill.printNo}`
    : undefined;

  return {
    adapter: 'ny-api',
    jurisdiction: JURISDICTION,
    session: String(data.bill?.sessionYear ?? new Date().getFullYear()),
    chamber: 'upper' as VoteChamber,
    organization: 'Senate',
    organizationType: 'chamber',
    rollCallNumber: rollCallId,
    motionText: data.voteType ?? 'Roll call vote',
    date: data.voteDate ?? new Date().toISOString().split('T')[0],
    result: /pass|adopt|affirm/i.test(data.result ?? '') ? 'pass' : 'fail',
    counts,
    memberVotes,
    billIdentifier: billId,
    sources: [
      {
        url: `${API_BASE}/roll-calls/${rollCallId}`,
        note: 'NY Open Legislation API',
      },
    ],
    rawContent: JSON.stringify(data),
  };
}

export class NewYorkVoteAdapter implements StateVoteAdapter {
  stateAbbr = 'NY';
  jurisdictionOcdId = JURISDICTION;
  adapterName = 'ny-api';

  async *discoverVotes(ctx: ScrapeContext): AsyncIterable<DiscoveredVote> {
    await ctx.rateLimiter.wait();
    const year = ctx.session.match(/\d{4}/)?.[0] ?? new Date().getFullYear();
    const url = `${API_BASE}/roll-calls/${year}`;

    let json: { rollCalls?: { rollCall?: { rollCallId?: number; voteDate?: string }[] } };
    try {
      const body = await ctx.httpClient.get(url);
      json = JSON.parse(body);
    } catch {
      return;
    }

    const rollCalls = json.rollCalls?.rollCall;
    const list = Array.isArray(rollCalls) ? rollCalls : rollCalls ? [rollCalls] : [];

    for (const rc of list) {
      if (!rc.rollCallId) continue;
      const date = rc.voteDate ? normalizeVoteDate(rc.voteDate) : undefined;
      if (date && new Date(date) < ctx.since) continue;
      yield {
        sourceId: String(rc.rollCallId),
        sourceUrl: `${API_BASE}/roll-calls/${rc.rollCallId}`,
        rollCallNumber: String(rc.rollCallId),
        date,
      };
    }
  }

  async fetchVoteDetail(
    discovered: DiscoveredVote,
    ctx: ScrapeContext
  ): Promise<RawVotePayload> {
    await ctx.rateLimiter.wait();
    const body =
      discovered.metadata?.fixtureContent ??
      (await ctx.httpClient.get(discovered.sourceUrl));
    const data = JSON.parse(body) as NyRollCallResponse;
    return parseNyRollCallJson(data, discovered.sourceId);
  }
}
