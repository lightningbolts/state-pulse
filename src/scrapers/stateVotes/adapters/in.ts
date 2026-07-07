import type {
  DiscoveredVote,
  RawMemberVote,
  RawVotePayload,
  ScrapeContext,
  StateVoteAdapter,
} from '@/types/voteRecord';
import { normalizeVoteDate } from '@/types/voteRecord';

const JURISDICTION = 'ocd-jurisdiction/country:us/state:in/government';
const API_BASE = 'https://api.iga.in.gov';
const SESSION_YEAR = '2026';

interface InVotesheet {
  id: string;
  date?: string;
  chamber?: string;
  motionText?: string;
  billIdentifier?: string;
  yea?: number;
  nay?: number;
  memberVotes: RawMemberVote[];
  result?: 'pass' | 'fail' | 'unknown';
}

async function inApiGet(
  path: string,
  apiKey: string
): Promise<unknown> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: {
      Accept: 'application/json',
      'x-api-key': apiKey,
      'User-Agent': `iga-api-client-${apiKey}`,
    },
  });
  if (!response.ok) {
    throw new Error(`IN API ${response.status} for ${path}`);
  }
  return response.json();
}

function walkLinks(value: unknown, acc: string[] = []): string[] {
  if (!value || typeof value !== 'object') return acc;
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (key === 'link' && typeof child === 'string') acc.push(child);
    else if (typeof child === 'object') walkLinks(child, acc);
  }
  return acc;
}

function parseMemberVotes(node: unknown): RawMemberVote[] {
  if (!node || typeof node !== 'object') return [];
  const record = node as Record<string, unknown>;
  const votes: RawMemberVote[] = [];

  const arrays = [
    record.members,
    record.memberVotes,
    record.votes,
    record.legislators,
  ];
  for (const arr of arrays) {
    if (!Array.isArray(arr)) continue;
    for (const item of arr) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const name =
        (row.name as string) ??
        (row.legislatorName as string) ??
        (row.fullName as string);
      const option =
        (row.vote as string) ??
        (row.position as string) ??
        (row.voteType as string);
      if (name && option) votes.push({ name: String(name), option: String(option) });
    }
  }

  return votes;
}

function normalizeVotesheet(node: unknown, fallbackId: string): InVotesheet | null {
  if (!node || typeof node !== 'object') return null;
  const row = node as Record<string, unknown>;
  const id = String(row.id ?? row.votesheetId ?? row.rollcallId ?? fallbackId);
  const date =
    (row.date as string) ??
    (row.voteDate as string) ??
    (row.actionDate as string);
  const chamberRaw = String(row.chamber ?? row.legislativeBody ?? 'House');
  const billIdentifier =
    (row.billName as string) ??
    (row.billNumber as string) ??
    (row.bill as string);
  const motionText =
    (row.motion as string) ??
    (row.description as string) ??
    (row.title as string) ??
    'Roll call vote';
  const yea = Number(row.yea ?? row.ayes ?? row.yes ?? 0) || undefined;
  const nay = Number(row.nay ?? row.nays ?? row.no ?? 0) || undefined;
  const memberVotes = parseMemberVotes(row);
  const resultRaw = String(row.result ?? row.outcome ?? '').toLowerCase();

  return {
    id,
    date,
    chamber: chamberRaw,
    motionText,
    billIdentifier,
    yea,
    nay,
    memberVotes,
    result: resultRaw.includes('fail')
      ? 'fail'
      : resultRaw.includes('pass') || resultRaw.includes('adopt')
        ? 'pass'
        : 'unknown',
  };
}

async function listVotesheetPaths(apiKey: string): Promise<string[]> {
  const root = (await inApiGet(`/${SESSION_YEAR}/votesheets`, apiKey)) as unknown;
  const links = walkLinks(root);
  if (links.length) return links;

  const rollcalls = (await inApiGet(`/${SESSION_YEAR}/rollcalls`, apiKey)) as unknown;
  return walkLinks(rollcalls);
}

async function fetchVotesheet(
  path: string,
  apiKey: string
): Promise<InVotesheet | null> {
  const detail = await inApiGet(path, apiKey);
  if (Array.isArray(detail)) {
    return normalizeVotesheet(detail[0], path);
  }
  return normalizeVotesheet(detail, path);
}

export class IndianaVoteAdapter implements StateVoteAdapter {
  stateAbbr = 'IN';
  jurisdictionOcdId = JURISDICTION;
  adapterName = 'in-myiga-api';

  constructor(private readonly apiKey?: string) {}

  async *discoverVotes(ctx: ScrapeContext): AsyncIterable<DiscoveredVote> {
    const apiKey = this.apiKey ?? process.env.IGA_API_KEY;
    if (!apiKey) {
      console.warn(
        '[IN] Skipping: set IGA_API_KEY (request at apitoken.request@iga.in.gov)'
      );
      return;
    }

    let paths: string[] = [];
    try {
      paths = (await listVotesheetPaths(apiKey)).slice(0, 100);
    } catch {
      console.warn('[IN] Could not list votesheets from MyIGA API');
      return;
    }

    for (const path of paths) {
      await ctx.rateLimiter.wait();
      let sheet: InVotesheet | null;
      try {
        sheet = await fetchVotesheet(path, apiKey);
      } catch {
        continue;
      }
      if (!sheet?.date) continue;

      const voteDate = new Date(normalizeVoteDate(sheet.date));
      if (voteDate < ctx.since) continue;

      const absolute = path.startsWith('http') ? path : `${API_BASE}${path}`;
      yield {
        sourceId: sheet.id,
        sourceUrl: absolute,
        rollCallNumber: sheet.id,
        billIdentifier: sheet.billIdentifier,
        date: sheet.date,
        metadata: { inVote: JSON.stringify(sheet) },
      };
    }
  }

  async fetchVoteDetail(
    discovered: DiscoveredVote,
    ctx: ScrapeContext
  ): Promise<RawVotePayload> {
    const rowJson = discovered.metadata?.inVote;
    const sheet = rowJson
      ? (JSON.parse(rowJson) as InVotesheet)
      : undefined;
    if (!sheet) {
      throw new Error(`IN vote metadata missing for ${discovered.sourceId}`);
    }

    const chamber = /senate/i.test(sheet.chamber ?? '') ? 'upper' : 'lower';
    const counts = [
      ...(sheet.yea != null ? [{ option: 'yea' as const, value: sheet.yea }] : []),
      ...(sheet.nay != null ? [{ option: 'nay' as const, value: sheet.nay }] : []),
    ];

    return {
      adapter: this.adapterName,
      jurisdiction: JURISDICTION,
      session: ctx.session,
      chamber,
      organization: chamber === 'upper' ? 'Senate' : 'House',
      organizationType: /committee/i.test(sheet.motionText ?? '')
        ? 'committee'
        : 'chamber',
      rollCallNumber: discovered.rollCallNumber ?? sheet.id,
      motionText: sheet.motionText ?? 'Roll call vote',
      date: sheet.date ?? discovered.date ?? '',
      result: sheet.result,
      counts,
      memberVotes: sheet.memberVotes,
      billIdentifier: sheet.billIdentifier ?? discovered.billIdentifier,
      sources: [{ url: discovered.sourceUrl }],
      rawContent: rowJson,
      sourceUrl: discovered.sourceUrl,
    };
  }
}
