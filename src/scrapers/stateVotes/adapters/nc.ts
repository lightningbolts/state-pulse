import type {
  DiscoveredVote,
  RawVotePayload,
  ScrapeContext,
  StateVoteAdapter,
} from '@/types/voteRecord';
import { normalizeVoteDate } from '@/types/voteRecord';
import {
  parseNcRollCallHistory,
  parseNcRollCallTranscript,
} from '../parsers/ncVote';

const JURISDICTION = 'ocd-jurisdiction/country:us/state:nc/government';
const BASE_URL = 'https://www.ncleg.gov';

export class NorthCarolinaVoteAdapter implements StateVoteAdapter {
  stateAbbr = 'NC';
  jurisdictionOcdId = JURISDICTION;
  adapterName = 'nc-html';

  async *discoverVotes(ctx: ScrapeContext): AsyncIterable<DiscoveredVote> {
    const sessionYear = ctx.session.match(/\d{4}/)?.[0] ?? String(new Date().getFullYear());
    const chambers: Array<'H' | 'S'> = ['H', 'S'];

    for (const chamberCode of chambers) {
      const historyUrl = `${BASE_URL}/Legislation/Votes/RollCallVoteHistory/${sessionYear}/${chamberCode}`;
      await ctx.rateLimiter.wait();
      let html: string;
      try {
        html = await ctx.httpClient.get(historyUrl);
      } catch {
        continue;
      }

      const rollCalls = parseNcRollCallHistory(html, sessionYear, chamberCode);
      for (const rc of rollCalls) {
        const voteDate = new Date(normalizeVoteDate(rc.date));
        if (voteDate < ctx.since) continue;

        yield {
          sourceId: `${chamberCode}-${rc.rollCallNumber}`,
          sourceUrl: rc.transcriptUrl,
          rollCallNumber: rc.rollCallNumber,
          date: rc.date,
          billIdentifier: rc.billIdentifier,
          organization: rc.organization,
          organizationType: 'chamber',
          metadata: {
            chamberCode,
            motionText: rc.motionText,
            result: rc.result,
            counts: JSON.stringify(rc.counts),
            historyUrl,
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

    const memberVotes = parseNcRollCallTranscript(html);
    const chamberCode = (discovered.metadata?.chamberCode ?? 'H') as 'H' | 'S';
    const counts = discovered.metadata?.counts
      ? JSON.parse(discovered.metadata.counts)
      : undefined;

    return {
      adapter: this.adapterName,
      jurisdiction: this.jurisdictionOcdId,
      session: ctx.session,
      chamber: chamberCode === 'S' ? 'upper' : 'lower',
      organization: discovered.organization ?? (chamberCode === 'S' ? 'Senate' : 'House'),
      organizationType: 'chamber',
      rollCallNumber: discovered.rollCallNumber,
      motionText: discovered.metadata?.motionText ?? 'Roll call vote',
      date: discovered.date ?? new Date().toISOString().split('T')[0],
      result: (discovered.metadata?.result as 'pass' | 'fail' | 'unknown') ?? 'unknown',
      counts,
      memberVotes,
      billIdentifier: discovered.billIdentifier,
      sources: [
        { url: discovered.sourceUrl, note: 'NC roll call transcript' },
        ...(discovered.metadata?.historyUrl
          ? [{ url: discovered.metadata.historyUrl, note: 'NC roll call history' }]
          : []),
      ],
      rawContent: html,
      sourceUrl: discovered.sourceUrl,
    };
  }
}
