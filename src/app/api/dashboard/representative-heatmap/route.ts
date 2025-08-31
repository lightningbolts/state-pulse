import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';

function normalizeIds(...ids: (string | undefined | null)[]): string[] {
  const out = new Set<string>();
  ids.filter(Boolean).forEach((raw) => {
    const s = String(raw);
    out.add(s);
    if (s.includes('_')) out.add(s.replace('_', '/'));
    if (s.includes('/')) out.add(s.replace('/', '_'));
  });
  return Array.from(out);
}

function getDistrictIdentifiers(rep: any): string[] {
  // Canonical ID that matches GeoJSON: prefer GEOID (STATEFP + padded district)
  const getStateFipsFromDivision = (divisionId?: string): string | null => {
    if (!divisionId) return null;
    const m = divisionId.match(/state:([a-z]{2})/i);
    if (!m) return null;
    const abbr = m[1].toUpperCase();
    const ABR_TO_FIPS: Record<string, string> = {
      AL: '01', AK: '02', AZ: '04', AR: '05', CA: '06', CO: '08', CT: '09', DE: '10', DC: '11',
      FL: '12', GA: '13', HI: '15', ID: '16', IL: '17', IN: '18', IA: '19', KS: '20', KY: '21',
      LA: '22', ME: '23', MD: '24', MA: '25', MI: '26', MN: '27', MS: '28', MO: '29', MT: '30',
      NE: '31', NV: '32', NH: '33', NJ: '34', NM: '35', NY: '36', NC: '37', ND: '38', OH: '39',
      OK: '40', OR: '41', PA: '42', RI: '44', SC: '45', SD: '46', TN: '47', TX: '48', UT: '49',
      VT: '50', VA: '51', WA: '53', WV: '54', WI: '55', WY: '56', PR: '72'
    };
    return ABR_TO_FIPS[abbr] || null;
  };

  // Helper function to get state FIPS from state field (handles both abbreviations and full names)
  const getStateFipsFromState = (state?: string): string | null => {
    if (!state) return null;

    const ABR_TO_FIPS: Record<string, string> = {
      AL: '01', AK: '02', AZ: '04', AR: '05', CA: '06', CO: '08', CT: '09', DE: '10', DC: '11',
      FL: '12', GA: '13', HI: '15', ID: '16', IL: '17', IN: '18', IA: '19', KS: '20', KY: '21',
      LA: '22', ME: '23', MD: '24', MA: '25', MI: '26', MN: '27', MS: '28', MO: '29', MT: '30',
      NE: '31', NV: '32', NH: '33', NJ: '34', NM: '35', NY: '36', NC: '37', ND: '38', OH: '39',
      OK: '40', OR: '41', PA: '42', RI: '44', SC: '45', SD: '46', TN: '47', TX: '48', UT: '49',
      VT: '50', VA: '51', WA: '53', WV: '54', WI: '55', WY: '56', PR: '72'
    };

    const NAME_TO_ABR: Record<string, string> = {
      'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
      'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'District of Columbia': 'DC',
      'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL',
      'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA',
      'Maine': 'ME', 'Maryland': 'MD', 'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN',
      'Mississippi': 'MS', 'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
      'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
      'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK', 'Oregon': 'OR',
      'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD',
      'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT', 'Virginia': 'VA',
      'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY', 'Puerto Rico': 'PR'
    };

    // First try as abbreviation
    const stateUpper = state.toUpperCase();
    if (ABR_TO_FIPS[stateUpper]) {
      return ABR_TO_FIPS[stateUpper];
    }

    // Then try as full state name
    const abbr = NAME_TO_ABR[state];
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
  const fips = getStateFipsFromDivision(divisionId) ||
               getStateFipsFromState(stateFromTerms) ||
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

  const mb = rep.map_boundary || {};

  if (typeof mb.geoid === 'string' && /^\d{4,6}$/.test(mb.geoid)) return [mb.geoid];
  if (typeof mb.district === 'string' && /^\d{4,6}$/.test(mb.district)) return [mb.district];

  const districtRaw = rep.current_role?.district ?? rep.district;
  const dStr = districtRaw !== null && districtRaw !== undefined ? String(districtRaw) : '';
  const numeric = /^\d+$/.test(dStr) ? parseInt(dStr, 10) : NaN;

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
  let repState = '';
  if (stateFromTerms && stateFromTerms.length === 2) {
    repState = stateFromTerms.toUpperCase();
  } else if (stateFromCurrentRole && stateFromCurrentRole.length === 2) {
    repState = stateFromCurrentRole.toUpperCase();
  } else if (stateFromField && stateFromField.length === 2) {
    repState = stateFromField.toUpperCase();
  } else {
    // Convert full state name to abbreviation
    const NAME_TO_ABR: Record<string, string> = {
      'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR', 'California': 'CA',
      'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE', 'District of Columbia': 'DC',
      'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID', 'Illinois': 'IL',
      'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS', 'Kentucky': 'KY', 'Louisiana': 'LA',
      'Maine': 'ME', 'Maryland': 'MD', 'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN',
      'Mississippi': 'MS', 'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
      'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
      'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK', 'Oregon': 'OR',
      'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC', 'South Dakota': 'SD',
      'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT', 'Vermont': 'VT', 'Virginia': 'VA',
      'Washington': 'WA', 'West Virginia': 'WV', 'Wisconsin': 'WI', 'Wyoming': 'WY', 'Puerto Rico': 'PR'
    };

    const stateName = stateFromTerms || stateFromCurrentRole || stateFromField || '';
    repState = NAME_TO_ABR[stateName] || stateName.toUpperCase();
  }

  const isAtLargeState = isCongress && atLargeStates.includes(repState);

  // console.log(`Processing rep: ${rep.name}, State: ${repState}, District: ${dStr}, IsAtLarge: ${isAtLargeState}, FIPS: ${fips}`);

  // For congressional districts, prioritize at-large state detection
  if (isCongress && fips && (isAtLargeState || isAtLarge || (!dStr || dStr === '0') || districtRaw === null)) {
    // For at-large districts, try multiple possible formats
    const atLargeIdentifiers = [
      fips + '00',  // Standard format: STATEFP + '00'
      fips + '0',   // Alternative format: STATEFP + '0'
      fips,         // Just the state FIPS
      repState + '00', // State abbreviation + '00'
      repState + '0',  // State abbreviation + '0'
      repState + 'AL'  // State abbreviation + 'AL' (at-large)
    ];
    // console.log(`At-large district identifiers for ${repState}: [${atLargeIdentifiers.join(', ')}]`);
    return atLargeIdentifiers;
  }

  if (fips && (Number.isFinite(numeric) || isAtLarge)) {
    if (isCongress) return [fips + (isAtLarge ? '00' : String(numeric).padStart(2, '0'))];
    if (isStateUpper || isStateLower && Number.isFinite(numeric)) return [fips + String(numeric).padStart(3, '0')];
  }

  if (typeof mb.geoidfq === 'string' && mb.geoidfq.length > 0) return [mb.geoidfq];
  if (dStr) return [dStr];
  return [];
}

async function getBulkBillsSponsoredCount(representatives: any[], enactedOnly: boolean = false): Promise<Record<string, number>> {
  try {
    const legislationCollection = await getCollection('legislation');

    const currentYear = new Date().getFullYear();
    const yearStart = new Date(currentYear, 0, 1);
    const yearEnd = new Date(currentYear + 1, 0, 1);

    const repIdToRepKey = new Map<string, string>();

    representatives.forEach(rep => {
      const repKey = rep.id;
      if (!repKey) return;
      const ids = normalizeIds(rep.id, rep._id?.toString(), rep.person_id, rep.name);
      ids.forEach(id => repIdToRepKey.set(id, repKey));
    });

    const allRepIds = Array.from(repIdToRepKey.keys());
    if (allRepIds.length === 0) return {};

    // Base match criteria
    let matchCriteria: any = {
      sponsors: { $exists: true, $ne: [] },
      $or: [
        { firstActionAt: { $gte: yearStart, $lt: yearEnd } },
        { latestActionAt: { $gte: yearStart, $lt: yearEnd } },
        { createdAt: { $gte: yearStart, $lt: yearEnd } }
      ]
    };

    // Add enacted filter if requested
    if (enactedOnly) {
      matchCriteria.enactedAt = { $exists: true, $ne: null };
    }

    const pipeline = [
      { $match: matchCriteria },
      { $unwind: '$sponsors' },
      { $project: { sponsor_id: { $ifNull: ['$sponsors.person_id', '$sponsors.id'] }, sponsor_name: '$sponsors.name' } },
      { $match: { $or: [
        { sponsor_id: { $in: allRepIds } },
        { sponsor_name: { $in: allRepIds } }
      ] } },
      { $group: { _id: { $ifNull: ['$sponsor_id', '$sponsor_name'] }, count: { $sum: 1 } } }
    ];

    const results = await legislationCollection.aggregate(pipeline).toArray();

    const sponsorshipCounts: Record<string, number> = {};
    results.forEach((result: any) => {
      const sponsorId = result._id as string;
      const repKey = repIdToRepKey.get(sponsorId);
      if (repKey) sponsorshipCounts[repKey] = (sponsorshipCounts[repKey] || 0) + result.count;
      else {
        // Try normalized variants in case only one form matched
        const variants = normalizeIds(sponsorId);
        for (const v of variants) {
          const key = repIdToRepKey.get(v);
          if (key) {
            sponsorshipCounts[key] = (sponsorshipCounts[key] || 0) + result.count;
            break;
          }
        }
      }
    });

    // console.log(`Sponsorship counts found for ${Object.keys(sponsorshipCounts).length} representatives`);
    return sponsorshipCounts;
  } catch (error) {
    console.error('Error counting sponsored bills in bulk:', error);
    return {};
  }
}

function calculateRecentActivityScore(rep: any): number {
  let score = 0;
  if (rep.updated_at) {
    const lastUpdate = new Date(rep.updated_at);
    const daysSinceUpdate = (Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceUpdate < 7) score = 100;
    else if (daysSinceUpdate < 30) score = 80;
    else if (daysSinceUpdate < 90) score = 60;
    else if (daysSinceUpdate < 180) score = 40;
    else if (daysSinceUpdate < 365) score = 20;
    else score = 10;
  }
  return score;
}

async function getBulkRecentActivityScores(representatives: any[], enactedOnly: boolean = false): Promise<Record<string, number>> {
  try {
    const legislationCollection = await getCollection('legislation');

    const repIdToRepKey = new Map<string, string>();
    representatives.forEach(rep => {
      const repKey = rep.id;
      if (!repKey) return;
      // Enhanced ID normalization for Nebraska and other edge cases
      const ids = normalizeIds(
        rep.id,
        rep._id?.toString(),
        rep.person_id,
        rep.name,
        // Add Nebraska-specific ID patterns
        rep.current_role?.person_id,
        rep.current_role?.id,
        // OpenStates ID patterns
        rep.openstates_url?.split('/').pop()?.replace('-', '_')
      );
      ids.forEach(id => repIdToRepKey.set(id, repKey));
    });

    const allRepIds = Array.from(repIdToRepKey.keys());
    if (allRepIds.length === 0) return {};

    const now = new Date();
    const d30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const d90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const d180 = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
    const d365 = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    // Base match criteria
    let matchCriteria: any = { sponsors: { $exists: true, $ne: [] } };

    // Add enacted filter if requested
    if (enactedOnly) {
      matchCriteria.enactedAt = { $exists: true, $ne: null };
    }

    const pipeline = [
      { $match: matchCriteria },
      { $project: {
        sponsors: 1,
        actionDate: enactedOnly ?
          '$enactedAt' : // Use enactedAt for enacted legislation
          { $ifNull: ['$latestActionAt', { $ifNull: ['$firstActionAt', '$createdAt'] }] }
      } },
      { $unwind: '$sponsors' },
      { $project: {
        sponsorId: { $ifNull: ['$sponsors.person_id', { $ifNull: ['$sponsors.id', '$sponsors.name'] }] },
        sponsorName: '$sponsors.name',
        actionDate: 1
      } },
      { $match: {
        $or: [
          { sponsorId: { $in: allRepIds } },
          { sponsorName: { $in: allRepIds } }
        ]
      } },
      { $group: {
        _id: { $ifNull: ['$sponsorId', '$sponsorName'] },
        latestAction: { $max: '$actionDate' },
        last30: { $sum: { $cond: [{ $gte: ['$actionDate', d30] }, 1, 0] } },
        last90: { $sum: { $cond: [{ $gte: ['$actionDate', d90] }, 1, 0] } },
        last180: { $sum: { $cond: [{ $gte: ['$actionDate', d180] }, 1, 0] } },
        last365: { $sum: { $cond: [{ $gte: ['$actionDate', d365] }, 1, 0] } },
        total: { $sum: 1 }
      } }
    ];

    const results = await legislationCollection.aggregate(pipeline).toArray();

    const scores: Record<string, number> = {};
    results.forEach((row: any) => {
      // Enhanced ID matching for Nebraska and other edge cases
      let repKey = repIdToRepKey.get(row._id);

      if (!repKey) {
        // Try all normalized variants
        const variants = normalizeIds(row._id);
        for (const v of variants) {
          repKey = repIdToRepKey.get(v);
          if (repKey) break;
        }
      }

      // If still no match, try fuzzy matching for Nebraska names
      if (!repKey) {
        const rowIdStr = String(row._id || '').toLowerCase();
        for (const [mappedId, mappedKey] of repIdToRepKey.entries()) {
          const mappedIdStr = String(mappedId).toLowerCase();
          // Check for partial name matches (useful for Nebraska where names might vary slightly)
          if (rowIdStr.includes(' ') && mappedIdStr.includes(' ')) {
            const rowParts = rowIdStr.split(' ');
            const mappedParts = mappedIdStr.split(' ');
            if (rowParts.length >= 2 && mappedParts.length >= 2) {
              // Match first and last name
              if (rowParts[0] === mappedParts[0] && rowParts[rowParts.length - 1] === mappedParts[mappedParts.length - 1]) {
                repKey = mappedKey;
                break;
              }
            }
          }
        }
      }

      if (!repKey) return;

      let base = 0;
      const latest = row.latestAction ? new Date(row.latestAction) : null;
      if (latest) {
        const days = (Date.now() - latest.getTime()) / (1000 * 60 * 60 * 24);
        if (days < 7) base = 100;
        else if (days < 30) base = 80;
        else if (days < 90) base = 60;
        else if (days < 180) base = 40;
        else if (days < 365) base = 20;
        else base = 10;
      }
      const boost = Math.min(20, row.last30 * 4 + row.last90 * 2 + row.last180 * 1);
      scores[repKey] = base + boost;
    });

    return scores;
  } catch (e) {
    console.error('Error computing recent activity scores:', e);
    return {};
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const districtType = searchParams.get('type') || 'congressional-districts';
    const metric = searchParams.get('metric') || 'sponsored_bills';

    const chamberMap: Record<string, string> = {
      'congressional-districts': 'us_house',
      'state-upper-districts': 'state_upper',
      'state-lower-districts': 'state_lower'
    };

    const chamber = chamberMap[districtType];
    if (!chamber) {
      return NextResponse.json({ error: 'Invalid district type', validTypes: Object.keys(chamberMap) }, { status: 400 });
    }

    const repsCollection = await getCollection('representatives');

    let chamberQuery: any = {};
    if (chamber === 'us_house') {
      chamberQuery = { $or: [
        { chamber: 'House of Representatives' }, { chamber: 'U.S. House of Representatives' },
        { 'current_role.chamber': 'House' }, { 'current_role.chamber': 'house' },
        { 'map_boundary.type': 'congressional' }
      ] };
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
      ] };
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
      ] };
    }

    // console.log(`Chamber query for ${chamber}:`, JSON.stringify(chamberQuery, null, 2));

    const representatives = await repsCollection.find(chamberQuery).toArray();
    // console.log(`Found ${representatives.length} representatives for chamber ${chamber}`);
    if (representatives.length > 0) {
      // console.log(`Sample representative structure:`, JSON.stringify(representatives[0], null, 2));
      // console.log(`Sample district identifiers for first rep:`, getDistrictIdentifiers(representatives[0]));
    }

    const districtDetails: Record<string, any> = {};

    // Check if enacted filter is requested
    const enactedOnly = metric === 'enacted_bills' || metric === 'enacted_recent_activity';
    const baseMetric = enactedOnly ?
      (metric === 'enacted_bills' ? 'sponsored_bills' : 'recent_activity') :
      metric;

    const sponsorshipCounts = (baseMetric === 'sponsored_bills') ? await getBulkBillsSponsoredCount(representatives, enactedOnly) : {};
    const recentActivityScores = (baseMetric === 'recent_activity') ? await getBulkRecentActivityScores(representatives, enactedOnly) : {};

    if (baseMetric === 'sponsored_bills' && Object.keys(sponsorshipCounts).length > 0) {
      // console.log(`Sponsorship counts found for ${Object.keys(sponsorshipCounts).length} representatives`);
    }
    if (baseMetric === 'recent_activity' && Object.keys(recentActivityScores).length > 0) {
      // console.log(`Recent activity scores found for ${Object.keys(recentActivityScores).length} representatives`);
    }

    const districtScores: Record<string, number> = {};
    const districtRepCount: Record<string, number> = {};

    for (const rep of representatives) {
      const identifiers = getDistrictIdentifiers(rep);
      const repSponsorshipCount = sponsorshipCounts[rep.id] || 0;
      const repRecentScore = recentActivityScores[rep.id] || calculateRecentActivityScore(rep);

      let score = 0;
      if (baseMetric === 'sponsored_bills') score = repSponsorshipCount;
      else if (baseMetric === 'recent_activity') score = repRecentScore;

      for (const id of identifiers) {
        districtScores[id] = (districtScores[id] || 0) + score;
        districtRepCount[id] = (districtRepCount[id] || 0) + 1;
      }
    }

    for (const id of Object.keys(districtScores)) {
      if (districtRepCount[id] > 1) districtScores[id] = districtScores[id] / districtRepCount[id];
    }

    // Improved normalization: different strategies for better color variation
    const values = Object.values(districtScores);
    const maxScore = Math.max(...values, 1);
    const normalizedScores: Record<string, number> = {};

    const isStateLeg = districtType === 'state-upper-districts' || districtType === 'state-lower-districts';

    if (metric === 'sponsored_bills') {
      if (isStateLeg) {
        // For state legislative districts, use improved quantile-based normalization
        const positive = values.filter(v => v > 0).sort((a, b) => a - b);

        if (positive.length === 0) {
          // No data, all districts get 0
          Object.keys(districtScores).forEach(id => {
            normalizedScores[id] = 0;
          });
        } else {
          // Use quantile-based scaling with more aggressive distribution
          const getQuantile = (p: number) => {
            const idx = Math.floor((positive.length - 1) * p);
            return positive[Math.min(idx, positive.length - 1)] || 0;
          };

          const q25 = getQuantile(0.25);
          const q50 = getQuantile(0.5);
          const q75 = getQuantile(0.75);
          const q90 = getQuantile(0.9);

          Object.entries(districtScores).forEach(([districtId, score]) => {
            if (score === 0) {
              normalizedScores[districtId] = 0;
            } else if (score <= q25) {
              // Bottom 25% get values 0.1-0.3
              normalizedScores[districtId] = 0.1 + (score / q25) * 0.2;
            } else if (score <= q50) {
              // 25-50% get values 0.3-0.5
              normalizedScores[districtId] = 0.3 + ((score - q25) / (q50 - q25)) * 0.2;
            } else if (score <= q75) {
              // 50-75% get values 0.5-0.7
              normalizedScores[districtId] = 0.5 + ((score - q50) / (q75 - q50)) * 0.2;
            } else if (score <= q90) {
              // 75-90% get values 0.7-0.9
              normalizedScores[districtId] = 0.7 + ((score - q75) / (q90 - q75)) * 0.2;
            } else {
              // Top 10% get values 0.9-1.0
              const maxVal = Math.max(q90, maxScore);
              normalizedScores[districtId] = 0.9 + ((score - q90) / (maxVal - q90)) * 0.1;
            }
          });
        }
      } else {
        // For congressional districts, use square root scaling for better mid-range variation
        const sqrtMax = Math.sqrt(maxScore);
        Object.entries(districtScores).forEach(([districtId, score]) => {
          if (sqrtMax > 0) {
            normalizedScores[districtId] = Math.sqrt(score) / sqrtMax;
          } else {
            normalizedScores[districtId] = 0;
          }
        });
      }
    } else {
      // For recent activity, use linear normalization
      Object.entries(districtScores).forEach(([districtId, score]) => {
        normalizedScores[districtId] = maxScore > 0 ? score / maxScore : 0;
      });
    }

    // console.log(`Representative heatmap for ${districtType} - ${metric}:`);
    // console.log(`Raw scores range: 0 to ${maxScore}`);
    // console.log(`Sample scores:`, Object.entries(districtScores).slice(0, 5));
    // console.log(`Normalized sample:`, Object.entries(normalizedScores).slice(0, 5));

    const scores = Object.values(normalizedScores);
    const avgScore = scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
    const minScore = scores.length > 0 ? Math.min(...scores) : 0;
    const maxNormalizedScore = scores.length > 0 ? Math.max(...scores) : 0;

    return NextResponse.json({
      success: true,
      scores: normalizedScores,
      details: districtDetails,
      metric,
      districtType,
      metadata: {
        totalDistricts: Object.keys(normalizedScores).length,
        totalRepresentatives: representatives.length,
        avgScore: Math.round(avgScore * 100) / 100,
        minScore: Math.round(minScore * 100) / 100,
        maxScoreRaw: maxScore,
        maxScoreP90: (baseMetric === 'sponsored_bills' && isStateLeg) ? Math.max(...values.filter(v => v > 0).sort((a,b)=>a-b).slice(0, Math.ceil(values.filter(v=>v>0).length*0.9))) || 0 : undefined,
        maxScoreNormalized: Math.round(maxNormalizedScore * 100) / 100,
        availableMetrics: ['sponsored_bills', 'recent_activity', 'enacted_bills', 'enacted_recent_activity'],
        enactedOnly
      }
    });

  } catch (error: any) {
    console.error('Representative heatmap error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
