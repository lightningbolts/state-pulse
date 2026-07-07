import type {
  DiscoveredVote,
  RawVotePayload,
  ScrapeContext,
  StateVoteAdapter,
} from '@/types/voteRecord';
import { normalizeVoteDate } from '@/types/voteRecord';
import {
  MO_SESSION_CODE,
  MO_SESSION_YEAR,
  moBillActionsUrl,
  moVoteToParseResult,
  parseMoBillActions,
} from '../parsers/moVote';

const JURISDICTION = 'ocd-jurisdiction/country:us/state:mo/government';
const HB_MAX = 200;
const MAX_BILL_PAGES = 60;
const MAX_DISCOVERED = 120;

function buildBillSlugs(): string[] {
  const slugs: string[] = [];
  for (let n = 1; n <= HB_MAX; n++) slugs.push(`HB${n}`);
  return slugs;
}

export class MissouriVoteAdapter implements StateVoteAdapter {
  stateAbbr = 'MO';
  jurisdictionOcdId = JURISDICTION;
  adapterName = 'mo-house-actions';

  async *discoverVotes(ctx: ScrapeContext): AsyncIterable<DiscoveredVote> {
    let pagesScanned = 0;
    let discovered = 0;

    for (const billSlug of buildBillSlugs()) {
      if (pagesScanned >= MAX_BILL_PAGES || discovered >= MAX_DISCOVERED) break;

      await ctx.rateLimiter.wait();
      pagesScanned++;

      const url = moBillActionsUrl(billSlug, MO_SESSION_YEAR, MO_SESSION_CODE);
      let html: string;
      try {
        html = await ctx.httpClient.get(url);
      } catch {
        continue;
      }

      const votes = parseMoBillActions(html, billSlug, url);
      for (const vote of votes) {
        if (vote.date) {
          const voteDate = new Date(normalizeVoteDate(vote.date));
          if (voteDate < ctx.since) continue;
        }

        const sourceId = `${vote.billSlug}-${vote.date}-${vote.chamber}-${vote.motionText.slice(0, 24)}`;
        yield {
          sourceId,
          sourceUrl: url,
          billIdentifier: vote.billIdentifier,
          date: vote.date,
          metadata: {
            billSlug: vote.billSlug,
            moVote: JSON.stringify(vote),
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
    const rowJson = discovered.metadata?.moVote;
    if (!rowJson) {
      throw new Error(`MO vote metadata missing for ${discovered.sourceId}`);
    }

    const parsed = moVoteToParseResult(JSON.parse(rowJson));

    return {
      adapter: this.adapterName,
      jurisdiction: JURISDICTION,
      session: ctx.session,
      chamber: parsed.chamber,
      organization: parsed.organization,
      organizationType: parsed.organizationType,
      rollCallNumber: parsed.rollCallNumber,
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
