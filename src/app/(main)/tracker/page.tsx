import TrackerPageClient from './TrackerPageClient';
import { pageMetadata } from '@/lib/metadata';
import { PageHeader } from '@/components/layout/PageHeader';

export const metadata = pageMetadata.tracker;

export default function TrackerPage() {
  return (
    <div className="animate-content-in space-y-6">
      <PageHeader
        title="Policy Tracker"
        subtitle="Subscribe to topics, manage bookmarks, and follow legislators."
      />
      <TrackerPageClient />
    </div>
  );
}
