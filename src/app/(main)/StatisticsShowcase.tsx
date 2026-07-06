"use client";

import { useQuery } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowRight, Calendar, FileText, MapPin, RefreshCw, TrendingUp, Users } from 'lucide-react';
import Link from 'next/link';
import { DataCard } from '@/components/layout/DataCard';
import { Panel, PanelBody } from '@/components/layout/Panel';
import type { HomepageStats } from '@/lib/homepage';

async function fetchStats(): Promise<HomepageStats> {
  const response = await fetch('/api/homepage/stats');
  const data = await response.json();
  if (data.success) return data.stats;
  if (data.stats) return data.stats;
  throw new Error('Failed to load statistics');
}

export default function StatisticsShowcase({
  initialStats,
}: {
  initialStats: HomepageStats | null;
}) {
  const { data: stats, isLoading, error, refetch, isFetching } = useQuery({
    queryKey: ['homepage-stats'],
    queryFn: fetchStats,
    initialData: initialStats ?? undefined,
    staleTime: 60_000,
  });

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toLocaleString();
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  if (isLoading && !stats) {
    return (
      <Panel title="StatePulse by the Numbers">
        <PanelBody className="flex items-center justify-center py-12">
          <RefreshCw className="h-5 w-5 animate-spin text-primary" />
        </PanelBody>
      </Panel>
    );
  }

  return (
    <Panel
      title="StatePulse by the Numbers"
      action={
        stats?.lastUpdated ? (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>{formatTimeAgo(stats.lastUpdated)}</span>
            <Button variant="ghost" size="sm" onClick={() => refetch()} disabled={isFetching} className="h-7 px-2">
              <RefreshCw className={`h-3 w-3 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        ) : null
      }
    >
      <PanelBody className="space-y-4">
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="space-y-3 border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <span className="font-medium">Legislation</span>
              </div>
              <Badge variant="secondary" className="text-xs">Live Data</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DataCard label="Total Bills" value={formatNumber(stats?.legislation.total || 0)} className="border-0 p-0 hover:bg-transparent" />
              <DataCard label="Active Bills" value={formatNumber(stats?.legislation.active || 0)} className="border-0 p-0 hover:bg-transparent" />
            </div>
            {stats?.legislation.topSubjects && stats.legislation.topSubjects.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Top Policy Areas</h4>
                {stats.legislation.topSubjects.slice(0, 5).map((subject, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="truncate">{subject.subject}</span>
                    <Badge variant="outline" className="text-xs">{formatNumber(subject.count)}</Badge>
                  </div>
                ))}
              </div>
            )}
            <Button asChild className="w-full" size="sm">
              <Link href="/legislation" prefetch>Explore Legislation <ArrowRight className="ml-2 h-3.5 w-3.5" /></Link>
            </Button>
          </div>

          <div className="space-y-3 border border-border bg-surface p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <span className="font-medium">Representatives</span>
              </div>
              <Badge variant="secondary" className="text-xs">All Levels</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <DataCard label="State Level" value={formatNumber(stats?.representatives.state || 0)} className="border-0 p-0 hover:bg-transparent" />
              <DataCard label="Federal Level" value={formatNumber(stats?.representatives.congress || 0)} className="border-0 p-0 hover:bg-transparent" />
            </div>
            {stats?.representatives.parties && stats.representatives.parties.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Party Breakdown</h4>
                {stats.representatives.parties.slice(0, 5).map((party, index) => (
                  <div key={index} className="flex justify-between text-sm">
                    <span className="truncate">{party._id || 'Unknown'}</span>
                    <Badge variant="outline" className="text-xs">{formatNumber(party.count)}</Badge>
                  </div>
                ))}
              </div>
            )}
            <Button asChild variant="outline" className="w-full" size="sm">
              <Link href="/representatives" prefetch>Find Representatives <MapPin className="ml-2 h-3.5 w-3.5" /></Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
          <DataCard label="Total Content" value={formatNumber((stats?.legislation.total || 0) + (stats?.posts.total || 0))} />
          <DataCard label="Jurisdictions" value={formatNumber(stats?.jurisdictions || 52)} />
          <DataCard label="Updates Today" value={formatNumber(stats?.legislation.daily || 0)} />
        </div>

        {error ? (
          <div className="flex items-center gap-2 rounded-sm border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
            <TrendingUp className="h-4 w-4" />
            Failed to refresh statistics
          </div>
        ) : null}
      </PanelBody>
    </Panel>
  );
}
