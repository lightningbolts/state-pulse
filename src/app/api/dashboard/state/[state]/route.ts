import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ state: string }> }
) {
  try {
    const { db } = await connectToDatabase();
    const resolvedParams = await params;
    const stateParam = resolvedParams.state.toUpperCase();

    // Map state abbreviations to jurisdiction patterns
    const jurisdictionPatterns: Record<string, string[]> = {
      'AL': ['Alabama'],
      'AK': ['Alaska'],
      'AZ': ['Arizona'],
      'AR': ['Arkansas'],
      'CA': ['California'],
      'CO': ['Colorado'],
      'CT': ['Connecticut'],
      'DE': ['Delaware'],
      'DC': ['District of Columbia'],
      'FL': ['Florida'],
      'GA': ['Georgia'],
      'HI': ['Hawaii'],
      'ID': ['Idaho'],
      'IL': ['Illinois'],
      'IN': ['Indiana'],
      'IA': ['Iowa'],
      'KS': ['Kansas'],
      'KY': ['Kentucky'],
      'LA': ['Louisiana'],
      'ME': ['Maine'],
      'MD': ['Maryland'],
      'MA': ['Massachusetts'],
      'MI': ['Michigan'],
      'MN': ['Minnesota'],
      'MS': ['Mississippi'],
      'MO': ['Missouri'],
      'MT': ['Montana'],
      'NE': ['Nebraska'],
      'NV': ['Nevada'],
      'NH': ['New Hampshire'],
      'NJ': ['New Jersey'],
      'NM': ['New Mexico'],
      'NY': ['New York'],
      'NC': ['North Carolina'],
      'ND': ['North Dakota'],
      'OH': ['Ohio'],
      'OK': ['Oklahoma'],
      'OR': ['Oregon'],
      'PA': ['Pennsylvania'],
      'RI': ['Rhode Island'],
      'SC': ['South Carolina'],
      'SD': ['South Dakota'],
      'TN': ['Tennessee'],
      'TX': ['Texas'],
      'UT': ['Utah'],
      'VT': ['Vermont'],
      'VA': ['Virginia'],
      'WA': ['Washington'],
      'WV': ['West Virginia'],
      'WI': ['Wisconsin'],
      'WY': ['Wyoming'],
      'US': ['United States Congress', 'Congress']
    };

    const patterns = jurisdictionPatterns[stateParam];
    if (!patterns) {
      return NextResponse.json(
        { success: false, error: 'Invalid state parameter' },
        { status: 400 }
      );
    }

    // Build regex pattern to match jurisdiction names
    const jurisdictionRegex = new RegExp(patterns.join('|'), 'i');

    // Get recent legislation (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Fetch recent legislation for this state
    const recentLegislation = await db.collection('legislation')
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

    // Get trending topics for this state
    const topicsAggregation = await db.collection('legislation')
      .aggregate([
        {
          $match: {
            jurisdictionName: { $regex: jurisdictionRegex },
            subjects: { $exists: true, $ne: [] }
          }
        },
        {
          $unwind: '$subjects'
        },
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
        {
          $match: {
            _id: { $ne: null, $ne: '' }
          }
        },
        {
          $sort: { recentCount: -1, count: -1 }
        },
        {
          $limit: 10
        }
      ])
      .toArray();

    // Get sponsor activity
    const sponsorActivity = await db.collection('legislation')
      .aggregate([
        {
          $match: {
            jurisdictionName: { $regex: jurisdictionRegex },
            sponsors: { $exists: true, $ne: [] }
          }
        },
        {
          $unwind: '$sponsors'
        },
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
        {
          $match: {
            _id: { $ne: null, $ne: '' }
          }
        },
        {
          $sort: { recentBills: -1, totalBills: -1 }
        },
        {
          $limit: 10
        }
      ])
      .toArray();

    // Get overall statistics
    const overallStats = await db.collection('legislation')
      .aggregate([
        {
          $match: {
            jurisdictionName: { $regex: jurisdictionRegex }
          }
        },
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
                  1000 * 60 * 60 * 24 // Convert to days
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
