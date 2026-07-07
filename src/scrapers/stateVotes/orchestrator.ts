import { linkBillIdentifier } from './billLinker';
import { normalizeRawVote } from './normalizer';
import { createPersonResolver } from './personResolver';
import type { StateAdapterRegistry } from './index';
import {
  canonicalToStorageRecord,
  upsertStateVotingRecord,
} from '@/services/votingRecordService';
import {
  checkScrapeHealth,
  updateVoteCoverage,
} from '@/services/voteCoverageService';
import type {
  CanonicalVoteRecord,
  IngestionStats,
  ScrapeContext,
  StateVoteAdapter,
} from '@/types/voteRecord';
import { dedupeVoteRecords } from '@/types/voteRecord';
import { FetchHttpClient, SimpleRateLimiter } from './httpClient';
import { fetchNcLegislators } from './rosters/ncLegislators';

const NC_JURISDICTION = 'ocd-jurisdiction/country:us/state:nc/government';

export interface OrchestratorOptions {
  registry: StateAdapterRegistry;
  states?: string[];
  sessionByState?: Record<string, string>;
  since?: Date;
  openStatesApiKey?: string;
  onProgress?: (message: string) => void;
}

export interface StateIngestionResult extends IngestionStats {
  state: string;
  adapter: string;
}

function defaultSession(): string {
  return String(new Date().getFullYear());
}

export class VoteIngestionOrchestrator {
  constructor(private readonly options: OrchestratorOptions) {}

  async run(): Promise<StateIngestionResult[]> {
    const adapters = this.options.registry.getByStates(this.options.states);
    const results: StateIngestionResult[] = [];
    const personResolver = createPersonResolver(this.options.openStatesApiKey);

    for (const adapter of adapters) {
      const result = await this.runAdapter(adapter, personResolver);
      results.push(result);
    }

    return results;
  }

  async runAdapter(
    adapter: StateVoteAdapter,
    personResolver = createPersonResolver(this.options.openStatesApiKey)
  ): Promise<StateIngestionResult> {
    const stats: StateIngestionResult = {
      state: adapter.stateAbbr,
      adapter: adapter.adapterName,
      discovered: 0,
      ingested: 0,
      skipped: 0,
      errors: 0,
      unresolvedMembers: 0,
    };

    const session =
      this.options.sessionByState?.[adapter.stateAbbr] ?? defaultSession();
    const since =
      this.options.since ??
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const ctx: ScrapeContext = {
      session,
      since,
      rateLimiter: new SimpleRateLimiter(750),
      httpClient: new FetchHttpClient(),
    };

    const batch: CanonicalVoteRecord[] = [];

    try {
      if (adapter.stateAbbr === 'NC') {
        try {
          const ncPeople = await fetchNcLegislators((url) => ctx.httpClient.get(url));
          personResolver.mergePeople(NC_JURISDICTION, ncPeople);
          this.log(`Loaded ${ncPeople.length} NC legislators for name resolution`);
        } catch (error) {
          this.log(`Warning: could not load NC legislator roster: ${error}`);
        }
      }

      for await (const discovered of adapter.discoverVotes(ctx)) {
        stats.discovered++;
        try {
          const raw = await adapter.fetchVoteDetail(discovered, ctx);
          const canonical = normalizeRawVote(raw);

          if (canonical.billIdentifier) {
            const billId = await linkBillIdentifier(
              canonical.billIdentifier,
              adapter.jurisdictionOcdId,
              session
            );
            if (billId) canonical.bill_id = billId;
            else canonical.pendingBillLink = canonical.billIdentifier;
          }

          if (adapter.resolveBillLink && !canonical.bill_id) {
            const linked = await adapter.resolveBillLink(raw);
            if (linked) canonical.bill_id = linked;
          }

          const { resolved, unresolved } =
            await personResolver.resolveMemberVotes(
              canonical.memberVotes,
              adapter.jurisdictionOcdId,
              canonical.chamber
            );
          canonical.memberVotes = resolved;
          stats.unresolvedMembers += unresolved;

          batch.push(canonical);
        } catch (error) {
          stats.errors++;
          this.log(
            `Error ingesting vote for ${adapter.stateAbbr}: ${error}`
          );
        }
      }

      const deduped = dedupeVoteRecords(batch);
      for (const record of deduped) {
        const storage = canonicalToStorageRecord(record);
        await upsertStateVotingRecord(storage);
        stats.ingested++;
      }

      stats.skipped = stats.discovered - stats.ingested - stats.errors;

      await updateVoteCoverage({
        state: adapter.stateAbbr,
        jurisdiction: adapter.jurisdictionOcdId,
        floorVotes: stats.ingested > 0 ? 'full' : 'none',
        committeeVotes: 'partial',
        freshness: 'daily',
        adapter: adapter.adapterName,
        lastScrapedAt: new Date().toISOString(),
        lastVoteCount: stats.ingested,
        updatedAt: new Date().toISOString(),
      });

      if (stats.discovered === 0) {
        this.log(
          `${adapter.stateAbbr}: no votes discovered since ${since.toISOString().split('T')[0]} (check session year or adapter URL)`
        );
      }

      const health = await checkScrapeHealth(adapter.stateAbbr, stats.ingested);
      if (!health.healthy) {
        this.log(`Health warning for ${adapter.stateAbbr}: ${health.message}`);
      }
    } catch (error) {
      stats.errors++;
      this.log(`Adapter failed for ${adapter.stateAbbr}: ${error}`);
    }

    return stats;
  }

  async syncBillVotes(
    billId: string,
    jurisdiction: string,
    stateAbbr: string,
    billIdentifier?: string
  ): Promise<CanonicalVoteRecord[]> {
    const adapter = this.options.registry.get(stateAbbr);
    if (!adapter) return [];

    const personResolver = createPersonResolver(this.options.openStatesApiKey);
    const ctx: ScrapeContext = {
      session: defaultSession(),
      since: new Date(0),
      rateLimiter: new SimpleRateLimiter(),
      httpClient: new FetchHttpClient(),
    };

    const results: CanonicalVoteRecord[] = [];
    for await (const discovered of adapter.discoverVotes(ctx)) {
      if (
        billIdentifier &&
        discovered.billIdentifier &&
        discovered.billIdentifier !== billIdentifier
      ) {
        continue;
      }
      const raw = await adapter.fetchVoteDetail(discovered, ctx);
      const canonical = normalizeRawVote(raw);
      canonical.bill_id = billId;
      const { resolved } = await personResolver.resolveMemberVotes(
        canonical.memberVotes,
        jurisdiction,
        canonical.chamber
      );
      canonical.memberVotes = resolved;
      await upsertStateVotingRecord(canonicalToStorageRecord(canonical));
      results.push(canonical);
    }
    return results;
  }

  private log(message: string): void {
    this.options.onProgress?.(message);
  }
}
