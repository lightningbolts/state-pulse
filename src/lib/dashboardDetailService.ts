import { getCollection } from '@/lib/mongodb';
import type {
  ChamberMix,
  ClassificationMix,
  SessionPhaseBreakdown,
  StateDetailData,
  TrendingTopic,
} from '@/types/jurisdictions';
import {
  SPARKLINE_WEEKS,
  chamberBucketExpression,
  classificationBucketExpression,
  dashboardDateWindows,
  deadOnArrivalExpression,
  emptyWeeklyCounts,
  enactedDateMatch,
  pingPongExpression,
  primarySponsorExpression,
  roundDays,
  roundRate,
  sessionPhaseFromRange,
  sponsorConcentration,
  topicArrayExpression,
  trendFromWindowCounts,
  velocityDaysExpression,
  weeklyPace,
  multiSponsorExpression,
} from '@/lib/dashboardMetrics';
import { computeBipartisanForMatch } from '@/lib/dashboardBipartisan';

type TopicAggRow = {
  _id: string;
  count: number;
  recentCount: number;
  priorCount: number;
};

type SponsorAggRow = {
  _id: string;
  totalBills: number;
  recentBills: number;
};

type StatsAggRow = {
  totalBills?: number;
  recentBills?: number;
  averageAge?: number;
  enactedCount?: number;
  averageVelocity?: number | null;
  multiSponsorBills?: number;
  primaryBills?: number;
  doaCount?: number;
  pingPongCount?: number;
  typeBills?: number;
  typeResolutions?: number;
  typeMemorials?: number;
  typeOther?: number;
  upperCount?: number;
  lowerCount?: number;
  unicameralCount?: number;
  otherChamberCount?: number;
  primaryMentions?: number;
  cosponsorMentions?: number;
};

function mapTrendingTopics(
  rows: TopicAggRow[],
  weeklyByTopic: Record<string, number[]>,
): TrendingTopic[] {
  return rows.map((topic) => {
    const trend = trendFromWindowCounts(topic.recentCount || 0, topic.priorCount || 0);
    return {
      name: topic._id,
      totalCount: topic.count,
      recentCount: topic.recentCount,
      priorCount: topic.priorCount,
      pctChange: trend.pctChange,
      trend: trend.direction,
      weeklyCounts: weeklyByTopic[topic._id] || emptyWeeklyCounts(),
    };
  });
}

function emptyChamberMix(): ChamberMix {
  return { upper: 0, lower: 0, unicameral: 0, other: 0 };
}

function emptyClassificationMix(): ClassificationMix {
  return { bills: 0, resolutions: 0, memorials: 0, other: 0 };
}

export async function fetchJurisdictionDashboard(options: {
  jurisdictionName: string;
  state?: string;
  jurisdiction?: string;
}): Promise<StateDetailData> {
  const { now, thirtyDaysAgo, sixtyDaysAgo, eightWeeksAgo } = dashboardDateWindows();
  const legislationCollection = await getCollection('legislation');
  const jurisdictionMatch = { jurisdictionName: options.jurisdictionName };
  const doaExpression = deadOnArrivalExpression(thirtyDaysAgo);

  const recentLegislationPromise = legislationCollection
    .find({
      ...jurisdictionMatch,
      latestActionAt: { $gte: thirtyDaysAgo },
    })
    .sort({ latestActionAt: -1 })
    .limit(20)
    .project({
      identifier: 1,
      title: 1,
      latestActionAt: 1,
      latestActionDescription: 1,
      subjects: 1,
      sponsors: 1,
      chamber: 1,
      fromOrganization: 1,
    })
    .toArray();

  const topicsAggregationPromise = legislationCollection
    .aggregate([
      { $match: jurisdictionMatch },
      { $addFields: { dashboardTopics: topicArrayExpression } },
      { $unwind: '$dashboardTopics' },
      {
        $group: {
          _id: '$dashboardTopics',
          count: { $sum: 1 },
          recentCount: {
            $sum: {
              $cond: [{ $gte: ['$latestActionAt', thirtyDaysAgo] }, 1, 0],
            },
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
      { $match: { _id: { $nin: [null, ''] } } },
      { $sort: { recentCount: -1, count: -1 } },
      { $limit: 20 },
    ])
    .toArray() as Promise<TopicAggRow[]>;

  const weeklyTopicsPromise = legislationCollection
    .aggregate([
      {
        $match: {
          ...jurisdictionMatch,
          latestActionAt: { $gte: eightWeeksAgo },
        },
      },
      { $addFields: { dashboardTopics: topicArrayExpression } },
      { $unwind: '$dashboardTopics' },
      { $match: { dashboardTopics: { $nin: [null, ''] } } },
      {
        $group: {
          _id: {
            topic: '$dashboardTopics',
            weekAge: {
              $floor: {
                $divide: [
                  { $subtract: [now, '$latestActionAt'] },
                  7 * 24 * 60 * 60 * 1000,
                ],
              },
            },
          },
          count: { $sum: 1 },
        },
      },
    ])
    .toArray()
    .catch((error) => {
      console.error('[Dashboard] Weekly topic aggregation failed:', error);
      return [];
    });

  const weeklyActivityPromise = legislationCollection
    .aggregate([
      {
        $match: {
          ...jurisdictionMatch,
          latestActionAt: { $gte: eightWeeksAgo },
        },
      },
      {
        $group: {
          _id: {
            $floor: {
              $divide: [
                { $subtract: [now, '$latestActionAt'] },
                7 * 24 * 60 * 60 * 1000,
              ],
            },
          },
          count: { $sum: 1 },
        },
      },
    ])
    .toArray()
    .catch((error) => {
      console.error('[Dashboard] Weekly activity aggregation failed:', error);
      return [];
    });

  const sponsorActivityPromise = legislationCollection
    .aggregate([
      {
        $match: {
          ...jurisdictionMatch,
          sponsors: { $exists: true, $ne: [] },
        },
      },
      { $unwind: '$sponsors' },
      {
        $group: {
          _id: '$sponsors.name',
          totalBills: { $sum: 1 },
          recentBills: {
            $sum: {
              $cond: [{ $gte: ['$latestActionAt', thirtyDaysAgo] }, 1, 0],
            },
          },
        },
      },
      { $match: { _id: { $nin: [null, ''] } } },
      { $sort: { recentBills: -1, totalBills: -1 } },
      { $limit: 20 },
    ])
    .toArray() as Promise<SponsorAggRow[]>;

  const sponsorCountsPromise = legislationCollection
    .aggregate([
      {
        $match: {
          ...jurisdictionMatch,
          sponsors: { $exists: true, $ne: [] },
        },
      },
      { $unwind: '$sponsors' },
      { $match: { 'sponsors.name': { $nin: [null, ''] } } },
      { $group: { _id: '$sponsors.name', count: { $sum: 1 } } },
      { $project: { _id: 0, count: 1 } },
    ])
    .toArray() as Promise<Array<{ count: number }>>;

  const activeSponsorsPromise = legislationCollection
    .aggregate([
      {
        $match: {
          ...jurisdictionMatch,
          sponsors: { $exists: true, $ne: [] },
        },
      },
      { $unwind: '$sponsors' },
      { $group: { _id: '$sponsors.name' } },
      { $count: 'total' },
    ])
    .toArray();

  const overallStatsPromise = legislationCollection
    .aggregate([
      { $match: jurisdictionMatch },
      { $addFields: { chamberBucket: chamberBucketExpression, classBucket: classificationBucketExpression } },
      {
        $group: {
          _id: null,
          totalBills: { $sum: 1 },
          recentBills: {
            $sum: {
              $cond: [{ $gte: ['$latestActionAt', thirtyDaysAgo] }, 1, 0],
            },
          },
          enactedCount: {
            $sum: { $cond: [enactedDateMatch, 1, 0] },
          },
          averageAge: {
            $avg: {
              $divide: [{ $subtract: [now, '$createdAt'] }, 1000 * 60 * 60 * 24],
            },
          },
          averageVelocity: { $avg: velocityDaysExpression },
          multiSponsorBills: { $sum: { $cond: [multiSponsorExpression, 1, 0] } },
          primaryBills: { $sum: { $cond: [primarySponsorExpression, 1, 0] } },
          doaCount: { $sum: { $cond: [doaExpression, 1, 0] } },
          pingPongCount: { $sum: { $cond: [pingPongExpression, 1, 0] } },
          typeBills: { $sum: { $cond: [{ $eq: ['$classBucket', 'bill'] }, 1, 0] } },
          typeResolutions: { $sum: { $cond: [{ $eq: ['$classBucket', 'resolution'] }, 1, 0] } },
          typeMemorials: { $sum: { $cond: [{ $eq: ['$classBucket', 'memorial'] }, 1, 0] } },
          typeOther: { $sum: { $cond: [{ $eq: ['$classBucket', 'other'] }, 1, 0] } },
          upperCount: { $sum: { $cond: [{ $eq: ['$chamberBucket', 'upper'] }, 1, 0] } },
          lowerCount: { $sum: { $cond: [{ $eq: ['$chamberBucket', 'lower'] }, 1, 0] } },
          unicameralCount: { $sum: { $cond: [{ $eq: ['$chamberBucket', 'unicameral'] }, 1, 0] } },
          otherChamberCount: { $sum: { $cond: [{ $eq: ['$chamberBucket', 'other'] }, 1, 0] } },
        },
      },
    ])
    .toArray() as Promise<StatsAggRow[]>;

  const sponsorRolePromise = legislationCollection
    .aggregate([
      {
        $match: {
          ...jurisdictionMatch,
          sponsors: { $exists: true, $ne: [] },
        },
      },
      { $unwind: '$sponsors' },
      {
        $group: {
          _id: null,
          primaryMentions: { $sum: { $cond: [{ $eq: ['$sponsors.primary', true] }, 1, 0] } },
          cosponsorMentions: { $sum: { $cond: [{ $ne: ['$sponsors.primary', true] }, 1, 0] } },
        },
      },
    ])
    .toArray() as Promise<Array<{ primaryMentions?: number; cosponsorMentions?: number }>>;

  const sessionPhasePromise = legislationCollection
    .aggregate([
      { $match: { ...jurisdictionMatch, session: { $exists: true, $nin: [null, ''] } } },
      {
        $group: {
          _id: '$session',
          count: { $sum: 1 },
          minFirst: { $min: '$firstActionAt' },
          maxLatest: { $max: '$latestActionAt' },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 1 },
    ])
    .toArray() as Promise<Array<{
      _id: string;
      count: number;
      minFirst?: Date;
      maxLatest?: Date;
    }>>;

  const [
    recentLegislation,
    topicsAggregation,
    weeklyTopicRows,
    weeklyActivityRows,
    sponsorActivity,
    sponsorCounts,
    activeSponsorsResult,
    overallStats,
    sponsorRoles,
    sessionRows,
    bipartisan,
  ] = await Promise.all([
    recentLegislationPromise,
    topicsAggregationPromise,
    weeklyTopicsPromise,
    weeklyActivityPromise,
    sponsorActivityPromise,
    sponsorCountsPromise,
    activeSponsorsPromise,
    overallStatsPromise,
    sponsorRolePromise,
    sessionPhasePromise,
    computeBipartisanForMatch(jurisdictionMatch),
  ]);

  const stats = overallStats[0] || {};
  const totalBills = stats.totalBills || 0;
  const enactedCount = stats.enactedCount || 0;
  const concentration = sponsorConcentration(sponsorCounts.map((row) => row.count));
  const primaryMentions = sponsorRoles[0]?.primaryMentions || 0;
  const cosponsorMentions = sponsorRoles[0]?.cosponsorMentions || 0;

  const weeklyByTopic: Record<string, number[]> = {};
  for (const row of weeklyTopicRows as Array<{ _id?: { topic?: string; weekAge?: number }; count?: number }>) {
    const topic = row._id?.topic;
    const weekAge = row._id?.weekAge;
    if (!topic || weekAge == null || weekAge < 0 || weekAge >= SPARKLINE_WEEKS) continue;
    if (!weeklyByTopic[topic]) weeklyByTopic[topic] = emptyWeeklyCounts();
    weeklyByTopic[topic][SPARKLINE_WEEKS - 1 - weekAge] += row.count || 0;
  }

  const weeklyActivity = emptyWeeklyCounts();
  for (const row of weeklyActivityRows as Array<{ _id?: number; count?: number }>) {
    const weekAge = row._id;
    if (weekAge == null || weekAge < 0 || weekAge >= SPARKLINE_WEEKS) continue;
    weeklyActivity[SPARKLINE_WEEKS - 1 - weekAge] = row.count || 0;
  }

  const sessionRow = sessionRows[0];
  let sessionPhase: SessionPhaseBreakdown = {
    session: sessionRow?._id || null,
    current: null,
    early: 0,
    mid: 0,
    late: 0,
  };
  if (sessionRow?._id && sessionRow.minFirst && sessionRow.maxLatest) {
    const start = new Date(sessionRow.minFirst);
    const end = new Date(sessionRow.maxLatest);
    sessionPhase.current = sessionPhaseFromRange(now, start, end);
    const span = end.getTime() - start.getTime();
    if (span > 0) {
      try {
        const t1 = new Date(start.getTime() + span / 3);
        const t2 = new Date(start.getTime() + (2 * span) / 3);
        const buckets = await legislationCollection
          .aggregate([
            { $match: { ...jurisdictionMatch, session: sessionRow._id, firstActionAt: { $exists: true, $ne: null } } },
            {
              $group: {
                _id: null,
                early: { $sum: { $cond: [{ $lt: ['$firstActionAt', t1] }, 1, 0] } },
                mid: {
                  $sum: {
                    $cond: [
                      { $and: [{ $gte: ['$firstActionAt', t1] }, { $lt: ['$firstActionAt', t2] }] },
                      1,
                      0,
                    ],
                  },
                },
                late: { $sum: { $cond: [{ $gte: ['$firstActionAt', t2] }, 1, 0] } },
              },
            },
          ])
          .toArray();
        sessionPhase = {
          ...sessionPhase,
          early: buckets[0]?.early || 0,
          mid: buckets[0]?.mid || 0,
          late: buckets[0]?.late || 0,
        };
      } catch (error) {
        console.error('[Dashboard] Session phase buckets failed:', error);
      }
    }
  }

  const classificationMix: ClassificationMix = {
    bills: stats.typeBills || 0,
    resolutions: stats.typeResolutions || 0,
    memorials: stats.typeMemorials || 0,
    other: stats.typeOther || 0,
  };
  const chamberMix: ChamberMix = {
    upper: stats.upperCount || 0,
    lower: stats.lowerCount || 0,
    unicameral: stats.unicameralCount || 0,
    other: stats.otherChamberCount || 0,
  };
  const chamberDenom = chamberMix.upper + chamberMix.lower;

  return {
    state: options.state,
    jurisdiction: options.jurisdiction,
    statistics: {
      totalLegislation: totalBills,
      recentActivity: stats.recentBills || 0,
      activeSponsors: activeSponsorsResult[0]?.total || 0,
      averageBillAge: Math.round(stats.averageAge || 0),
      enactedCount,
      enactmentRate: roundRate(enactedCount, totalBills),
      averageBillVelocityDays: roundDays(stats.averageVelocity),
      bipartisanRate: bipartisan.bipartisanRate,
      bipartisanScoredBills: bipartisan.scoredBills,
      legislativePace: weeklyPace(stats.recentBills || 0),
      sponsorConcentration: concentration.top10Share,
      sponsorHhi: concentration.hhi,
      multiSponsorRate: roundRate(stats.multiSponsorBills || 0, totalBills),
      multiSponsorCount: stats.multiSponsorBills || 0,
      primaryShare: roundRate(primaryMentions, primaryMentions + cosponsorMentions),
      primaryMentions,
      cosponsorMentions,
      doaRate: roundRate(stats.doaCount || 0, totalBills),
      doaCount: stats.doaCount || 0,
      pingPongRate: roundRate(stats.pingPongCount || 0, totalBills),
      pingPongCount: stats.pingPongCount || 0,
      weeklyActivity,
    },
    sessionPhase,
    classificationMix: classificationMix.bills + classificationMix.resolutions + classificationMix.memorials + classificationMix.other > 0
      ? classificationMix
      : emptyClassificationMix(),
    chamberMix: chamberDenom + chamberMix.unicameral + chamberMix.other > 0 ? chamberMix : emptyChamberMix(),
    recentLegislation: recentLegislation.map((bill) => ({
      id: bill._id?.toString?.() ?? String(bill._id),
      identifier: bill.identifier || 'N/A',
      title: bill.title || 'No title available',
      lastAction: bill.latestActionDescription || 'No recent action',
      lastActionDate: bill.latestActionAt || new Date().toISOString(),
      subjects: bill.subjects || [],
      primarySponsor:
        bill.sponsors && bill.sponsors.length > 0
          ? bill.sponsors.find((s: { primary?: boolean }) => s.primary)?.name || bill.sponsors[0].name
          : 'Unknown',
      chamber: bill.chamber || bill.fromOrganization || 'Unknown',
    })),
    trendingTopics: mapTrendingTopics(topicsAggregation, weeklyByTopic),
    topSponsors: sponsorActivity.map((sponsor) => ({
      name: sponsor._id,
      totalBills: sponsor.totalBills,
      recentBills: sponsor.recentBills,
      activity: sponsor.recentBills > 0 ? 'active' : 'inactive',
    })),
  };
}
