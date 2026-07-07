import { describe, expect, it } from 'vitest';
import {
  aggregateCountsFromMembers,
  buildVoteIdentifier,
  dedupeVoteRecords,
  deriveResultFromCounts,
  normalizeVoteDate,
  normalizeVoteOption,
} from '@/types/voteRecord';
import type { CanonicalVoteRecord } from '@/types/voteRecord';

describe('normalizeVoteOption', () => {
  it.each([
    ['Yea', 'yea'],
    ['Yes', 'yea'],
    ['Aye', 'yea'],
    ['yea', 'yea'],
    ['Nay', 'nay'],
    ['No', 'nay'],
    ['nay', 'nay'],
    ['NV', 'not_voting'],
    ['Not Voting', 'not_voting'],
    ['Excused', 'not_voting'],
    ['Absent', 'absent'],
    ['Present', 'present'],
    ['P', 'present'],
    ['Recused', 'other'],
  ])('maps %s to %s', (input, expected) => {
    expect(normalizeVoteOption(input)).toBe(expected);
  });
});

describe('normalizeVoteDate', () => {
  it('normalizes ISO dates', () => {
    expect(normalizeVoteDate('2024-09-18T00:00:00')).toBe('2024-09-18');
  });

  it('normalizes US dates', () => {
    expect(normalizeVoteDate('09/18/2024')).toBe('2024-09-18');
  });
});

describe('aggregateCountsFromMembers', () => {
  it('aggregates member vote counts', () => {
    const members = [
      ...Array(10).fill({ name: 'A', option: 'yea' as const }),
      ...Array(5).fill({ name: 'B', option: 'nay' as const }),
      { name: 'C', option: 'present' as const },
    ];
    const counts = aggregateCountsFromMembers(members);
    expect(counts.find((c) => c.option === 'yea')?.value).toBe(10);
    expect(counts.find((c) => c.option === 'nay')?.value).toBe(5);
    expect(counts.find((c) => c.option === 'present')?.value).toBe(1);
  });
});

describe('deriveResultFromCounts', () => {
  it('returns pass when yea > nay', () => {
    expect(
      deriveResultFromCounts([
        { option: 'yea', value: 10 },
        { option: 'nay', value: 5 },
      ])
    ).toBe('pass');
  });

  it('returns fail when nay > yea', () => {
    expect(
      deriveResultFromCounts([
        { option: 'yea', value: 3 },
        { option: 'nay', value: 8 },
      ])
    ).toBe('fail');
  });
});

describe('buildVoteIdentifier', () => {
  it('produces stable identifiers', () => {
    const params = {
      jurisdiction: 'ocd-jurisdiction/country:us/state:fl/government',
      session: '2024',
      organizationType: 'chamber' as const,
      organization: 'House',
      rollCallNumber: '1234',
      date: '2024-03-15',
      motionText: 'On passage',
    };
    expect(buildVoteIdentifier(params)).toBe(buildVoteIdentifier(params));
  });

  it('differentiates committee vs chamber', () => {
    const base = {
      jurisdiction: 'ocd-jurisdiction/country:us/state:fl/government',
      session: '2024',
      organization: 'Education',
      rollCallNumber: '100',
      date: '2024-03-15',
      motionText: 'Passage',
    };
    const chamber = buildVoteIdentifier({ ...base, organizationType: 'chamber' });
    const committee = buildVoteIdentifier({ ...base, organizationType: 'committee' });
    expect(chamber).not.toBe(committee);
  });

  it('falls back to date and motion hash without roll call', () => {
    const id = buildVoteIdentifier({
      jurisdiction: 'ocd-jurisdiction/country:us/state:fl/government',
      session: '2024',
      organizationType: 'chamber',
      organization: 'House',
      date: '2024-03-15',
      motionText: 'On passage of HB 1',
    });
    expect(id).toContain('2024-03-15');
  });
});

describe('dedupeVoteRecords', () => {
  const base: CanonicalVoteRecord = {
    id: 'ocd-vote/test/1',
    identifier: 'a',
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
  };

  it('dedupes same vote from two sources', () => {
    const dup = { ...base, identifier: 'b' };
    expect(dedupeVoteRecords([base, dup])).toHaveLength(1);
  });

  it('keeps votes on different dates', () => {
    const other = { ...base, date: '2024-03-16', identifier: 'c' };
    expect(dedupeVoteRecords([base, other])).toHaveLength(2);
  });

  it('keeps votes in different committees', () => {
    const committee = {
      ...base,
      organization: 'Education',
      organizationType: 'committee' as const,
      identifier: 'd',
    };
    expect(dedupeVoteRecords([base, committee])).toHaveLength(2);
  });
});
