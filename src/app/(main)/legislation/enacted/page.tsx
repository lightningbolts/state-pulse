import { PolicyUpdatesFeed } from "@/components/features/PolicyUpdatesFeed";
import { Suspense } from "react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Panel, PanelBody } from "@/components/layout/Panel";
import { PageSkeleton } from "@/components/layout/PageSkeleton";
import { Badge } from "@/components/ui/badge";
import { getAllLegislationWithFiltering } from "@/services/legislationService";
import type { PolicyUpdate } from "@/components/features/PolicyUpdatesFeed";

export const metadata = {
  title: 'Enacted Legislation | StatePulse',
  description: 'View all bills that have been enacted into law across states and federal government.',
};

export default async function EnactedLegislationPage() {
  const raw = await getAllLegislationWithFiltering({
    limit: 20,
    skip: 0,
    sortDir: 'desc',
    sortBy: 'createdAt',
    showOnlyEnacted: 'true',
    context: 'policy-updates-feed',
  });
  const initialData = JSON.parse(JSON.stringify(raw)) as PolicyUpdate[];

  return (
    <div className="animate-content-in space-y-6">
      <PageHeader
        title="Enacted Legislation"
        subtitle="Bills that have been signed into law with effective dates and chapter numbers."
        badge={<Badge className="bg-status-enacted text-white">Enacted into Law</Badge>}
      />
      <Panel>
        <PanelBody>
          <Suspense fallback={<PageSkeleton variant="feed" />}>
            <PolicyUpdatesFeed initialData={initialData} enactedOnly />
          </Suspense>
        </PanelBody>
      </Panel>
    </div>
  );
}
