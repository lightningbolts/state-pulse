import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

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

// State abbreviation to name mapping
const STATE_NAMES: Record<string, string> = {
  'AL': 'Alabama',
  'AK': 'Alaska',
  'AZ': 'Arizona',
  'AR': 'Arkansas',
  'CA': 'California',
  'CO': 'Colorado',
  'CT': 'Connecticut',
  'DE': 'Delaware',
  'DC': 'District of Columbia',
  'FL': 'Florida',
  'GA': 'Georgia',
  'HI': 'Hawaii',
  'ID': 'Idaho',
  'IL': 'Illinois',
  'IN': 'Indiana',
  'IA': 'Iowa',
  'KS': 'Kansas',
  'KY': 'Kentucky',
  'LA': 'Louisiana',
  'ME': 'Maine',
  'MD': 'Maryland',
  'MA': 'Massachusetts',
  'MI': 'Michigan',
  'MN': 'Minnesota',
  'MS': 'Mississippi',
  'MO': 'Missouri',
  'MT': 'Montana',
  'NE': 'Nebraska',
  'NV': 'Nevada',
  'NH': 'New Hampshire',
  'NJ': 'New Jersey',
  'NM': 'New Mexico',
  'NY': 'New York',
  'NC': 'North Carolina',
  'ND': 'North Dakota',
  'OH': 'Ohio',
  'OK': 'Oklahoma',
  'OR': 'Oregon',
  'PA': 'Pennsylvania',
  'RI': 'Rhode Island',
  'SC': 'South Carolina',
  'SD': 'South Dakota',
  'TN': 'Tennessee',
  'TX': 'Texas',
  'UT': 'Utah',
  'VT': 'Vermont',
  'VA': 'Virginia',
  'WA': 'Washington',
  'WV': 'West Virginia',
  'WI': 'Wisconsin',
  'WY': 'Wyoming',
  'US': 'United States Congress'
};

// State coordinates for map visualization - using state capitals
const STATE_COORDINATES: Record<string, [number, number]> = {
  'AL': [32.3617, -86.2792], // Montgomery
  'AK': [58.3019, -134.4197], // Juneau
  'AZ': [33.4484, -112.0740], // Phoenix
  'AR': [34.7465, -92.2896], // Little Rock
  'CA': [38.5816, -121.4944], // Sacramento
  'CO': [39.7392, -104.9903], // Denver
  'CT': [41.7658, -72.6734], // Hartford
  'DE': [39.1612, -75.5264], // Dover
  'DC': [38.9072, -77.0369], // Washington DC
  'FL': [30.4518, -84.27277], // Tallahassee
  'GA': [33.7490, -84.3880], // Atlanta
  'HI': [21.3099, -157.8581], // Honolulu
  'ID': [43.6150, -116.2023], // Boise
  'IL': [39.7817, -89.6501], // Springfield
  'IN': [39.7904, -86.1477], // Indianapolis
  'IA': [41.5868, -93.6250], // Des Moines
  'KS': [39.0473, -95.6890], // Topeka
  'KY': [38.2009, -84.8733], // Frankfort
  'LA': [30.4515, -91.1871], // Baton Rouge
  'ME': [44.3106, -69.7795], // Augusta
  'MD': [38.9729, -76.5012], // Annapolis
  'MA': [42.2352, -71.0275], // Boston
  'MI': [42.3540, -84.9555], // Lansing
  'MN': [44.9537, -93.0900], // Saint Paul
  'MS': [32.3617, -90.2070], // Jackson
  'MO': [38.5767, -92.1735], // Jefferson City
  'MT': [46.5958, -112.0270], // Helena
  'NE': [40.8136, -96.7026], // Lincoln
  'NV': [39.1638, -119.7674], // Carson City
  'NH': [43.2081, -71.5376], // Concord
  'NJ': [40.2206, -74.7563], // Trenton
  'NM': [35.6870, -105.9378], // Santa Fe
  'NY': [42.6526, -73.7562], // Albany
  'NC': [35.7796, -78.6382], // Raleigh
  'ND': [46.8083, -100.7837], // Bismarck
  'OH': [39.9612, -82.9988], // Columbus
  'OK': [35.4676, -97.5164], // Oklahoma City
  'OR': [44.9778, -123.0351], // Salem
  'PA': [40.2737, -76.8844], // Harrisburg
  'RI': [41.8240, -71.4128], // Providence
  'SC': [34.0000, -81.0348], // Columbia
  'SD': [44.2998, -100.3510], // Pierre
  'TN': [36.1627, -86.7816], // Nashville
  'TX': [30.2672, -97.7431], // Austin
  'UT': [40.7608, -111.8910], // Salt Lake City
  'VT': [44.2601, -72.5806], // Montpelier
  'VA': [37.5407, -77.4360], // Richmond
  'WA': [47.0379, -122.9015], // Olympia
  'WV': [38.3498, -81.6326], // Charleston
  'WI': [43.0642, -89.4012], // Madison
  'WY': [41.1400, -104.8197], // Cheyenne
  'US': [38.8899, -77.0091] // Capitol Hill, Washington DC
};

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
        $match: {
          jurisdictionName: { $exists: true, $ne: null }
        }
      },
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
