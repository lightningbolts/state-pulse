import type {
  DiscoveredVote,
  RawVotePayload,
  ScrapeContext,
  StateVoteAdapter,
} from '@/types/voteRecord';
import { normalizeVoteDate } from '@/types/voteRecord';
import {
  WA_YEAR,
  waBillHasRollCalls,
  waBillSummaryUrl,
  waRollCallsUrl,
  waVoteToParseResult,
  parseWaRollCallsPage,
} from '../parsers/waVote';

const JURISDICTION = 'ocd-jurisdiction/country:us/state:wa/government';
const BILL_MIN = 1000;
const BILL_MAX = 2600;
const MAX_BILL_PAGES = 50;
const MAX_DISCOVERED = 100;

export class WashingtonVoteAdapter implements StateVoteAdapter {
  stateAbbr = 'WA';
  jurisdictionOcdId = JURISDICTION;
  adapterName = 'wa-app-leg-wa';

  async *discoverVotes(ctx: ScrapeContext): AsyncIterable<DiscoveredVote> {
    let pagesScanned = 0;
    let discovered = 0;

    for (let billNumber = BILL_MAX; billNumber >= BILL_MIN; billNumber--) {
      if (pagesScanned >= MAX_BILL_PAGES || discovered >= MAX_DISCOVERED) break;

      await ctx.rateLimiter.wait();
      pagesScanned++;

      let summaryHtml: string;
      try {
        summaryHtml = await ctx.httpClient.get(waBillSummaryUrl(billNumber, WA_YEAR));
      } catch {
        continue;
      }

      if (!waBillHasRollCalls(summaryHtml)) continue;

      await ctx.rateLimiter.wait();
      let rollCallsHtml: string;
      try {
        rollCallsHtml = await ctx.httpClient.get(waRollCallsUrl(billNumber));
      } catch {
        continue;
      }

      for (const vote of parseWaRollCallsPage(rollCallsHtml, billNumber)) {
        if (vote.date) {
          const voteDate = new Date(normalizeVoteDate(vote.date));
          if (voteDate < ctx.since) continue;
        }

        const sourceId = `hb${billNumber}-${vote.chamber}-${vote.date}-${vote.transcriptNo ?? vote.motionText}`;
        yield {
          sourceId,
          sourceUrl: vote.rollCallsUrl,
          billIdentifier: vote.billIdentifier,
          rollCallNumber: vote.transcriptNo,
          date: vote.date,
          metadata: {
            billNumber: String(billNumber),
            chamber: vote.chamber,
            voteDate: vote.date,
            waVote: JSON.stringify(vote),
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
    const rowJson = discovered.metadata?.waVote;
    if (rowJson) {
      const parsed = waVoteToParseResult(JSON.parse(rowJson));
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

    const billNumber = discovered.metadata?.billNumber;
    const chamber = discovered.metadata?.chamber as 'lower' | 'upper' | undefined;
    const date = discovered.metadata?.voteDate ?? discovered.date;
    if (!billNumber || !chamber || !date) {
      throw new Error(`WA vote metadata missing for ${discovered.sourceId}`);
    }

    await ctx.rateLimiter.wait();
    const html = await ctx.httpClient.get(waRollCallsUrl(billNumber));
    const parsed = parseWaRollCallsPage(html, billNumber).find(
      (vote) => vote.date === date && vote.chamber === chamber
    );
    if (!parsed) {
      throw new Error(`WA vote not found for ${discovered.sourceId}`);
    }
    const result = waVoteToParseResult(parsed);

    return {
      adapter: this.adapterName,
      jurisdiction: JURISDICTION,
      session: ctx.session,
      chamber: result.chamber,
      organization: result.organization,
      organizationType: result.organizationType,
      rollCallNumber: discovered.rollCallNumber ?? result.rollCallNumber,
      motionText: result.motionText,
      date: result.date,
      result: result.result,
      counts: result.counts,
      memberVotes: result.memberVotes,
      billIdentifier: result.billIdentifier ?? discovered.billIdentifier,
      sources: [{ url: discovered.sourceUrl }],
      rawContent: html,
      sourceUrl: discovered.sourceUrl,
    };
  }
}
