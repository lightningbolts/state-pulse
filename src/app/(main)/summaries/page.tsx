import { AnimatedSection } from "@/components/ui/AnimatedSection";
import { pageMetadata } from '@/lib/metadata';

export const metadata = pageMetadata.summaries;

export default function SummariesPage() {
  return (
    <AnimatedSection>
      {/* <AISummarizationTool /> */}
      <div className="py-8 text-center text-gray-600">
        Summarization tool is under construction.
      </div>
    </AnimatedSection>
  );
}
