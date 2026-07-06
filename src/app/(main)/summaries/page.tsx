import { PageHeader } from '@/components/layout/PageHeader';
import { EmptyState } from '@/components/layout/EmptyState';
import { pageMetadata } from '@/lib/metadata';

export const metadata = pageMetadata.summaries;

export default function SummariesPage() {
  return (
    <div className="animate-content-in space-y-6">
      <PageHeader title="AI Summaries" subtitle="AI-powered legislative summarization tools." />
      <EmptyState
        title="Summarization tool is under construction"
        description="This feature will return soon. Existing bill detail summaries remain available on individual legislation pages."
      />
    </div>
  );
}
