import { getCollection } from '@/lib/mongodb';
import { unstable_cache } from 'next/cache';
import type { HomepageStats } from '@/lib/homepage';

async function fetchHomepageStatsFromDb(): Promise<HomepageStats> {
  const legislationCollection = await getCollection('legislation');
  const representativesCollection = await getCollection('representatives');
  const postsCollection = await getCollection('posts');

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [legislationStats, representativeStats, postsStats, jurisdictionsCount] = await Promise.all([
    legislationCollection.aggregate([
      {
        $facet: {
          totalBills: [{ $count: 'count' }],
          recentBills: [{ $match: { latestActionAt: { $gte: thirtyDaysAgo } } }, { $count: 'count' }],
          dailyBills: [{ $match: { latestActionAt: { $gte: todayStart } } }, { $count: 'count' }],
          activeBills: [{ $match: { status: { $nin: ['dead', 'failed', 'vetoed'] } } }, { $count: 'count' }],
          topSubjects: [
            { $unwind: '$subjects' },
            { $group: { _id: '$subjects', count: { $sum: 1 } } },
            { $sort: { count: -1 } },
            { $limit: 5 },
            { $project: { subject: '$_id', count: 1 } },
          ],
        },
      },
    ]).toArray(),
    representativesCollection.aggregate([
      {
        $facet: {
          totalReps: [{ $count: 'count' }],
          stateReps: [{ $match: { $or: [{ 'jurisdiction.classification': 'state' }, { 'current_role.org_classification': { $in: ['upper', 'lower'] } }] } }, { $count: 'count' }],
          congressReps: [{ $match: { $or: [{ jurisdiction: { $in: ['US House', 'US Senate'] } }, { terms: { $exists: true } }] } }, { $count: 'count' }],
          partiesBreakdown: [{ $group: { _id: '$party', count: { $sum: 1 } } }, { $sort: { count: -1 } }, { $limit: 5 }],
        },
      },
    ]).toArray(),
    postsCollection.aggregate([
      {
        $facet: {
          totalPosts: [{ $count: 'count' }],
          recentPosts: [{ $match: { createdAt: { $gte: sevenDaysAgo } } }, { $count: 'count' }],
          activePosts: [{ $match: { updatedAt: { $gte: thirtyDaysAgo } } }, { $count: 'count' }],
        },
      },
    ]).toArray(),
    legislationCollection.aggregate([
      {
        $addFields: {
          effectiveJurisdictionName: {
            $cond: {
              if: {
                $or: [
                  { $regexMatch: { input: { $ifNull: ['$jurisdictionName', ''] }, regex: /congress|united states/i } },
                  { $in: ['President of the United States', { $ifNull: ['$history.actor', []] }] },
                ],
              },
              then: 'United States Congress',
              else: '$jurisdictionName',
            },
          },
        },
      },
      { $match: { effectiveJurisdictionName: { $exists: true, $nin: [null, ''] } } },
      { $group: { _id: '$effectiveJurisdictionName' } },
      { $count: 'jurisdictions' },
    ]).toArray(),
  ]);

  const legislation = legislationStats[0];
  const representatives = representativeStats[0];
  const posts = postsStats[0];

  return {
    legislation: {
      total: legislation.totalBills[0]?.count || 0,
      recent: legislation.recentBills[0]?.count || 0,
      active: legislation.activeBills[0]?.count || 0,
      daily: legislation.dailyBills[0]?.count || 0,
      topSubjects: legislation.topSubjects?.slice(0, 5) || [],
    },
    representatives: {
      total: representatives.totalReps[0]?.count || 0,
      state: representatives.stateReps[0]?.count || 0,
      congress: representatives.congressReps[0]?.count || 0,
      parties: representatives.partiesBreakdown?.slice(0, 5) || [],
    },
    posts: {
      total: posts.totalPosts[0]?.count || 0,
      recent: posts.recentPosts[0]?.count || 0,
      active: posts.activePosts[0]?.count || 0,
    },
    jurisdictions: jurisdictionsCount[0]?.jurisdictions || 52,
    lastUpdated: new Date().toISOString(),
  };
}

export const getHomepageStats = unstable_cache(
  fetchHomepageStatsFromDb,
  ['homepage-stats'],
  { revalidate: 300 },
);
