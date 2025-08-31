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
        // Stage 1: Create a normalized 'effectiveJurisdictionName' field with improved state matching.
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
              // Otherwise, normalize the jurisdiction name for better state matching
              else: {
                $switch: {
                  branches: [
                    // Handle common state jurisdiction name patterns with exact matches
                    { case: { $regexMatch: { input: { $ifNull: ["$jurisdictionName", ""] }, regex: /^west virginia$/i } }, then: "West Virginia" },
                    { case: { $regexMatch: { input: { $ifNull: ["$jurisdictionName", ""] }, regex: /^west virginia legislature$/i } }, then: "West Virginia" },
                    { case: { $regexMatch: { input: { $ifNull: ["$jurisdictionName", ""] }, regex: /^west virginia general assembly$/i } }, then: "West Virginia" },
                    { case: { $regexMatch: { input: { $ifNull: ["$jurisdictionName", ""] }, regex: /^wv$/i } }, then: "West Virginia" },
                    { case: { $regexMatch: { input: { $ifNull: ["$jurisdictionName", ""] }, regex: /^new york$/i } }, then: "New York" },
                    { case: { $regexMatch: { input: { $ifNull: ["$jurisdictionName", ""] }, regex: /^new jersey$/i } }, then: "New Jersey" },
                    { case: { $regexMatch: { input: { $ifNull: ["$jurisdictionName", ""] }, regex: /^new hampshire$/i } }, then: "New Hampshire" },
                    { case: { $regexMatch: { input: { $ifNull: ["$jurisdictionName", ""] }, regex: /^new mexico$/i } }, then: "New Mexico" },
                    { case: { $regexMatch: { input: { $ifNull: ["$jurisdictionName", ""] }, regex: /^north carolina$/i } }, then: "North Carolina" },
                    { case: { $regexMatch: { input: { $ifNull: ["$jurisdictionName", ""] }, regex: /^north dakota$/i } }, then: "North Dakota" },
                    { case: { $regexMatch: { input: { $ifNull: ["$jurisdictionName", ""] }, regex: /^south carolina$/i } }, then: "South Carolina" },
                    { case: { $regexMatch: { input: { $ifNull: ["$jurisdictionName", ""] }, regex: /^south dakota$/i } }, then: "South Dakota" },
                    { case: { $regexMatch: { input: { $ifNull: ["$jurisdictionName", ""] }, regex: /^rhode island$/i } }, then: "Rhode Island" }
                  ],
                  // Default: use the original jurisdiction name
                  default: "$jurisdictionName"
                }
              }
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
          // Improved state matching with exact name matching first, then partial matching
          for (const [abbr, name] of Object.entries(STATE_NAMES)) {
            if (abbr === 'US') continue;

            // Exact match first (case insensitive)
            if (jurisdictionName.toLowerCase() === name.toLowerCase()) {
              stateAbbr = abbr;
              break;
            }
          }

          // If no exact match, try partial matching
          if (!stateAbbr) {
            for (const [abbr, name] of Object.entries(STATE_NAMES)) {
              if (abbr === 'US') continue;

              // Partial match for compound state names and variations
              if (jurisdictionName.toLowerCase().includes(name.toLowerCase()) ||
                  name.toLowerCase().includes(jurisdictionName.toLowerCase())) {
                stateAbbr = abbr;
                break;
              }
            }
          }

          // Special cases for known variations
          if (!stateAbbr) {
            const variations: Record<string, string> = {
              'wv': 'WV',
              'west va': 'WV',
              'w virginia': 'WV',
              'w va': 'WV'
            };

            const lowerJurisdiction = jurisdictionName.toLowerCase().trim();
            stateAbbr = variations[lowerJurisdiction] || '';
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
        } else {
          console.warn(`Could not map jurisdiction "${jurisdictionName}" to a known state`);
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
