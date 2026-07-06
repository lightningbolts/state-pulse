import { RepresentativesFinder } from "@/components/features/RepresentativesFinder";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Panel, PanelBody } from "@/components/layout/Panel";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { pageMetadata } from '@/lib/metadata';

export const metadata = pageMetadata.civic;

export default function CivicPage() {
  return (
    <div className="animate-content-in space-y-6">
      <PageHeader
        title="Civic Tools"
        subtitle="Find your representatives by address or zip code with an interactive map."
      />
      <Panel>
        <PanelBody>
          <Suspense fallback={<PageSkeleton variant="map" />}>
            <RepresentativesFinder />
          </Suspense>
        </PanelBody>
      </Panel>
    </div>
  );
}
