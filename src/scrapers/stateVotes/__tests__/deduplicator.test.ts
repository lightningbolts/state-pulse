import { describe, expect, it } from 'vitest';
import { dedupeVoteRecords } from '@/types/voteRecord';
import type { CanonicalVoteRecord } from '@/types/voteRecord';

describe('deduplicator', () => {
  const makeRecord = (overrides: Partial<CanonicalVoteRecord>): CanonicalVoteRecord => ({
    id: 'ocd-vote/test/1',
    identifier: 'id-1',
    jurisdiction: 'ocd-jurisdiction/country:us/state:fl/government',
    session: '2024',
    chamber: 'lower',
    organization: 'House',
    organizationType: 'chamber',
    rollCallNumber: '100',
    motionText: 'Passage',
    date: '2024-03-15',
    result: 'pass',
    counts: [],
    memberVotes: [],
    sources: [],
    provenance: { adapter: 'fl-html', scrapedAt: new Date().toISOString() },
    ...overrides,
  });

  it('keeps single record from bill page and chamber index duplicate', () => {
    const records = dedupeVoteRecords([
      makeRecord({ identifier: 'from-bill-page' }),
      makeRecord({ identifier: 'from-chamber-index' }),
    ]);
    expect(records).toHaveLength(1);
  });
});
