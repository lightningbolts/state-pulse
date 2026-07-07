import { PolicyUpdatesFeed, type PolicyUpdate } from "@/components/features/PolicyUpdatesFeed";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Panel, PanelBody } from "@/components/layout/Panel";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { pageMetadata } from '@/lib/metadata';
import { getCachedPolicyFeedPage } from "@/services/legislationService";

export const metadata = pageMetadata.legislation;

export default async function UpdatesPage() {
  const initialData = await getCachedPolicyFeedPage(20, 0, 'createdAt', 'desc') as PolicyUpdate[];

  return (
    <div className="animate-content-in space-y-6">
      <PageHeader
        title="Policy Updates"
        subtitle="Stay updated with the latest policy developments. Filter by category or search for specific topics."
      />
      <Panel>
        <PanelBody>
          <Suspense fallback={<PageSkeleton variant="feed" />}>
            <PolicyUpdatesFeed initialData={initialData} />
          </Suspense>
        </PanelBody>
      </Panel>
    </div>
  );
}
