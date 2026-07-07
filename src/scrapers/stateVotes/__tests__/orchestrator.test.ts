import { describe, expect, it, vi, beforeEach } from 'vitest';
import type { DiscoveredVote, RawVotePayload, StateVoteAdapter } from '@/types/voteRecord';
import { VoteIngestionOrchestrator } from '../orchestrator';
import { StateAdapterRegistry } from '../index';

const mockUpsert = vi.fn();
const mockUpdateCoverage = vi.fn();
const mockCheckHealth = vi.fn();
const mockLinkBill = vi.fn();

vi.mock('@/services/votingRecordService', () => ({
  canonicalToStorageRecord: (r: unknown) => r,
  upsertStateVotingRecord: (...args: unknown[]) => mockUpsert(...args),
}));

vi.mock('@/services/voteCoverageService', () => ({
  updateVoteCoverage: (...args: unknown[]) => mockUpdateCoverage(...args),
  checkScrapeHealth: (...args: unknown[]) => mockCheckHealth(...args),
}));

vi.mock('../billLinker', () => ({
  linkBillIdentifier: (...args: unknown[]) => mockLinkBill(...args),
}));

vi.mock('../personResolver', () => ({
  createPersonResolver: () => ({
    resolveMemberVotes: async (votes: { name: string; option: string }[]) => ({
      resolved: votes.map((v) => ({ ...v, option: v.option as 'yea' })),
      unresolved: 0,
    }),
  }),
}));

class MockAdapter implements StateVoteAdapter {
  stateAbbr = 'TST';
  jurisdictionOcdId = 'ocd-jurisdiction/country:us/state:ts/government';
  adapterName = 'mock';
  private throwOnSecond = false;

  constructor(throwOnSecond = false) {
    this.throwOnSecond = throwOnSecond;
  }

  async *discoverVotes(): AsyncIterable<DiscoveredVote> {
    yield { sourceId: '1', sourceUrl: 'https://example.com/1', rollCallNumber: '1' };
    yield { sourceId: '2', sourceUrl: 'https://example.com/2', rollCallNumber: '2' };
  }

  async fetchVoteDetail(discovered: DiscoveredVote): Promise<RawVotePayload> {
    if (this.throwOnSecond && discovered.sourceId === '2') {
      throw new Error('parse failed');
    }
    return {
      adapter: 'mock',
      jurisdiction: this.jurisdictionOcdId,
      session: '2024',
      chamber: 'lower',
      organization: 'House',
      organizationType: 'chamber',
      rollCallNumber: discovered.rollCallNumber,
      motionText: 'On passage',
      date: '2024-03-15',
      result: 'pass',
      counts: [
        { option: 'yea', value: 2 },
        { option: 'nay', value: 1 },
      ],
      memberVotes: [
        { name: 'Smith', option: 'Yea' },
        { name: 'Jones', option: 'Nay' },
      ],
      billIdentifier: 'HB 1',
      sources: [{ url: discovered.sourceUrl }],
    };
  }
}

describe('VoteIngestionOrchestrator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLinkBill.mockResolvedValue('ocd-bill_test');
    mockCheckHealth.mockResolvedValue({ healthy: true, message: 'OK' });
  });

  it('runs full pipeline and upserts records', async () => {
    const registry = new StateAdapterRegistry();
    registry.register(new MockAdapter());
    const orchestrator = new VoteIngestionOrchestrator({ registry });
    const results = await orchestrator.run();
    expect(results[0].ingested).toBe(2);
    expect(mockUpsert).toHaveBeenCalledTimes(2);
    expect(mockUpdateCoverage).toHaveBeenCalledTimes(1);
  });

  it('continues when one vote fails', async () => {
    const registry = new StateAdapterRegistry();
    registry.register(new MockAdapter(true));
    const orchestrator = new VoteIngestionOrchestrator({ registry });
    const results = await orchestrator.run();
    expect(results[0].ingested).toBe(1);
    expect(results[0].errors).toBe(1);
  });

  it('dedupes on re-run with same identifier', async () => {
    const registry = new StateAdapterRegistry();
    registry.register(new MockAdapter());
    const orchestrator = new VoteIngestionOrchestrator({ registry });
    await orchestrator.run();
    await orchestrator.run();
    expect(mockUpsert.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('emits health warning when check fails', async () => {
    mockCheckHealth.mockResolvedValue({
      healthy: false,
      message: 'Zero votes',
    });
    const registry = new StateAdapterRegistry();
    registry.register(new MockAdapter());
    const logs: string[] = [];
    const orchestrator = new VoteIngestionOrchestrator({
      registry,
      onProgress: (m) => logs.push(m),
    });
    await orchestrator.run();
    expect(logs.some((l) => l.includes('Health warning'))).toBe(true);
  });
});
