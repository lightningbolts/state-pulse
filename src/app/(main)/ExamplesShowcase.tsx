"use client";

import { useQuery } from '@tanstack/react-query';
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, User, ArrowRight, Calendar, MapPin, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { Panel, PanelBody } from '@/components/layout/Panel';
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
    initialData: initialExamples,
    staleTime: 60_000,
  });

  const policyUpdate = data?.legislation ?? null;
  const representative = data?.representative ?? null;

  const getPartyColor = (party: string | undefined) => {
    if (!party) return 'bg-muted text-muted-foreground';
    switch (party.toLowerCase()) {
      case 'democratic':
      case 'democrat':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400';
      case 'republican':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'independent':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getSponsorName = (sponsors: unknown[]) => {
    if (!sponsors || sponsors.length === 0) return 'Unknown Sponsor';
    const primarySponsor = sponsors[0] as { name?: string; person?: { name?: string } };
    if (typeof primarySponsor === 'string') return primarySponsor;
    return primarySponsor?.name || primarySponsor?.person?.name || 'Unknown Sponsor';
  };

  const getSponsorParty = (sponsors: unknown[]) => {
    if (!sponsors || sponsors.length === 0) return null;
    const primarySponsor = sponsors[0] as { party?: string; person?: { party?: string } };
    if (typeof primarySponsor === 'string') return null;
    return primarySponsor?.party || primarySponsor?.person?.party || null;
  };

  const formatDate = (date: Date | string | null | undefined) => {
    if (!date) return 'Unknown';
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleDateString();
  };

  const getRepresentativeOffice = (rep: Representative) =>
    rep.current_role?.title || rep.office || 'Representative';

  const getRepresentativeJurisdiction = (rep: Representative) => {
    if (rep.jurisdiction && typeof rep.jurisdiction === 'object' && rep.jurisdiction.name) {
      return rep.jurisdiction.name;
    }
    if (typeof rep.jurisdiction === 'string') return rep.jurisdiction;
    if (rep.jurisdictionName) return rep.jurisdictionName;
    const chamber = (rep as Representative & { chamber?: string }).chamber;
    if (chamber === 'House of Representatives') return 'US House';
    if (chamber === 'Senate') return 'US Senate';
    return 'Unknown Jurisdiction';
  };

  return (
    <Panel title="See StatePulse in Action">
      <PanelBody>
        {isLoading && !policyUpdate && !representative ? (
          <div className="grid gap-3 lg:grid-cols-2">
            <Skeleton className="h-64 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : error ? (
          <div className="py-8 text-center">
            <p className="mb-4 text-sm text-muted-foreground">Failed to load examples</p>
            <Button onClick={() => refetch()} variant="outline" size="sm">Try Again</Button>
          </div>
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {policyUpdate ? <PolicyExampleCard policyUpdate={policyUpdate} getPartyColor={getPartyColor} getSponsorName={getSponsorName} getSponsorParty={getSponsorParty} formatDate={formatDate} /> : null}
            {representative ? <RepExampleCard representative={representative} getPartyColor={getPartyColor} getRepresentativeOffice={getRepresentativeOffice} getRepresentativeJurisdiction={getRepresentativeJurisdiction} /> : null}
          </div>
        )}
        <div className="mt-4 text-center">
          <Button onClick={() => refetch()} variant="outline" size="sm">Fetch Again</Button>
        </div>
      </PanelBody>
    </Panel>
  );
}

function PolicyExampleCard({
  policyUpdate,
  getPartyColor,
  getSponsorName,
  getSponsorParty,
  formatDate,
}: {
  policyUpdate: Legislation;
  getPartyColor: (party: string | undefined) => string;
  getSponsorName: (sponsors: unknown[]) => string;
  getSponsorParty: (sponsors: unknown[]) => string | null;
  formatDate: (date: Date | string | null | undefined) => string;
}) {
  const party = getSponsorParty(policyUpdate.sponsors || []);
  return (
    <div className="flex h-full flex-col border border-border bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <FileText className="h-5 w-5 text-primary" />
        <div>
          <p className="font-medium">Featured Policy Update</p>
          <p className="text-xs text-muted-foreground">{policyUpdate.jurisdictionName || 'Unknown'}</p>
        </div>
      </div>
      <h3 className="line-clamp-2 font-medium">{policyUpdate.title || 'Untitled Legislation'}</h3>
      <p className="mt-2 line-clamp-3 flex-1 text-sm text-muted-foreground">
        {policyUpdate.geminiSummary || policyUpdate.summary || 'No summary available'}
      </p>
      <div className="mt-3 space-y-2 text-sm">
        <div className="flex items-center gap-2">
          <User className="h-3.5 w-3.5 text-muted-foreground" />
          <span>{getSponsorName(policyUpdate.sponsors || [])}</span>
          {party ? <Badge className={`text-xs ${getPartyColor(party)}`}>{party}</Badge> : null}
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" />
          <span>{policyUpdate.statusText || 'Unknown Status'}</span>
          {policyUpdate.latestActionAt ? <span>• {formatDate(policyUpdate.latestActionAt)}</span> : null}
        </div>
      </div>
      <Button asChild className="mt-4 w-full" size="sm">
        <Link href={`/legislation/${encodeURIComponent(policyUpdate.id)}`} prefetch>
          View Full Details <ArrowRight className="ml-2 h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  );
}

function RepExampleCard({
  representative,
  getPartyColor,
  getRepresentativeOffice,
  getRepresentativeJurisdiction,
}: {
  representative: Representative;
  getPartyColor: (party: string | undefined) => string;
  getRepresentativeOffice: (rep: Representative) => string;
  getRepresentativeJurisdiction: (rep: Representative) => string;
}) {
  return (
    <div className="flex h-full flex-col border border-border bg-surface p-4">
      <div className="mb-3 flex items-center gap-2">
        <User className="h-5 w-5 text-primary" />
        <div>
          <p className="font-medium">Featured Representative</p>
          <p className="text-xs text-muted-foreground">{getRepresentativeJurisdiction(representative)}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        {representative.image ? (
          <img src={representative.image} alt={representative.name} className="h-14 w-14 rounded-full object-cover" />
        ) : (
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
            <User className="h-7 w-7 text-muted-foreground" />
          </div>
        )}
        <div>
          <h3 className="font-medium">{representative.name}</h3>
          <p className="text-sm text-muted-foreground">{getRepresentativeOffice(representative)}</p>
          {representative.party ? (
            <Badge className={getPartyColor(representative.party)} variant="outline">{representative.party}</Badge>
          ) : null}
        </div>
      </div>
      <div className="mt-4 flex items-center justify-between rounded-sm bg-panel p-3 text-sm">
        <span>Bills Sponsored This Year</span>
        <Badge variant="secondary">{representative.recentBillsCount ?? 0}</Badge>
      </div>
      <Button asChild variant="outline" className="mt-4 w-full" size="sm">
        <Link href={`/representatives/${encodeURIComponent(representative.id)}`} prefetch>
          View Profile <ExternalLink className="ml-2 h-3.5 w-3.5" />
        </Link>
      </Button>
    </div>
  );
}
