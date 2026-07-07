import type {
  DiscoveredVote,
  RawVotePayload,
  ScrapeContext,
  StateVoteAdapter,
} from '@/types/voteRecord';
import { normalizeVoteDate } from '@/types/voteRecord';
import {
  parsePaRollCallSummary,
  parsePaVoteIndexLinks,
} from '../parsers/paVote';

const JURISDICTION = 'ocd-jurisdiction/country:us/state:pa/government';
const INDEX_URL = 'https://www.palegis.us/house/roll-calls';

export class PennsylvaniaVoteAdapter implements StateVoteAdapter {
  stateAbbr = 'PA';
  jurisdictionOcdId = JURISDICTION;
  adapterName = 'pa-palegis';

  async *discoverVotes(ctx: ScrapeContext): AsyncIterable<DiscoveredVote> {
    await ctx.rateLimiter.wait();
    let html: string;
    try {
      html = await ctx.httpClient.get(INDEX_URL);
    } catch {
      return;
    }

    const links = parsePaVoteIndexLinks(html, INDEX_URL);
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

    const parsed = parsePaRollCallSummary(html)[0];
    if (!parsed) {
      throw new Error('Could not parse PA roll call summary');
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
      billIdentifier: parsed.billIdentifier,
      sources: [{ url: discovered.sourceUrl }],
      rawContent: html,
      sourceUrl: discovered.sourceUrl,
    };
  }
}
