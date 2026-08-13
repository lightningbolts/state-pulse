import type { TrendDirection } from '@/types/jurisdictions';

export type { TrendDirection };
export type MajorParty = 'D' | 'R';

export const MS_PER_DAY = 1000 * 60 * 60 * 24;
const STABLE_PCT_BAND = 5;

export interface WindowTrend {
  direction: TrendDirection;
  pctChange: number;
  recentCount: number;
  priorCount: number;
}

export interface DashboardDateWindows {
  now: Date;
  thirtyDaysAgo: Date;
  sixtyDaysAgo: Date;
  eightWeeksAgo: Date;
  ninetyDaysAgo: Date;
}

export function dashboardDateWindows(now = new Date()): DashboardDateWindows {
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sixtyDaysAgo = new Date(now);
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const eightWeeksAgo = new Date(now);
  eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);
  const ninetyDaysAgo = new Date(now);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  return { now, thirtyDaysAgo, sixtyDaysAgo, eightWeeksAgo, ninetyDaysAgo };
}

export function percentChange(recentCount: number, priorCount: number): number {
  if (priorCount <= 0) {
    if (recentCount <= 0) return 0;
    return 100;
  }
  return Math.round(((recentCount - priorCount) / priorCount) * 100);
}

export function trendFromWindowCounts(recentCount: number, priorCount: number): WindowTrend {
  const pctChange = percentChange(recentCount, priorCount);
  let direction: TrendDirection = 'stable';
  if (pctChange > STABLE_PCT_BAND) direction = 'up';
  else if (pctChange < -STABLE_PCT_BAND) direction = 'down';
  return {
    direction,
    pctChange,
    recentCount,
    priorCount,
  };
}

export function roundRate(numerator: number, denominator: number): number | null {
  if (!denominator || denominator <= 0) return null;
  return Math.round((numerator / denominator) * 100);
}

export function roundDays(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value) || value < 0) return null;
  return Math.round(value);
}

export function normalizeMajorParty(party: string | null | undefined): MajorParty | null {
  if (!party) return null;
  const lower = party.toLowerCase();
  if (lower.includes('democrat')) return 'D';
  if (lower.includes('republican') || lower === 'gop' || lower.includes('conservative')) return 'R';
  return null;
}

export function normalizeSponsorLookupKey(value: string): string {
  return value.replace(/[.,]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function sponsorKeyVariants(key: string): string[] {
  const trimmed = key.trim();
  if (!trimmed) return [];
  const variants = new Set<string>([
    trimmed,
    trimmed.replace(/\//g, '_'),
    trimmed.replace(/_/g, '/'),
    normalizeSponsorLookupKey(trimmed),
  ]);
  return [...variants];
}

export function isBipartisanParties(parties: Iterable<MajorParty | null | undefined>): boolean {
  const unique = new Set<MajorParty>();
  for (const party of parties) {
    if (party === 'D' || party === 'R') unique.add(party);
  }
  return unique.has('D') && unique.has('R');
}

export function formatSignedPercent(pctChange: number): string {
  if (pctChange > 0) return `+${pctChange}%`;
  if (pctChange < 0) return `${pctChange}%`;
  return '0%';
}

export const SPARKLINE_WEEKS = 8;

export function emptyWeeklyCounts(weeks = SPARKLINE_WEEKS): number[] {
  return Array.from({ length: weeks }, () => 0);
}

export function weeklyBucketIndex(date: Date, now: Date, weeks = SPARKLINE_WEEKS): number | null {
  const elapsed = now.getTime() - date.getTime();
  const weekAge = Math.floor(elapsed / (7 * MS_PER_DAY));
  if (weekAge < 0 || weekAge >= weeks) return null;
  return weeks - 1 - weekAge;
}

export function foldWeeklyCounts(
  dates: Array<Date | string | null | undefined>,
  now = new Date(),
  weeks = SPARKLINE_WEEKS,
): number[] {
  const buckets = emptyWeeklyCounts(weeks);
  for (const value of dates) {
    if (!value) continue;
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) continue;
    const index = weeklyBucketIndex(date, now, weeks);
    if (index != null) buckets[index] += 1;
  }
  return buckets;
}

export function weeklyPace(recentCount: number, windowDays = 30): number {
  if (recentCount <= 0 || windowDays <= 0) return 0;
  return Math.round((recentCount * 7) / windowDays);
}

export function sponsorConcentration(counts: number[]): {
  top10Share: number | null;
  hhi: number | null;
} {
  const ranked = counts.filter((count) => count > 0).sort((a, b) => b - a);
  if (ranked.length === 0) return { top10Share: null, hhi: null };
  const total = ranked.reduce((sum, count) => sum + count, 0);
  const topN = Math.max(1, Math.ceil(ranked.length * 0.1));
  const topSum = ranked.slice(0, topN).reduce((sum, count) => sum + count, 0);
  const hhi = ranked.reduce((sum, count) => sum + (count / total) ** 2, 0);
  return {
    top10Share: roundRate(topSum, total),
    hhi: Math.round(hhi * 100),
  };
}

export type SessionPhase = 'early' | 'mid' | 'late';

export function sessionPhaseFromProgress(progress: number): SessionPhase {
  if (progress < 1 / 3) return 'early';
  if (progress < 2 / 3) return 'mid';
  return 'late';
}

export function sessionPhaseFromRange(now: Date, start: Date, end: Date): SessionPhase | null {
  const span = end.getTime() - start.getTime();
  if (span <= 0) return null;
  const progress = (now.getTime() - start.getTime()) / span;
  if (progress < 0) return 'early';
  return sessionPhaseFromProgress(Math.min(progress, 1));
}

export type ClassificationBucket = 'bill' | 'resolution' | 'memorial' | 'other';

export function classificationBucket(values: string[] | null | undefined): ClassificationBucket {
  const joined = (values || []).join(' ').toLowerCase();
  if (!joined.trim()) return 'other';
  if (joined.includes('memorial')) return 'memorial';
  if (joined.includes('resolution')) return 'resolution';
  if (joined.includes('bill')) return 'bill';
  return 'other';
}

export function dateConvert(field: string) {
  return { $convert: { input: `$${field}`, to: 'date', onError: null, onNull: null } };
}

export const topicArrayExpression = {
  $let: {
    vars: {
      classified: { $ifNull: ['$topicClassification.broadTopics', []] },
    },
    in: {
      $cond: [
        { $gt: [{ $size: '$$classified' }, 0] },
        '$$classified',
        { $ifNull: ['$subjects', []] },
      ],
    },
  },
};

export const sponsorKeyExpression = {
  $filter: {
    input: {
      $map: {
        input: { $ifNull: ['$sponsors', []] },
        as: 's',
        in: {
          $ifNull: [
            '$$s.personId',
            { $ifNull: ['$$s.person_id', { $ifNull: ['$$s.id', '$$s.name'] }] },
          ],
        },
      },
    },
    as: 'key',
    cond: { $and: [{ $ne: ['$$key', null] }, { $ne: ['$$key', ''] }] },
  },
};

export const velocityDaysExpression = {
  $let: {
    vars: {
      start: {
        $convert: { input: '$firstActionAt', to: 'date', onError: null, onNull: null },
      },
      end: {
        $convert: {
          input: { $ifNull: ['$enactedAt', '$latestPassageAt'] },
          to: 'date',
          onError: null,
          onNull: null,
        },
      },
    },
    in: {
      $cond: [
        {
          $and: [
            { $ne: ['$$start', null] },
            { $ne: ['$$end', null] },
            { $gt: ['$$end', '$$start'] },
          ],
        },
        { $divide: [{ $subtract: ['$$end', '$$start'] }, MS_PER_DAY] },
        null,
      ],
    },
  },
};

export const enactedDateMatch = {
  $ne: [
    { $convert: { input: '$enactedAt', to: 'date', onError: null, onNull: null } },
    null,
  ],
};

export const pingPongExpression = {
  $let: {
    vars: {
      text: {
        $toLower: {
          $reduce: {
            input: { $ifNull: ['$history', []] },
            initialValue: '',
            in: {
              $concat: [
                '$$value',
                ' ',
                { $ifNull: ['$$this.actor', ''] },
                ' ',
                { $ifNull: ['$$this.action', ''] },
              ],
            },
          },
        },
      },
    },
    in: {
      $and: [
        { $regexMatch: { input: '$$text', regex: 'senate|upper' } },
        { $regexMatch: { input: '$$text', regex: 'house|assembly|lower' } },
      ],
    },
  },
};

export function deadOnArrivalExpression(thirtyDaysAgo: Date) {
  return {
    $let: {
      vars: {
        first: dateConvert('firstActionAt'),
        latest: dateConvert('latestActionAt'),
        enacted: dateConvert('enactedAt'),
        historySize: { $size: { $ifNull: ['$history', []] } },
      },
      in: {
        $and: [
          { $eq: ['$$enacted', null] },
          { $ne: ['$$first', null] },
          { $lte: ['$$first', thirtyDaysAgo] },
          {
            $or: [
              { $lte: ['$$historySize', 1] },
              {
                $and: [
                  { $ne: ['$$latest', null] },
                  { $lte: [{ $abs: { $subtract: ['$$latest', '$$first'] } }, MS_PER_DAY] },
                ],
              },
            ],
          },
        ],
      },
    },
  };
}

export const classificationBucketExpression = {
  $let: {
    vars: {
      joined: {
        $toLower: {
          $reduce: {
            input: { $ifNull: ['$classification', []] },
            initialValue: '',
            in: { $concat: ['$$value', ' ', { $toString: '$$this' }] },
          },
        },
      },
    },
    in: {
      $switch: {
        branches: [
          { case: { $regexMatch: { input: '$$joined', regex: 'memorial' } }, then: 'memorial' },
          { case: { $regexMatch: { input: '$$joined', regex: 'resolution' } }, then: 'resolution' },
          { case: { $regexMatch: { input: '$$joined', regex: 'bill' } }, then: 'bill' },
        ],
        default: 'other',
      },
    },
  },
};

export const chamberBucketExpression = {
  $let: {
    vars: {
      raw: {
        $toLower: {
          $toString: { $ifNull: ['$chamber', { $ifNull: ['$fromOrganization', ''] }] },
        },
      },
    },
    in: {
      $switch: {
        branches: [
          { case: { $regexMatch: { input: '$$raw', regex: 'upper|senate' } }, then: 'upper' },
          { case: { $regexMatch: { input: '$$raw', regex: 'lower|house|assembly' } }, then: 'lower' },
          { case: { $regexMatch: { input: '$$raw', regex: 'unicameral|legislature' } }, then: 'unicameral' },
        ],
        default: 'other',
      },
    },
  },
};

export const multiSponsorExpression = {
  $gte: [{ $size: { $ifNull: ['$sponsors', []] } }, 2],
};

export const primarySponsorExpression = {
  $gt: [
    {
      $size: {
        $filter: {
          input: { $ifNull: ['$sponsors', []] },
          as: 's',
          cond: { $eq: ['$$s.primary', true] },
        },
      },
    },
    0,
  ],
};
