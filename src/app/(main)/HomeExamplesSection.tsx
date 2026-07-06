"use client";

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/ui/skeleton';
import type { HomepageExamples } from '@/lib/homepage';

const ExamplesShowcase = dynamic(() => import('./ExamplesShowcase'), {
  ssr: false,
  loading: () => (
    <div className="grid gap-3 lg:grid-cols-2">
      <Skeleton className="h-52 w-full" />
      <Skeleton className="h-52 w-full" />
    </div>
  ),
});

export function HomeExamplesSection({
  initialExamples,
}: {
  initialExamples: HomepageExamples;
}) {
  return <ExamplesShowcase initialExamples={initialExamples} />;
}
