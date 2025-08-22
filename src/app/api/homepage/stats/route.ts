import { NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';

export async function GET() {
  try {
    const legislationCollection = await getCollection('legislation');
    const representativesCollection = await getCollection('representatives');
    const postsCollection = await getCollection('posts');

    // Get current date for recent activity calculations
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    // Get today's date for daily updates (start of today)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Parallel execution of statistics queries
    const [legislationStats, representativeStats, postsStats, jurisdictionsCount] = await Promise.all([
      // Legislation statistics
      legislationCollection.aggregate([
        {
          $facet: {
            totalBills: [{ $count: "count" }],
            recentBills: [
              {
                $match: {
                  latestActionAt: { $gte: thirtyDaysAgo }
                }
              },
              { $count: "count" }
            ],
            dailyBills: [
              {
                $match: {
                  latestActionAt: { $gte: todayStart }
                }
              },
              { $count: "count" }
            ],
            activeBills: [
              {
                $match: {
                  status: { $nin: ["dead", "failed", "vetoed"] }
                }
              },
              { $count: "count" }
            ],
            topSubjects: [
              { $unwind: "$subjects" },
              { $group: { _id: "$subjects", count: { $sum: 1 } } },
              { $sort: { count: -1 } },
              { $limit: 5 },
              { $project: { subject: "$_id", count: 1 } }
            ]
          }
        }
      ]).toArray(),

      // Representatives statistics
      representativesCollection.aggregate([
        {
          $facet: {
            totalReps: [{ $count: "count" }],
            stateReps: [
              {
                $match: {
                  $or: [
                    { "jurisdiction.classification": "state" },
                    { "current_role.org_classification": { $in: ["upper", "lower"] } }
                  ]
                }
              },
              { $count: "count" }
            ],
            congressReps: [
              {
                $match: {
                  $or: [
                    { "jurisdiction": { $in: ["US House", "US Senate"] } },
                    { "terms": { $exists: true } }
                  ]
                }
              },
              { $count: "count" }
            ],
            partiesBreakdown: [
              { $group: { _id: "$party", count: { $sum: 1 } } },
              { $sort: { count: -1 } },
              { $limit: 5 }
            ]
          }
        }
      ]).toArray(),

      // Posts statistics
      postsCollection.aggregate([
        {
          $facet: {
            totalPosts: [{ $count: "count" }],
            recentPosts: [
              {
                $match: {
                  createdAt: { $gte: sevenDaysAgo }
                }
              },
              { $count: "count" }
            ],
            activePosts: [
              {
                $match: {
                  updatedAt: { $gte: thirtyDaysAgo }
                }
              },
              { $count: "count" }
            ]
          }
        }
      ]).toArray(),

      // Jurisdictions count - including US Congress + DC + all states
      legislationCollection.aggregate([
        {
          $addFields: {
            effectiveJurisdictionName: {
              $cond: {
                if: {
                  $or: [
                    { $regexMatch: { input: { $ifNull: ["$jurisdictionName", ""] }, regex: /congress|united states/i } },
                    { $in: ["President of the United States", { $ifNull: ["$history.actor", []] }] }
                  ]
                },
                then: "United States Congress",
                else: "$jurisdictionName"
              }
            }
          }
        },
        {
          $match: {
            effectiveJurisdictionName: { $exists: true, $nin: [null, ""] }
          }
        },
        {
          $group: {
            _id: "$effectiveJurisdictionName"
          }
        },
        {
          $count: "jurisdictions"
        }
      ]).toArray()
    ]);

    // Process results
    const legislation = legislationStats[0];
    const representatives = representativeStats[0];
    const posts = postsStats[0];
    const jurisdictions = jurisdictionsCount[0]?.jurisdictions || 52; // Fallback to 52 (50 states + DC + US Congress)

    const stats = {
      legislation: {
        total: legislation.totalBills[0]?.count || 0,
        recent: legislation.recentBills[0]?.count || 0,
        active: legislation.activeBills[0]?.count || 0,
        daily: legislation.dailyBills[0]?.count || 0,
        topSubjects: legislation.topSubjects.slice(0, 10)
      },
      representatives: {
        total: representatives.totalReps[0]?.count || 0,
        state: representatives.stateReps[0]?.count || 0,
        congress: representatives.congressReps[0]?.count || 0,
        parties: representatives.partiesBreakdown.slice(0, 10)
      },
      posts: {
        total: posts.totalPosts[0]?.count || 0,
        recent: posts.recentPosts[0]?.count || 0,
        active: posts.activePosts[0]?.count || 0
      },
      jurisdictions: jurisdictions,
      lastUpdated: new Date().toISOString()
    };

    return NextResponse.json({ success: true, stats });
  } catch (error) {
    console.error('Error fetching homepage stats:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch statistics',
        stats: {
          legislation: { total: 0, recent: 0, active: 0, daily: 0, topSubjects: [] },
          representatives: { total: 0, state: 0, congress: 0, parties: [] },
          posts: { total: 0, recent: 0, active: 0 },
          jurisdictions: 52, // 50 states + DC + US Congress
          lastUpdated: new Date().toISOString()
        }
      },
      { status: 500 }
    );
  }
}
