import type {
  DiscoveredVote,
  RawVotePayload,
  ScrapeContext,
  StateVoteAdapter,
} from '@/types/voteRecord';
import { normalizeVoteDate } from '@/types/voteRecord';
import {
  AZ_SESSION_ID,
  azBillApiUrl,
  azVoteApiUrl,
  fetchAzBillNumbers,
  parseAzVoteAction,
  type AzBillHeader,
  type AzVoteRecord,
} from '../parsers/azVote';

const JURISDICTION = 'ocd-jurisdiction/country:us/state:az/government';
const MAX_BILLS_PER_RUN = 60;

interface AzBillResponse {
  BillId?: number;
  Number?: string;
  FloorHeaders?: AzBillHeader[];
}

export class ArizonaVoteAdapter implements StateVoteAdapter {
  stateAbbr = 'AZ';
  jurisdictionOcdId = JURISDICTION;
  adapterName = 'az-api';

  async *discoverVotes(ctx: ScrapeContext): AsyncIterable<DiscoveredVote> {
    const billNumbers = (await fetchAzBillNumbers(AZ_SESSION_ID)).slice(
      -MAX_BILLS_PER_RUN
    );

    for (const billNumber of billNumbers) {
      const body = billNumber.startsWith('S') ? 'S' : 'H';
      await ctx.rateLimiter.wait();

      let bill: AzBillResponse;
      try {
        const bodyText = await ctx.httpClient.get(
          azBillApiUrl(billNumber, AZ_SESSION_ID, body)
        );
        bill = JSON.parse(bodyText);
      } catch {
        continue;
      }

      if (!bill.BillId || !bill.FloorHeaders?.length) continue;

      for (const header of bill.FloorHeaders) {
        if (header.ActionDate) {
          const voteDate = new Date(normalizeVoteDate(header.ActionDate.split('T')[0]));
          if (voteDate < ctx.since) continue;
        }
        if (!header.TotalVotes && !header.ActionDate) continue;

        yield {
          sourceId: `${billNumber}-${header.BillStatusActionId}`,
          sourceUrl: azVoteApiUrl(bill.BillId, header.BillStatusActionId),
          billIdentifier: bill.Number ?? billNumber,
          date: header.ActionDate?.split('T')[0],
          rollCallNumber: String(header.BillStatusActionId),
          metadata: {
            billStatusId: bill.BillId,
            header,
            billNumber: bill.Number ?? billNumber,
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
    const body =
      discovered.metadata?.fixtureContent ??
      (await ctx.httpClient.get(discovered.sourceUrl));

    const actions = JSON.parse(body) as AzVoteRecord[];
    const header = discovered.metadata?.header as AzBillHeader | undefined;
    const billNumber =
      (discovered.metadata?.billNumber as string) ?? discovered.billIdentifier ?? '';

    const action = actions[0];
    if (!action || !header) {
      throw new Error('AZ vote response missing action data');
    }

    const parsed = parseAzVoteAction(action, billNumber, header);

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
      rawContent: body,
      sourceUrl: discovered.sourceUrl,
    };
  }
}
