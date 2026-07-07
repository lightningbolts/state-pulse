import type {
  DiscoveredVote,
  RawVotePayload,
  ScrapeContext,
  StateVoteAdapter,
} from '@/types/voteRecord';
import { normalizeVoteDate } from '@/types/voteRecord';
import {
  VA_DEFAULT_SESSION_CODE,
  parseVaVotesCsv,
  vaCsvUrl,
  type VaCsvBundle,
} from '../parsers/vaVote';

const JURISDICTION = 'ocd-jurisdiction/country:us/state:va/government';

function sessionCode(): string {
  return process.env.VA_LIS_SESSION_CODE ?? VA_DEFAULT_SESSION_CODE;
}

async function downloadVaCsv(
  ctx: ScrapeContext,
  fileName: 'Vote.csv' | 'Members.csv' | 'History.csv'
): Promise<string | null> {
  const apiKey = process.env.LIS_API_KEY ?? process.env.VA_LIS_API_KEY;
  const headers: Record<string, string> = {};
  if (apiKey) {
    headers['x-api-key'] = apiKey;
    headers.Authorization = `Bearer ${apiKey}`;
  }

  for (const useLegacy of [false, true]) {
    const url = vaCsvUrl(sessionCode(), fileName, useLegacy);
    try {
      return await ctx.httpClient.get(url, { headers });
    } catch {
      continue;
    }
  }
  return null;
}

export class VirginiaVoteAdapter implements StateVoteAdapter {
  stateAbbr = 'VA';
  jurisdictionOcdId = JURISDICTION;
  adapterName = 'va-lis-csv';

  async *discoverVotes(ctx: ScrapeContext): AsyncIterable<DiscoveredVote> {
    if (!process.env.LIS_API_KEY && !process.env.VA_LIS_API_KEY) {
      console.warn(
        '[VA] Skipping: set LIS_API_KEY for 2025+ session CSV downloads (register at lis.virginia.gov/developers)'
      );
      return;
    }

    await ctx.rateLimiter.wait();
    const [votesCsv, membersCsv, historyCsv] = await Promise.all([
      downloadVaCsv(ctx, 'Vote.csv'),
      downloadVaCsv(ctx, 'Members.csv'),
      downloadVaCsv(ctx, 'History.csv'),
    ]);

    if (!votesCsv || !membersCsv || !historyCsv) {
      console.warn('[VA] Could not download LIS CSV files for session', sessionCode());
      return;
    }

    const bundle: VaCsvBundle = { votesCsv, membersCsv, historyCsv };
    const votes = parseVaVotesCsv(bundle);

    for (const vote of votes) {
      if (!vote.date) continue;
      const voteDate = new Date(normalizeVoteDate(vote.date));
      if (voteDate < ctx.since) continue;

      yield {
        sourceId: vote.rollCallNumber ?? 'unknown',
        sourceUrl: vaCsvUrl(sessionCode(), 'Vote.csv'),
        rollCallNumber: vote.rollCallNumber,
        billIdentifier: vote.billIdentifier,
        date: vote.date,
        metadata: { vaVote: JSON.stringify(vote) },
      };
    }
  }

  async fetchVoteDetail(
    discovered: DiscoveredVote,
    _ctx: ScrapeContext
  ): Promise<RawVotePayload> {
    const rowJson = discovered.metadata?.vaVote;
    if (!rowJson) {
      throw new Error(`VA vote metadata missing for ${discovered.sourceId}`);
    }
    const parsed = JSON.parse(rowJson) as ReturnType<typeof parseVaVotesCsv>[number];

    return {
      adapter: this.adapterName,
      jurisdiction: JURISDICTION,
      session: _ctx.session,
      chamber: parsed.chamber,
      organization: parsed.organization,
      organizationType: parsed.organizationType,
      rollCallNumber: discovered.rollCallNumber ?? parsed.rollCallNumber,
      motionText: parsed.motionText,
      date: parsed.date,
      result: parsed.result,
      counts: parsed.counts,
      memberVotes: parsed.memberVotes,
      billIdentifier: parsed.billIdentifier ?? discovered.billIdentifier,
      sources: [{ url: discovered.sourceUrl }],
      rawContent: rowJson,
      sourceUrl: discovered.sourceUrl,
    };
  }
}
