import { getCollection } from '@/lib/mongodb';
import { unstable_cache } from 'next/cache';

export type SponsorActivity = {
  sponsored: number;
  cosponsored: number;
  recent: number;
};

export type RepresentativeSortField =
  | 'name'
  | 'state'
  | 'party'
  | 'sponsored'
  | 'cosponsored'
  | 'activity'
  | 'recentActivity';

const ACTIVITY_SORT_FIELDS = new Set<RepresentativeSortField>([
  'sponsored',
  'cosponsored',
  'activity',
  'recentActivity',
]);

export function isActivitySortField(field: string): field is RepresentativeSortField {
  return ACTIVITY_SORT_FIELDS.has(field as RepresentativeSortField);
}

function normalizeSponsorName(name: string): string {
  return name.replace(/[.,]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

export function getRepDisplayName(rep: Record<string, unknown>): string {
  const direct = (rep.name || rep.directOrderName) as string | undefined;
  if (direct) return direct;
  const first = (rep.firstName || rep.first_name || '') as string;
  const last = (rep.lastName || rep.last_name || '') as string;
  return `${first} ${last}`.trim();
}

async function fetchSponsorActivityFromDb(): Promise<Record<string, SponsorActivity>> {
  const legislationCollection = await getCollection('legislation');
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const results = await legislationCollection
    .aggregate(
      [
        { $match: { sponsors: { $exists: true, $ne: [] } } },
        { $unwind: '$sponsors' },
        {
          $group: {
            _id: '$sponsors.name',
            sponsored: {
              $sum: {
                $cond: [{ $eq: ['$sponsors.primary', true] }, 1, 0],
              },
            },
            cosponsored: {
              $sum: {
                $cond: [{ $ne: ['$sponsors.primary', true] }, 1, 0],
              },
            },
            recent: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $ne: ['$latestActionAt', null] },
                      { $gte: ['$latestActionAt', thirtyDaysAgo] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
        { $match: { _id: { $nin: [null, ''] } } },
      ],
      { maxTimeMS: 20000, allowDiskUse: true },
    )
    .toArray();

  const map: Record<string, SponsorActivity> = {};
  for (const row of results) {
    const key = normalizeSponsorName(String(row._id));
    map[key] = {
      sponsored: row.sponsored ?? 0,
      cosponsored: row.cosponsored ?? 0,
      recent: row.recent ?? 0,
    };
  }
  return map;
}

const getCachedSponsorActivity = unstable_cache(
  fetchSponsorActivityFromDb,
  ['representative-sponsor-activity'],
  { revalidate: 600 },
);

export async function getSponsorActivityMap(): Promise<Record<string, SponsorActivity>> {
  return getCachedSponsorActivity();
}

export function getSponsoredCount(
  rep: Record<string, unknown>,
  activityMap: Record<string, SponsorActivity>,
): number {
  const congressCount = (rep.sponsoredLegislation as { count?: number } | undefined)?.count;
  if (typeof congressCount === 'number') return congressCount;

  const name = getRepDisplayName(rep);
  if (!name) return 0;
  return activityMap[normalizeSponsorName(name)]?.sponsored ?? 0;
}

export function getCosponsoredCount(
  rep: Record<string, unknown>,
  activityMap: Record<string, SponsorActivity>,
): number {
  const congressCount = (rep.cosponsoredLegislation as { count?: number } | undefined)?.count;
  if (typeof congressCount === 'number') return congressCount;

  const name = getRepDisplayName(rep);
  if (!name) return 0;
  return activityMap[normalizeSponsorName(name)]?.cosponsored ?? 0;
}

export function getRecentActivityCount(
  rep: Record<string, unknown>,
  activityMap: Record<string, SponsorActivity>,
): number {
  const name = getRepDisplayName(rep);
  if (!name) return 0;
  return activityMap[normalizeSponsorName(name)]?.recent ?? 0;
}

export function getTotalActivityCount(
  rep: Record<string, unknown>,
  activityMap: Record<string, SponsorActivity>,
): number {
  return (
    getSponsoredCount(rep, activityMap) +
    getCosponsoredCount(rep, activityMap) +
    getRecentActivityCount(rep, activityMap)
  );
}

export function sortRepresentatives<T extends Record<string, unknown>>(
  reps: T[],
  sortBy: string,
  sortDir: 1 | -1,
  activityMap: Record<string, SponsorActivity>,
): T[] {
  const sorted = [...reps];
  const direction = sortDir;

  const compareNumbers = (a: number, b: number) => (a - b) * direction;
  const compareStrings = (a: string, b: string) => a.localeCompare(b) * direction;

  sorted.sort((a, b) => {
    switch (sortBy) {
      case 'sponsored':
        return compareNumbers(getSponsoredCount(a, activityMap), getSponsoredCount(b, activityMap));
      case 'cosponsored':
        return compareNumbers(getCosponsoredCount(a, activityMap), getCosponsoredCount(b, activityMap));
      case 'recentActivity':
        return compareNumbers(getRecentActivityCount(a, activityMap), getRecentActivityCount(b, activityMap));
      case 'activity':
        return compareNumbers(getTotalActivityCount(a, activityMap), getTotalActivityCount(b, activityMap));
      case 'state': {
        const aState = String(a.state || a.jurisdiction || '');
        const bState = String(b.state || b.jurisdiction || '');
        return compareStrings(aState, bState);
      }
      case 'party':
        return compareStrings(String(a.party || ''), String(b.party || ''));
      default:
        return compareStrings(getRepDisplayName(a), getRepDisplayName(b));
    }
  });

  return sorted;
}

export function attachActivityMetrics<T extends Record<string, unknown>>(
  rep: T,
  activityMap: Record<string, SponsorActivity>,
): T & {
  sponsoredCount: number;
  cosponsoredCount: number;
  recentActivityCount: number;
  totalActivityCount: number;
} {
  const sponsoredCount = getSponsoredCount(rep, activityMap);
  const cosponsoredCount = getCosponsoredCount(rep, activityMap);
  const recentActivityCount = getRecentActivityCount(rep, activityMap);
  return {
    ...rep,
    sponsoredCount,
    cosponsoredCount,
    recentActivityCount,
    totalActivityCount: sponsoredCount + cosponsoredCount + recentActivityCount,
  };
}
