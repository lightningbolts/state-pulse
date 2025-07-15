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

// State coordinates for map visualization
const STATE_COORDINATES: Record<string, [number, number]> = {
  'AL': [32.3617, -86.2792],
  'AK': [64.0685, -152.2782],
  'AZ': [34.0489, -111.0937],
  'AR': [35.2010, -92.4426],
  'CA': [36.7783, -119.4179],
  'CO': [39.5501, -105.7821],
  'CT': [41.6032, -73.0877],
  'DE': [38.9108, -75.5277],
  'DC': [38.9072, -77.0369],
  'FL': [27.7663, -81.6868],
  'GA': [32.1656, -82.9001],
  'HI': [19.8968, -155.5828],
  'ID': [44.0682, -114.7420],
  'IL': [40.6331, -89.3985],
  'IN': [40.2732, -86.1349],
  'IA': [41.8780, -93.0977],
  'KS': [39.0119, -98.4842],
  'KY': [37.8393, -84.2700],
  'LA': [30.9843, -91.9623],
  'ME': [45.2538, -69.4455],
  'MD': [39.0458, -76.6413],
  'MA': [42.4072, -71.3824],
  'MI': [44.3148, -85.6024],
  'MN': [46.7296, -94.6859],
  'MS': [32.3547, -89.3985],
  'MO': [37.9643, -91.8318],
  'MT': [47.0527, -110.2140],
  'NE': [41.4925, -99.9018],
  'NV': [38.8026, -116.4194],
  'NH': [43.1939, -71.5724],
  'NJ': [40.0583, -74.4057],
  'NM': [34.5199, -105.8701],
  'NY': [43.2994, -74.2179],
  'NC': [35.7596, -79.0193],
  'ND': [47.6201, -100.5400],
  'OH': [40.4173, -82.9071],
  'OK': [35.0078, -97.0929],
  'OR': [43.9336, -120.5583],
  'PA': [41.2033, -77.1945],
  'RI': [41.6809, -71.5118],
  'SC': [33.8361, -81.1637],
  'SD': [43.9695, -99.9018],
  'TN': [35.5175, -86.5804],
  'TX': [31.9686, -99.9018],
  'UT': [39.3210, -111.0937],
  'VT': [44.2601, -72.5806],
  'VA': [37.4316, -78.6569],
  'WA': [47.7511, -120.7401],
  'WV': [38.6409, -80.6227],
  'WI': [43.7844, -88.7879],
  'WY': [43.0759, -107.2903],
  'US': [39.8283, -98.5795] // Center of US for federal
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
