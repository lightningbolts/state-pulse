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
    stateAbbr: 'MN',
    jurisdictionOcdId: ocd('mn'),
    adapterName: 'mn-html',
    voteIndexUrl: 'https://www.house.mn.gov/votes/getvotes.asp',
    linkPattern: /getvote/i,
    chamber: 'lower',
    organization: 'House',
  },
  {
    stateAbbr: 'PA',
    jurisdictionOcdId: ocd('pa'),
    adapterName: 'pa-html',
    voteIndexUrl: 'https://www.legis.state.pa.us/cfdocs/legis/RC/RC_index.cfm',
    chamber: 'lower',
    organization: 'House',
  },
  {
    stateAbbr: 'OH',
    jurisdictionOcdId: ocd('oh'),
    adapterName: 'oh-html',
    voteIndexUrl: 'https://www.legislature.ohio.gov/legislation/votes',
    chamber: 'lower',
    organization: 'House',
  },
  {
    stateAbbr: 'MI',
    jurisdictionOcdId: ocd('mi'),
    adapterName: 'mi-html',
    voteIndexUrl: 'https://www.legislature.mi.gov/Home/VoteSearch',
    chamber: 'lower',
    organization: 'House',
  },
  {
    stateAbbr: 'GA',
    jurisdictionOcdId: ocd('ga'),
    adapterName: 'ga-html',
    voteIndexUrl: 'https://www.legis.ga.gov/legislation/votes',
    chamber: 'lower',
    organization: 'House',
  },
  {
    stateAbbr: 'VA',
    jurisdictionOcdId: ocd('va'),
    adapterName: 'va-html',
    voteIndexUrl: 'https://lis.virginia.gov/cgi-bin/legp604.exe?000+vot+HTC',
    chamber: 'lower',
    organization: 'House',
  },
  {
    stateAbbr: 'WA',
    jurisdictionOcdId: ocd('wa'),
    adapterName: 'wa-html',
    voteIndexUrl: 'https://app.leg.wa.gov/billsummary/Home/Votes',
    chamber: 'lower',
    organization: 'House',
  },
  {
    stateAbbr: 'CO',
    jurisdictionOcdId: ocd('co'),
    adapterName: 'co-html',
    voteIndexUrl: 'https://leg.colorado.gov/bills/votes',
    chamber: 'lower',
    organization: 'House',
  },
  {
    stateAbbr: 'AZ',
    jurisdictionOcdId: ocd('az'),
    adapterName: 'az-html',
    voteIndexUrl: 'https://apps.azleg.gov/BillStatusVote/',
    chamber: 'lower',
    organization: 'House',
  },
  {
    stateAbbr: 'WI',
    jurisdictionOcdId: ocd('wi'),
    adapterName: 'wi-html',
    voteIndexUrl: 'https://docs.legis.wisconsin.gov/assembly/votes',
    chamber: 'lower',
    organization: 'Assembly',
  },
  {
    stateAbbr: 'MO',
    jurisdictionOcdId: ocd('mo'),
    adapterName: 'mo-html',
    voteIndexUrl: 'https://house.mo.gov/BillActions.aspx?filter=votes',
    chamber: 'lower',
    organization: 'House',
  },
  {
    stateAbbr: 'TN',
    jurisdictionOcdId: ocd('tn'),
    adapterName: 'tn-html',
    voteIndexUrl: 'https://wapp.capitol.tn.gov/apps/votehistory/',
    chamber: 'lower',
    organization: 'House',
  },
  {
    stateAbbr: 'IN',
    jurisdictionOcdId: ocd('in'),
    adapterName: 'in-html',
    voteIndexUrl: 'https://iga.in.gov/legislative/roll-call/votes',
    chamber: 'lower',
    organization: 'House',
  },
  {
    stateAbbr: 'MD',
    jurisdictionOcdId: ocd('md'),
    adapterName: 'md-html',
    voteIndexUrl: 'https://mgaleg.maryland.gov/mgawebsite/Votes/House',
    chamber: 'lower',
    organization: 'House',
  },
];

export function createWave2Adapters(): ChamberHtmlVoteAdapter[] {
  return WAVE2_ADAPTER_CONFIGS.map((c) => new ChamberHtmlVoteAdapter(c));
}
