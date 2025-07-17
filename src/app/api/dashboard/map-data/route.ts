import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import { STATE_NAMES, STATE_COORDINATES } from "@/types/geo";

interface StateStats {
  name: string;
  abbreviation: string;
  legislationCount: number;
  activeRepresentatives: number;
  recentActivity: number;
  keyTopics: string[];
  center: [number, number];
  color: string;
}


export async function GET(request: NextRequest) {
  try {
    const { db } = await connectToDatabase();

    // Get current date for recent activity calculation (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    console.log('Starting map data aggregation...');
    const startTime = Date.now();

    // Simplified and optimized aggregation pipeline
    const pipeline = [
      {
        // Stage 1: Create a normalized 'effectiveJurisdictionName' field.
        // This is the most critical step to correctly differentiate federal from state bills.
        $addFields: {
          effectiveJurisdictionName: {
            $cond: {
              // A bill is considered federal if it meets specific, unambiguous criteria.
              if: {
                $or: [
                  // Criteria 1: The jurisdictionName explicitly says it's federal.
                  { $regexMatch: { input: { $ifNull: ["$jurisdictionName", ""] }, regex: /congress|united states/i } },
                  // Criteria 2: The bill's history involves the President. This is a definitive federal indicator.
                  // NOTE: We avoid using "House" or "Senate" here as they are ambiguous and exist in state legislatures.
                  { $in: ["President of the United States", { $ifNull: ["$history.actor", []] }] }
                ]
              },
              // If it's federal, label it "United States".
              then: "United States",
              // Otherwise, use its existing jurisdictionName.
              else: "$jurisdictionName"
            }
          }
        }
      },
      {
        // Stage 2: Filter out any documents that do not have a valid jurisdiction name after normalization.
        // This removes junk data and bills that are neither clearly federal nor state-level.
        $match: {
          effectiveJurisdictionName: { $exists: true, $ne: null, $ne: "" }
        }
      },
      {
        $group: {
          _id: '$effectiveJurisdictionName',
          totalBills: { $sum: 1 },
          recentBills: {
            $sum: {
              $cond: {
                if: {
                  $and: [
                    { $ne: ['$latestActionAt', null] },
                    { $gte: ['$latestActionAt', thirtyDaysAgo] }
                  ]
                },
                then: 1,
                else: 0
              }
            }
          },
          // Simplified subject collection - just get first few subjects instead of all
          sampleSubjects: { $push: { $arrayElemAt: ['$subjects', 0] } },
          // Count unique sponsors more efficiently
          sponsorCount: { $addToSet: { $arrayElemAt: ['$sponsors.name', 0] } }
        }
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
                  cond: { $ne: ['$$this', null] }
                }
              },
              3
            ]
          },
          uniqueSponsors: { $size: '$sponsorCount' }
        }
      },
      {
        $sort: { totalBills: -1 }
      }
    ];

    const results = await db.collection('legislation').aggregate(pipeline, {
      maxTimeMS: 10000, // 10 second timeout
      allowDiskUse: true // Allow using disk for large operations
    }).toArray();

    console.log(`Aggregation completed in ${Date.now() - startTime}ms`);

    // Process results into state data with better error handling
    const stateStats: Record<string, StateStats> = {};

    results.forEach((result: any) => {
      try {
        const jurisdictionName = result._id;
        let stateAbbr = '';

        // More efficient state matching
        if (jurisdictionName.includes('Congress') || jurisdictionName.includes('United States')) {
          stateAbbr = 'US';
        } else {
          // Try to match by state name
          for (const [abbr, name] of Object.entries(STATE_NAMES)) {
            if (abbr === 'US') continue;
            if (jurisdictionName.toLowerCase().includes(name.toLowerCase())) {
              stateAbbr = abbr;
              break;
            }
          }
        }

        if (stateAbbr && STATE_COORDINATES[stateAbbr]) {
          // Use the simplified subjects
          const topSubjects = (result.topSubjects || [])
            .filter((s: string) => s && s.trim())
            .slice(0, 3);

          // Generate color based on activity level
          const intensity = Math.min(result.totalBills / 1000, 1);
          const hue = (intensity * 240); // Blue to red scale
          const color = `hsl(${240 - hue}, 70%, 50%)`;

          stateStats[stateAbbr] = {
            name: STATE_NAMES[stateAbbr],
            abbreviation: stateAbbr,
            legislationCount: result.totalBills || 0,
            activeRepresentatives: result.uniqueSponsors || 0,
            recentActivity: result.recentBills || 0,
            keyTopics: topSubjects.length > 0 ? topSubjects : ['General'],
            center: STATE_COORDINATES[stateAbbr],
            color: color
          };
        }
      } catch (error) {
        console.error('Error processing result:', result, error);
      }
    });

    // Add missing states with zero data more efficiently
    const existingStates = new Set(Object.keys(stateStats));
    Object.entries(STATE_NAMES).forEach(([abbr, name]) => {
      if (!existingStates.has(abbr) && STATE_COORDINATES[abbr]) {
        stateStats[abbr] = {
          name: name,
          abbreviation: abbr,
          legislationCount: 0,
          activeRepresentatives: 0,
          recentActivity: 0,
          keyTopics: ['No Data'],
          center: STATE_COORDINATES[abbr],
          color: '#e0e0e0'
        };
      }
    });

    console.log(`Map data processed for ${Object.keys(stateStats).length} states`);

    return NextResponse.json({
      success: true,
      data: stateStats,
      lastUpdated: new Date().toISOString(),
      processingTime: Date.now() - startTime
    });

  } catch (error) {
    console.error('Error fetching map data:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch map data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
