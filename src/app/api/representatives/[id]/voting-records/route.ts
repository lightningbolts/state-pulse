import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';
import { VotingRecord, MemberVote } from '@/types/legislation';

export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: 'Representative ID is required' }, { status: 400 });
    }

    // Get URL search params for pagination and filtering
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10000'); // Increased from 20 to 10000
    const chamber = searchParams.get('chamber'); // 'US House' or 'US Senate'
    const votePosition = searchParams.get('votePosition'); // 'Yea', 'Nay', etc.
    const sortBy = searchParams.get('sortBy') || 'date'; // 'date' or 'bill'
    const sortOrder = searchParams.get('sortOrder') || 'desc'; // 'asc' or 'desc'

    const skip = (page - 1) * limit;

    const votingRecordsCollection = await getCollection('voting_records');

    // Build aggregation pipeline to find voting records where the representative voted
    const matchStage: any = {
      'memberVotes.bioguideId': id
    };

    // Always filter to only bill-related voting records (exclude nominations and non-bill types)
    matchStage.bill_id = { 
      $exists: true, 
      $ne: null, 
      $not: /undefined/ 
    };
    matchStage.legislationType = { 
      $exists: true, 
      $ne: null, 
      $nin: ['', undefined, 'nomination', 'Nomination'] // Exclude nominations
    };
    matchStage.legislationNumber = { 
      $exists: true, 
      $ne: null, 
      $nin: ['', undefined] 
    };

    // Add chamber filter if specified
    if (chamber) {
      matchStage.chamber = chamber;
    }

    // Build aggregation pipeline
    const pipeline: any[] = [
      { $match: matchStage },
      {
        $addFields: {
          // Find the specific member's vote in the memberVotes array
          representativeVote: {
            $arrayElemAt: [
              {
                $filter: {
                  input: '$memberVotes',
                  cond: { $eq: ['$$this.bioguideId', id] }
                }
              },
              0
            ]
          }
        }
      },
      {
        $addFields: {
          partyVotes: {
            $filter: {
              input: '$memberVotes',
              as: 'vote',
              cond: { $eq: ['$$vote.voteParty', '$representativeVote.voteParty'] }
            }
          }
        }
      },
      {
        $addFields: {
          partyVoteBreakdown: {
            $reduce: {
              input: '$partyVotes',
              initialValue: { Yea: 0, Nay: 0 },
              in: {
                $switch: {
                  branches: [
                    {
                      case: { $in: ['$$this.voteCast', ['Yea', 'Yes', 'Aye']] },
                      then: { $mergeObjects: ['$$value', { Yea: { $add: ['$$value.Yea', 1] } }] }
                    },
                    {
                      case: { $in: ['$$this.voteCast', ['Nay', 'No']] },
                      then: { $mergeObjects: ['$$value', { Nay: { $add: ['$$value.Nay', 1] } }] }
                    }
                  ],
                  default: '$$value'
                }
              }
            }
          }
        }
      },
      {
        $addFields: {
          partyPosition: {
            $cond: [
              { $gt: ['$partyVoteBreakdown.Yea', '$partyVoteBreakdown.Nay'] },
              'Yea',
              {
                $cond: [
                  { $gt: ['$partyVoteBreakdown.Nay', '$partyVoteBreakdown.Yea'] },
                  'Nay',
                  'No Majority'
                ]
              }
            ]
          }
        }
      },
      {
        $addFields: {
          votedAgainstParty: {
            $let: {
              vars: {
                repVote: '$representativeVote.voteCast'
              },
              in: {
                $cond: [
                  {
                    $and: [
                      { $ne: ['$partyPosition', 'No Majority'] },
                      {
                        $or: [
                          { $and: [{ $eq: ['$partyPosition', 'Yea'] }, { $in: ['$$repVote', ['Nay', 'No']] }] },
                          { $and: [{ $eq: ['$partyPosition', 'Nay'] }, { $in: ['$$repVote', ['Yea', 'Yes', 'Aye']] }] }
                        ]
                      }
                    ]
                  },
                  true,
                  false
                ]
              }
            }
          }
        }
      }
    ];

    // Add vote position filter if specified
    if (votePosition) {
      pipeline.push({
        $match: {
          'representativeVote.voteCast': votePosition
        }
      });
    }

    // Add sorting
    const sortField = sortBy === 'bill' ? 'legislationNumber' : 'date';
    const sortDirection = sortOrder === 'asc' ? 1 : -1;
    pipeline.push({ $sort: { [sortField]: sortDirection } });

    // Get total count for pagination
    const totalCountPipeline = [...pipeline, { $count: 'total' }];
    const totalResult = await votingRecordsCollection.aggregate(totalCountPipeline).toArray();
    const total = totalResult.length > 0 ? totalResult[0].total : 0;

    // Add pagination
    pipeline.push({ $skip: skip }, { $limit: limit });

    // Project the fields we need
    pipeline.push({
      $project: {
        _id: 0,
        identifier: 1,
        rollCallNumber: 1,
        legislationType: 1,
        legislationNumber: 1,
        bill_id: 1,
        voteQuestion: 1,
        result: 1,
        date: 1,
        congress: 1,
        session: 1,
        chamber: 1,
        representativeVote: 1,
        votedAgainstParty: 1,
        totalVotes: { $size: '$memberVotes' },
        // Calculate vote breakdown
        voteBreakdown: {
          $reduce: {
            input: '$memberVotes',
            initialValue: { Yea: 0, Nay: 0, 'Not Voting': 0, Present: 0, Other: 0 },
            in: {
              $switch: {
                branches: [
                  { 
                    case: { 
                      $or: [
                        { $eq: ['$$this.voteCast', 'Yea'] },
                        { $eq: ['$$this.voteCast', 'Yes'] },
                        { $eq: ['$$this.voteCast', 'Aye'] }
                      ]
                    }, 
                    then: { $mergeObjects: ['$$value', { Yea: { $add: ['$$value.Yea', 1] } }] } 
                  },
                  { 
                    case: { 
                      $or: [
                        { $eq: ['$$this.voteCast', 'Nay'] },
                        { $eq: ['$$this.voteCast', 'No'] }
                      ]
                    }, 
                    then: { $mergeObjects: ['$$value', { Nay: { $add: ['$$value.Nay', 1] } }] } 
                  },
                  { 
                    case: { 
                      $or: [
                        { $eq: ['$$this.voteCast', 'Not Voting'] },
                        { $eq: ['$$this.voteCast', 'Absent'] }
                      ]
                    }, 
                    then: { $mergeObjects: ['$$value', { 'Not Voting': { $add: ['$$value.Not Voting', 1] } }] } 
                  },
                  { 
                    case: { $eq: ['$$this.voteCast', 'Present'] }, 
                    then: { $mergeObjects: ['$$value', { Present: { $add: ['$$value.Present', 1] } }] } 
                  }
                ],
                default: { $mergeObjects: ['$$value', { Other: { $add: ['$$value.Other', 1] } }] }
              }
            }
          }
        }
      }
    });

    const votingRecords = await votingRecordsCollection.aggregate(pipeline).toArray();

    // Calculate pagination metadata
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return NextResponse.json({
      success: true,
      data: {
        votingRecords,
        pagination: {
          currentPage: page,
          totalPages,
          totalRecords: total,
          hasNextPage,
          hasPrevPage,
          limit
        },
        filters: {
          chamber,
          votePosition,
          sortBy,
          sortOrder
        }
      }
    });

  } catch (error) {
    console.error('Error fetching representative voting records:', error);
    return NextResponse.json(
      { error: 'Failed to fetch voting records' },
      { status: 500 }
    );
  }
}
