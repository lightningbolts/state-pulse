import { getCollection } from '@/lib/mongodb';
import { STATE_NAMES, STATE_COORDINATES } from '@/types/geo';
import { StateData } from '@/types/jurisdictions';
import { unstable_cache } from 'next/cache';

function buildEarlyMatchForStates(abbrs: string[]): object {
  const jurisdictionNames: string[] = [];

  for (const abbr of abbrs) {
    if (abbr === 'US') {
      jurisdictionNames.push('United States Congress');
      continue;
    }
    const name = STATE_NAMES[abbr];
    if (name) jurisdictionNames.push(name);
  }

  return {
    $match: {
      jurisdictionName: { $in: jurisdictionNames },
    },
  };
}

function buildStateStatsFromResults(
  results: Array<{
    _id: string;
    totalBills?: number;
    recentBills?: number;
    sampleSubjects?: string[];
    uniqueSponsors?: number;
    uniqueTopics?: number;
    topSubjects?: string[];
  }>,
  representativeCounts: Record<string, number> = {},
): Record<string, StateData> {
  const stateStats: Record<string, StateData> = {};

  results.forEach((result) => {
    const jurisdictionName = result._id;
    let stateAbbr = '';

    if (jurisdictionName.includes('Congress') || jurisdictionName.includes('United States')) {
      stateAbbr = 'US';
    } else {
      for (const [abbr, name] of Object.entries(STATE_NAMES)) {
        if (abbr === 'US') continue;
        if (jurisdictionName.toLowerCase() === name.toLowerCase()) {
          stateAbbr = abbr;
          break;
        }
      }
      if (!stateAbbr) {
        for (const [abbr, name] of Object.entries(STATE_NAMES)) {
          if (abbr === 'US') continue;
          if (
            jurisdictionName.toLowerCase().includes(name.toLowerCase()) ||
            name.toLowerCase().includes(jurisdictionName.toLowerCase())
          ) {
            stateAbbr = abbr;
            break;
          }
        }
      }
      if (!stateAbbr) {
        const variations: Record<string, string> = {
          wv: 'WV',
          'west va': 'WV',
          'w virginia': 'WV',
          'w va': 'WV',
        };
        stateAbbr = variations[jurisdictionName.toLowerCase().trim()] || '';
      }
    }

    if (stateAbbr && STATE_COORDINATES[stateAbbr]) {
      const topSubjects = (result.topSubjects || result.sampleSubjects || [])
        .filter((s: string) => s && s.trim())
        .slice(0, 3);
      const intensity = Math.min((result.totalBills || 0) / 1000, 1);
      const hue = intensity * 240;
      stateStats[stateAbbr] = {
        name: STATE_NAMES[stateAbbr],
        abbreviation: stateAbbr,
        legislationCount: result.totalBills || 0,
        activeRepresentatives: representativeCounts[stateAbbr] ?? result.uniqueSponsors ?? 0,
        recentActivity: result.recentBills || 0,
        topicDiversity: result.uniqueTopics || 0,
        keyTopics: topSubjects.length > 0 ? topSubjects : ['General'],
        center: STATE_COORDINATES[stateAbbr],
        color: `hsl(${240 - hue}, 70%, 50%)`,
      };
    }
  });

  return stateStats;
}

async function fetchStateLegislatorCounts(): Promise<Record<string, number>> {
  const repsCollection = await getCollection('representatives');
  const results = await repsCollection
    .aggregate(
      [
        {
          $match: {
            $or: [
              { 'map_boundary.type': { $in: ['state_leg_upper', 'state_leg_lower', 'state_leg'] } },
              { 'jurisdiction.classification': 'state' },
              { 'current_role.org_classification': { $in: ['upper', 'lower', 'legislature'] } },
            ],
          },
        },
        {
          $project: {
            stateAbbr: {
              $cond: {
                if: { $eq: [{ $strLenCP: { $ifNull: ['$state', ''] } }, 2] },
                then: { $toUpper: '$state' },
                else: null,
              },
            },
            stateName: '$jurisdiction.name',
          },
        },
        {
          $group: {
            _id: {
              $cond: {
                if: { $ne: ['$stateAbbr', null] },
                then: '$stateAbbr',
                else: '$stateName',
              },
            },
            count: { $sum: 1 },
          },
        },
      ],
      { maxTimeMS: 15000, allowDiskUse: true },
    )
    .toArray();

  const counts: Record<string, number> = {};
  for (const row of results) {
    const key = row._id;
    if (!key) continue;
    if (typeof key === 'string' && key.length === 2) {
      counts[key.toUpperCase()] = row.count;
      continue;
    }
    for (const [abbr, name] of Object.entries(STATE_NAMES)) {
      if (abbr === 'US') continue;
      if (typeof key === 'string' && key.toLowerCase() === name.toLowerCase()) {
        counts[abbr] = row.count;
        break;
      }
    }
  }
  return counts;
}

const getCachedRepresentativeCounts = unstable_cache(
  () => fetchStateLegislatorCounts(),
  ['map-data-rep-counts'],
  { revalidate: 600 },
);

async function fetchMapDataFromDb(requestedAbbrs: string[] | null): Promise<Record<string, StateData>> {
  const legislationCollection = await getCollection('legislation');
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const pipeline: object[] = [];

  if (requestedAbbrs && requestedAbbrs.length > 0) {
    pipeline.push(buildEarlyMatchForStates(requestedAbbrs));
  } else {
    pipeline.push({
      $match: {
        jurisdictionName: { $exists: true, $nin: [null, ''] },
      },
    });
  }

  pipeline.push(
    {
      $group: {
        _id: '$jurisdictionName',
        totalBills: { $sum: 1 },
        recentBills: {
          $sum: {
            $cond: {
              if: {
                $and: [
                  { $ne: ['$latestActionAt', null] },
                  { $gte: ['$latestActionAt', thirtyDaysAgo] },
                ],
              },
              then: 1,
              else: 0,
            },
          },
        },
        sampleSubjects: { $push: { $arrayElemAt: ['$subjects', 0] } },
        topicSubjects: { $addToSet: { $arrayElemAt: ['$subjects', 0] } },
        sponsorCount: { $addToSet: { $arrayElemAt: ['$sponsors.name', 0] } },
      },
    },
    {
      $project: {
        _id: 1,
        totalBills: 1,
        recentBills: 1,
        topSubjects: {
          $slice: [
            {
              $filter: {
                input: '$sampleSubjects',
                cond: { $ne: ['$$this', null] },
              },
            },
            3,
          ],
        },
        uniqueTopics: {
          $size: {
            $filter: {
              input: '$topicSubjects',
              cond: { $and: [{ $ne: ['$$this', null] }, { $ne: ['$$this', ''] }] },
            },
          },
        },
        uniqueSponsors: { $size: '$sponsorCount' },
      },
    },
    { $sort: { totalBills: -1 } },
  );

  const fetchLegislation = legislationCollection
    .aggregate(pipeline, {
      maxTimeMS: requestedAbbrs ? 12000 : 25000,
      allowDiskUse: true,
    })
    .toArray();

  const [results, representativeCounts] = await Promise.all([
    fetchLegislation,
    getCachedRepresentativeCounts(),
  ]);

  const stateStats = buildStateStatsFromResults(
    results as Array<{
      _id: string;
      totalBills?: number;
      recentBills?: number;
      sampleSubjects?: string[];
      uniqueSponsors?: number;
      uniqueTopics?: number;
      topSubjects?: string[];
    }>,
    representativeCounts,
  );

  if (!requestedAbbrs) {
    const existingStates = new Set(Object.keys(stateStats));
    Object.entries(STATE_NAMES).forEach(([abbr, name]) => {
      if (!existingStates.has(abbr) && STATE_COORDINATES[abbr]) {
        stateStats[abbr] = {
          name,
          abbreviation: abbr,
          legislationCount: 0,
          activeRepresentatives: representativeCounts[abbr] || 0,
          recentActivity: 0,
          topicDiversity: 0,
          keyTopics: ['No Data'],
          center: STATE_COORDINATES[abbr],
          color: '#e0e0e0',
        };
      }
    });
  }

  return stateStats;
}

export async function getMapDataForStates(statesParam: string | null): Promise<Record<string, StateData>> {
  const requestedAbbrs = statesParam
    ? statesParam.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean)
    : null;

  if (requestedAbbrs && requestedAbbrs.length > 0) {
    const cacheKey = requestedAbbrs.slice().sort().join(',');
    const cachedFetch = unstable_cache(
      () => fetchMapDataFromDb(requestedAbbrs),
      ['map-data-states', cacheKey],
      { revalidate: 600 },
    );
    return cachedFetch();
  }

  const cachedFetch = unstable_cache(
    () => fetchMapDataFromDb(null),
    ['map-data-all'],
    { revalidate: 600 },
  );
  return cachedFetch();
}
