import type {
  DiscoveredVote,
  RawVotePayload,
  ScrapeContext,
  StateVoteAdapter,
} from '@/types/voteRecord';
import { normalizeVoteDate } from '@/types/voteRecord';
import {
  parseFlVoteDetail,
  parseVoteIndexLinks,
} from '../parsers/htmlVoteTable';

const JURISDICTION = 'ocd-jurisdiction/country:us/state:fl/government';
const VOTE_INDEX_URL =
  'https://www.myfloridahouse.gov/Sections/Bills/billsvote.aspx';

export class FloridaVoteAdapter implements StateVoteAdapter {
  stateAbbr = 'FL';
  jurisdictionOcdId = JURISDICTION;
  adapterName = 'fl-html';

  async *discoverVotes(ctx: ScrapeContext): AsyncIterable<DiscoveredVote> {
    await ctx.rateLimiter.wait();
    const html = await ctx.httpClient.get(VOTE_INDEX_URL);
    const links = parseVoteIndexLinks(html, VOTE_INDEX_URL, /billvote\.aspx/i);

    for (const link of links) {
      if (link.date) {
        const voteDate = new Date(normalizeVoteDate(link.date));
        if (voteDate < ctx.since) continue;
      }
      yield {
        sourceId: link.rollCallNumber ?? link.url,
        sourceUrl: link.url,
        rollCallNumber: link.rollCallNumber,
        date: link.date,
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
    const parsed = parseFlVoteDetail(html);

    return {
      adapter: this.adapterName,
      jurisdiction: this.jurisdictionOcdId,
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
