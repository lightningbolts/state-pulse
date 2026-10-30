import { DataCard } from '@/components/layout/DataCard';
import { getHomepageStats } from '@/lib/homepageStatsService';
import { buildSafe } from '@/lib/buildSafe';
import type { HomepageStats } from '@/lib/homepage';

const EMPTY_STATS: HomepageStats = {
  legislation: { total: 0, recent: 0, active: 0, daily: 0, topSubjects: [] },
  representatives: { total: 0, state: 0, congress: 0, parties: [] },
  posts: { total: 0, recent: 0, active: 0 },
  jurisdictions: 52,
  lastUpdated: new Date(0).toISOString(),
};

export async function HomeStats() {
  const stats = await buildSafe(getHomepageStats, EMPTY_STATS);

  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <DataCard label="Bills tracked" value={stats.legislation.total.toLocaleString()} />
      <DataCard label="Active bills" value={stats.legislation.active.toLocaleString()} />
      <DataCard label="Representatives" value={stats.representatives.total.toLocaleString()} />
      <DataCard label="Jurisdictions covered" value={stats.jurisdictions.toLocaleString()} />
    </section>
  );
}
