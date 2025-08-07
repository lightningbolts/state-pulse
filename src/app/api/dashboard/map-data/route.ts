import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';
import { STATE_NAMES, STATE_COORDINATES } from "@/types/geo";
import { StateData } from '@/types/jurisdictions';


export async function GET(request: NextRequest) {
  try {
    const legislationCollection = await getCollection('legislation');

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    console.log('Starting map data aggregation...');
    const startTime = Date.now();

    const pipeline = [
      {
        // Stage 1: Create a normalized 'effectiveJurisdictionName' field.
        $addFields: {
          effectiveJurisdictionName: {
            $cond: {
              // A bill is considered federal if it meets specific, unambiguous criteria.
              if: {
                $or: [
                  // Criteria 1: The jurisdictionName explicitly says it's federal.
                  { $regexMatch: { input: { $ifNull: ["$jurisdictionName", ""] }, regex: /congress|united states/i } },
                  // Criteria 2: The bill's history involves the President. This is a definitive federal indicator.
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
        $match: {
          effectiveJurisdictionName: { $exists: true, $nin: [null, ""] }
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
          sampleSubjects: { $push: { $arrayElemAt: ['$subjects', 0] } },
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

    const results = await legislationCollection.aggregate(pipeline, {
      maxTimeMS: 10000,
      allowDiskUse: true
    }).toArray();

    console.log(`Aggregation completed in ${Date.now() - startTime}ms`);

    const stateStats: Record<string, StateData> = {};

    results.forEach((result: any) => {
      try {
        const jurisdictionName = result._id;
        let stateAbbr = '';

        if (jurisdictionName.includes('Congress') || jurisdictionName.includes('United States')) {
          stateAbbr = 'US';
        } else {
          for (const [abbr, name] of Object.entries(STATE_NAMES)) {
            if (abbr === 'US') continue;
            if (jurisdictionName.toLowerCase().includes(name.toLowerCase())) {
              stateAbbr = abbr;
              break;
            }
          }
        }

        if (stateAbbr && STATE_COORDINATES[stateAbbr]) {
          const topSubjects = (result.topSubjects || [])
            .filter((s: string) => s && s.trim())
            .slice(0, 3);

          const intensity = Math.min(result.totalBills / 1000, 1);
          const hue = (intensity * 240);
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
