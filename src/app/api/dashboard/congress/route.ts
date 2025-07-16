import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export async function GET() {
  console.log('Congress API endpoint called');

  try {
    console.log('Attempting to connect to database...');
    const { db } = await connectToDatabase();
    console.log('Database connection successful');

    // Get unique jurisdiction names using aggregation instead of distinct (API v1 compatible)
    const allJurisdictionsResult = await db.collection('legislation').aggregate([
      { $group: { _id: "$jurisdictionName" } },
      { $match: { _id: { $ne: null } } },
      { $sort: { _id: 1 } },
      { $limit: 50 } // Limit to prevent huge responses
    ]).toArray();

    const allJurisdictions = allJurisdictionsResult.map(item => item._id);
    console.log('All jurisdictions in database:', allJurisdictions.slice(0, 20)); // Log first 20

    // Try different possible jurisdiction names for US Congress
    const possibleCongressNames = [
      "United States",
      "United States of America",
      "US",
      "USA",
      "Federal",
      "Congress",
      "U.S. Congress",
      "US Congress",
      // Add variations for different Congress sessions
      "117th Congress",
      "118th Congress",
      "119th Congress",
      "United States Congress",
      "U.S. Federal Government"
    ];

    let jurisdictionPattern = null;
    let totalFound = 0;
    let allCongressCounts = {};

    // Find which jurisdiction name actually has data AND check all variations
    for (const name of possibleCongressNames) {
      const count = await db.collection('legislation').countDocuments({
        jurisdictionName: name
      });
      console.log(`Checking jurisdiction "${name}": ${count} documents`);
      allCongressCounts[name] = count;

      if (count > 0 && !jurisdictionPattern) {
        jurisdictionPattern = name;
        totalFound = count;
        console.log(`Found US Congress data under jurisdiction: "${name}" with ${count} documents`);
      }
    }

    // Log all congress-related jurisdiction names found
    console.log('All Congress-related jurisdiction counts:', allCongressCounts);

    // If we found some Congress data but want to include ALL Congress sessions,
    // let's search for patterns that might include multiple sessions
    if (jurisdictionPattern) {
      // Check if there are other jurisdiction names that might be Congress sessions
      const congressRelatedJurisdictions = allJurisdictions.filter(name =>
        name && (
          name.toLowerCase().includes('congress') ||
          name.toLowerCase().includes('117th') ||
          name.toLowerCase().includes('118th') ||
          name.toLowerCase().includes('119th') ||
          (name.toLowerCase().includes('united') && name.toLowerCase().includes('states'))
        )
      );

      console.log('All Congress-related jurisdictions found in database:', congressRelatedJurisdictions);

      // Calculate total across all Congress sessions
      let totalAcrossAllSessions = 0;
      for (const jurisdiction of congressRelatedJurisdictions) {
        const count = await db.collection('legislation').countDocuments({
          jurisdictionName: jurisdiction
        });
        console.log(`Congress session "${jurisdiction}": ${count} documents`);
        totalAcrossAllSessions += count;
      }

      console.log(`Total across all Congress sessions: ${totalAcrossAllSessions} documents`);

      // If we found multiple Congress sessions, use a query that includes all of them
      if (congressRelatedJurisdictions.length > 1) {
        totalFound = totalAcrossAllSessions;
        console.log(`Using combined query for all Congress sessions with ${totalFound} total documents`);
      }
    }

    // If we still can't find Congress data, return empty response but with info
    if (!jurisdictionPattern) {
      console.log('No US Congress data found in any jurisdiction');
      return NextResponse.json({
        success: true,
        data: {
          jurisdiction: "United States",
          statistics: {
            totalLegislation: 0,
            recentActivity: 0,
            activeSponsors: 0,
            averageBillAge: 0
          },
          recentLegislation: [],
          trendingTopics: [],
          topSponsors: [],
          debugInfo: {
            message: "No US Congress data found",
            availableJurisdictions: allJurisdictions.slice(0, 10),
            searchedNames: possibleCongressNames
          }
        }
      });
    }

    console.log(`Using jurisdiction pattern: "${jurisdictionPattern}" with ${totalFound} documents`);

    // Create query filter for all Congress sessions if multiple found
    let congressQuery;
    if (jurisdictionPattern) {
      // Get all Congress-related jurisdictions that have data
      const congressRelatedJurisdictions = allJurisdictions.filter(name =>
        name && (
          name.toLowerCase().includes('congress') ||
          name.toLowerCase().includes('117th') ||
          name.toLowerCase().includes('118th') ||
          name.toLowerCase().includes('119th') ||
          (name.toLowerCase().includes('united') && name.toLowerCase().includes('states'))
        )
      );

      // Filter to only those with actual data
      const congressJurisdictionsWithData = [];
      for (const jurisdiction of congressRelatedJurisdictions) {
        const count = await db.collection('legislation').countDocuments({
          jurisdictionName: jurisdiction
        });
        if (count > 0) {
          congressJurisdictionsWithData.push(jurisdiction);
        }
      }

      // If we have multiple Congress jurisdictions, query all of them
      if (congressJurisdictionsWithData.length > 1) {
        console.log(`Found multiple Congress jurisdictions: ${congressJurisdictionsWithData.join(', ')}`);
        congressQuery = { jurisdictionName: { $in: congressJurisdictionsWithData } };
      } else {
        congressQuery = { jurisdictionName: jurisdictionPattern };
      }
    } else {
      congressQuery = { jurisdictionName: jurisdictionPattern };
    }

    console.log('Using Congress query:', congressQuery);

    // Get recent activity (last 30 days) - now across ALL Congress sessions
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentActivity = await db.collection('legislation').countDocuments({
      ...congressQuery,
      $or: [
        { lastActionAt: { $gte: thirtyDaysAgo } },
        { createdAt: { $gte: thirtyDaysAgo } },
        // Also check for recent history entries
        {
          "history": {
            $elemMatch: {
              "date": { $gte: thirtyDaysAgo.toISOString().split('T')[0] }
            }
          }
        }
      ]
    });

    console.log('Recent US Congress activity (all sessions):', recentActivity);

    // Get active sponsors count - now across ALL Congress sessions
    const activeSponsorsResult = await db.collection('legislation').aggregate([
      { $match: congressQuery },
      { $unwind: { path: "$sponsors", preserveNullAndEmptyArrays: true } },
      { $group: { _id: "$sponsors.name" } },
      { $count: "total" }
    ]).toArray();

    const activeSponsors = activeSponsorsResult[0]?.total || 0;

    // Calculate average bill age - now across ALL Congress sessions
    const avgAgeResult = await db.collection('legislation').aggregate([
      { $match: { ...congressQuery, createdAt: { $exists: true } } },
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

    // Get recent legislation (last 10) - now across ALL Congress sessions with better sorting
    // Use aggregation to get the most recent date from multiple sources
    const recentLegislationAggregation = await db.collection('legislation').aggregate([
      { $match: congressQuery },
      {
        $addFields: {
          // Calculate the most recent date from multiple sources
          mostRecentDate: {
            $max: [
              "$lastActionAt",
              "$createdAt",
              // Get the most recent history date
              {
                $max: {
                  $map: {
                    input: { $ifNull: ["$history", []] },
                    in: {
                      $dateFromString: {
                        dateString: "$$this.date",
                        onError: new Date(0) // Default to epoch if date parsing fails
                      }
                    }
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

    console.log('Recent US Congress legislation count (all sessions, history-aware):', recentLegislationAggregation.length);

    // Get trending topics - now across ALL Congress sessions
    const trendingTopics = await db.collection('legislation').aggregate([
      { $match: congressQuery },
      { $unwind: { path: "$subjects", preserveNullAndEmptyArrays: true } },
      { $group: { _id: "$subjects", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 10 },
      {
        $project: {
          name: "$_id",
          totalCount: "$count",
          recentCount: "$count", // For simplicity, using same count
          trend: "stable"
        }
      }
    ]).toArray();

    // Get top sponsors - now across ALL Congress sessions
    const topSponsors = await db.collection('legislation').aggregate([
      { $match: congressQuery },
      { $unwind: { path: "$sponsors", preserveNullAndEmptyArrays: true } },
      { $group: {
        _id: "$sponsors.name",
        totalBills: { $sum: 1 },
        recentBills: { $sum: 1 } // For simplicity, using same count
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
      jurisdiction: jurisdictionPattern,
      statistics: {
        totalLegislation: totalFound,
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
        foundJurisdiction: jurisdictionPattern,
        totalDocuments: totalFound,
        searchedNames: possibleCongressNames,
        availableJurisdictions: allJurisdictions.slice(0, 10)
      }
    };

    console.log('US Congress dashboard response data:', {
      foundJurisdiction: jurisdictionPattern,
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
