import { PageHeader } from '@/components/layout/PageHeader';
import { StateLegislationComparison } from '@/components/features/StateLegislationComparison';
import { Badge } from '@/components/ui/badge';
import { pageMetadata } from '@/lib/metadata';

export const metadata = pageMetadata.summaries;

export default function SummariesPage() {
  return (
    <div className="animate-content-in space-y-6">
      <PageHeader
        title="Compare States"
        subtitle="Experimental — search and AI comparison run in your browser. Results can be slow and may not be accurate yet."
        badge={<Badge variant="secondary">Beta</Badge>}
      />
      <StateLegislationComparison />
    </div>
  );
}
