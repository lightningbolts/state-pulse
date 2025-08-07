import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';
import { STATE_NAMES } from '@/types/geo';



export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ state: string }> }
) {
  try {
    const resolvedParams = await params;
    const stateParam = resolvedParams.state.toUpperCase();
    const stateName = STATE_NAMES[stateParam];
    if (!stateName) {
      return NextResponse.json(
        { success: false, error: 'Invalid state parameter' },
        { status: 400 }
      );
    }

    const jurisdictionRegex = new RegExp(stateName, 'i');
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const legislationCollection = await getCollection('legislation');

    const recentLegislation = await legislationCollection
      .find({
        jurisdictionName: { $regex: jurisdictionRegex },
        latestActionAt: { $gte: thirtyDaysAgo }
      })
      .sort({ latestActionAt: -1 })
      .limit(10)
      .project({
        identifier: 1,
        title: 1,
        latestActionAt: 1,
        latestActionDescription: 1,
        subjects: 1,
        sponsors: 1,
        chamber: 1
      })
      .toArray();

    const topicsAggregation = await legislationCollection
      .aggregate([
        {
          $match: {
            jurisdictionName: { $regex: jurisdictionRegex },
            subjects: { $exists: true, $ne: [] }
          }
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
                  else: 0
                }
              }
            }
          }
        },
        { $match: { _id: { $nin: [null, ''] } } },
        { $sort: { recentCount: -1, count: -1 } },
        { $limit: 10 }
      ])
      .toArray();

    const sponsorActivity = await legislationCollection
      .aggregate([
        {
          $match: {
            jurisdictionName: { $regex: jurisdictionRegex },
            sponsors: { $exists: true, $ne: [] }
          }
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
                  else: 0
                }
              }
            }
          }
        },
        { $match: { _id: { $nin: [null, ''] } } },
        { $sort: { recentBills: -1, totalBills: -1 } },
        { $limit: 10 }
      ])
      .toArray();

    const overallStats = await legislationCollection
      .aggregate([
        { $match: { jurisdictionName: { $regex: jurisdictionRegex } } },
        {
          $group: {
            _id: null,
            totalBills: { $sum: 1 },
            recentBills: {
              $sum: {
                $cond: {
                  if: { $gte: ['$latestActionAt', thirtyDaysAgo] },
                  then: 1,
                  else: 0
                }
              }
            },
            averageAge: {
              $avg: {
                $divide: [
                  { $subtract: [new Date(), '$createdAt'] },
                  1000 * 60 * 60 * 24
                ]
              }
            }
          }
        }
      ])
      .toArray();

    const stats = overallStats[0] || {
      totalBills: 0,
      recentBills: 0,
      averageAge: 0
    };

    return NextResponse.json({
      success: true,
      data: {
        state: stateParam,
        statistics: {
          totalLegislation: stats.totalBills,
          recentActivity: stats.recentBills,
          activeSponsors: sponsorActivity.length,
          averageBillAge: Math.round(stats.averageAge || 0)
        },
        recentLegislation: recentLegislation.map(bill => ({
          id: bill._id,
          identifier: bill.identifier,
          title: bill.title,
          lastAction: bill.latestActionDescription,
          lastActionDate: bill.latestActionAt,
          subjects: bill.subjects || [],
          primarySponsor: bill.sponsors && bill.sponsors.length > 0
            ? bill.sponsors.find((s: any) => s.primary)?.name || bill.sponsors[0].name
            : 'Unknown',
          chamber: bill.chamber
        })),
        trendingTopics: topicsAggregation.map(topic => ({
          name: topic._id,
          totalCount: topic.count,
          recentCount: topic.recentCount,
          trend: topic.recentCount > 0 ? 'up' : 'stable'
        })),
        topSponsors: sponsorActivity.map(sponsor => ({
          name: sponsor._id,
          totalBills: sponsor.totalBills,
          recentBills: sponsor.recentBills,
          activity: sponsor.recentBills > 0 ? 'active' : 'inactive'
        }))
      }
    });

  } catch (error) {
    console.error('Error fetching state details:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch state details' },
      { status: 500 }
    );
  }
}
