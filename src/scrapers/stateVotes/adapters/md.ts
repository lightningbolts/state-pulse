import type {
  DiscoveredVote,
  RawVotePayload,
  ScrapeContext,
  StateVoteAdapter,
} from '@/types/voteRecord';
import { normalizeVoteDate } from '@/types/voteRecord';
import {
  MD_SESSION_YEAR,
  mdFloorIndexBody,
  mdFloorIndexUrl,
  mdVoteToParseResult,
  parseMdFloorActionIndex,
  parseMdMediaVotes,
  type MdVoteRow,
} from '../parsers/mdVote';

const JURISDICTION = 'ocd-jurisdiction/country:us/state:md/government';
const MAX_PROCEEDINGS_PER_RUN = 20;

export class MarylandVoteAdapter implements StateVoteAdapter {
  stateAbbr = 'MD';
  jurisdictionOcdId = JURISDICTION;
  adapterName = 'md-floor-actions';

  async *discoverVotes(ctx: ScrapeContext): AsyncIterable<DiscoveredVote> {
    const postForm = ctx.httpClient.postForm?.bind(ctx.httpClient);
    if (!postForm) {
      console.warn('[MD] Skipping: HTTP client does not support postForm');
      return;
    }

    await ctx.rateLimiter.wait();
    let indexHtml: string;
    try {
      indexHtml = await postForm(
        mdFloorIndexUrl(),
        mdFloorIndexBody(MD_SESSION_YEAR, 'House'),
        {
          headers: {
            Referer: `https://mgaleg.maryland.gov/mgawebsite/FloorActions/Index/house`,
          },
        }
      );
    } catch {
      return;
    }

    const proceedings = parseMdFloorActionIndex(indexHtml)
      .filter((p) => {
        if (!p.date) return true;
        return new Date(normalizeVoteDate(p.date)) >= ctx.since;
      })
      .slice(-MAX_PROCEEDINGS_PER_RUN);

    for (const proceeding of proceedings) {
      await ctx.rateLimiter.wait();
      let mediaHtml: string;
      try {
        mediaHtml = await ctx.httpClient.get(proceeding.mediaUrl);
      } catch {
        continue;
      }

      const votes = parseMdMediaVotes(mediaHtml, proceeding);
      for (const vote of votes) {
        if (vote.date) {
          const voteDate = new Date(normalizeVoteDate(vote.date));
          if (voteDate < ctx.since) continue;
        }

        yield {
          sourceId: `house-${vote.rollCallNumber}`,
          sourceUrl: vote.voteUrl,
          rollCallNumber: vote.rollCallNumber,
          billIdentifier: vote.billIdentifier,
          date: vote.date,
          metadata: { mdVote: JSON.stringify(vote) },
        };
      }
    }
  }

  async fetchVoteDetail(
    discovered: DiscoveredVote,
    ctx: ScrapeContext
  ): Promise<RawVotePayload> {
    const rowJson = discovered.metadata?.mdVote;
    const row = rowJson
      ? (JSON.parse(rowJson) as MdVoteRow)
      : undefined;
    if (!row) {
      throw new Error(`MD vote metadata missing for ${discovered.sourceId}`);
    }

    const parsed = mdVoteToParseResult(row);

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
}
