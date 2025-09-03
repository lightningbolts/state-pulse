import {NextRequest, NextResponse} from 'next/server';
import {getCollection} from '@/lib/mongodb';
import {ABR_TO_FIPS, STATE_MAP} from "@/types/geo";

function normalizeIds(...ids: (string | undefined | null)[]): string[] {
  const out = new Set<string>();
  ids.filter(Boolean).forEach((raw) => {
    const s = String(raw);
    out.add(s);
    // underscore <-> slash variants for ocd-person ids
    if (s.includes('_')) out.add(s.replace('_', '/'));
    if (s.includes('/')) out.add(s.replace('/', '_'));
  });
  return Array.from(out);
}

function getDistrictIdentifiers(rep: any): string[] {
  // Return a single, canonical identifier that matches GeoJSON properties best.
  // Prefer GEOID (STATEFP + padded district), otherwise derive from division_id.

  // Helper: derive state FIPS from division_id (ocd-division/.../state:xx/...)
  const getStateFipsFromDivision = (divisionId?: string): string | null => {
    if (!divisionId) return null;
    const m = divisionId.match(/state:([a-z]{2})/i);
    if (!m) return null;
    const abbr = m[1].toUpperCase();
    return ABR_TO_FIPS[abbr] || null;
  };

  // Helper function to get state FIPS from state field (handles both abbreviations and full names)
  const getStateFipsFromState = (state?: string): string | null => {
    if (!state) return null;

    // First try as abbreviation
    const stateUpper = state.toUpperCase();
    if (ABR_TO_FIPS[stateUpper]) {
      return ABR_TO_FIPS[stateUpper];
    }

    // Then try as full state name
    const abbr = STATE_MAP[state];
    if (abbr && ABR_TO_FIPS[abbr]) {
      return ABR_TO_FIPS[abbr];
    }

    return null;
  };

  // Helper to extract state info from terms array (for Congress.gov data)
  const getStateFromTerms = (rep: any): string | null => {
    if (rep.terms && Array.isArray(rep.terms) && rep.terms.length > 0) {
      const latestTerm = rep.terms[rep.terms.length - 1];
      return latestTerm.stateCode || latestTerm.stateName;
    }
    return null;
  };

  // Check if this is a Nebraska representative (unicameral legislature)
  const isNebraska = rep.current_role?.division_id?.includes('/state:ne/') ||
                    rep.state === 'Nebraska' || rep.state === 'NE' ||
                    rep.current_role?.state === 'NE';

  const divisionId: string | undefined = rep.current_role?.division_id;

  // Try multiple sources for state information
  const stateFromTerms = getStateFromTerms(rep);
  const stateFromCurrentRole = rep.current_role?.state;
  const stateFromField = rep.state;

  // @ts-ignore
  // @ts-ignore
  const fips = getStateFipsFromDivision(divisionId) ||
               // getStateFipsFromState(stateFromTerms) ||
               getStateFipsFromState(stateFromCurrentRole) ||
               getStateFipsFromState(stateFromField);

  // Special handling for Nebraska's unicameral legislature
  if (isNebraska && divisionId) {
    const divisionMatch = divisionId.match(/\/state:ne\/sldu:(\d+)/);
    if (divisionMatch) {
      const districtNum = divisionMatch[1];
      // Add various possible Nebraska district ID formats
      return [
        districtNum,
        `31${districtNum.padStart(3, '0')}`, // FIPS format: 31 + 3-digit district
        `3100${districtNum.padStart(2, '0')}`, // Alternative FIPS format
        `NE-${districtNum}`, // State-district format
        `Nebraska-${districtNum}`, // Full state name format
        `31${districtNum}`, // FIPS + district
        `ne${districtNum}`, // state abbrev + district
      ];
    }
  }

  // 1) If map_boundary.geoid looks like canonical GEOID, use it
  const mb = rep.map_boundary || {};
  if (typeof mb.geoid === 'string' && /^\d{4,6}$/.test(mb.geoid)) {
    return [mb.geoid];
  }
  // Some datasets store canonical id in map_boundary.district already (e.g., '01010')
  if (typeof mb.district === 'string' && /^\d{4,6}$/.test(mb.district)) {
    return [mb.district];
  }

  // 2) Derive from division_id + district
  const districtRaw = rep.current_role?.district ?? rep.district;
  const dStr = districtRaw !== null && districtRaw !== undefined ? String(districtRaw) : '';
  const numeric = /^\d+$/.test(dStr) ? parseInt(dStr, 10) : NaN;

  // Determine chamber
  const isCongress = rep.chamber === 'House of Representatives' || rep.chamber === 'U.S. House of Representatives' || rep.map_boundary?.type === 'congressional' || /cd:/i.test(divisionId || '');
  const isStateUpper = rep.map_boundary?.type === 'state_leg_upper' || /sldu:/i.test(divisionId || '') || rep.current_role?.org_classification === 'upper';
  const isStateLower = rep.map_boundary?.type === 'state_leg_lower' || /sldl:/i.test(divisionId || '') || rep.current_role?.org_classification === 'lower';

  // Handle at-large congressional districts where district may be encoded as "AL" or "at-large"
  const dNorm = (dStr || '').trim().toLowerCase();
  const divisionAtLarge = /cd:(at[-_ ]?large|al)\b/i.test(divisionId || '');
  const isAtLarge = isCongress && (divisionAtLarge || dNorm === 'al' || dNorm === 'at-large' || dNorm === 'atlarge');

  // Check for at-large states (states that have only one congressional district)
  const atLargeStates = ['AK', 'DE', 'MT', 'ND', 'SD', 'VT', 'WY'];

  // Get the best state abbreviation we have
  let repState: string;
  if (stateFromTerms && stateFromTerms.length === 2) {
    repState = stateFromTerms.toUpperCase();
  } else if (stateFromCurrentRole && stateFromCurrentRole.length === 2) {
    repState = stateFromCurrentRole.toUpperCase();
  } else if (stateFromField && stateFromField.length === 2) {
    repState = stateFromField.toUpperCase();
  } else {
    const stateName = stateFromTerms || stateFromCurrentRole || stateFromField || '';
    repState = STATE_MAP[stateName] || stateName.toUpperCase();
  }

  const isAtLargeState = isCongress && atLargeStates.includes(repState);

  // console.log(`Processing rep: ${rep.name}, State: ${repState}, District: ${dStr}, IsAtLarge: ${isAtLargeState}, FIPS: ${fips}`);

  // For congressional districts, prioritize at-large state detection
  if (isCongress && fips && (isAtLargeState || isAtLarge || (!dStr || dStr === '0') || districtRaw === null)) {
    // For at-large districts, try multiple possible formats
    // console.log(`At-large district identifiers for ${repState}: [${atLargeIdentifiers.join(', ')}]`);
    return [
      fips + '00',  // Standard format: STATEFP + '00'
      fips + '0',   // Alternative format: STATEFP + '0'
      fips,         // Just the state FIPS
      repState + '00', // State abbreviation + '00'
      repState + '0',  // State abbreviation + '0'
      repState + 'AL'  // State abbreviation + 'AL' (at-large)
    ];
  }

  if (fips && Number.isFinite(numeric)) {
    if (isCongress) {
      const padded = String(numeric).padStart(2, '0');
      return [fips + padded];
    }
    if (isStateUpper || isStateLower) {
      const padded = String(numeric).padStart(3, '0');
      return [fips + padded];
    }
  }

  // 4) Fallbacks: GEOIDFQ (less preferred, but map supports it), or any string ID available
  if (typeof mb.geoidfq === 'string' && mb.geoidfq.length > 0) {
    return [mb.geoidfq];
  }
  if (dStr) {
    return [dStr];
  }

  return [];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const districtType = searchParams.get('type') || 'congressional-districts';
    const selectedTopic = searchParams.get('topic') || 'all';
    const enactedOnly = searchParams.get('enacted') === 'true'; // New parameter for enacted legislation

    // console.log(`Topic heatmap request: ${districtType}, topic: ${selectedTopic}, enacted: ${enactedOnly}`);

    const chamberMap: Record<string, string> = {
      'congressional-districts': 'us_house',
      'state-upper-districts': 'state_upper',
      'state-lower-districts': 'state_lower'
    };

    const chamber = chamberMap[districtType];
    if (!chamber) {
      return NextResponse.json({
        error: 'Invalid district type',
        validTypes: Object.keys(chamberMap)
      }, { status: 400 });
    }

    let repsCollection, legislationCollection;
    try {
      repsCollection = await getCollection('representatives');
      legislationCollection = await getCollection('legislation');
    } catch (dbError) {
      console.error('Database connection error:', dbError);
      return NextResponse.json({ success: false, error: 'Database connection failed' }, { status: 500 });
    }

    let chamberQuery: any = {};
    if (chamber === 'us_house') {
      chamberQuery = { $or: [
        { chamber: 'House of Representatives' },
        { chamber: 'U.S. House of Representatives' },
        { 'current_role.chamber': 'House' },
        { 'current_role.chamber': 'house' },
        { 'map_boundary.type': 'congressional' }
      ]};
    } else if (chamber === 'state_upper') {
      chamberQuery = { $or: [
        { chamber: 'State Senate' }, { chamber: 'Senate' },
        { 'current_role.chamber': 'upper' }, { 'current_role.chamber': 'senate' },
        { 'map_boundary.type': 'state_leg_upper' },
        // Special case for Nebraska's unicameral legislature
        {
          $and: [
            {
              $or: [
                { 'current_role.division_id': { $regex: '/state:ne/' } },
                { 'state': { $in: ['Nebraska', 'NE'] } }
              ]
            },
            {
              $or: [
                { 'current_role.title': 'Senator' },
                { 'map_boundary.type': 'state_leg' },
                { 'current_role.org_classification': 'legislature' }
              ]
            }
          ]
        }
      ]};
    } else if (chamber === 'state_lower') {
      chamberQuery = { $or: [
        { chamber: 'State House' }, { chamber: 'House' }, { chamber: 'Assembly' }, { chamber: 'General Assembly' },
        { 'current_role.chamber': 'lower' }, { 'current_role.chamber': 'house' },
        { 'map_boundary.type': 'state_leg_lower' }
      ],
      // Exclude Nebraska from state_lower since it's unicameral
      $nor: [
        { 'current_role.division_id': { $regex: '/state:ne/' } },
        { 'state': { $in: ['Nebraska', 'NE'] } }
      ]};
    }

    // console.log(`Topic heatmap chamber query for ${chamber}:`, JSON.stringify(chamberQuery, null, 2));

    const representatives = await repsCollection.find(chamberQuery, {
      projection: { _id: 1, id: 1, person_id: 1, name: 1, state: 1, district: 1, chamber: 1, map_boundary: 1, current_role: 1, terms: 1 }
    }).toArray();

    // console.log(`Found ${representatives.length} representatives for chamber ${chamber}`);

    if (representatives.length > 0) {
      // console.log(`Sample representative structure:`, JSON.stringify(representatives[0], null, 2));
      // console.log(`Sample district identifiers for first rep:`, getDistrictIdentifiers(representatives[0]));
      // console.log(`District ID samples from first 10 reps:`, representatives.slice(0, 10).map(rep => ({
      //   name: rep.name, state: rep.state, district: rep.district, chamber: rep.chamber, map_boundary: rep.map_boundary, identifiers: getDistrictIdentifiers(rep)
      // })));
    }

    const repIdToDistricts = new Map<string, string[]>();
    const allRepIds = new Set<string>();

    representatives.forEach(rep => {
      const variants = normalizeIds(rep._id?.toString(), rep.id, rep.person_id, rep.name);
      const districtIds = getDistrictIdentifiers(rep);
      variants.forEach(id => {
        repIdToDistricts.set(id, districtIds);
        allRepIds.add(id);
      });
    });

    const currentYear = new Date().getFullYear();
    const yearStart = new Date(currentYear, 0, 1);

    let matchStage: any = {
      sponsors: { $exists: true, $ne: [] },
      'topicClassification.broadTopics': { $exists: true, $ne: [] },
      $or: [
        { latestActionAt: { $gte: yearStart } },
        { firstActionAt: { $gte: yearStart } },
        { createdAt: { $gte: yearStart } }
      ]
    };

    // Add enacted filter if requested
    if (enactedOnly) {
      matchStage.enactedAt = { $exists: true, $ne: null };
    }

    if (selectedTopic !== 'all') {
      matchStage['topicClassification.broadTopics'] = { $regex: selectedTopic, $options: 'i' };
    }

    const pipeline = [
      { $match: matchStage },
      { $unwind: '$sponsors' },
      { $match: { $or: [
        { 'sponsors.id': { $in: Array.from(allRepIds) } },
        { 'sponsors.person_id': { $in: Array.from(allRepIds) } },
        { 'sponsors.name': { $in: Array.from(allRepIds) } }
      ]}},
      { $project: {
        sponsorId: { $ifNull: ['$sponsors.person_id', { $ifNull: ['$sponsors.id', '$sponsors.name'] }] },
        broadTopics: '$topicClassification.broadTopics'
      }},
      { $unwind: '$broadTopics' },
      { $group: { _id: { sponsorId: '$sponsorId', topic: '$broadTopics' }, count: { $sum: 1 } } }
    ];

    let results;
    try {
      // console.log(`Running aggregation pipeline with ${allRepIds.size} representative IDs`);
      results = await legislationCollection.aggregate(pipeline).toArray();
      // console.log(`Aggregation returned ${results.length} sponsor-topic combinations`);
    } catch (aggregationError) {
      console.error('Aggregation pipeline error:', aggregationError);
      return NextResponse.json({ success: false, error: 'Failed to process topic data' }, { status: 500 });
    }

    if (!results || results.length === 0) {
      // console.log('No topic data found, returning empty result set');
      return NextResponse.json({ success: true, scores: {}, availableTopics: ['all'], selectedTopic, districtType, metadata: { totalDistricts: 0, totalRepresentatives: representatives.length, maxScore: 0, uniqueTopics: 0, processedResults: 0 }});
    }

    const districtTopicCounts: Record<string, Record<string, number>> = {};
    const allBroadTopics = new Set<string>();

    results.forEach((result: any) => {
      const sponsorId = result._id.sponsorId as string;
      const topic = result._id.topic as string;
      const count = result.count as number;

      // Normalize sponsor id to catch underscore/slash variants
      const variants = normalizeIds(sponsorId);
      let districtIds: string[] | undefined;
      for (const v of variants) {
        districtIds = repIdToDistricts.get(v);
        if (districtIds) break;
      }
      if (!districtIds || districtIds.length === 0) return;

      allBroadTopics.add(topic);

      districtIds.forEach(districtId => {
        if (!districtTopicCounts[districtId]) {
          districtTopicCounts[districtId] = {};
        }
        districtTopicCounts[districtId][topic] = (districtTopicCounts[districtId][topic] || 0) + count;
      });
    });

    // console.log(`Processed data for ${Object.keys(districtTopicCounts).length} districts`);

    const topicScores: Record<string, number> = {};

    if (selectedTopic === 'all') {
      Object.entries(districtTopicCounts).forEach(([districtId, topicCounts]) => {
        topicScores[districtId] = Object.values(topicCounts).reduce((sum, count) => sum + (count as number), 0);
      });
    } else {
      Object.entries(districtTopicCounts).forEach(([districtId, topicCounts]) => {
        topicScores[districtId] = Object.entries(topicCounts)
            .filter(([topic]) => topic.toLowerCase().includes(selectedTopic.toLowerCase()))
            .reduce((sum, [, count]) => sum + (count as number), 0);
      });
    }

    const maxScore = Math.max(...Object.values(topicScores), 1);
    const normalizedScores: Record<string, number> = {};
    Object.entries(topicScores).forEach(([districtId, score]) => {
      normalizedScores[districtId] = score / maxScore;
    });

    const availableTopics = ['all', ...Array.from(allBroadTopics).sort()];

    // console.log(`Topic heatmap for ${districtType} - topic: ${selectedTopic}:`);
    // console.log(`Raw scores range: 0 to ${maxScore}`);
    // console.log(`Sample scores:`, Object.entries(topicScores).slice(0, 5));
    // console.log(`Normalized sample:`, Object.entries(normalizedScores).slice(0, 5));
    // console.log(`Available topics (${availableTopics.length}):`, availableTopics.slice(0, 10));

    // console.log(`Returning ${Object.keys(normalizedScores).length} scored districts with ${availableTopics.length} available topics`);

    return NextResponse.json({
      success: true,
      scores: normalizedScores,
      availableTopics,
      selectedTopic,
      districtType,
      enactedOnly,
      metadata: {
        totalDistricts: Object.keys(normalizedScores).length,
        totalRepresentatives: representatives.length,
        maxScore,
        uniqueTopics: allBroadTopics.size,
        processedResults: results.length
      }
    });

  } catch (error: any) {
    console.error('Topic heatmap error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
