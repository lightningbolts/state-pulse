import type {
  DiscoveredVote,
  RawVotePayload,
  ScrapeContext,
  StateVoteAdapter,
} from '@/types/voteRecord';
import { parseWiVoteDetail, parseWiVoteIndexLinks } from '../parsers/wiVote';

const JURISDICTION = 'ocd-jurisdiction/country:us/state:wi/government';
const MAX_VOTES_PER_RUN = 25;

function legislativeYear(): string {
  return String(new Date().getFullYear() - 1);
}

export class WisconsinVoteAdapter implements StateVoteAdapter {
  stateAbbr = 'WI';
  jurisdictionOcdId = JURISDICTION;
  adapterName = 'wi-docs';

  private indexUrl(): string {
    return `https://docs.legis.wisconsin.gov/${legislativeYear()}/related/votes/assembly`;
  }

  async *discoverVotes(ctx: ScrapeContext): AsyncIterable<DiscoveredVote> {
    await ctx.rateLimiter.wait();
    const indexUrl = this.indexUrl();
    let html: string;
    try {
      html = await ctx.httpClient.get(indexUrl);
    } catch {
      return;
    }

    const links = parseWiVoteIndexLinks(html, indexUrl).slice(-MAX_VOTES_PER_RUN);
    for (const link of links) {
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

    const parsed = parseWiVoteDetail(html);

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
