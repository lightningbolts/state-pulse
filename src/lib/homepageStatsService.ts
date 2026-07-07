import { getCollection } from '@/lib/mongodb';
import { unstable_cache } from 'next/cache';
import type { HomepageStats } from '@/lib/homepage';

const CONGRESS_JURISDICTION_NAMES = new Set([
  'United States Congress',
  'United States',
  'US',
  'USA',
  'Federal',
  'Congress',
]);

function normalizeJurisdictionCount(names: string[]): number {
  const normalized = new Set<string>();
  for (const name of names) {
    if (!name) continue;
    if (CONGRESS_JURISDICTION_NAMES.has(name) || /congress|united states/i.test(name)) {
      normalized.add('United States Congress');
    } else {
      normalized.add(name);
    }
  }
  return normalized.size || 52;
}

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

  const [
    totalBills,
    recentBills,
    dailyBills,
    activeBills,
    topSubjects,
    jurisdictionNames,
    totalReps,
    stateReps,
    congressReps,
    partiesBreakdown,
    totalPosts,
    recentPosts,
    activePosts,
  ] = await Promise.all([
    legislationCollection.estimatedDocumentCount(),
    legislationCollection.countDocuments({ latestActionAt: { $gte: thirtyDaysAgo } }),
    legislationCollection.countDocuments({ latestActionAt: { $gte: todayStart } }),
    legislationCollection.countDocuments({ status: { $nin: ['dead', 'failed', 'vetoed'] } }),
    legislationCollection
      .aggregate([
        { $match: { latestActionAt: { $gte: thirtyDaysAgo }, subjects: { $exists: true, $ne: [] } } },
        { $unwind: '$subjects' },
        { $group: { _id: '$subjects', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
        { $project: { subject: '$_id', count: 1, _id: 0 } },
      ])
      .toArray(),
    legislationCollection
      .aggregate([
        { $match: { jurisdictionName: { $exists: true, $nin: [null, ''] } } },
        { $group: { _id: '$jurisdictionName' } },
      ])
      .toArray()
      .then((rows) => rows.map((r) => r._id as string)),
    representativesCollection.estimatedDocumentCount(),
    representativesCollection.countDocuments({
      $or: [
        { 'jurisdiction.classification': 'state' },
        { 'current_role.org_classification': { $in: ['upper', 'lower'] } },
      ],
    }),
    representativesCollection.countDocuments({
      $or: [{ jurisdiction: { $in: ['US House', 'US Senate'] } }, { terms: { $exists: true } }],
    }),
    representativesCollection
      .aggregate([
        { $group: { _id: '$party', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ])
      .toArray(),
    postsCollection.estimatedDocumentCount(),
    postsCollection.countDocuments({ createdAt: { $gte: sevenDaysAgo } }),
    postsCollection.countDocuments({ updatedAt: { $gte: thirtyDaysAgo } }),
  ]);

  return {
    legislation: {
      total: totalBills,
      recent: recentBills,
      active: activeBills,
      daily: dailyBills,
      topSubjects: topSubjects as HomepageStats['legislation']['topSubjects'],
    },
    representatives: {
      total: totalReps,
      state: stateReps,
      congress: congressReps,
      parties: partiesBreakdown as HomepageStats['representatives']['parties'],
    },
    posts: {
      total: totalPosts,
      recent: recentPosts,
      active: activePosts,
    },
    jurisdictions: normalizeJurisdictionCount(jurisdictionNames),
    lastUpdated: new Date().toISOString(),
  };
}

export const getHomepageStats = unstable_cache(
  fetchHomepageStatsFromDb,
  ['homepage-stats-v2'],
  { revalidate: 300 },
);
