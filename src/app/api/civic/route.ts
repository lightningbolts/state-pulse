
import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';
import { FIPS_TO_ABBR, STATE_MAP, STATE_NAMES } from '@/types/geo';
import { validStates } from '@/types/geo';
import { getStateAbbrFromString } from "@/lib/locationUtils";

/**
 * Build Mongo $or clauses so geospatial hits resolve to representatives.
 * US House was missing because many members have no `map_boundary`, or GEOID/GEOIDFQ
 * on the shapefile does not exactly match `map_boundary.district` typing.
 */
function appendDistrictRepMatchers(district: any, repOrs: any[]) {
  const props = district.properties || {};
  const boundaryType = district.type;
  if (!boundaryType) return;

  const geoIds = new Set<string>();
  if (props.GEOID != null && String(props.GEOID).trim() !== '') geoIds.add(String(props.GEOID));
  if (props.GEOIDFQ != null && String(props.GEOIDFQ).trim() !== '') geoIds.add(String(props.GEOIDFQ));

  for (const gid of geoIds) {
    const mapMatch: any[] = [
      { 'map_boundary.district': gid },
      { 'map_boundary.geoidfq': gid },
    ];
    const asNum = Number(gid);
    if (!Number.isNaN(asNum) && /^[0-9]+$/.test(String(gid).replace(/\s/g, ''))) {
      mapMatch.push({ 'map_boundary.district': asNum });
    }
    repOrs.push({
      $and: [{ 'map_boundary.type': boundaryType }, { $or: mapMatch }],
    });
  }

  if (boundaryType !== 'congressional') return;

  const stateFp =
    props.STATEFP != null && props.STATEFP !== ''
      ? String(props.STATEFP).padStart(2, '0')
      : '';
  const stateAbbr = stateFp ? FIPS_TO_ABBR[stateFp] : '';
  const cdRaw =
    props.CD119FP ??
    props.CD118FP ??
    props.CD117FP ??
    props.CD116FP ??
    props.CD115FP ??
    props.CD114FP;

  if (!stateAbbr || cdRaw === undefined || cdRaw === null || String(cdRaw).trim() === '') {
    return;
  }

  const cdString = String(cdRaw).trim();
  const cdParsed = String(parseInt(cdString, 10));
  const cdPadded2 = cdString.padStart(2, '0');
  const fullStateName = STATE_NAMES[stateAbbr];

  const districtValues = new Set<string>([cdString, cdParsed, cdPadded2]);
  if (cdParsed === '0' || cdString === '00') {
    districtValues.add('At-Large');
    districtValues.add('at-large');
  }

  const districtOrs: any[] = [];
  for (const v of districtValues) {
    districtOrs.push({ district: v }, { 'current_role.district': v });
    const n = Number(v);
    if (!Number.isNaN(n) && v !== 'At-Large' && v !== 'at-large') {
      districtOrs.push({ district: n }, { 'current_role.district': n });
    }
  }
  districtOrs.push(
    { 'terms.district': cdString },
    { 'terms.district': cdPadded2 },
    { 'terms.district': cdParsed },
  );

  const stateLower = stateAbbr.toLowerCase();
  districtOrs.push(
    { 'current_role.division_id': new RegExp(`/state:${stateLower}/cd:${cdParsed}($|[^0-9])`, 'i') },
    { 'current_role.division_id': new RegExp(`/state:${stateLower}/cd:${cdPadded2}($|[^0-9])`, 'i') },
    { 'current_role.division_id': new RegExp(`/state:${stateLower}/cd:${cdString}($|[^0-9])`, 'i') },
  );

  const stateOrs: any[] = [
    { state: new RegExp(`^${stateAbbr}$`, 'i') },
    { 'terms.stateCode': stateAbbr },
    { 'terms.stateCode': stateAbbr.toUpperCase() },
    { 'terms.item.stateCode': stateAbbr },
    { 'terms.item.stateCode': stateAbbr.toUpperCase() },
  ];
  if (fullStateName) {
    stateOrs.push({ state: new RegExp(`^${fullStateName.replace(/\s+/g, '\\s+')}$`, 'i') });
  }

  repOrs.push({
    $and: [
      {
        $or: [
          { jurisdiction: 'US House' },
          { jurisdiction: /^US\s*House$/i },
          { chamber: /^House of Representatives$/i },
          { chamber: /^House$/i },
          { 'jurisdiction.name': /^House of Representatives$/i },
        ],
      },
      { $or: stateOrs },
      { $or: districtOrs },
    ],
  });
}
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


      let boundaries, representatives;
      try {
        boundaries = await getCollection('map_boundaries');
        representatives = await getCollection('representatives');
      } catch (dbError) {
        return NextResponse.json({ error: 'Database connection failed.' }, { status: 503 });
      }

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

      let resolvedStateAbbr: string | null = null;
      if (foundDistricts.length && foundDistricts[0].properties) {
        const p0 = foundDistricts[0].properties;
        if (p0.STATE) {
          resolvedStateAbbr = String(p0.STATE).toUpperCase();
        } else if (p0.STATEFP != null && p0.STATEFP !== '') {
          const fp = String(p0.STATEFP).padStart(2, '0');
          resolvedStateAbbr = FIPS_TO_ABBR[fp] || null;
        }
      }

      // console.log('[API] Geospatial lookup: foundDistricts:', JSON.stringify(foundDistricts, null, 2));

      if (!foundDistricts.length) {
        return NextResponse.json({ error: 'No districts found for this location.' }, { status: 404 });
      }

      // Build queries to find representatives for each district
      const repOrs: any[] = [];
      let stateCodeForSenators: string | null = null;
      for (const district of foundDistricts) {
        appendDistrictRepMatchers(district, repOrs);
        if (!stateCodeForSenators && district.properties?.STATEFP != null && district.properties.STATEFP !== '') {
          stateCodeForSenators = String(district.properties.STATEFP).padStart(2, '0');
        }
        if (!stateCodeForSenators && district.properties?.STATE) {
          stateCodeForSenators = String(district.properties.STATE);
        }
      }

      // At-large US House states: boundary CD is "00" — match reps with null / missing district
      const atLargeStates = ['AK', 'WY', 'VT', 'ND', 'SD', 'DE', 'MT'];
      const abbr = (resolvedStateAbbr || '').toUpperCase();
      if (atLargeStates.includes(abbr)) {
        const stateFullNameMap: Record<string, string> = {
          AK: 'Alaska',
          WY: 'Wyoming',
          VT: 'Vermont',
          ND: 'North Dakota',
          SD: 'South Dakota',
          DE: 'Delaware',
          MT: 'Montana',
        };
        const fullName = stateFullNameMap[abbr] || abbr;
        repOrs.push({
          $and: [
            {
              $or: [
                { state: { $regex: new RegExp(`^${abbr}$`, 'i') } },
                { state: { $regex: new RegExp(`^${fullName}$`, 'i') } },
                { 'terms.stateCode': abbr },
                { 'terms.item.stateCode': abbr },
              ],
            },
            {
              $or: [
                { chamber: { $regex: /house/i } },
                { role: { $regex: /representative/i } },
                { 'terms.item.chamber': { $regex: /house/i } },
                { jurisdiction: { $regex: /house/i } },
                { jurisdiction: { $regex: /us house/i } },
                { jurisdiction: 'US House' },
              ],
            },
            {
              $or: [{ district: null }, { district: { $exists: false } }, { district: 'At-Large' }, { district: /at.?large/i }],
            },
          ],
        });
      }

      const senatorOrs = [];
      let senatorState = null;
      if (stateName && STATE_MAP[stateName]) {
        senatorState = STATE_MAP[stateName];
      } else if (state && true && state.length === 2) {
        senatorState = state.toUpperCase();
      } else if (resolvedStateAbbr) {
        senatorState = resolvedStateAbbr;
      }
      if (senatorState) {
        const fullStateName = Object.keys(STATE_MAP).find(name => STATE_MAP[name] === senatorState.toUpperCase()) || senatorState;
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
          ]
        });
      }

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
          return true;
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

    let stateCode = state;
    if (!stateCode && address) {
      stateCode = getStateAbbrFromString(address);
    }

    if (!stateCode) {
      return NextResponse.json(
        { error: 'Unable to determine state from address. Please include state abbreviation at the end (e.g., "123 Main St, Columbus, OH").' },
        { status: 400 }
      );
    }  

    if (!validStates.includes(stateCode.toUpperCase())) {
      return NextResponse.json(
        { error: `Invalid state abbreviation: ${stateCode}. Please use a valid US state abbreviation.` },
        { status: 400 }
      );
    }

    stateCode = stateCode.toUpperCase();
    // console.log(`[API] Processing request for state: ${stateCode}`);


    let representativesCollection;
    try {
      representativesCollection = await getCollection('representatives');
    } catch (dbError) {
      console.error(`[API] Database connection failed:`, dbError);
      return NextResponse.json(
        { error: 'Database connection failed. Please try again later.' },
        { status: 503 }
      );
    }

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const stateFullName = Object.keys(STATE_MAP).find(name => STATE_MAP[name] === stateCode) || stateCode;
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