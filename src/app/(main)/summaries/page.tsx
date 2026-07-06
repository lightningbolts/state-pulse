import { PageHeader } from '@/components/layout/PageHeader';
import { StateLegislationComparison } from '@/components/features/StateLegislationComparison';
import { pageMetadata } from '@/lib/metadata';

export const metadata = pageMetadata.summaries;

export default function SummariesPage() {
  return (
    <div className="animate-content-in space-y-6">
      <PageHeader
        title="Compare States"
        subtitle="Search a policy issue and compare how states approach it — powered by browser-side AI, no API keys."
      />
      <StateLegislationComparison />
    </div>
  );
}
