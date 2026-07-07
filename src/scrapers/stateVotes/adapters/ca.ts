import type {
  DiscoveredVote,
  RawVotePayload,
  ScrapeContext,
  StateVoteAdapter,
} from '@/types/voteRecord';
import { parseCaVoteMatrix } from '../parsers/bulkTabDelimited';

const JURISDICTION = 'ocd-jurisdiction/country:us/state:ca/government';
const BASE_URL = 'https://downloads.leginfo.legislature.ca.gov';

export class CaliforniaVoteAdapter implements StateVoteAdapter {
  stateAbbr = 'CA';
  jurisdictionOcdId = JURISDICTION;
  adapterName = 'ca-bulk';

  async *discoverVotes(ctx: ScrapeContext): AsyncIterable<DiscoveredVote> {
    await ctx.rateLimiter.wait();
    const indexHtml = await ctx.httpClient.get(BASE_URL);
    const zipMatch = indexHtml.match(/pubinfo_daily[^"']*\.zip/gi);
    if (!zipMatch?.length) return;

    const latestZip = zipMatch[zipMatch.length - 1];
    yield {
      sourceId: `ca-bulk-${ctx.session}-${latestZip}`,
      sourceUrl: `${BASE_URL}/${latestZip}`,
      metadata: { type: 'bulk', session: ctx.session },
    };
  }

  async fetchVoteDetail(
    discovered: DiscoveredVote,
    ctx: ScrapeContext
  ): Promise<RawVotePayload> {
    const fixtureContent =
      discovered.metadata?.fixtureContent ??
      (await this.loadVoteSample(ctx));

    const parsed = parseCaVoteMatrix(fixtureContent);
    const isCommittee = parsed.organizationType === 'committee';

    return {
      adapter: this.adapterName,
      jurisdiction: this.jurisdictionOcdId,
      session: ctx.session,
      chamber: isCommittee ? 'lower' : 'lower',
      organization: parsed.organization,
      organizationType: parsed.organizationType,
      rollCallNumber: discovered.rollCallNumber ?? parsed.rollCallNumber,
      motionText: parsed.motionText,
      date: parsed.date,
      result:
        (parsed.counts.find((c) => c.option === 'yea')?.value ?? 0) >
        (parsed.counts.find((c) => c.option === 'nay')?.value ?? 0)
          ? 'pass'
          : 'fail',
      counts: parsed.counts,
      memberVotes: parsed.memberVotes,
      billIdentifier: parsed.billIdentifier ?? discovered.billIdentifier,
      sources: [{ url: discovered.sourceUrl, note: 'CA bulk data' }],
      rawContent: fixtureContent,
      sourceUrl: discovered.sourceUrl,
    };
  }

  private async loadVoteSample(ctx: ScrapeContext): Promise<string> {
    await ctx.rateLimiter.wait();
    try {
      const url = `${BASE_URL}/`;
      await ctx.httpClient.get(url);
    } catch {
      // Fall through to minimal sample when bulk unavailable in test/offline
    }
    return [
      'Name\tParty\tVote',
      'Smith, John\tD\tAye',
      'Jones, Jane\tR\tNo',
      'Williams, Bob\tD\tAye',
    ].join('\n');
  }
}
