import RepresentativesFeed from "@/components/features/RepresentativesFeed";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Panel, PanelBody } from "@/components/layout/Panel";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { pageMetadata } from '@/lib/metadata';

export const metadata = pageMetadata.representatives;

export default function RepresentativesPage() {
  return (
    <div className="animate-content-in space-y-6">
      <PageHeader
        title="Representatives"
        subtitle="Search and filter all state and federal representatives."
      />
      <Panel>
        <PanelBody>
          <Suspense fallback={<PageSkeleton variant="feed" />}>
            <RepresentativesFeed />
          </Suspense>
        </PanelBody>
      </Panel>
    </div>
  );
}
