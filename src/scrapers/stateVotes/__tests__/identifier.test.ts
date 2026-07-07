import { describe, expect, it } from 'vitest';
import { buildVoteIdentifier } from '@/types/voteRecord';

describe('identifier', () => {
  it('different roll call numbers produce different identifiers', () => {
    const base = {
      jurisdiction: 'ocd-jurisdiction/country:us/state:fl/government',
      session: '2024',
      organizationType: 'chamber' as const,
      organization: 'House',
      date: '2024-03-15',
      motionText: 'Passage',
    };
    const a = buildVoteIdentifier({ ...base, rollCallNumber: '100' });
    const b = buildVoteIdentifier({ ...base, rollCallNumber: '101' });
    expect(a).not.toBe(b);
  });
});
