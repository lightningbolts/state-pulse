import type {
  DiscoveredVote,
  RawVotePayload,
  ScrapeContext,
  StateVoteAdapter,
  VoteChamber,
} from '@/types/voteRecord';
import { normalizeVoteDate } from '@/types/voteRecord';
import {
  parseGenericChamberVoteDetail,
  parseVoteIndexLinks,
} from '../parsers/htmlVoteTable';

export interface ChamberHtmlAdapterConfig {
  stateAbbr: string;
  jurisdictionOcdId: string;
  adapterName: string;
  voteIndexUrl: string;
  linkPattern?: RegExp;
  chamber: VoteChamber;
  organization: string;
  defaultSession?: string;
}

export class ChamberHtmlVoteAdapter implements StateVoteAdapter {
  stateAbbr: string;
  jurisdictionOcdId: string;
  adapterName: string;
  private readonly config: ChamberHtmlAdapterConfig;

  constructor(config: ChamberHtmlAdapterConfig) {
    this.config = config;
    this.stateAbbr = config.stateAbbr;
    this.jurisdictionOcdId = config.jurisdictionOcdId;
    this.adapterName = config.adapterName;
  }

  async *discoverVotes(ctx: ScrapeContext): AsyncIterable<DiscoveredVote> {
    await ctx.rateLimiter.wait();
    let html: string;
    try {
      html = await ctx.httpClient.get(this.config.voteIndexUrl);
    } catch {
      return;
    }

    const links = parseVoteIndexLinks(
      html,
      this.config.voteIndexUrl,
      this.config.linkPattern
    );

    for (const link of links) {
      if (link.date) {
        const voteDate = new Date(normalizeVoteDate(link.date));
        if (voteDate < ctx.since) continue;
      }
      yield {
        sourceId: link.rollCallNumber ?? link.url,
        sourceUrl: link.url,
        rollCallNumber: link.rollCallNumber,
        date: link.date,
      };
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
    const parsed = parseGenericChamberVoteDetail(
      html,
      this.config.chamber,
      this.config.organization
    );

    return {
      adapter: this.adapterName,
      jurisdiction: this.jurisdictionOcdId,
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

function ocd(state: string): string {
  return `ocd-jurisdiction/country:us/state:${state.toLowerCase()}/government`;
}

export const WAVE2_ADAPTER_CONFIGS: ChamberHtmlAdapterConfig[] = [
  {
    stateAbbr: 'GA',
    jurisdictionOcdId: ocd('ga'),
    adapterName: 'ga-html',
    voteIndexUrl: 'https://www.legis.ga.gov/legislation/votes',
    chamber: 'lower',
    organization: 'House',
  },
];

export function createWave2Adapters(): ChamberHtmlVoteAdapter[] {
  return WAVE2_ADAPTER_CONFIGS.map((c) => new ChamberHtmlVoteAdapter(c));
}
