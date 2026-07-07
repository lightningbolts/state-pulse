import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';
import { unstable_cache } from 'next/cache';

const CONGRESS_JURISDICTION = 'United States Congress';

async function fetchCongressDetailData() {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const legislationCollection = await getCollection('legislation');
  const jurisdictionMatch = { jurisdictionName: CONGRESS_JURISDICTION };

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
      fromOrganization: 1,
    })
    .toArray();

  const topicsAggregationPromise = legislationCollection
    .aggregate([
      {
        $match: {
          ...jurisdictionMatch,
          subjects: { $exists: true, $ne: [] },
        },
      },
      { $unwind: '$subjects' },
      {
        $group: {
          _id: '$subjects',
          count: { $sum: 1 },
          recentCount: {
            $sum: {
              $cond: {
                if: { $gte: ['$latestActionAt', thirtyDaysAgo] },
                then: 1,
                else: 0,
              },
            },
          },
        },
      },
      { $match: { _id: { $nin: [null, ''] } } },
      { $sort: { recentCount: -1, count: -1 } },
      { $limit: 20 },
    ])
    .toArray();

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
              $cond: {
                if: { $gte: ['$latestActionAt', thirtyDaysAgo] },
                then: 1,
                else: 0,
              },
            },
          },
        },
      },
      { $match: { _id: { $nin: [null, ''] } } },
      { $sort: { recentBills: -1, totalBills: -1 } },
      { $limit: 20 },
    ])
    .toArray();

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
      {
        $group: {
          _id: null,
          totalBills: { $sum: 1 },
          recentBills: {
            $sum: {
              $cond: {
                if: { $gte: ['$latestActionAt', thirtyDaysAgo] },
                then: 1,
                else: 0,
              },
            },
          },
          averageAge: {
            $avg: {
              $divide: [
                { $subtract: [new Date(), '$createdAt'] },
                1000 * 60 * 60 * 24,
              ],
            },
          },
        },
      },
    ])
    .toArray();

  const [
    recentLegislation,
    topicsAggregation,
    sponsorActivity,
    activeSponsorsResult,
    overallStats,
  ] = await Promise.all([
    recentLegislationPromise,
    topicsAggregationPromise,
    sponsorActivityPromise,
    activeSponsorsPromise,
    overallStatsPromise,
  ]);

  const stats = overallStats[0] || {
    totalBills: 0,
    recentBills: 0,
    averageAge: 0,
  };

  return {
    jurisdiction: CONGRESS_JURISDICTION,
    statistics: {
      totalLegislation: stats.totalBills,
      recentActivity: stats.recentBills,
      activeSponsors: activeSponsorsResult[0]?.total || 0,
      averageBillAge: Math.round(stats.averageAge || 0),
    },
    recentLegislation: recentLegislation.map((bill) => ({
      id: bill._id.toString(),
      identifier: bill.identifier || 'N/A',
      title: bill.title || 'No title available',
      lastAction: bill.latestActionDescription || 'No recent action',
      lastActionDate: bill.latestActionAt || new Date().toISOString(),
      subjects: bill.subjects || [],
      primarySponsor:
        bill.sponsors && bill.sponsors.length > 0
          ? bill.sponsors.find((s: { primary?: boolean }) => s.primary)?.name ||
            bill.sponsors[0].name
          : 'Unknown',
      chamber: bill.fromOrganization || 'Federal',
    })),
    trendingTopics: topicsAggregation.map((topic) => ({
      name: topic._id,
      totalCount: topic.count,
      recentCount: topic.recentCount,
      trend: topic.recentCount > 0 ? 'up' : 'stable',
    })),
    topSponsors: sponsorActivity.map((sponsor) => ({
      name: sponsor._id,
      totalBills: sponsor.totalBills,
      recentBills: sponsor.recentBills,
      activity: sponsor.recentBills > 0 ? 'active' : 'inactive',
    })),
  };
}

export async function GET() {
  try {
    const cachedFetch = unstable_cache(
      fetchCongressDetailData,
      ['dashboard-congress-detail'],
      { revalidate: 600 },
    );
    const data = await cachedFetch();

    return NextResponse.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('Error fetching US Congress dashboard data:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch US Congress dashboard data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
