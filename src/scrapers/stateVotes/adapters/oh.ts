import type {
  DiscoveredVote,
  RawVotePayload,
  ScrapeContext,
  StateVoteAdapter,
} from '@/types/voteRecord';
import { normalizeVoteDate } from '@/types/voteRecord';
import {
  ohBillHasVotes,
  ohBillVotesUrl,
  ohVoteToParseResult,
  parseOhBillVoteDetail,
  parseOhBillVotesPage,
} from '../parsers/ohVote';

const JURISDICTION = 'ocd-jurisdiction/country:us/state:oh/government';
const MAX_BILL_PAGES = 40;
const MAX_DISCOVERED = 120;
const HB_MAX = 120;
const SB_MAX = 80;

function buildBillSlugs(): string[] {
  const slugs: string[] = [];
  for (let n = 1; n <= HB_MAX; n++) slugs.push(`hb${n}`);
  for (let n = 1; n <= SB_MAX; n++) slugs.push(`sb${n}`);
  return slugs;
}

export class OhioVoteAdapter implements StateVoteAdapter {
  stateAbbr = 'OH';
  jurisdictionOcdId = JURISDICTION;
  adapterName = 'oh-legislature-votes';

  async *discoverVotes(ctx: ScrapeContext): AsyncIterable<DiscoveredVote> {
    let pagesScanned = 0;
    let discovered = 0;

    for (const billSlug of buildBillSlugs()) {
      if (pagesScanned >= MAX_BILL_PAGES || discovered >= MAX_DISCOVERED) break;

      await ctx.rateLimiter.wait();
      pagesScanned++;

      let html: string;
      try {
        html = await ctx.httpClient.get(ohBillVotesUrl(billSlug));
      } catch {
        continue;
      }

      if (!ohBillHasVotes(html)) continue;

      const votes = parseOhBillVotesPage(html, billSlug);
      for (const vote of votes) {
        if (vote.date) {
          const voteDate = new Date(normalizeVoteDate(vote.date));
          if (voteDate < ctx.since) continue;
        }

        const sourceId = `${vote.billSlug}-${vote.breakdownId}`;
        yield {
          sourceId,
          sourceUrl: ohBillVotesUrl(billSlug),
          billIdentifier: vote.billIdentifier,
          rollCallNumber: sourceId,
          date: vote.date,
          metadata: {
            billSlug: vote.billSlug,
            breakdownId: vote.breakdownId,
            ohVote: JSON.stringify(vote),
          },
        };
        discovered++;
      }
    }
  }

  async fetchVoteDetail(
    discovered: DiscoveredVote,
    ctx: ScrapeContext
  ): Promise<RawVotePayload> {
    const rowJson = discovered.metadata?.ohVote;
    if (rowJson) {
      const parsed = ohVoteToParseResult(JSON.parse(rowJson));
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
        rawContent: rowJson,
        sourceUrl: discovered.sourceUrl,
      };
    }

    const billSlug = discovered.metadata?.billSlug;
    const breakdownId = discovered.metadata?.breakdownId;
    if (!billSlug || !breakdownId) {
      throw new Error(`OH vote metadata missing for ${discovered.sourceId}`);
    }

    await ctx.rateLimiter.wait();
    const html =
      discovered.metadata?.fixtureContent ??
      (await ctx.httpClient.get(ohBillVotesUrl(billSlug)));
    const parsed = parseOhBillVoteDetail(html, billSlug, breakdownId);

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
