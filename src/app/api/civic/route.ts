
import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { OpenStatesPerson, Representative } from "@/types/representative";

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

let cachedClient: MongoClient | null = null;

async function connectToDatabase() {
  if (cachedClient) {
    return cachedClient;
  }

  const client = new MongoClient(MONGODB_URI!);
  await client.connect();
  cachedClient = client;
  return client;
}

// Interface for OpenStates person data
let stateAbbr: string | null = null;
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const address = searchParams.get('address');
  const state = searchParams.get('state');
  const stateName = searchParams.get('stateName');
  const forceRefresh = searchParams.get('refresh') === 'true';
  const pageParam = parseInt(searchParams.get('page') || '1');
  const pageSize = parseInt(searchParams.get('pageSize') || '10');
  const showAll = searchParams.get('showAll') === 'true';

  // If lat/lng provided, use geospatial lookup and return early
  if (lat && lng) {
    try {
      const latitude = parseFloat(lat);
      const longitude = parseFloat(lng);
      if (isNaN(latitude) || isNaN(longitude)) {
        return NextResponse.json({ error: 'Invalid latitude or longitude' }, { status: 400 });
      }

      let client;
      try {
        client = await connectToDatabase();
      } catch (dbError) {
        return NextResponse.json({ error: 'Database connection failed.' }, { status: 503 });
      }
      const db = client.db('statepulse');
      const boundaries = db.collection('map_boundaries');
      const representatives = db.collection('representatives');

      // Find all districts containing the point

      const foundDistricts = await boundaries.find({
        geometry: {
          $geoIntersects: {
            $geometry: {
              type: 'Point',
              coordinates: [longitude, latitude]
            }
          }
        }
      }).toArray();

      // Fallback: try to get state code from the first found district's properties
      // stateAbbr is already declared above, do not redeclare
      if (foundDistricts.length && foundDistricts[0].properties) {
        // Try to get state abbreviation from properties
        if (foundDistricts[0].properties.STATE) {
          stateAbbr = foundDistricts[0].properties.STATE;
        } else if (foundDistricts[0].properties.STATEFP) {
          // Map FIPS to abbreviation
          const fipsToAbbr: Record<string, string> = {
            '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO', '09': 'CT', '10': 'DE',
            '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI', '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA',
            '20': 'KS', '21': 'KY', '22': 'LA', '23': 'ME', '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN',
            '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH', '34': 'NJ', '35': 'NM',
            '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH', '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI',
            '45': 'SC', '46': 'SD', '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA',
            '54': 'WV', '55': 'WI', '56': 'WY'
          };
          stateAbbr = fipsToAbbr[String(foundDistricts[0].properties.STATEFP) as keyof typeof fipsToAbbr];
        }
      }

      // console.log('[API] Geospatial lookup: foundDistricts:', JSON.stringify(foundDistricts, null, 2));

      if (!foundDistricts.length) {
        return NextResponse.json({ error: 'No districts found for this location.' }, { status: 404 });
      }

      // Build queries to find representatives for each district
      const repOrs = [];
      let stateCodeForSenators = null;
      for (const district of foundDistricts) {
        if (district.properties && district.properties.GEOID) {
          repOrs.push({ 'map_boundary.district': district.properties.GEOID, 'map_boundary.type': district.type });
        }
        // Try to extract state code from district properties (should be present in GEOID or properties)
        if (!stateCodeForSenators && district.properties && district.properties.STATEFP) {
          stateCodeForSenators = district.properties.STATEFP;
        }
        if (!stateCodeForSenators && district.properties && district.properties.STATE) {
          stateCodeForSenators = district.properties.STATE;
        }
      }

      // Always include at-large House rep for at-large states (AK, WY, VT, ND, SD, DE, MT)
      const atLargeStates = ['AK', 'WY', 'VT', 'ND', 'SD', 'DE', 'MT'];
      const abbr = (stateAbbr || '').toUpperCase();
      if (atLargeStates.includes(abbr)) {
        // Also match full state name and jurisdiction for at-large reps
        const stateFullNameMap: Record<string, string> = {
          'AK': 'Alaska', 'WY': 'Wyoming', 'VT': 'Vermont', 'ND': 'North Dakota', 'SD': 'South Dakota', 'DE': 'Delaware', 'MT': 'Montana'
        };
        const fullName = stateFullNameMap[abbr] || abbr;
        repOrs.push({
          $and: [
            {
              $or: [
                { state: { $regex: new RegExp(`^${abbr}$`, 'i') } },
                { state: { $regex: new RegExp(`^${fullName}$`, 'i') } }
              ]
            },
            {
              $or: [
                { chamber: { $regex: /house/i } },
                { role: { $regex: /representative/i } },
                { 'terms.item.chamber': { $regex: /house/i } },
                { jurisdiction: { $regex: /house/i } },
                { jurisdiction: { $regex: /us house/i } }
              ]
            },
            {
              $or: [
                { district: null },
                { district: { $exists: false } }
              ]
            }
          ]
        });
      } else if (foundDistricts.length === 1 && stateAbbr) {
        // For non-at-large states, keep the original logic
        repOrs.push({
          $and: [
            { state: { $regex: new RegExp(`^${stateAbbr}$`, 'i') } },
            {
              $or: [
                { chamber: { $regex: /house/i } },
                { role: { $regex: /representative/i } },
                { 'terms.item.chamber': { $regex: /house/i } }
              ]
            },
            {
              $or: [
                { district: null },
                { district: { $exists: false } }
              ]
            }
          ]
        });
      }

      const senatorOrs = [];
      const stateMap: Record<string, string> = {
        'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
        'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
        'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
        'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
        'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
        'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
        'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
        'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
        'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
        'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
        'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
        'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
        'Wisconsin': 'WI', 'Wyoming': 'WY', 'District of Columbia': 'DC'
      };
      let senatorState = null;
      if (stateName && stateMap[stateName]) {
        senatorState = stateMap[stateName];
      } else if (state && typeof state === 'string' && state.length === 2) {
        senatorState = state.toUpperCase();
      } else if (stateAbbr) {
        senatorState = stateAbbr;
      }
      if (senatorState) {
        // Also get the full state name for robust matching
        const fullStateName = Object.keys(stateMap).find(name => stateMap[name] === senatorState.toUpperCase()) || senatorState;
        senatorOrs.push({
          $and: [
            {
              $or: [
                { 'chamber': { $regex: /senate/i } },
                { 'role': { $regex: /senator/i } },
                { 'jurisdiction': { $regex: /senate/i } },
                { 'terms.item.chamber': { $regex: /senate/i } }
              ]
            },
            {
              $or: [
                { 'state': { $regex: new RegExp(`^${senatorState}$`, 'i') } },
                { 'state': { $regex: new RegExp(`^${fullStateName}$`, 'i') } }
              ]
            }
            // No district restriction: match all senators for the state
          ]
        });
      }

      // Combine district reps and senators as a single $or array
      const finalOrs: any[] = [...repOrs, ...senatorOrs];

      // console.log('[API] Geospatial lookup: repOrs + senatorOrs:', JSON.stringify(finalOrs, null, 2));

      let reps: any[] = [];
      if (finalOrs.length) {
        reps = await representatives.find({ $or: finalOrs }).toArray();
      }

      // Deduplicate by id+chamber if id exists, else by name+chamber
      const seenKeys = new Set();
      const dedupedReps = reps.filter(rep => {
        let key = '';
        if (rep.id) {
          key = `${rep.id}|${rep.chamber || rep.role || ''}`;
        } else if (rep.name) {
          key = `${rep.name}|${rep.chamber || rep.role || ''}`;
        } else {
          return true; // Can't dedupe, keep
        }
        if (seenKeys.has(key)) return false;
        seenKeys.add(key);
        return true;
      });

      return NextResponse.json({ districts: foundDistricts, representatives: dedupedReps, source: 'geo' });
    } catch (error) {
      return NextResponse.json({ error: 'Internal server error', details: (error as Error).message }, { status: 500 });
    }
  }

  try {
    // Fallback to address/state-based lookup if no lat/lng
    if (!address && !state) {
      return NextResponse.json(
        { error: 'Address, state, or lat/lng parameter is required' },
        { status: 400 }
      );
    }

    // Define state mapping at function level so it's available throughout
    const stateMap: Record<string, string> = {
      'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
      'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
      'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
      'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
      'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
      'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
      'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
      'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
      'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
      'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
      'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
      'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
      'Wisconsin': 'WI', 'Wyoming': 'WY', 'District of Columbia': 'DC'
    };

    // Extract state from address if not provided separately
    let stateCode = state;
    if (!stateCode && address) {
      // Check if address contains a full state name (case-insensitive)
      for (const [fullName, abbrev] of Object.entries(stateMap)) {
        if (address.toLowerCase().includes(fullName.toLowerCase())) {
          stateCode = abbrev;
          break;
        }
      }

      // If no full state name found, try to find 2-letter state code
      if (!stateCode) {
        const stateMatch = address.match(/,\s*([A-Z]{2})(?:\s|$)|(?:^|\s)([A-Z]{2})(?:\s*$)/);
        if (stateMatch) {
          stateCode = stateMatch[1] || stateMatch[2];
        }
      }
    }

    if (!stateCode) {
      return NextResponse.json(
        { error: 'Unable to determine state from address. Please include state abbreviation at the end (e.g., "123 Main St, Columbus, OH").' },
        { status: 400 }
      );
    }

    // Validate state code
    const validStates = [
      'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
      'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
      'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
      'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
      'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
      'DC'
    ];

    if (!validStates.includes(stateCode.toUpperCase())) {
      return NextResponse.json(
        { error: `Invalid state abbreviation: ${stateCode}. Please use a valid US state abbreviation.` },
        { status: 400 }
      );
    }

    stateCode = stateCode.toUpperCase();
    // console.log(`[API] Processing request for state: ${stateCode}`);

    // Check MongoDB connection
    let client;
    try {
      client = await connectToDatabase();
      // console.log(`[API] Database connection established`);
    } catch (dbError) {
      console.error(`[API] Database connection failed:`, dbError);
      return NextResponse.json(
        { error: 'Database connection failed. Please try again later.' },
        { status: 503 }
      );
    }

    const db = client.db('statepulse');
    const representativesCollection = db.collection('representatives');

    // Only use cached data, never fetch from OpenStates API
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const stateFullName = Object.keys(stateMap).find(name => stateMap[name] === stateCode) || stateCode;
    const stateRegex = new RegExp(`\\b(${stateCode}|${stateFullName.replace(/\\s+/g, '\\s+')}|${stateCode}\\s+State)\\b`, 'i');

    const totalCachedReps = await representativesCollection.countDocuments({
      jurisdiction: { $regex: stateRegex },
      lastUpdated: { $gte: yesterday }
    });

    if (totalCachedReps > 0) {
      if (showAll) {
        const skip = (pageParam - 1) * pageSize;
        const cachedReps = await representativesCollection
          .find({
            jurisdiction: { $regex: stateRegex },
            lastUpdated: { $gte: yesterday }
          })
          .skip(skip)
          .limit(pageSize)
          .toArray();
        return NextResponse.json({
          representatives: cachedReps,
          source: 'cache',
          pagination: {
            page: pageParam,
            pageSize,
            total: totalCachedReps,
            totalPages: Math.ceil(totalCachedReps / pageSize),
            hasNext: skip + pageSize < totalCachedReps,
            hasPrev: pageParam > 1
          }
        });
      } else {
        const cachedReps = await representativesCollection
          .find({
            jurisdiction: { $regex: stateRegex },
            lastUpdated: { $gte: yesterday }
          })
          .limit(10)
          .toArray();
        return NextResponse.json({
          representatives: cachedReps,
          source: 'cache'
        });
      }
    } else {
      return NextResponse.json({ error: 'No cached representative data found for this state or location.' }, { status: 404 });
    }
  } catch (error) {
    console.error(`[API] Error during database operations:`, error);
    return NextResponse.json({ error: 'Database error occurred. Please try again later.', details: (error as Error).message }, { status: 500 });
  }
}