import { describe, expect, it } from 'vitest';
import {
  classificationBucket,
  foldWeeklyCounts,
  formatSignedPercent,
  isBipartisanParties,
  normalizeMajorParty,
  percentChange,
  roundDays,
  roundRate,
  sessionPhaseFromRange,
  sponsorConcentration,
  sponsorKeyVariants,
  trendFromWindowCounts,
  weeklyPace,
} from './dashboardMetrics';

describe('trendFromWindowCounts', () => {
  it('marks new activity as up at +100%', () => {
    expect(trendFromWindowCounts(8, 0)).toEqual({
      direction: 'up',
      pctChange: 100,
      recentCount: 8,
      priorCount: 0,
    });
  });

  it('treats small swings as stable', () => {
    expect(trendFromWindowCounts(21, 20).direction).toBe('stable');
    expect(trendFromWindowCounts(19, 20).direction).toBe('stable');
  });

  it('detects downtrends', () => {
    expect(trendFromWindowCounts(10, 20)).toMatchObject({
      direction: 'down',
      pctChange: -50,
    });
  });
});

describe('percentChange', () => {
  it('returns 0 when both windows are empty', () => {
    expect(percentChange(0, 0)).toBe(0);
  });
});

describe('roundRate / roundDays', () => {
  it('computes enactment-style rates', () => {
    expect(roundRate(13, 100)).toBe(13);
    expect(roundRate(0, 0)).toBeNull();
  });

  it('rounds velocity days and rejects invalid values', () => {
    expect(roundDays(12.4)).toBe(12);
    expect(roundDays(-3)).toBeNull();
    expect(roundDays(undefined)).toBeNull();
  });
});

describe('party helpers', () => {
  it('normalizes major parties only', () => {
    expect(normalizeMajorParty('Democratic')).toBe('D');
    expect(normalizeMajorParty('Republican')).toBe('R');
    expect(normalizeMajorParty('Independent')).toBeNull();
    expect(normalizeMajorParty('Nonpartisan')).toBeNull();
  });

  it('requires both D and R for bipartisan', () => {
    expect(isBipartisanParties(['D', 'R'])).toBe(true);
    expect(isBipartisanParties(['D', 'D'])).toBe(false);
    expect(isBipartisanParties(['D', null, 'R'])).toBe(true);
    expect(isBipartisanParties([])).toBe(false);
  });

  it('expands OpenStates id slash/underscore variants', () => {
    const keys = sponsorKeyVariants('ocd-person/abc');
    expect(keys).toContain('ocd-person/abc');
    expect(keys).toContain('ocd-person_abc');
  });
});

describe('formatSignedPercent', () => {
  it('adds a sign for nonzero values', () => {
    expect(formatSignedPercent(12)).toBe('+12%');
    expect(formatSignedPercent(-4)).toBe('-4%');
    expect(formatSignedPercent(0)).toBe('0%');
  });
});

describe('sponsorConcentration', () => {
  it('returns null for empty counts', () => {
    expect(sponsorConcentration([])).toEqual({ top10Share: null, hhi: null });
  });

  it('gives a monopolist 100% share and HHI', () => {
    expect(sponsorConcentration([50])).toEqual({ top10Share: 100, hhi: 100 });
  });

  it('measures top-decile share on a skewed leaderboard', () => {
    const counts = [40, 10, 10, 10, 10, 5, 5, 5, 5, 0];
    const result = sponsorConcentration(counts);
    expect(result.top10Share).toBe(40);
    expect(result.hhi).toBeGreaterThan(10);
  });
});

describe('sessionPhaseFromRange', () => {
  const start = new Date('2026-01-01T00:00:00Z');
  const end = new Date('2026-04-01T00:00:00Z');

  it('labels the first third as early', () => {
    expect(sessionPhaseFromRange(new Date('2026-01-15T00:00:00Z'), start, end)).toBe('early');
  });

  it('labels the last third as late', () => {
    expect(sessionPhaseFromRange(new Date('2026-03-20T00:00:00Z'), start, end)).toBe('late');
  });
});

describe('foldWeeklyCounts', () => {
  it('puts the newest week on the right', () => {
    const now = new Date('2026-08-13T00:00:00Z');
    const thisWeek = new Date('2026-08-12T00:00:00Z');
    const lastWeek = new Date('2026-08-04T00:00:00Z');
    const buckets = foldWeeklyCounts([thisWeek, thisWeek, lastWeek], now, 8);
    expect(buckets[7]).toBe(2);
    expect(buckets[6]).toBe(1);
    expect(buckets.slice(0, 6).every((n) => n === 0)).toBe(true);
  });
});

describe('classificationBucket', () => {
  it('buckets OpenStates classifications', () => {
    expect(classificationBucket(['bill'])).toBe('bill');
    expect(classificationBucket(['concurrent resolution'])).toBe('resolution');
    expect(classificationBucket(['memorial'])).toBe('memorial');
    expect(classificationBucket([])).toBe('other');
  });
});

describe('weeklyPace', () => {
  it('converts a 30-day count into bills per week', () => {
    expect(weeklyPace(30, 30)).toBe(7);
  });
});
