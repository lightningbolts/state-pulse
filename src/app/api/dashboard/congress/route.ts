import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';

export async function GET() {
  console.log('Congress API endpoint called');
  try {
    const legislationCollection = await getCollection('legislation');

    const allJurisdictionsResult = await legislationCollection.aggregate([
      { $group: { _id: "$jurisdictionName" } },
      { $match: { _id: { $ne: null } } },
      { $sort: { _id: 1 } },
      { $limit: 50 }
    ]).toArray();

    const allJurisdictions = allJurisdictionsResult.map(item => item._id);
    console.log('All jurisdictions in database:', allJurisdictions.slice(0, 20)); // Log first 20

    const currentYear = new Date().getFullYear();
    const congressNumber = Math.floor((currentYear - 1789) / 2) + 1;
    const currentCongressSession = `${congressNumber}th Congress`;
    const nextCongressSession = `${congressNumber + 1}th Congress`;

    const allCongressQuery = {
      jurisdictionName: "United States Congress"
    };

    const recentCongressQuery = {
      session: { $in: [currentCongressSession, nextCongressSession] }
    };

    const totalLegislation = await legislationCollection.countDocuments(allCongressQuery);

    if (totalLegislation === 0) {
      console.log('No US Congress data found for any session.');
      return NextResponse.json({
        success: true,
        data: {
          jurisdiction: "United States",
          statistics: { totalLegislation: 0, recentActivity: 0, activeSponsors: 0, averageBillAge: 0 },
          recentLegislation: [],
          trendingTopics: [],
          topSponsors: [],
          debugInfo: { message: "No US Congress data found" }
        }
      });
    }

    console.log(`Found ${totalLegislation} total documents for all of US Congress.`);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentActivity = await legislationCollection.countDocuments({
      ...allCongressQuery,
      $or: [
        { lastActionAt: { $gte: thirtyDaysAgo } },
        { createdAt: { $gte: thirtyDaysAgo } },
        { "history.date": { $gte: thirtyDaysAgo.toISOString().split('T')[0] } }
      ]
    });

    console.log('Recent US Congress activity (all sessions):', recentActivity);

    const activeSponsorsResult = await legislationCollection.aggregate([
      { $match: allCongressQuery },
      { $unwind: { path: "$sponsors", preserveNullAndEmptyArrays: true } },
      { $group: { _id: "$sponsors.name" } },
      { $count: "total" }
    ]).toArray();

    const activeSponsors = activeSponsorsResult[0]?.total || 0;

    const avgAgeResult = await legislationCollection.aggregate([
      { $match: { ...allCongressQuery, createdAt: { $exists: true } } },
      {
        $addFields: {
          ageInDays: {
            $divide: [
              { $subtract: [new Date(), "$createdAt"] },
              1000 * 60 * 60 * 24
            ]
          }
        }
      },
      {
        $group: {
          _id: null,
          avgAge: { $avg: "$ageInDays" }
        }
      }
    ]).toArray();

    const averageBillAge = Math.round(avgAgeResult[0]?.avgAge || 0);

    const recentLegislationAggregation = await legislationCollection.aggregate([
      { $match: recentCongressQuery },
      {
        $addFields: {
          mostRecentDate: {
            $max: [
              "$lastActionAt",
              "$createdAt",
              {
                $max: {
                  $map: {
                    input: { $ifNull: ["$history", []] },
                    in: { $dateFromString: { dateString: "$$this.date", onError: new Date(0) } }
                  }
                }
              }
            ]
          }
        }
      },
      { $sort: { mostRecentDate: -1 } },
      { $limit: 10 }
    ]).toArray();

    console.log(`Recent legislation from 119th Congress: ${recentLegislationAggregation.length} documents`);

    const trendingTopics = await legislationCollection.aggregate([
      { $match: allCongressQuery },
      { $unwind: { path: "$subjects", preserveNullAndEmptyArrays: true } },
      { $group: { _id: "$subjects", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $project: {
          name: "$_id",
          totalCount: "$count",
          recentCount: "$count",
          trend: "stable"
        }
      }
    ]).toArray();

    const topSponsors = await legislationCollection.aggregate([
      { $match: allCongressQuery },
      { $unwind: { path: "$sponsors", preserveNullAndEmptyArrays: true } },
      { $group: {
        _id: "$sponsors.name",
        totalBills: { $sum: 1 },
        recentBills: { $sum: 1 }
      }},
      { $sort: { totalBills: -1 } },
      { $limit: 6 },
      {
        $project: {
          name: "$_id",
          totalBills: 1,
          recentBills: 1,
          activity: "active"
        }
      }
    ]).toArray();

    const responseData = {
      jurisdiction: "United States Congress",
      statistics: {
        totalLegislation,
        recentActivity,
        activeSponsors,
        averageBillAge
      },
      recentLegislation: recentLegislationAggregation.map(bill => ({
        id: bill._id.toString(),
        identifier: bill.identifier || 'N/A',
        title: bill.title || 'No title available',
        lastAction: bill.latestActionDescription || 'No recent action',
        lastActionDate: bill.lastActionAt || bill.createdAt || new Date().toISOString(),
        subjects: bill.subjects || [],
        primarySponsor: bill.sponsors?.[0]?.name || 'Unknown',
        chamber: bill.fromOrganization || 'Federal'
      })),
      trendingTopics: trendingTopics.filter(topic => topic.name),
      topSponsors: topSponsors.filter(sponsor => sponsor.name),
      debugInfo: {
        totalDocuments: totalLegislation,
        availableJurisdictions: allJurisdictions.slice(0, 10)
      }
    };

    console.log('US Congress dashboard response data:', {
      jurisdiction: responseData.jurisdiction,
      totalLegislation: responseData.statistics.totalLegislation,
      recentActivity: responseData.statistics.recentActivity,
      activeSponsors: responseData.statistics.activeSponsors,
      averageBillAge: responseData.statistics.averageBillAge,
      recentLegislationCount: responseData.recentLegislation.length,
      trendingTopicsCount: responseData.trendingTopics.length,
      topSponsorsCount: responseData.topSponsors.length
    });

    return NextResponse.json({
      success: true,
      data: responseData
    });

  } catch (error) {
    console.error('Error fetching US Congress dashboard data:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch US Congress dashboard data',
        details: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    );
  }
}
