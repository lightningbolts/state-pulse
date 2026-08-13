"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Calendar, ChevronRight, FileText, Gauge, Handshake, Timer, TrendingUp, Users, Stamp } from "lucide-react";
import type { StateData, StateDetailData } from "@/types/jurisdictions";
import { cn } from "@/lib/utils";
import {
  BillRow,
  formatDashboardDate,
  formatDays,
  formatRate,
  LoadingBlock,
  MixBar,
  SectionHeader,
  Sparkline,
  SponsorRow,
  StatCard,
  TopicBar,
} from "./dashboard/DashboardDetailParts";

type DetailMapMode = "legislation" | "representatives" | "trends" | "recent" | string;

const MODE_LABELS: Record<string, string> = {
  legislation: "Legislation Activity",
  representatives: "Representatives",
  trends: "Trending Topics",
  recent: "Recent Activity",
  bipartisan: "Bipartisan Sponsorship",
  enactment: "Enactment Rate",
  velocity: "Bill Velocity",
  pace: "Legislative Pace",
};

export type StateModeDetailPanelProps = {
  mapMode: DetailMapMode;
  stateAbbr: string;
  state: StateData;
  stateDetails: StateDetailData | null;
  detailsLoading: boolean;
  activityLevel?: string;
  onViewDashboard?: () => void;
  onViewLegislation?: () => void;
};

export function StateModeDetailPanel({
  mapMode,
  stateAbbr,
  state,
  stateDetails,
  detailsLoading,
  activityLevel,
  onViewDashboard,
  onViewLegislation,
}: StateModeDetailPanelProps) {
  const isCongress = stateAbbr === 'US';
  const modeLabel = MODE_LABELS[mapMode] ?? "Overview";
  const listLimit = 6;

  const primaryStat = (() => {
    switch (mapMode) {
      case "legislation":
        return { label: "Total bills tracked", value: state.legislationCount, icon: FileText, color: "text-blue-500" };
      case "representatives":
        return {
          label: isCongress ? "Members of Congress" : "State legislators",
          value: state.activeRepresentatives,
          icon: Users,
          color: "text-green-500",
        };
      case "trends":
        return { label: "Topics heating up", value: state.topicMomentum ?? state.topicDiversity, icon: TrendingUp, color: "text-orange-500" };
      case "recent":
        return { label: "Actions in last 30 days", value: state.recentActivity, icon: Calendar, color: "text-amber-500" };
      case "bipartisan":
        return { label: "Recent bipartisan rate", value: state.bipartisanRate ?? 0, suffix: "%", icon: Handshake, color: "text-violet-500" };
      case "enactment":
        return { label: "Enactment rate", value: state.enactmentRate ?? 0, suffix: "%", icon: Stamp, color: "text-emerald-600" };
      case "velocity":
        return { label: "Days to passage", value: state.averageBillVelocityDays ?? 0, icon: Timer, color: "text-amber-600" };
      case "pace":
        return { label: "Weekly pace", value: state.legislativePace ?? 0, icon: Gauge, color: "text-sky-600" };
      default:
        return { label: "Total bills", value: state.legislationCount, icon: FileText, color: "text-blue-500" };
    }
  })();

  const PrimaryIcon = primaryStat.icon;

  const secondaryStats = [
    { label: "Bills", value: state.legislationCount },
    { label: "Legislators", value: state.activeRepresentatives },
    { label: "Topics", value: state.topicDiversity },
    { label: "30-day actions", value: state.recentActivity },
  ].filter((item) => {
    if (mapMode === "legislation") return item.label !== "Bills";
    if (mapMode === "representatives") return item.label !== "Legislators";
    if (mapMode === "trends") return item.label !== "Topics";
    if (mapMode === "recent") return item.label !== "30-day actions";
    if (mapMode === "bipartisan") return item.label !== "Legislators";
    if (mapMode === "enactment" || mapMode === "velocity" || mapMode === "pace") return item.label !== "Bills";
    return true;
  });

  const detailSection = (() => {
    if (detailsLoading && !stateDetails) {
      return <LoadingBlock label={`Loading ${modeLabel.toLowerCase()} breakdown…`} />;
    }
    if (!stateDetails) return null;

    const maxTopicRecent = Math.max(...stateDetails.trendingTopics.map((t) => t.recentCount), 1);

    switch (mapMode) {
      case "legislation":
        return (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Total legislation" value={stateDetails.statistics.totalLegislation} />
              <StatCard label="Recent actions" value={stateDetails.statistics.recentActivity} hint="Last 30 days" />
              <StatCard label="Enactment rate" value={formatRate(stateDetails.statistics.enactmentRate)} hint="Bills with an enacted date" />
              <StatCard label="Bill velocity" value={formatDays(stateDetails.statistics.averageBillVelocityDays)} hint="First action to passage" />
            </div>
            <Separator />
            <div className="space-y-3">
              <SectionHeader title="Active sponsors" description={`${stateDetails.statistics.activeSponsors} legislators have sponsored at least one bill.`} />
              {stateDetails.topSponsors.length > 0 ? (
                <div className="divide-y rounded-lg border">
                  {stateDetails.topSponsors.slice(0, listLimit).map((sponsor, index) => (
                    <SponsorRow
                      key={sponsor.name}
                      rank={index + 1}
                      name={sponsor.name}
                      totalBills={sponsor.totalBills}
                      recentBills={sponsor.recentBills}
                      activity={sponsor.activity}
                    />
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No sponsor activity recorded.</p>
              )}
            </div>
            {stateDetails.recentLegislation.length > 0 && (
              <>
                <Separator />
                <div className="space-y-3">
                  <SectionHeader title="Latest bill movement" description="Most recently updated legislation in this state." />
                  <div className="space-y-2">
                    {stateDetails.recentLegislation.slice(0, listLimit).map((bill) => (
                      <BillRow
                        key={bill.id}
                        identifier={bill.identifier}
                        title={bill.title}
                        meta={`${formatDashboardDate(bill.lastActionDate)}${bill.chamber ? ` · ${bill.chamber}` : ""}`}
                        action={bill.lastAction}
                        subjects={bill.subjects}
                      />
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        );

      case "representatives":
        return (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="Active sponsors" value={stateDetails.statistics.activeSponsors} hint="With at least one bill" />
              <StatCard label="Bills in jurisdiction" value={stateDetails.statistics.totalLegislation} />
              <StatCard label="30-day actions" value={stateDetails.statistics.recentActivity} hint="Recent legislative activity" />
            </div>
            <Separator />
            <div className="space-y-3">
              <SectionHeader
                title={isCongress ? "Most active members" : "Most active legislators"}
                description={isCongress
                  ? "Members of Congress ranked by recent and total bills sponsored."
                  : "Ranked by recent and total bills sponsored."}
              />
              <div className="divide-y rounded-lg border">
                {stateDetails.topSponsors.slice(0, listLimit).map((sponsor, index) => (
                  <SponsorRow
                    key={sponsor.name}
                    rank={index + 1}
                    name={sponsor.name}
                    totalBills={sponsor.totalBills}
                    recentBills={sponsor.recentBills}
                    activity={sponsor.activity}
                  />
                ))}
              </div>
            </div>
          </div>
        );

      case "trends":
        return (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <StatCard label="Topics heating up" value={state.topicMomentum ?? 0} hint="Subjects with more action than the prior 30 days" />
              <StatCard label="Recent legislative actions" value={state.recentActivity} hint="Last 30 days" />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[...new Set(state.keyTopics)].map((topic, index) => (
                <Badge key={`${topic}-${index}`} variant="outline" className="text-xs">
                  {topic}
                </Badge>
              ))}
            </div>
            <Separator />
            <div className="space-y-3">
              <SectionHeader title="Trending policy areas" description="Topics with the most recent legislative activity versus the prior 30 days." />
              <div className="space-y-3">
                {stateDetails.trendingTopics.slice(0, listLimit).map((topic, index) => (
                  <TopicBar
                    key={topic.name}
                    rank={index + 1}
                    name={topic.name}
                    recent={topic.recentCount}
                    total={topic.totalCount}
                    maxRecent={maxTopicRecent}
                    prior={topic.priorCount}
                    pctChange={topic.pctChange}
                    trend={topic.trend}
                    weeklyCounts={topic.weeklyCounts}
                  />
                ))}
              </div>
            </div>
          </div>
        );

      case "recent":
        return (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="30-day actions" value={state.recentActivity} />
              <StatCard label="Active sponsors" value={stateDetails.statistics.activeSponsors} />
              <StatCard label="Avg bill age" value={`${stateDetails.statistics.averageBillAge}d`} />
            </div>
            <Separator />
            <div className="space-y-3">
              <SectionHeader title="Recent legislative developments" description="Bills with actions in the last 30 days." />
              <div className="space-y-2">
                {stateDetails.recentLegislation.slice(0, listLimit).map((bill) => (
                  <BillRow
                    key={bill.id}
                    identifier={bill.identifier}
                    title={bill.title}
                    meta={formatDashboardDate(bill.lastActionDate)}
                    sponsor={bill.primarySponsor}
                    action={bill.lastAction || bill.title}
                    subjects={bill.subjects}
                  />
                ))}
              </div>
            </div>
          </div>
        );

      case "bipartisan":
        return (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard
                label="Recent rate"
                value={formatRate(state.bipartisanRate)}
                hint="Last 60 days on the map"
              />
              <StatCard
                label="Overall rate"
                value={formatRate(stateDetails.statistics.bipartisanRate)}
                hint="All tracked multi-sponsor bills"
              />
              <StatCard
                label="Scored bills"
                value={stateDetails.statistics.bipartisanScoredBills ?? 0}
                hint="Bills with two or more known-party sponsors"
              />
              <StatCard
                label="Enactment rate"
                value={formatRate(stateDetails.statistics.enactmentRate)}
                hint="Bills with an enacted date"
              />
            </div>
            <Separator />
            <div className="space-y-3">
              <SectionHeader title="Most active sponsors" description="Legislators ranked by recent and total bills sponsored." />
              <div className="divide-y rounded-lg border">
                {stateDetails.topSponsors.slice(0, listLimit).map((sponsor, index) => (
                  <SponsorRow
                    key={sponsor.name}
                    rank={index + 1}
                    name={sponsor.name}
                    totalBills={sponsor.totalBills}
                    recentBills={sponsor.recentBills}
                    activity={sponsor.activity}
                  />
                ))}
              </div>
            </div>
          </div>
        );

      case "enactment":
        return (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="Enactment rate" value={formatRate(stateDetails.statistics.enactmentRate)} hint="Bills with an enacted date" />
              <StatCard label="Enacted bills" value={stateDetails.statistics.enactedCount ?? 0} />
              <StatCard label="Dead-on-arrival" value={formatRate(stateDetails.statistics.doaRate)} hint="Stalled after introduction" />
            </div>
            <Separator />
            <SectionHeader title="What else is moving" description="Lifecycle rates for this jurisdiction." />
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="Cross-chamber" value={formatRate(stateDetails.statistics.pingPongRate)} />
              <StatCard label="Multi-sponsor" value={formatRate(stateDetails.statistics.multiSponsorRate)} />
              <StatCard label="Bill velocity" value={formatDays(stateDetails.statistics.averageBillVelocityDays)} />
            </div>
          </div>
        );

      case "velocity":
        return (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="Days to passage" value={formatDays(stateDetails.statistics.averageBillVelocityDays)} hint="First action to enacted or passage date" />
              <StatCard label="Average bill age" value={`${stateDetails.statistics.averageBillAge}d`} />
              <StatCard label="Enactment rate" value={formatRate(stateDetails.statistics.enactmentRate)} />
            </div>
            {stateDetails.statistics.weeklyActivity && (
              <>
                <Separator />
                <SectionHeader title="8-week activity" description="Actions by week, oldest on the left." />
                <Sparkline counts={stateDetails.statistics.weeklyActivity} className="h-10" />
              </>
            )}
          </div>
        );

      case "pace":
        return (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <StatCard label="Weekly pace" value={`${stateDetails.statistics.legislativePace ?? 0}/wk`} hint="From 30-day actions" />
              <StatCard
                label="Session phase"
                value={stateDetails.sessionPhase?.current ?? "—"}
                hint={stateDetails.sessionPhase?.session ? `Session ${stateDetails.sessionPhase.session}` : undefined}
              />
              <StatCard label="30-day actions" value={stateDetails.statistics.recentActivity} />
            </div>
            <Separator />
            <SectionHeader title="Session introductions" description="Early / mid / late split of the dominant session." />
            <MixBar
              items={[
                { label: "Early", value: stateDetails.sessionPhase?.early || 0, className: "bg-emerald-500/80" },
                { label: "Mid", value: stateDetails.sessionPhase?.mid || 0, className: "bg-amber-500/80" },
                { label: "Late", value: stateDetails.sessionPhase?.late || 0, className: "bg-orange-600/80" },
              ]}
            />
          </div>
        );

      default:
        return null;
    }
  })();

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{modeLabel}</p>
          <h3 className="text-2xl font-bold tracking-tight">{state.name}</h3>
          <p className="text-sm text-foreground/70">
            Snapshot for {stateAbbr} based on the current map view.
          </p>
        </div>
        {activityLevel && (
          <Badge variant="outline" className="w-fit px-3 py-1 text-xs">
            {activityLevel}
          </Badge>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4 sm:col-span-1">
          <PrimaryIcon className={cn("mb-2 h-5 w-5", primaryStat.color)} />
          <p className="text-3xl font-bold tabular-nums">
            {primaryStat.value.toLocaleString()}
            {"suffix" in primaryStat && primaryStat.suffix ? primaryStat.suffix : ""}
          </p>
          <p className="mt-1 text-sm font-medium">{primaryStat.label}</p>
        </div>
        {secondaryStats.map((stat) => (
          <StatCard key={stat.label} label={stat.label} value={stat.value} />
        ))}
      </div>

      {detailSection}

      {(onViewDashboard || onViewLegislation) && (
        <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row">
          {onViewDashboard && (
            <Button variant="default" size="sm" onClick={onViewDashboard} className="sm:flex-1">
              View full {state.name} dashboard
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          )}
          {onViewLegislation && (
            <Button variant="outline" size="sm" onClick={onViewLegislation} className="sm:flex-1">
              Browse all legislation
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
