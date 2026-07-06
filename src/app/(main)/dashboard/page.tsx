import DashboardPageClient from '@/app/(main)/dashboard/DashboardPageClient';
import { pageMetadata } from '@/lib/metadata';
import { Suspense } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { PageSkeleton } from '@/components/layout/PageSkeleton';

export const metadata = pageMetadata.dashboard;

export default function DashboardPage() {
  return (
    <div className="animate-content-in space-y-6">
      <PageHeader
        title="Dashboard"
        subtitle="Interactive maps, state statistics, and legislative activity across the nation."
      />
      <Suspense fallback={<PageSkeleton variant="map" />}>
        <DashboardPageClient />
      </Suspense>
    </div>
  );
}
