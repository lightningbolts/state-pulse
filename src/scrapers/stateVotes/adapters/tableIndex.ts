import type {
  DiscoveredVote,
  RawVotePayload,
  ScrapeContext,
  StateVoteAdapter,
  VoteChamber,
} from '@/types/voteRecord';
import { normalizeVoteDate } from '@/types/voteRecord';
import {
  parseTableIndexVotes,
  tableRowToCounts,
  type TableIndexParserConfig,
} from '../parsers/tableIndexVote';

export interface TableIndexAdapterConfig {
  stateAbbr: string;
  jurisdictionOcdId: string;
  adapterName: string;
  voteIndexUrl: string;
  chamber: VoteChamber;
  organization: string;
  parserConfig?: Partial<TableIndexParserConfig>;
}

export class TableIndexVoteAdapter implements StateVoteAdapter {
  stateAbbr: string;
  jurisdictionOcdId: string;
  adapterName: string;
  private readonly config: TableIndexAdapterConfig;

  constructor(config: TableIndexAdapterConfig) {
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

    const rows = parseTableIndexVotes(
      html,
      this.config.voteIndexUrl,
      this.config.parserConfig
    );

    for (const row of rows) {
      const voteDate = new Date(normalizeVoteDate(row.date));
      if (voteDate < ctx.since) continue;

      yield {
        sourceId: row.rollCallNumber,
        sourceUrl: row.detailUrl ?? this.config.voteIndexUrl,
        rollCallNumber: row.rollCallNumber,
        billIdentifier: row.billIdentifier,
        date: row.date,
        metadata: { tableRow: row },
      };
    }
  }

  async fetchVoteDetail(
    discovered: DiscoveredVote,
    ctx: ScrapeContext
  ): Promise<RawVotePayload> {
    const row = discovered.metadata?.tableRow as
      | ReturnType<typeof parseTableIndexVotes>[number]
      | undefined;

    if (!row) {
      throw new Error('Table index vote missing row metadata');
    }

    return {
      adapter: this.adapterName,
      jurisdiction: this.jurisdictionOcdId,
      session: ctx.session,
      chamber: this.config.chamber,
      organization: this.config.organization,
      organizationType: 'chamber',
      rollCallNumber: row.rollCallNumber,
      motionText: row.motionText,
      date: row.date,
      result: row.result,
      counts: tableRowToCounts(row),
      memberVotes: [],
      billIdentifier: row.billIdentifier,
      sources: [{ url: discovered.sourceUrl }],
    };
  }
}

function ocd(state: string): string {
  return `ocd-jurisdiction/country:us/state:${state.toLowerCase()}/government`;
}

export const TABLE_INDEX_ADAPTER_CONFIGS: TableIndexAdapterConfig[] = [
  {
    stateAbbr: 'SC',
    jurisdictionOcdId: ocd('sc'),
    adapterName: 'sc-table-index',
    voteIndexUrl: 'https://www.scstatehouse.gov/votehistory.php?chamber=H',
    chamber: 'lower',
    organization: 'House',
    parserConfig: { detailLinkPattern: /KEY=/i },
  },
  {
    stateAbbr: 'RI',
    jurisdictionOcdId: ocd('ri'),
    adapterName: 'ri-table-index',
    voteIndexUrl:
      'https://webserver.rilegislature.gov/votes/voteReport.aspx?chamber=H&year=2025',
    chamber: 'lower',
    organization: 'House',
    parserConfig: {
      detailLinkPattern: /VoteReport/i,
      dateColumn: 2,
      yeaColumns: [3],
      nayColumns: [4],
      resultColumn: 6,
      billColumn: 1,
      motionColumn: 2,
    },
  },
];

export function createTableIndexAdapters(): TableIndexVoteAdapter[] {
  return TABLE_INDEX_ADAPTER_CONFIGS.map((c) => new TableIndexVoteAdapter(c));
}
