import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';
import { STATE_NAMES } from '@/types/geo';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ state: string }> }
) {
  try {
    const { state } = await params;
    
    if (!state) {
      return NextResponse.json(
        { error: 'State parameter is required' },
        { status: 400 }
      );
    }

    const representativesCollection = await getCollection('representatives');


    const stateAbbr = state.toUpperCase();
    const stateFull = STATE_NAMES[stateAbbr] || state;

    let baseFilter;
    if (stateAbbr === 'US') {
      const currentYear = new Date().getFullYear();
      const FIFTY_STATE_NAMES = Object.keys(STATE_NAMES)
        .map(abbr => STATE_NAMES[abbr])
        .filter(name => ![
          'District of Columbia',
          'Puerto Rico',
          'Guam',
          'American Samoa',
          'U.S. Virgin Islands',
          'Northern Mariana Islands'
        ].includes(name));
      baseFilter = {
        $and: [
          {
            $or: [
              // US House: OpenStates/state reps (no terms array)
              { $and: [
                { terms: { $exists: false } },
                { $or: [
                  { 'jurisdiction': 'US House' },
                  { 'jurisdiction.name': 'US House' }
                ] },
                { state: { $in: FIFTY_STATE_NAMES } }
              ] },
              // US House: CongressPeople (with terms array, latest term is House and is current)
              { $and: [
                { 'terms.item': { $exists: true } },
                { state: { $in: FIFTY_STATE_NAMES } },
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
              ] },
              // US Senate: OpenStates/state reps (no terms array)
              { $and: [
                { terms: { $exists: false } },
                { $or: [
                  { 'jurisdiction': 'US Senate' },
                  { 'jurisdiction.name': 'US Senate' }
                ] }
              ] },
              // US Senate: CongressPeople (with terms array, latest term is Senate and is current)
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
          },
        ]
      };
    } else {
      // Create flexible regex to match state in various formats (abbr and full name)
      const stateRegex = new RegExp(`\\b(${stateAbbr}|${stateFull}|${state})\\b`, 'i');
      baseFilter = {
        $and: [
          {
            $or: [
              { 'jurisdiction.name': { $regex: stateRegex } },
              { jurisdiction: { $regex: stateRegex } },
              { state: { $regex: stateRegex } },
              { 'terms.stateCode': stateAbbr },
              { 'terms.stateName': { $regex: stateFull, $options: 'i' } },
              { 'terms.stateName': { $regex: state, $options: 'i' } }
            ]
          },
          {
            $nor: [
              { 'jurisdiction.name': { $regex: /united states congress|us congress|us house|us senate/i } },
              { jurisdiction: { $regex: /united states congress|us congress|us house|us senate/i } }
            ]
          }
        ]
      };
    }

    let partyMakeup;
    if (stateAbbr === 'US') {
      // For US, strictly assign chamber based on latest term logic (no overlap)
      partyMakeup = await representativesCollection.aggregate([
        { $match: baseFilter },
        {
          $addFields: {
            lastTerm: {
              $cond: [
                { $and: [ { $isArray: "$terms.item" }, { $gt: [ { $size: "$terms.item" }, 0 ] } ] },
                { $arrayElemAt: ["$terms.item", { $subtract: [ { $size: "$terms.item" }, 1 ] } ] },
                null
              ]
            }
          }
        },
        {
          $addFields: {
            normalizedChamber: {
              $switch: {
                branches: [
                  // CongressPeople with terms: assign based on latest term
                  {
                    case: { $and: [
                      { $ne: ["$lastTerm", null] },
                      { $regexMatch: { input: "$lastTerm.chamber", regex: '^House of Representatives$', options: 'i' } },
                      { $or: [
                        { $not: [ { $ifNull: ["$lastTerm.endYear", false] } ] },
                        { $gte: ["$lastTerm.endYear", new Date().getFullYear()] }
                      ] }
                    ] },
                    then: 'House'
                  },
                  {
                    case: { $and: [
                      { $ne: ["$lastTerm", null] },
                      { $regexMatch: { input: "$lastTerm.chamber", regex: '^Senate$', options: 'i' } },
                      { $or: [
                        { $not: [ { $ifNull: ["$lastTerm.endYear", false] } ] },
                        { $gte: ["$lastTerm.endYear", new Date().getFullYear()] }
                      ] }
                    ] },
                    then: 'Senate'
                  },
                  // OpenStates/state reps: assign by jurisdiction
                  {
                    case: { $or: [
                      { $and: [
                        { $eq: ["$terms", undefined] },
                        { $or: [
                          { $eq: ["$jurisdiction", 'US House'] },
                          { $eq: ["$jurisdiction.name", 'US House'] }
                        ] }
                      ] },
                      { $and: [
                        { $eq: ["$terms", undefined] },
                        { $or: [
                          { $eq: ["$jurisdiction", 'US Senate'] },
                          { $eq: ["$jurisdiction.name", 'US Senate'] }
                        ] }
                      ] }
                    ] },
                    then: {
                      $cond: [
                        { $or: [
                          { $eq: ["$jurisdiction", 'US House'] },
                          { $eq: ["$jurisdiction.name", 'US House'] }
                        ] },
                        'House',
                        'Senate'
                      ]
                    }
                  }
                ],
                default: 'Other'
              }
            },
            normalizedParty: {
              $cond: {
                if: { $regexMatch: { input: { $ifNull: ['$party', ''] }, regex: 'democrat', options: 'i' } },
                then: 'Democratic',
                else: {
                  $cond: {
                    if: { $regexMatch: { input: { $ifNull: ['$party', ''] }, regex: 'republican', options: 'i' } },
                    then: 'Republican',
                    else: {
                      $cond: {
                        if: { $or: [
                          { $regexMatch: { input: { $ifNull: ['$party', ''] }, regex: 'independent', options: 'i' } },
                          { $regexMatch: { input: { $ifNull: ['$party', ''] }, regex: 'nonpartisan', options: 'i' } },
                          { $regexMatch: { input: { $ifNull: ['$party', ''] }, regex: 'green|libertarian|constitution', options: 'i' } }
                        ]},
                        then: 'Other',
                        else: { $ifNull: ['$party', 'Unknown'] }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        { $match: { normalizedChamber: { $in: ['House', 'Senate'] } } },
        {
          $group: {
            _id: {
              chamber: '$normalizedChamber',
              party: '$normalizedParty'
            },
            count: { $sum: 1 },
            representatives: {
              $push: {
                id: '$id',
                name: '$name',
                party: '$party',
                district: '$district',
                state: '$state'
              }
            }
          }
        },
        {
          $group: {
            _id: '$_id.chamber',
            parties: {
              $push: {
                party: '$_id.party',
                count: '$count',
                representatives: '$representatives'
              }
            },
            totalSeats: { $sum: '$count' }
          }
        },
        { $sort: { _id: 1 } }
      ]).toArray();
    } else {
      partyMakeup = await representativesCollection.aggregate([
        { $match: baseFilter },
        {
          $addFields: {
            normalizedChamber: {
              $cond: {
                if: { $or: [
                  { $regexMatch: { input: { $ifNull: ['$chamber', ''] }, regex: 'house|lower|assembly', options: 'i' } },
                  { $regexMatch: { input: { $ifNull: ['$role', ''] }, regex: 'representative|assembly', options: 'i' } },
                  { $regexMatch: { input: { $ifNull: ['$current_role.org_classification', ''] }, regex: 'lower', options: 'i' } },
                  { $regexMatch: { input: { $ifNull: ['$office', ''] }, regex: 'representative|assembly', options: 'i' } }
                ]},
                then: 'House',
                else: {
                  $cond: {
                    if: { $or: [
                      { $regexMatch: { input: { $ifNull: ['$chamber', ''] }, regex: 'senate|upper', options: 'i' } },
                      { $regexMatch: { input: { $ifNull: ['$role', ''] }, regex: 'senator', options: 'i' } },
                      { $regexMatch: { input: { $ifNull: ['$current_role.org_classification', ''] }, regex: 'upper', options: 'i' } },
                      { $regexMatch: { input: { $ifNull: ['$office', ''] }, regex: 'senator', options: 'i' } }
                    ]},
                    then: 'Senate',
                    else: 'Other'
                  }
                }
              }
            },
            normalizedParty: {
              $cond: {
                if: { $regexMatch: { input: { $ifNull: ['$party', ''] }, regex: 'democrat', options: 'i' } },
                then: 'Democratic',
                else: {
                  $cond: {
                    if: { $regexMatch: { input: { $ifNull: ['$party', ''] }, regex: 'republican', options: 'i' } },
                    then: 'Republican',
                    else: {
                      $cond: {
                        if: { $or: [
                          { $regexMatch: { input: { $ifNull: ['$party', ''] }, regex: 'independent', options: 'i' } },
                          { $regexMatch: { input: { $ifNull: ['$party', ''] }, regex: 'nonpartisan', options: 'i' } },
                          { $regexMatch: { input: { $ifNull: ['$party', ''] }, regex: 'green|libertarian|constitution', options: 'i' } }
                        ]},
                        then: 'Other',
                        else: { $ifNull: ['$party', 'Unknown'] }
                      }
                    }
                  }
                }
              }
            }
          }
        },
        {
          $group: {
            _id: {
              chamber: '$normalizedChamber',
              party: '$normalizedParty'
            },
            count: { $sum: 1 },
            representatives: {
              $push: {
                id: '$id',
                name: '$name',
                party: '$party',
                district: '$district',
                state: '$state'
              }
            }
          }
        },
        {
          $group: {
            _id: '$_id.chamber',
            parties: {
              $push: {
                party: '$_id.party',
                count: '$count',
                representatives: '$representatives'
              }
            },
            totalSeats: { $sum: '$count' }
          }
        },
        {
          $sort: { _id: 1 }
        }
      ]).toArray();
    }


    // Format the response and include the 'Other' chamber, displaying its people grouped by party
    const chambers = partyMakeup
      .map((chamber: any) => ({
        chamber: chamber._id,
        totalSeats: chamber.totalSeats,
        parties: chamber.parties.map((party: any) => ({
          party: party.party,
          count: party.count,
          percentage: Math.round((party.count / chamber.totalSeats) * 100),
          representatives: party.representatives
        })).sort((a: any, b: any) => b.count - a.count)
      }));

    return NextResponse.json({
      success: true,
      state: state,
      chambers: chambers,
      summary: {
        totalRepresentatives: chambers.reduce((sum, chamber) => sum + chamber.totalSeats, 0),
        chambersAvailable: chambers.map(c => c.chamber)
      }
    });

  } catch (error) {
    console.error('Error fetching party makeup:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch party makeup data' },
      { status: 500 }
    );
  }
}
