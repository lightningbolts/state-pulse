import type {
  DiscoveredVote,
  RawVotePayload,
  ScrapeContext,
  StateVoteAdapter,
} from '@/types/voteRecord';
import { normalizeVoteDate } from '@/types/voteRecord';
import {
  MN_SESSION_KEY,
  mnVoteDetailUrl,
  mnVoteSummaryRequest,
  mnVoteSummaryUrl,
  parseMnVoteDetail,
  parseMnVoteSummaryRows,
} from '../parsers/mnVote';

const JURISDICTION = 'ocd-jurisdiction/country:us/state:mn/government';
const MAX_VOTES_PER_RUN = 50;

export class MinnesotaVoteAdapter implements StateVoteAdapter {
  stateAbbr = 'MN';
  jurisdictionOcdId = JURISDICTION;
  adapterName = 'mn-house-api';

  async *discoverVotes(ctx: ScrapeContext): AsyncIterable<DiscoveredVote> {
    await ctx.rateLimiter.wait();

    const post = ctx.httpClient.post?.bind(ctx.httpClient);
    if (!post) {
      console.warn('[MN] Skipping: HTTP client does not support POST');
      return;
    }

    let summaryJson: string;
    try {
      summaryJson = await post(
        mnVoteSummaryUrl(),
        mnVoteSummaryRequest(MN_SESSION_KEY),
        {
          headers: {
            Referer: `https://www.house.mn.gov/Votes/Summary/${MN_SESSION_KEY}`,
          },
        }
      );
    } catch {
      return;
    }

    const rows = parseMnVoteSummaryRows(summaryJson).slice(0, MAX_VOTES_PER_RUN);
    for (const row of rows) {
      if (row.date) {
        const voteDate = new Date(normalizeVoteDate(row.date));
        if (voteDate < ctx.since) continue;
      }

      const url = mnVoteDetailUrl(row.billNumber, MN_SESSION_KEY);
      yield {
        sourceId: `${row.billNumber}-${row.date || 'unknown'}`,
        sourceUrl: url,
        billIdentifier: row.billNumber,
        date: row.date,
        rollCallNumber: row.billNumber,
        metadata: { billNumber: row.billNumber },
      };
    }
  }

  async fetchVoteDetail(
    discovered: DiscoveredVote,
    ctx: ScrapeContext
  ): Promise<RawVotePayload> {
    await ctx.rateLimiter.wait();
    const html =
      discovered.metadata?.fixtureContent ??
      (await ctx.httpClient.get(discovered.sourceUrl));

    const votes = parseMnVoteDetail(html);
    const parsed = votes[0];
    if (!parsed) {
      throw new Error(`MN vote not found for ${discovered.sourceUrl}`);
    }

    return {
      adapter: this.adapterName,
      jurisdiction: JURISDICTION,
      session: ctx.session,
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
      rawContent: html,
      sourceUrl: discovered.sourceUrl,
    };
  }
}
