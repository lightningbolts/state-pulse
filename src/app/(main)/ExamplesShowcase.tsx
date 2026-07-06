"use client";

import { useQuery } from '@tanstack/react-query';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, User, ArrowRight, Calendar, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import type { HomepageExamples } from '@/lib/homepage';
import type { Legislation } from '@/types/legislation';
import type { Representative } from '@/types/representative';
import { Skeleton } from '@/components/ui/skeleton';

async function fetchExamples(): Promise<HomepageExamples> {
  const response = await fetch('/api/homepage/random-examples');
  const data = await response.json();
  if (data.success && data.data) return data.data;
  throw new Error(data.message || 'Failed to load examples');
}

export default function ExamplesShowcase({
  initialExamples,
}: {
  initialExamples: HomepageExamples;
}) {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['homepage-examples'],
    queryFn: fetchExamples,
    initialData: initialExamples.legislation || initialExamples.representative ? initialExamples : undefined,
    staleTime: 60_000,
  });

  const policyUpdate = data?.legislation ?? null;
  const representative = data?.representative ?? null;

  if (isLoading && !policyUpdate && !representative) {
    return (
      <div className="grid gap-3 lg:grid-cols-2">
        <Skeleton className="h-52 w-full" />
        <Skeleton className="h-52 w-full" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-6 text-center">
        <p className="mb-3 text-sm text-muted-foreground">Couldn&apos;t load examples.</p>
        <Button onClick={() => refetch()} variant="outline" size="sm">Try again</Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 lg:grid-cols-2">
        {policyUpdate ? <PolicyExampleCard policyUpdate={policyUpdate} /> : null}
        {representative ? <RepExampleCard representative={representative} /> : null}
      </div>
      <div className="text-center">
        <Button onClick={() => refetch()} variant="ghost" size="sm">Show another</Button>
      </div>
    </div>
  );
}

function PolicyExampleCard({ policyUpdate }: { policyUpdate: Legislation }) {
  return (
    <div className="flex h-full flex-col border border-border bg-surface p-4">
      <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
        <FileText className="h-4 w-4 text-primary" />
        <span>{policyUpdate.jurisdictionName || 'Unknown state'}</span>
      </div>
      <h3 className="line-clamp-2 font-medium">{policyUpdate.title || 'Untitled bill'}</h3>
      <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted-foreground">
        {policyUpdate.geminiSummary || policyUpdate.summary || 'No summary yet.'}
      </p>
      {policyUpdate.latestActionAt ? (
        <p className="mt-2 text-xs text-muted-foreground">
          Last action: {new Date(policyUpdate.latestActionAt).toLocaleDateString()}
        </p>
      ) : null}
      <Button asChild className="mt-4 w-full" size="sm" variant="outline">
        <Link href={`/legislation/${encodeURIComponent(policyUpdate.id)}`} prefetch>
          Read bill <ArrowRight className="ml-2 h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  );
}

function RepExampleCard({ representative }: { representative: Representative }) {
  const jurisdiction =
    typeof representative.jurisdiction === 'object' && representative.jurisdiction?.name
      ? representative.jurisdiction.name
      : typeof representative.jurisdiction === 'string'
        ? representative.jurisdiction
        : representative.jurisdictionName || 'Unknown';

  return (
    <div className="flex h-full flex-col border border-border bg-surface p-4">
      <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
        <User className="h-4 w-4 text-primary" />
        <span>{jurisdiction}</span>
      </div>
      <div className="flex items-center gap-3">
        {representative.image ? (
          <img src={representative.image} alt={representative.name} className="h-12 w-12 rounded-full object-cover" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <User className="h-6 w-6 text-muted-foreground" />
          </div>
        )}
        <div>
          <h3 className="font-medium">{representative.name}</h3>
          {representative.party ? (
            <Badge variant="outline" className="mt-1 text-xs">{representative.party}</Badge>
          ) : null}
        </div>
      </div>
      <Button asChild className="mt-4 w-full" size="sm" variant="outline">
        <Link href={`/representatives/${encodeURIComponent(representative.id)}`} prefetch>
          View profile <ExternalLink className="ml-2 h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  );
}
