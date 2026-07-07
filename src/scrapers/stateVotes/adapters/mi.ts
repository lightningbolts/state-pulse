import type {
  DiscoveredVote,
  RawVotePayload,
  ScrapeContext,
  StateVoteAdapter,
  VoteChamber,
} from '@/types/voteRecord';
import { normalizeVoteDate } from '@/types/voteRecord';
import {
  miBillUrl,
  miRollCallUrl,
  parseMiBillRollCalls,
  parseMiRollCallPage,
  parseMiRollCallSummary,
} from '../parsers/miVote';

const JURISDICTION = 'ocd-jurisdiction/country:us/state:mi/government';
const MI_VOTE_YEAR = 2026;
const MAX_ROLL_CALLS_PER_CHAMBER = 50;
const MAX_DISCOVERED = 80;

export class MichiganVoteAdapter implements StateVoteAdapter {
  stateAbbr = 'MI';
  jurisdictionOcdId = JURISDICTION;
  adapterName = 'mi-michiganvotes';

  async *discoverVotes(ctx: ScrapeContext): AsyncIterable<DiscoveredVote> {
    const billDateCache = new Map<string, ReturnType<typeof parseMiBillRollCalls>>();
    let discovered = 0;

    for (const chamber of ['lower', 'upper'] as VoteChamber[]) {
      for (let rollCall = MAX_ROLL_CALLS_PER_CHAMBER; rollCall >= 1; rollCall--) {
        if (discovered >= MAX_DISCOVERED) return;

        const url = miRollCallUrl(MI_VOTE_YEAR, chamber, String(rollCall));
        await ctx.rateLimiter.wait();

        let html: string;
        try {
          html = await ctx.httpClient.get(url);
        } catch {
          continue;
        }

        const summary = parseMiRollCallSummary(html, url);
        if (!summary?.billObjectName) continue;

        const date = await this.resolveRollCallDate(
          summary.billObjectName,
          summary.rollCallNumber,
          ctx,
          billDateCache
        );
        if (date) {
          const voteDate = new Date(normalizeVoteDate(date));
          if (voteDate < ctx.since) continue;
        }

        const sourceId = `${chamber}-${rollCall}-${MI_VOTE_YEAR}`;
        yield {
          sourceId,
          sourceUrl: url,
          billIdentifier: summary.billIdentifier,
          rollCallNumber: summary.rollCallNumber,
          date,
          metadata: {
            rollCallUrl: url,
            voteDate: date ?? '',
            billObjectName: summary.billObjectName,
          },
        };
        discovered++;
      }
    }
  }

  private async resolveRollCallDate(
    billObjectName: string,
    rollCallNumber: string,
    ctx: ScrapeContext,
    cache: Map<string, ReturnType<typeof parseMiBillRollCalls>>
  ): Promise<string | undefined> {
    if (!cache.has(billObjectName)) {
      await ctx.rateLimiter.wait();
      try {
        const html = await ctx.httpClient.get(miBillUrl(billObjectName));
        cache.set(billObjectName, parseMiBillRollCalls(html, billObjectName));
      } catch {
        cache.set(billObjectName, []);
      }
    }

    return cache
      .get(billObjectName)
      ?.find((rollCall) => rollCall.rollCallNumber === rollCallNumber)?.date;
  }

  async fetchVoteDetail(
    discovered: DiscoveredVote,
    ctx: ScrapeContext
  ): Promise<RawVotePayload> {
    const detailUrl = discovered.metadata?.rollCallUrl ?? discovered.sourceUrl;
    await ctx.rateLimiter.wait();
    const html =
      discovered.metadata?.fixtureContent ??
      (await ctx.httpClient.get(detailUrl));
    const parsed = parseMiRollCallPage(html);
    const date = discovered.metadata?.voteDate || discovered.date || parsed.date;

    return {
      adapter: this.adapterName,
      jurisdiction: JURISDICTION,
      session: ctx.session,
      chamber: parsed.chamber,
      organization: parsed.organization,
      organizationType: parsed.organizationType,
      rollCallNumber: discovered.rollCallNumber ?? parsed.rollCallNumber,
      motionText: parsed.motionText,
      date,
      result: parsed.result,
      counts: parsed.counts,
      memberVotes: parsed.memberVotes,
      billIdentifier: parsed.billIdentifier ?? discovered.billIdentifier,
      sources: [
        { url: detailUrl, note: 'MichiganVotes roll call page' },
      ],
      rawContent: html,
      sourceUrl: detailUrl,
    };
  }
}
