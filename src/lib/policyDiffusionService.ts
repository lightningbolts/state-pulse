import { getCollection } from '@/lib/mongodb';
import { STATE_MAP, STATE_NAMES } from '@/types/geo';
import type { PolicyDiffusionTopic } from '@/types/jurisdictions';
import { dashboardDateWindows, topicArrayExpression } from '@/lib/dashboardMetrics';
import { unstable_cache } from 'next/cache';

const CONGRESS_NAME = 'United States Congress';
const MIN_STATES = 3;

function toStateAbbr(jurisdictionName: string): string | null {
  if (!jurisdictionName || jurisdictionName === CONGRESS_NAME) return null;
  if (STATE_MAP[jurisdictionName]) return STATE_MAP[jurisdictionName];
  for (const [abbr, name] of Object.entries(STATE_NAMES)) {
    if (abbr === 'US') continue;
    if (jurisdictionName.toLowerCase() === name.toLowerCase()) return abbr;
  }
  return null;
}

async function fetchPolicyDiffusionFromDb(): Promise<PolicyDiffusionTopic[]> {
  const { thirtyDaysAgo } = dashboardDateWindows();
  const legislation = await getCollection('legislation');

  const rows = await legislation
    .aggregate(
      [
        {
          $match: {
            latestActionAt: { $gte: thirtyDaysAgo },
            jurisdictionName: { $exists: true, $nin: [null, '', CONGRESS_NAME] },
          },
        },
        { $addFields: { dashboardTopics: topicArrayExpression } },
        { $unwind: '$dashboardTopics' },
        { $match: { dashboardTopics: { $nin: [null, ''] } } },
        {
          $group: {
            _id: '$dashboardTopics',
            billCount: { $sum: 1 },
            jurisdictions: { $addToSet: '$jurisdictionName' },
          },
        },
        {
          $project: {
            name: '$_id',
            billCount: 1,
            jurisdictions: 1,
            stateCount: { $size: '$jurisdictions' },
          },
        },
        { $match: { stateCount: { $gte: MIN_STATES } } },
        { $sort: { stateCount: -1, billCount: -1 } },
        { $limit: 12 },
      ],
      { maxTimeMS: 20000, allowDiskUse: true },
    )
    .toArray();

  return rows.map((row) => {
    const states = [...new Set(
      ((row.jurisdictions as string[]) || [])
        .map(toStateAbbr)
        .filter((abbr): abbr is string => Boolean(abbr)),
    )].sort();
    return {
      name: row.name as string,
      billCount: row.billCount as number,
      stateCount: states.length,
      states,
    };
  }).filter((topic) => topic.stateCount >= MIN_STATES);
}

export const getPolicyDiffusion = unstable_cache(
  fetchPolicyDiffusionFromDb,
  ['dashboard-policy-diffusion-v1'],
  { revalidate: 600 },
);
