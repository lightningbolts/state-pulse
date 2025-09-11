import {NextRequest, NextResponse} from 'next/server';
import {getCollection} from '@/lib/mongodb';
import {ABR_TO_FIPS, STATE_MAP} from "@/types/geo";

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

  if (isCongress && fips && (isAtLargeState || isAtLarge || (!dStr || dStr === '0') || districtRaw === null)) {
    return [
      fips + '00',  // Standard format: STATEFP + '00'
      fips + '0',   // Alternative format: STATEFP + '0'
      fips,         // Just the state FIPS
      repState + '00', // State abbreviation + '00'
      repState + '0',  // State abbreviation + '0'
      repState + 'AL'  // State abbreviation + 'AL' (at-large)
    ];
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

    return sponsorshipCounts;
  } catch (error) {
    console.error('Error counting sponsored bills in bulk:', error);
    return {};
  }
}

async function getBulkVotingMajorityScores(representatives: any[]): Promise<Record<string, number>> {
  try {
    const votingRecordsCollection = await getCollection('voting_records');
    const repIdMap = new Map<string, string>();
    const allRepIds = new Set<string>();

    representatives.forEach(rep => {
      const repKey = rep.id;
      if (!repKey) return;
      // Use normalizeIds to handle various ID formats (person_id, internal id, etc.)
      const ids = normalizeIds(rep.id, rep._id?.toString(), rep.person_id);
      ids.forEach(id => {
        if (id) {
          repIdMap.set(id, repKey);
          allRepIds.add(id);
        }
      });
    });

    if (allRepIds.size === 0) return {};

    // Fetch all voting records that involve any of the representatives.
    // This query is broad and robust, checking multiple possible ID fields.
    const votingRecords = await votingRecordsCollection.find({
      $or: [
        { 'memberVotes.bioguideId': { $in: Array.from(allRepIds) } },
        { 'memberVotes.person_id': { $in: Array.from(allRepIds) } },
        { 'memberVotes.id': { $in: Array.from(allRepIds) } }
      ]
    }).toArray();

    const repScores: Record<string, { totalVotes: number; majorityVotes: number }> = {};

    for (const record of votingRecords) {
      if (!record.memberVotes || record.memberVotes.length === 0) continue;

      let yea = 0;
      let nay = 0;
      for (const vote of record.memberVotes) {
        const voteCast = vote.voteCast?.toLowerCase();
        if (voteCast === 'yea' || voteCast === 'yes' || voteCast === 'aye') yea++;
        else if (voteCast === 'nay' || voteCast === 'no') nay++;
      }

      if (yea === nay) continue; // Skip ties
      const majorityPosition = yea > nay ? 'yea' : 'nay';

      for (const vote of record.memberVotes) {
        // Find the representative's internal ID using any of the possible ID fields
        const memberId = vote.bioguideId || vote.person_id || vote.id;
        if (!memberId) continue;

        const repKey = repIdMap.get(memberId);
        if (repKey) {
          if (!repScores[repKey]) {
            repScores[repKey] = { totalVotes: 0, majorityVotes: 0 };
          }

          const voteCast = vote.voteCast?.toLowerCase();
          // Only count yea/nay votes in the total
          if (voteCast === 'yea' || voteCast === 'yes' || voteCast === 'aye' || voteCast === 'nay' || voteCast === 'no') {
            repScores[repKey].totalVotes++;
            const normalizedVote = (voteCast === 'yes' || voteCast === 'aye') ? 'yea' : (voteCast === 'no' ? 'nay' : voteCast);
            if (normalizedVote === majorityPosition) {
              repScores[repKey].majorityVotes++;
            }
          }
        }
      }
    }

    const finalScores: Record<string, number> = {};
    for (const repKey in repScores) {
      const { totalVotes, majorityVotes } = repScores[repKey];
      finalScores[repKey] = totalVotes > 0 ? (majorityVotes / totalVotes) * 100 : 0;
    }
    console.log(finalScores)

    return finalScores;
  } catch (error) {
    console.error('Error calculating voting majority scores:', error);
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
        rep.openstates_url?.split('/')?.pop()?.replace('-', '_')
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

    const representatives = await repsCollection.find(chamberQuery).toArray();
    const districtDetails: Record<string, any> = {};

    const enactedOnly = metric === 'enacted_bills' || metric === 'enacted_recent_activity';
    const baseMetric = enactedOnly ?
      (metric === 'enacted_bills' ? 'sponsored_bills' : 'recent_activity') :
      metric;

    const sponsorshipCounts = (baseMetric === 'sponsored_bills') ? await getBulkBillsSponsoredCount(representatives, enactedOnly) : {};
    const recentActivityScores = (baseMetric === 'recent_activity') ? await getBulkRecentActivityScores(representatives, enactedOnly) : {};
    const votingMajorityScores = (baseMetric === 'voted_with_majority') ? await getBulkVotingMajorityScores(representatives) : {};


    const districtScores: Record<string, number> = {};
    const districtRepCount: Record<string, number> = {};

    for (const rep of representatives) {
      const identifiers = getDistrictIdentifiers(rep);
      const repSponsorshipCount = sponsorshipCounts[rep.id] || 0;
      const repRecentScore = recentActivityScores[rep.id] || calculateRecentActivityScore(rep);
      const repVotingMajorityScore = votingMajorityScores[rep.id] || 0;


      let score = 0;
      if (baseMetric === 'sponsored_bills') score = repSponsorshipCount;
      else if (baseMetric === 'recent_activity') score = repRecentScore;
      else if (baseMetric === 'voted_with_majority') score = repVotingMajorityScore;


      for (const id of identifiers) {
        districtScores[id] = (districtScores[id] || 0) + score;
        districtRepCount[id] = (districtRepCount[id] || 0) + 1;
      }
    }

    for (const id of Object.keys(districtScores)) {
      if (districtRepCount[id] > 1) districtScores[id] = districtScores[id] / districtRepCount[id];
    }

    const scores = Object.values(districtScores);
    const maxScore = scores.length > 0 ? Math.max(...scores) : 0;
    const avgScore = scores.length > 0 ? scores.reduce((sum, score) => sum + score, 0) / scores.length : 0;
    const minScore = scores.length > 0 ? Math.min(...scores) : 0;

    return NextResponse.json({
      success: true,
      scores: districtScores,
      details: districtDetails,
      metric,
      districtType,
      metadata: {
        totalDistricts: Object.keys(districtScores).length,
        totalRepresentatives: representatives.length,
        avgScore: Math.round(avgScore * 100) / 100,
        minScore: Math.round(minScore * 100) / 100,
        maxScoreRaw: maxScore,
        availableMetrics: ['sponsored_bills', 'recent_activity', 'enacted_bills', 'enacted_recent_activity', 'voted_with_majority'],
        enactedOnly
      }
    });

  } catch (error: any) {
    console.error('Representative heatmap error:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal server error' }, { status: 500 });
  }
}
