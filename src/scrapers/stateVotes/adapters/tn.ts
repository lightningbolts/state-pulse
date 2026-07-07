import type {
  DiscoveredVote,
  RawVotePayload,
  ScrapeContext,
  StateVoteAdapter,
} from '@/types/voteRecord';
import { normalizeVoteDate } from '@/types/voteRecord';
import { fetchOpenStatesBillsPaginated } from '../openStatesClient';
import {
  parseTnBillVotes,
  TN_GENERAL_ASSEMBLY,
  tnBillUrl,
  toTnBillNumber,
} from '../parsers/tnVote';

const JURISDICTION = 'ocd-jurisdiction/country:us/state:tn/government';
const MAX_BILLS_PER_RUN = 75;

export class TennesseeVoteAdapter implements StateVoteAdapter {
  stateAbbr = 'TN';
  jurisdictionOcdId = JURISDICTION;
  adapterName = 'tn-billinfo';

  constructor(private readonly openStatesApiKey?: string) {}

  async *discoverVotes(ctx: ScrapeContext): AsyncIterable<DiscoveredVote> {
    const apiKey = this.openStatesApiKey ?? process.env.OPENSTATES_API_KEY;
    if (!apiKey) {
      console.warn('[TN] Skipping: set OPENSTATES_API_KEY for bill discovery');
      return;
    }

    const bills = (
      await fetchOpenStatesBillsPaginated(JURISDICTION, apiKey, {
        session: TN_GENERAL_ASSEMBLY,
        maxPages: 4,
        perPage: 20,
        sort: 'updated_desc',
      })
    ).slice(0, MAX_BILLS_PER_RUN);

    for (const bill of bills) {
      const billNumber = toTnBillNumber(bill.identifier);
      const url = tnBillUrl(billNumber);

      await ctx.rateLimiter.wait();
      let html: string;
      try {
        html = await ctx.httpClient.get(url);
      } catch {
        continue;
      }

      const votes = parseTnBillVotes(html);
      for (let i = 0; i < votes.length; i++) {
        const vote = votes[i];
        const voteDate = new Date(normalizeVoteDate(vote.date));
        if (voteDate < ctx.since) continue;

        yield {
          sourceId: `${billNumber}-vote-${i}`,
          sourceUrl: url,
          billIdentifier: vote.billIdentifier ?? bill.identifier,
          date: vote.date,
          rollCallNumber: vote.rollCallNumber,
          metadata: { voteIndex: i, fixtureContent: html },
        };
      }
    }
  }

  async fetchVoteDetail(
    discovered: DiscoveredVote,
    ctx: ScrapeContext
  ): Promise<RawVotePayload> {
    const html =
      discovered.metadata?.fixtureContent ??
      (await ctx.httpClient.get(discovered.sourceUrl));
    const voteIndex = Number(discovered.metadata?.voteIndex ?? 0);
    const votes = parseTnBillVotes(html);
    const parsed = votes[voteIndex];
    if (!parsed) {
      throw new Error(`TN vote index ${voteIndex} not found`);
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
      billIdentifier: parsed.billIdentifier ?? discovered.billIdentifier,
      sources: [{ url: discovered.sourceUrl }],
      rawContent: html,
      sourceUrl: discovered.sourceUrl,
    };
  }
}
