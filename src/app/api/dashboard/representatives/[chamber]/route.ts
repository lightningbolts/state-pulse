import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';

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
        // For OpenStates/state reps, match top-level fields
        { $and: [
          { 'terms': { $exists: false } },
          { jurisdiction: 'US House' }
        ] },
        // For CongressPeople, only include if latest term is House and is current
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
            { 'map_boundary.type': 'state_leg_upper' }
          ]
        };
      } else if (chamber === 'state_lower') {
        query = {
          $and: [
            baseQuery,
            { 'map_boundary.type': 'state_leg_lower' }
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
    return NextResponse.json({ representatives: reps });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
