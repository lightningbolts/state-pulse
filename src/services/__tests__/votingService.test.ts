import { describe, expect, it, vi, beforeEach } from 'vitest';

vi.mock('@/lib/mongodb', () => ({
  getCollection: vi.fn(),
}));

vi.mock('@/services/congressVotingRecordService', () => ({
  getCongressBillVotingInfo: vi.fn().mockResolvedValue({ votingRecords: [{ chamber: 'US House' }] }),
}));

describe('votingService', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('routes Congress bills to Congress sync', async () => {
    const { getBillVotingInfo } = await import('@/services/votingService');
    const { getCongressBillVotingInfo } = await import('@/services/congressVotingRecordService');
    const result = await getBillVotingInfo('congress-bill-119-hr-100');
    expect(getCongressBillVotingInfo).toHaveBeenCalled();
    expect(result?.votingRecords?.length).toBe(1);
  });

  it('returns null for state bill with no records', async () => {
    const { getCollection } = await import('@/lib/mongodb');
    (getCollection as ReturnType<typeof vi.fn>).mockResolvedValue({
      find: () => ({
        sort: () => ({
          toArray: async () => [],
        }),
      }),
    });
    const { getBillVotingInfo } = await import('@/services/votingService');
    const result = await getBillVotingInfo('ocd-bill_abc123');
    expect(result).toBeNull();
  });

  it('returns state bill voting records when present', async () => {
    const { getCollection } = await import('@/lib/mongodb');
    (getCollection as ReturnType<typeof vi.fn>).mockResolvedValue({
      find: () => ({
        sort: () => ({
          toArray: async () => [
            {
              _id: 'x',
              identifier: 'state-vote-1',
              chamber: 'House',
              date: '2024-03-15',
              memberVotes: [],
              rollCallNumber: 1,
              legislationType: 'HB',
              legislationNumber: '100',
              voteQuestion: 'Passage',
              result: 'Passed',
              congress: 0,
              session: 2024,
              bill_id: 'ocd-bill_abc123',
            },
          ],
        }),
      }),
    });
    const { getBillVotingInfo } = await import('@/services/votingService');
    const result = await getBillVotingInfo('ocd-bill_abc123');
    expect(result?.votingRecords?.length).toBe(1);
    expect(result?.chambers).toContain('House');
  });
});
