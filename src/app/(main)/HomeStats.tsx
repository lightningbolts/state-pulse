import { DataCard } from '@/components/layout/DataCard';
import { getHomepageStats } from '@/lib/homepageStatsService';

export async function HomeStats() {
  const stats = await getHomepageStats();

  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <DataCard label="Bills tracked" value={stats.legislation.total.toLocaleString()} />
      <DataCard label="Active bills" value={stats.legislation.active.toLocaleString()} />
      <DataCard label="Representatives" value={stats.representatives.total.toLocaleString()} />
      <DataCard label="Jurisdictions covered" value={stats.jurisdictions.toLocaleString()} />
    </section>
  );
}
