import type {
  DiscoveredVote,
  RawVotePayload,
  ScrapeContext,
  StateVoteAdapter,
} from '@/types/voteRecord';
import { normalizeVoteDate } from '@/types/voteRecord';
import { fetchOpenStatesBillsPaginated } from '../openStatesClient';
import {
  CO_OPENSTATES_SESSION,
  coBillUrl,
  parseCoBillVoteLinks,
  parseCoFloorVote,
  toCoBillSlug,
} from '../parsers/coVote';

const JURISDICTION = 'ocd-jurisdiction/country:us/state:co/government';
const MAX_BILLS_PER_RUN = 60;

export class ColoradoVoteAdapter implements StateVoteAdapter {
  stateAbbr = 'CO';
  jurisdictionOcdId = JURISDICTION;
  adapterName = 'co-leg-colorado';

  constructor(private readonly openStatesApiKey?: string) {}

  async *discoverVotes(ctx: ScrapeContext): AsyncIterable<DiscoveredVote> {
    const apiKey = this.openStatesApiKey ?? process.env.OPENSTATES_API_KEY;
    if (!apiKey) {
      console.warn('[CO] Skipping: set OPENSTATES_API_KEY for bill discovery');
      return;
    }

    const bills = (
      await fetchOpenStatesBillsPaginated(JURISDICTION, apiKey, {
        session: CO_OPENSTATES_SESSION,
        maxPages: 3,
        perPage: 20,
        sort: 'updated_desc',
      })
    ).slice(0, MAX_BILLS_PER_RUN);

    for (const bill of bills) {
      const slug = toCoBillSlug(bill.identifier);
      const url = coBillUrl(slug);
      await ctx.rateLimiter.wait();

      let html: string;
      try {
        html = await ctx.httpClient.get(url);
      } catch {
        continue;
      }

      const links = parseCoBillVoteLinks(html, slug);
      for (const link of links) {
        if (link.date) {
          const voteDate = new Date(normalizeVoteDate(link.date));
          if (voteDate < ctx.since) continue;
        }

        yield {
          sourceId: link.voteId,
          sourceUrl: link.url,
          billIdentifier: link.billIdentifier ?? bill.identifier,
          date: link.date,
          rollCallNumber: link.voteId,
          metadata: {
            motionText: link.motionText ?? '',
            calendar: link.calendar ?? '',
          },
        };
      }
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
    const parsed = parseCoFloorVote(html);

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
