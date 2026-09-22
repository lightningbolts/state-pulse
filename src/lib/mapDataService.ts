import { getCollection } from '@/lib/mongodb';
import { STATE_NAMES, STATE_COORDINATES } from '@/types/geo';
import { StateData } from '@/types/jurisdictions';
import { unstable_cache } from 'next/cache';
import {
  chamberBucketExpression,
  dashboardDateWindows,
  deadOnArrivalExpression,
  enactedDateMatch,
  multiSponsorExpression,
  pingPongExpression,
  roundDays,
  roundRate,
  sponsorConcentration,
  topicArrayExpression,
  velocityDaysExpression,
  weeklyPace,
} from '@/lib/dashboardMetrics';
import { computeBipartisanByJurisdiction } from '@/lib/dashboardBipartisan';

function jurisdictionNamesForAbbrs(abbrs: string[]): string[] {
  const jurisdictionNames: string[] = [];
  for (const abbr of abbrs) {
    if (abbr === 'US') {
      jurisdictionNames.push('United States Congress');
      continue;
    }
    const name = STATE_NAMES[abbr];
    if (name) jurisdictionNames.push(name);
  }
  return jurisdictionNames;
}

function jurisdictionNameToAbbr(jurisdictionName: string): string {
  if (jurisdictionName.includes('Congress') || jurisdictionName.includes('United States')) {
    return 'US';
  }
  for (const [abbr, name] of Object.entries(STATE_NAMES)) {
    if (abbr === 'US') continue;
    if (jurisdictionName.toLowerCase() === name.toLowerCase()) return abbr;
  }
  for (const [abbr, name] of Object.entries(STATE_NAMES)) {
    if (abbr === 'US') continue;
    if (
      jurisdictionName.toLowerCase().includes(name.toLowerCase()) ||
      name.toLowerCase().includes(jurisdictionName.toLowerCase())
    ) {
      return abbr;
    }
  }
  const variations: Record<string, string> = {
    wv: 'WV',
    'west va': 'WV',
    'w virginia': 'WV',
    'w va': 'WV',
  };
  return variations[jurisdictionName.toLowerCase().trim()] || '';
}

function buildEarlyMatchForStates(abbrs: string[]): object {
  return {
    $match: {
      jurisdictionName: { $in: jurisdictionNamesForAbbrs(abbrs) },
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
    enactedCount?: number;
    averageVelocity?: number | null;
    multiSponsorBills?: number;
    doaCount?: number;
    pingPongCount?: number;
    upperCount?: number;
    lowerCount?: number;
  }>,
  representativeCounts: Record<string, number> = {},
  extras: Record<string, {
    bipartisanRate?: number | null;
    topicMomentum?: number;
    sponsorConcentration?: number | null;
  }> = {},
): Record<string, StateData> {
  const stateStats: Record<string, StateData> = {};

  results.forEach((result) => {
    const jurisdictionName = result._id;
    const stateAbbr = jurisdictionNameToAbbr(jurisdictionName);

    if (stateAbbr && STATE_COORDINATES[stateAbbr]) {
      const topSubjects = (result.topSubjects || result.sampleSubjects || [])
        .filter((s: string) => s && s.trim())
        .slice(0, 3);
      const intensity = Math.min((result.totalBills || 0) / 1000, 1);
      const hue = intensity * 240;
      const extra = extras[stateAbbr] || extras[jurisdictionName] || {};
      const totalBills = result.totalBills || 0;
      stateStats[stateAbbr] = {
        name: STATE_NAMES[stateAbbr],
        abbreviation: stateAbbr,
        legislationCount: totalBills,
        activeRepresentatives: representativeCounts[stateAbbr] ?? (stateAbbr === 'US' ? 0 : result.uniqueSponsors ?? 0),
        recentActivity: result.recentBills || 0,
        topicDiversity: result.uniqueTopics || 0,
        keyTopics: topSubjects.length > 0 ? topSubjects : ['General'],
        center: STATE_COORDINATES[stateAbbr],
        color: `hsl(${240 - hue}, 70%, 50%)`,
        enactmentRate: roundRate(result.enactedCount || 0, totalBills),
        averageBillVelocityDays: roundDays(result.averageVelocity),
        bipartisanRate: extra.bipartisanRate ?? null,
        topicMomentum: extra.topicMomentum ?? 0,
        legislativePace: weeklyPace(result.recentBills || 0),
        chamberUpperShare: roundRate(result.upperCount || 0, (result.upperCount || 0) + (result.lowerCount || 0)),
        sponsorConcentration: extra.sponsorConcentration ?? null,
        doaRate: roundRate(result.doaCount || 0, totalBills),
        pingPongRate: roundRate(result.pingPongCount || 0, totalBills),
        multiSponsorRate: roundRate(result.multiSponsorBills || 0, totalBills),
      };
    }
  });

  return stateStats;
}

async function fetchCongressMemberCount(): Promise<number> {
  const repsCollection = await getCollection('representatives');
  return repsCollection.countDocuments({
    $or: [
      { jurisdiction: { $in: ['US House', 'US Senate'] } },
      { 'jurisdiction.name': { $in: ['US House', 'US Senate'] } },
    ],
  });
}

const getCachedCongressMemberCount = unstable_cache(
  () => fetchCongressMemberCount(),
  ['map-data-congress-rep-count'],
  { revalidate: 3600 },
);

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
  { revalidate: 3600 },
);

async function fetchTopicMomentumByJurisdiction(requestedAbbrs: string[]): Promise<Record<string, number>> {
  const { thirtyDaysAgo, sixtyDaysAgo } = dashboardDateWindows();
  const legislationCollection = await getCollection('legislation');
  const rows = await legislationCollection
    .aggregate(
      [
        {
          $match: {
            jurisdictionName: { $in: jurisdictionNamesForAbbrs(requestedAbbrs) },
            latestActionAt: { $gte: sixtyDaysAgo },
          },
        },
        { $addFields: { dashboardTopics: topicArrayExpression } },
        { $unwind: '$dashboardTopics' },
        { $match: { dashboardTopics: { $nin: [null, ''] } } },
        {
          $group: {
            _id: { jurisdiction: '$jurisdictionName', topic: '$dashboardTopics' },
            recentCount: {
              $sum: { $cond: [{ $gte: ['$latestActionAt', thirtyDaysAgo] }, 1, 0] },
            },
            priorCount: {
              $sum: {
                $cond: [
                  {
                    $and: [
                      { $gte: ['$latestActionAt', sixtyDaysAgo] },
                      { $lt: ['$latestActionAt', thirtyDaysAgo] },
                    ],
                  },
                  1,
                  0,
                ],
              },
            },
          },
        },
        {
          $group: {
            _id: '$_id.jurisdiction',
            topicMomentum: {
              $sum: { $cond: [{ $gt: ['$recentCount', '$priorCount'] }, 1, 0] },
            },
          },
        },
      ],
      { maxTimeMS: 15000, allowDiskUse: true },
    )
    .toArray();

  const momentum: Record<string, number> = {};
  for (const row of rows) {
    const abbr = jurisdictionNameToAbbr(row._id);
    if (abbr) momentum[abbr] = row.topicMomentum || 0;
  }
  return momentum;
}

async function fetchSponsorConcentrationByJurisdiction(requestedAbbrs: string[]): Promise<Record<string, number | null>> {
  const legislationCollection = await getCollection('legislation');
  const rows = await legislationCollection
    .aggregate(
      [
        {
          $match: {
            jurisdictionName: { $in: jurisdictionNamesForAbbrs(requestedAbbrs) },
            sponsors: { $exists: true, $ne: [] },
          },
        },
        { $unwind: '$sponsors' },
        { $match: { 'sponsors.name': { $nin: [null, ''] } } },
        {
          $group: {
            _id: { jurisdiction: '$jurisdictionName', sponsor: '$sponsors.name' },
            count: { $sum: 1 },
          },
        },
        {
          $group: {
            _id: '$_id.jurisdiction',
            counts: { $push: '$count' },
          },
        },
      ],
      { maxTimeMS: 15000, allowDiskUse: true },
    )
    .toArray();

  const result: Record<string, number | null> = {};
  for (const row of rows) {
    const abbr = jurisdictionNameToAbbr(row._id);
    if (!abbr) continue;
    result[abbr] = sponsorConcentration(row.counts || []).top10Share;
  }
  return result;
}

async function fetchMapDataFromDb(requestedAbbrs: string[] | null): Promise<Record<string, StateData>> {
  const legislationCollection = await getCollection('legislation');
  const { thirtyDaysAgo, sixtyDaysAgo } = dashboardDateWindows();

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

  const includeProcessMetrics = Boolean(requestedAbbrs && requestedAbbrs.length > 0);
  const doaExpression = deadOnArrivalExpression(thirtyDaysAgo);

  if (includeProcessMetrics) {
    pipeline.push({ $addFields: { chamberBucket: chamberBucketExpression } });
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
        enactedCount: { $sum: { $cond: [enactedDateMatch, 1, 0] } },
        averageVelocity: { $avg: velocityDaysExpression },
        ...(includeProcessMetrics
          ? {
              multiSponsorBills: { $sum: { $cond: [multiSponsorExpression, 1, 0] } },
              doaCount: { $sum: { $cond: [doaExpression, 1, 0] } },
              pingPongCount: { $sum: { $cond: [pingPongExpression, 1, 0] } },
              upperCount: { $sum: { $cond: [{ $eq: ['$chamberBucket', 'upper'] }, 1, 0] } },
              lowerCount: { $sum: { $cond: [{ $eq: ['$chamberBucket', 'lower'] }, 1, 0] } },
            }
          : {}),
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
        enactedCount: 1,
        averageVelocity: 1,
        multiSponsorBills: 1,
        doaCount: 1,
        pingPongCount: 1,
        upperCount: 1,
        lowerCount: 1,
      },
    },
    { $sort: { totalBills: -1 } },
  );

  const fetchLegislation = legislationCollection
    .aggregate(pipeline, {
      maxTimeMS: requestedAbbrs ? 20000 : 25000,
      allowDiskUse: true,
    })
    .toArray();

  const extrasPromise: Promise<[
    Record<string, { bipartisanRate?: number | null }>,
    Record<string, number>,
    Record<string, number | null>,
  ]> = requestedAbbrs
    ? Promise.all([
        computeBipartisanByJurisdiction({
          jurisdictionName: { $in: jurisdictionNamesForAbbrs(requestedAbbrs) },
          latestActionAt: { $gte: sixtyDaysAgo },
        }).catch((error) => {
          console.error('[Map Data] Bipartisan aggregation failed:', error);
          return {};
        }),
        fetchTopicMomentumByJurisdiction(requestedAbbrs).catch((error) => {
          console.error('[Map Data] Topic momentum aggregation failed:', error);
          return {};
        }),
        fetchSponsorConcentrationByJurisdiction(requestedAbbrs).catch((error) => {
          console.error('[Map Data] Sponsor concentration aggregation failed:', error);
          return {};
        }),
      ])
    : Promise.resolve([{}, {}, {}]);

  const [results, representativeCounts, congressMemberCount, extraPair] = await Promise.all([
    fetchLegislation,
    getCachedRepresentativeCounts(),
    getCachedCongressMemberCount(),
    extrasPromise,
  ]);

  representativeCounts.US = congressMemberCount;

  const [bipartisanByJurisdiction, topicMomentum, concentrationByAbbr] = extraPair;
  const extras: Record<string, {
    bipartisanRate?: number | null;
    topicMomentum?: number;
    sponsorConcentration?: number | null;
  }> = {};
  for (const [jurisdiction, counts] of Object.entries(bipartisanByJurisdiction)) {
    const abbr = jurisdictionNameToAbbr(jurisdiction);
    if (!abbr) continue;
    extras[abbr] = { ...extras[abbr], bipartisanRate: counts.bipartisanRate };
  }
  for (const [abbr, momentum] of Object.entries(topicMomentum)) {
    extras[abbr] = { ...extras[abbr], topicMomentum: momentum };
  }
  for (const [abbr, share] of Object.entries(concentrationByAbbr)) {
    extras[abbr] = { ...extras[abbr], sponsorConcentration: share };
  }

  const stateStats = buildStateStatsFromResults(
    results as Array<{
      _id: string;
      totalBills?: number;
      recentBills?: number;
      sampleSubjects?: string[];
      uniqueSponsors?: number;
      uniqueTopics?: number;
      topSubjects?: string[];
      enactedCount?: number;
      averageVelocity?: number | null;
      multiSponsorBills?: number;
      doaCount?: number;
      pingPongCount?: number;
      upperCount?: number;
      lowerCount?: number;
    }>,
    representativeCounts,
    extras,
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
          topicMomentum: 0,
          enactmentRate: null,
          averageBillVelocityDays: null,
          bipartisanRate: null,
          legislativePace: 0,
          chamberUpperShare: null,
          sponsorConcentration: null,
          doaRate: null,
          pingPongRate: null,
          multiSponsorRate: null,
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
      ['map-data-states-v3', cacheKey],
      { revalidate: 600 },
    );
    return cachedFetch();
  }

  const cachedFetch = unstable_cache(
    () => fetchMapDataFromDb(null),
    ['map-data-all-v3'],
    { revalidate: 600 },
  );
  return cachedFetch();
}


async function fetchBaseMapDataFromDb(): Promise<Record<string, StateData>> {
  const legislationCollection = await getCollection('legislation');
  const { thirtyDaysAgo } = dashboardDateWindows();

  const results = await legislationCollection
    .aggregate(
      [
        {
          $match: {
            jurisdictionName: { $exists: true, $nin: [null, ''] },
          },
        },
        {
          $group: {
            _id: '$jurisdictionName',
            totalBills: { $sum: 1 },
            recentBills: {
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
            sampleSubjects: { $addToSet: { $arrayElemAt: ['$subjects', 0] } },
            topicSubjects: { $addToSet: { $arrayElemAt: ['$subjects', 0] } },
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
                    cond: { $and: [{ $ne: ['$$this', null] }, { $ne: ['$$this', ''] }] },
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
          },
        },
      ],
      { maxTimeMS: 20000, allowDiskUse: true },
    )
    .toArray();

  const [representativeCounts, congressMemberCount] = await Promise.all([
    getCachedRepresentativeCounts(),
    getCachedCongressMemberCount(),
  ]);
  representativeCounts.US = congressMemberCount;

  const stateStats = buildStateStatsFromResults(
    results as Array<{
      _id: string;
      totalBills?: number;
      recentBills?: number;
      uniqueTopics?: number;
      topSubjects?: string[];
    }>,
    representativeCounts,
  );

  for (const [abbr, name] of Object.entries(STATE_NAMES)) {
    if (stateStats[abbr] || !STATE_COORDINATES[abbr]) continue;
    stateStats[abbr] = {
      name,
      abbreviation: abbr,
      legislationCount: 0,
      activeRepresentatives: representativeCounts[abbr] || 0,
      recentActivity: 0,
      topicDiversity: 0,
      topicMomentum: 0,
      enactmentRate: null,
      averageBillVelocityDays: null,
      bipartisanRate: null,
      legislativePace: 0,
      chamberUpperShare: null,
      sponsorConcentration: null,
      doaRate: null,
      pingPongRate: null,
      multiSponsorRate: null,
      keyTopics: ['No Data'],
      center: STATE_COORDINATES[abbr],
      color: '#e0e0e0',
    };
  }

  return stateStats;
}

const getCachedBaseMapData = unstable_cache(
  () => fetchBaseMapDataFromDb(),
  ['map-data-base-v1'],
  { revalidate: 600 },
);

export async function getBaseMapData(): Promise<Record<string, StateData>> {
  return getCachedBaseMapData();
}

export type MapSupplementalMetric = 'trends' | 'bipartisan' | 'lifecycle';

export async function getMapSupplementalMetric(
  metric: MapSupplementalMetric,
): Promise<Record<string, Partial<StateData>>> {
  const cachedFetch = unstable_cache(
    async () => {
      const abbrs = Object.keys(STATE_NAMES).filter((abbr) => Boolean(STATE_COORDINATES[abbr]));

      if (metric === 'trends') {
        const momentum = await fetchTopicMomentumByJurisdiction(abbrs);
        return Object.fromEntries(
          Object.entries(momentum).map(([abbr, topicMomentum]) => [abbr, { topicMomentum }]),
        );
      }

      if (metric === 'bipartisan') {
        const { sixtyDaysAgo } = dashboardDateWindows();
        const rows = await computeBipartisanByJurisdiction({
          jurisdictionName: { $in: jurisdictionNamesForAbbrs(abbrs) },
          latestActionAt: { $gte: sixtyDaysAgo },
        });

        const result: Record<string, Partial<StateData>> = {};
        for (const [jurisdiction, counts] of Object.entries(rows)) {
          const abbr = jurisdictionNameToAbbr(jurisdiction);
          if (abbr) result[abbr] = { bipartisanRate: counts.bipartisanRate };
        }
        return result;
      }

      const legislationCollection = await getCollection('legislation');
      const rows = await legislationCollection
        .aggregate(
          [
            {
              $match: {
                jurisdictionName: { $in: jurisdictionNamesForAbbrs(abbrs) },
              },
            },
            {
              $group: {
                _id: '$jurisdictionName',
                totalBills: { $sum: 1 },
                enactedCount: { $sum: { $cond: [enactedDateMatch, 1, 0] } },
                averageVelocity: { $avg: velocityDaysExpression },
              },
            },
          ],
          { maxTimeMS: 20000, allowDiskUse: true },
        )
        .toArray();

      const result: Record<string, Partial<StateData>> = {};
      for (const row of rows) {
        const abbr = jurisdictionNameToAbbr(row._id);
        if (!abbr) continue;
        result[abbr] = {
          enactmentRate: roundRate(row.enactedCount || 0, row.totalBills || 0),
          averageBillVelocityDays: roundDays(row.averageVelocity),
        };
      }
      return result;
    },
    ['map-data-supplemental-v2', metric],
    { revalidate: 600 },
  );

  return cachedFetch();
}
