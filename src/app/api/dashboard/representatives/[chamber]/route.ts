import {NextRequest, NextResponse} from 'next/server';
import {getCollection} from '@/lib/mongodb';

const CHAMBER_MAP: Record<string, string[]> = {
  state_upper: ['upper', 'state senate', 'senate'],
  state_lower: ['lower', 'state house', 'house of representatives', 'house'],
  us_house: ['us house', 'house', 'house of representatives', 'representative', 'congress', 'House of Representatives', 'US House'],
  us_senate: ['us senate', 'senate', 'senator']
};

function buildChamberQuery(chamberParam: string) {
  const chamber = chamberParam.toLowerCase();
  const possible = CHAMBER_MAP[chamber];
  const currentYear = new Date().getFullYear();
  
  if (!possible) {
    return {
      $or: [
        { 'current_role.org_classification': chamber },
        { chamber },
        { role: chamber },
        { 'jurisdiction': chamber },
        { 'jurisdiction.name': chamber },
        { 'jurisdiction.classification': chamber }
      ]
    };
  }
  
  // For state_upper/state_lower, match org_classification, chamber, role, jurisdiction.classification
  if (chamber === 'state_upper' || chamber === 'state_lower') {
    return {
      $or: [
        { 'current_role.org_classification': { $in: possible } },
        { chamber: { $in: possible } },
        { role: { $in: possible } },
        { 'jurisdiction.classification': 'state' }
      ]
    };
  }
  
  // For us_house, only include current members (latest term is House and is current)
  if (chamber === 'us_house') {
    return {
      $or: [
        // Direct chamber match for congressional representatives
        { chamber: 'House of Representatives' },
        { chamber: 'House' },
        { jurisdiction: 'US House' },
        
        // Map boundary type match
        { 'map_boundary.type': 'congressional' },
        
        // For OpenStates/state reps, match top-level fields
        { $and: [
          { 'terms': { $exists: false } },
          { jurisdiction: 'US House' }
        ] },
        
        // For CongressPeople with terms array, check latest term
        { $and: [
          { 'terms': { $exists: true, $type: 'array' } },
          { $expr: {
            $let: {
              vars: {
                lastTerm: { $arrayElemAt: ["$terms", { $subtract: [ { $size: "$terms" }, 1 ] } ] }
              },
              in: {
                $and: [
                  { $regexMatch: { input: "$$lastTerm.chamber", regex: '^House of Representatives$', options: 'i' } },
                  { $or: [
                    { $not: [ { $ifNull: ["$$lastTerm.endYear", false] } ] },
                    { $gte: ["$$lastTerm.endYear", currentYear] }
                  ] }
                ]
              }
            }
          } }
        ] },
        
        // Fallback for terms.item structure (if it exists)
        { $and: [
          { 'terms.item': { $exists: true } },
          { $expr: {
            $let: {
              vars: {
                lastTerm: { $arrayElemAt: ["$terms.item", { $subtract: [ { $size: "$terms.item" }, 1 ] } ] }
              },
              in: {
                $and: [
                  { $regexMatch: { input: "$$lastTerm.chamber", regex: '^House of Representatives$', options: 'i' } },
                  { $or: [
                    { $not: [ { $ifNull: ["$$lastTerm.endYear", false] } ] },
                    { $gte: ["$$lastTerm.endYear", currentYear] }
                  ] }
                ]
              }
            }
          } }
        ] }
      ]
    };
  }
  
  // For us_senate, only include current members (latest term is Senate and is current)
  if (chamber === 'us_senate') {
    return {
      $or: [
        // For OpenStates/state reps, match top-level fields
        { $and: [
          { 'terms': { $exists: false } },
          { jurisdiction: 'US Senate' }
        ] },
        // For CongressPeople, only include if latest term is Senate and is current
        { $and: [
          { 'terms.item': { $exists: true } },
          { $expr: {
            $let: {
              vars: {
                lastTerm: { $arrayElemAt: ["$terms.item", { $subtract: [ { $size: "$terms.item" }, 1 ] } ] }
              },
              in: {
                $and: [
                  { $regexMatch: { input: "$$lastTerm.chamber", regex: '^Senate$', options: 'i' } },
                  { $or: [
                    { $not: [ { $ifNull: ["$$lastTerm.endYear", false] } ] },
                    { $gte: ["$$lastTerm.endYear", currentYear] }
                  ] }
                ]
              }
            }
          } }
        ] }
      ]
    };
  }
  
  return {
    $or: [
      { 'current_role.org_classification': { $in: possible } },
      { chamber: { $in: possible } },
      { role: { $in: possible } }
    ]
  };
}

// Helper function to extract party information from representative data
function extractPartyInfo(rep: any): string {
  // Try multiple possible party fields in order of preference
  if (rep.party) return rep.party;
  if (rep.current_role?.party) return rep.current_role.party;
  if (rep.extras?.party) return rep.extras.party;
  if (rep.partyHistory && Array.isArray(rep.partyHistory) && rep.partyHistory.length > 0) {
    return rep.partyHistory[0].partyName;
  }
  if (rep.terms && Array.isArray(rep.terms) && rep.terms.length > 0) {
    const latestTerm = rep.terms[rep.terms.length - 1];
    if (latestTerm.partyName) return latestTerm.partyName;
    if (latestTerm.party) return latestTerm.party;
  }
  if (rep.terms?.item && Array.isArray(rep.terms.item) && rep.terms.item.length > 0) {
    const latestTerm = rep.terms.item[rep.terms.item.length - 1];
    if (latestTerm.partyName) return latestTerm.partyName;
    if (latestTerm.party) return latestTerm.party;
  }
  return 'Unknown';
}

// Helper function to check if a state has a unicameral legislature
function isUnicameralState(rep: any): boolean {
  // Nebraska is the only state with a unicameral legislature
  return rep.jurisdiction?.name === 'Nebraska' ||
      rep.current_role?.division_id?.includes('/state:ne/') ||
      rep.state === 'Nebraska' ||
      rep.state === 'NE';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chamber: string }> }
) {
  try {
    const { chamber } = await params;
    const repsCollection = await getCollection('representatives');
    let query: any = {};
    
    if (chamber) {
      const baseQuery = buildChamberQuery(chamber);
      
      // Add map boundary type filter for state chambers to ensure correct chamber
      if (chamber === 'state_upper') {
        query = {
          $and: [
            baseQuery,
            {
              $or: [
                { 'map_boundary.type': 'state_leg_upper' },
                // Special case for Nebraska's unicameral legislature
                {
                  $and: [
                    {
                      $or: [
                        { 'jurisdiction.name': 'Nebraska' },
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
              ]
            }
          ]
        };
      } else if (chamber === 'state_lower') {
        query = {
          $and: [
            baseQuery,
            { 'map_boundary.type': 'state_leg_lower' },
            // Exclude Nebraska from state_lower since it's unicameral
            {
              $nor: [
                { 'jurisdiction.name': 'Nebraska' },
                { 'current_role.division_id': { $regex: '/state:ne/' } },
                { 'state': { $in: ['Nebraska', 'NE'] } }
              ]
            }
          ]
        };
      } else if (chamber === 'us_house') {
        query = {
          $and: [
            baseQuery,
            {
              $or: [
                { 'map_boundary.type': 'congressional' },
                {
                  $and: [
                    { 'jurisdiction': 'US House' },
                    {
                      $or: [
                        { 'district': null },
                        { 'district': { $exists: false } }
                      ]
                    }
                  ]
                }
              ]
            }
          ]
        };
      } else {
        query = baseQuery;
      }
    }
    
    const reps = await repsCollection.find(query).toArray();

    // Process representatives to ensure party information is available
    const processedReps = reps.map(rep => {
      const party = extractPartyInfo(rep);

      // Determine chamber based on the request and special cases
      let chamberName = rep.chamber;

      if (!chamberName) {
        if (isUnicameralState(rep)) {
          // Nebraska's unicameral legislature - treat as upper chamber for mapping purposes
          chamberName = 'State Senate';
        } else if (rep.current_role?.org_classification === 'upper') {
          chamberName = 'State Senate';
        } else if (rep.current_role?.org_classification === 'lower') {
          chamberName = 'State House';
        } else {
          chamberName = rep.chamber;
        }
      }

      return {
        ...rep,
        party,
        chamber: chamberName
      };
    });

    return NextResponse.json({ representatives: processedReps });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
