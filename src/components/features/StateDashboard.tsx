
"use client";

import { StateDetailData } from "@/types/jurisdictions";
import { AnimatedSection } from "@/components/ui/AnimatedSection";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, MapPin, TrendingUp, Users, X, ChevronRight } from "lucide-react";
import { formatSignedPercent } from "@/lib/dashboardMetrics";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useRouter } from "next/navigation";
import {
  BillRow,
  formatDashboardDate,
  formatDays,
  formatRate,
  MixBar,
  SectionHeader,
  Sparkline,
  SponsorRow,
  StatCard,
  TopicBar,
} from "./dashboard/DashboardDetailParts";

interface StateDashboardProps {
    stateData: StateDetailData | null;
    loading: boolean;
    error: string | null;
    isCongressDashboard: boolean;
    stateParam: string | null;
    stateAbbrParam: string | null;
    clearStateFilter: () => void;
}

export function StateDashboard({ stateData, loading, error, isCongressDashboard, stateParam, stateAbbrParam, clearStateFilter }: StateDashboardProps) {
    const router = useRouter();
    const jurisdictionLabel = isCongressDashboard ? "U.S. Congress" : (stateParam || stateAbbrParam || "State");

    if (loading) {
        return (
            <AnimatedSection>
                <Card className="shadow-lg">
                    <CardContent className="p-6 md:p-8 text-center">
                        <div className="flex items-center justify-center space-x-2">
                            <div className="animate-spin rounded-full h-5 w-5 md:h-6 md:w-6 border-b-2 border-primary"></div>
                            <span className="text-sm md:text-base">
                                {isCongressDashboard ? "Loading U.S. Congress dashboard..." : "Loading state dashboard..."}
                            </span>
                        </div>
                    </CardContent>
                </Card>
            </AnimatedSection>
        );
    }

    if (error) {
        return (
            <AnimatedSection>
                <Card className="shadow-lg">
                    <CardContent className="p-6 md:p-8 text-center">
                        <div className="flex items-center justify-center space-x-2 text-red-600">
                            <span className="text-sm md:text-base">{error}</span>
                        </div>
                    </CardContent>
                </Card>
            </AnimatedSection>
        );
    }

    if (!stateData) {
        return null;
    }

    const maxTopicRecent = Math.max(...stateData.trendingTopics.map((t) => t.recentCount), 1);
    const recentShare = stateData.statistics.totalLegislation > 0
        ? Math.round((stateData.statistics.recentActivity / stateData.statistics.totalLegislation) * 100)
        : 0;
    const activeSponsorShare = stateData.statistics.totalLegislation > 0
        ? Math.round((stateData.statistics.activeSponsors / stateData.statistics.totalLegislation) * 100)
        : 0;

    const legislationUrl = isCongressDashboard
        ? "/legislation?congress=true"
        : `/legislation?state=${encodeURIComponent(stateData.state || stateParam || stateAbbrParam || "")}&stateAbbr=${stateAbbrParam || ""}`;

    const representativesUrl = isCongressDashboard
        ? "/representatives?congress=true"
        : `/representatives?state=${encodeURIComponent(stateParam || stateAbbrParam || "")}&stateAbbr=${stateAbbrParam || ""}`;

    return (
        <AnimatedSection>
            <div className="space-y-6 md:space-y-8">
                <Card className="shadow-lg">
                    <CardContent className="p-4 md:p-6">
                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                            <div className="space-y-3">
                                <div className="flex flex-wrap items-center gap-2">
                                    <Button variant="ghost" size="sm" onClick={clearStateFilter} className="gap-2">
                                        <ArrowLeft className="h-4 w-4" />
                                        Back to map
                                    </Button>
                                    <Button variant="outline" size="sm" onClick={clearStateFilter} className="md:hidden gap-2">
                                        <X className="h-4 w-4" />
                                        Close
                                    </Button>
                                </div>
                                <div>
                                    <p className="text-xs font-medium uppercase tracking-wide text-foreground/70">
                                        Full jurisdiction dashboard
                                    </p>
                                    <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{jurisdictionLabel}</h1>
                                    <p className="mt-1 text-sm text-foreground/70">
                                        Combined legislative activity, policy trends, sponsors, and recent bill movement.
                                    </p>
                                </div>
                            </div>
                            <Badge variant="default" className="w-fit self-start">
                                {isCongressDashboard ? "Federal" : "State"} overview
                            </Badge>
                        </div>
                    </CardContent>
                </Card>

                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <StatCard label="Total legislation" value={stateData.statistics.totalLegislation} hint="All tracked bills" />
                    <StatCard label="Recent activity" value={stateData.statistics.recentActivity} hint="Actions in last 30 days" />
                    <StatCard label="Active sponsors" value={stateData.statistics.activeSponsors} hint="Legislators with bills" />
                    <StatCard label="Average bill age" value={`${stateData.statistics.averageBillAge} days`} hint="Since record creation" />
                    <StatCard
                        label="Enactment rate"
                        value={formatRate(stateData.statistics.enactmentRate)}
                        hint={stateData.statistics.enactedCount
                            ? `${stateData.statistics.enactedCount.toLocaleString()} bills with an enacted date`
                            : "Share of bills with an enacted date"}
                    />
                    <StatCard
                        label="Bill velocity"
                        value={formatDays(stateData.statistics.averageBillVelocityDays)}
                        hint="Average days from first action to passage"
                    />
                    <StatCard
                        label="Bipartisan rate"
                        value={formatRate(stateData.statistics.bipartisanRate)}
                        hint={stateData.statistics.bipartisanScoredBills
                            ? `Of ${stateData.statistics.bipartisanScoredBills.toLocaleString()} multi-sponsor bills with known party`
                            : "Share of multi-sponsor bills with both parties"}
                    />
                    <StatCard label="Recent share" value={`${recentShare}%`} hint="Of all bills had action in 30d" />
                    <StatCard
                        label="Legislative pace"
                        value={`${stateData.statistics.legislativePace ?? 0}/wk`}
                        hint="Recent actions converted to a weekly rate"
                    />
                    <StatCard
                        label="Sponsor concentration"
                        value={formatRate(stateData.statistics.sponsorConcentration)}
                        hint="Share of sponsorships from the top 10% of sponsors"
                    />
                    <StatCard
                        label="Multi-sponsor rate"
                        value={formatRate(stateData.statistics.multiSponsorRate)}
                        hint="Bills with two or more sponsors"
                    />
                    <StatCard
                        label="Dead-on-arrival"
                        value={formatRate(stateData.statistics.doaRate)}
                        hint="Introduced 30+ days ago with no further action"
                    />
                    <StatCard
                        label="Cross-chamber"
                        value={formatRate(stateData.statistics.pingPongRate)}
                        hint="Bills with history in both chambers"
                    />
                </div>

                <div className="grid gap-4 lg:grid-cols-3">
                    <Card className="shadow-sm lg:col-span-2">
                        <CardHeader>
                            <CardTitle className="text-base">Activity snapshot</CardTitle>
                            <CardDescription className="text-foreground/70">How active this jurisdiction is right now.</CardDescription>
                        </CardHeader>
                        <CardContent className="grid gap-3 sm:grid-cols-3">
                            <StatCard
                                label="Primary vs cosponsor"
                                value={formatRate(stateData.statistics.primaryShare)}
                                hint={`${(stateData.statistics.primaryMentions || 0).toLocaleString()} primary · ${(stateData.statistics.cosponsorMentions || 0).toLocaleString()} cosponsor`}
                            />
                            <StatCard
                                label="Session phase"
                                value={stateData.sessionPhase?.current ? stateData.sessionPhase.current : "—"}
                                hint={stateData.sessionPhase?.session ? `Session ${stateData.sessionPhase.session}` : "Dominant session window"}
                            />
                            <StatCard label="Policy topics" value={stateData.trendingTopics.length} hint="Distinct subject areas tracked" />
                        </CardContent>
                    </Card>
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle className="text-base">Quick links</CardTitle>
                        </CardHeader>
                        <CardContent className="flex flex-col gap-2">
                            <Button variant="default" size="sm" onClick={() => router.push(legislationUrl)}>
                                Browse all legislation
                                <ChevronRight className="ml-1 h-4 w-4" />
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => router.push(representativesUrl)}>
                                View representatives
                            </Button>
                        </CardContent>
                    </Card>
                </div>

                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                    <Card className="shadow-lg">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <FileText className="h-5 w-5" />
                                Recent legislation
                            </CardTitle>
                            <CardDescription className="text-foreground/70">
                                All recent bill movement in {jurisdictionLabel} ({stateData.recentLegislation.length} bills).
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            {stateData.recentLegislation.map((bill) => (
                                <BillRow
                                    key={bill.id}
                                    identifier={bill.identifier}
                                    title={bill.title}
                                    meta={`${formatDashboardDate(bill.lastActionDate)}${bill.chamber ? ` · ${bill.chamber}` : ""}`}
                                    sponsor={bill.primarySponsor}
                                    action={bill.lastAction}
                                    subjects={bill.subjects}
                                />
                            ))}
                            {stateData.recentLegislation.length === 0 && (
                                <p className="text-sm text-muted-foreground">No recent legislative activity in the last 30 days.</p>
                            )}
                        </CardContent>
                    </Card>

                    <Card className="shadow-lg">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-lg">
                                <TrendingUp className="h-5 w-5" />
                                Trending policy areas
                            </CardTitle>
                            <CardDescription className="text-foreground/70">
                                Subject areas ranked by recent volume, compared with the prior 30 days.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            {stateData.trendingTopics.map((topic, index) => (
                                <TopicBar
                                    key={topic.name}
                                    rank={index + 1}
                                    name={topic.name}
                                    recent={topic.recentCount}
                                    total={topic.totalCount}
                                    maxRecent={maxTopicRecent}
                                    prior={topic.priorCount}
                                    weeklyCounts={topic.weeklyCounts}
                                    pctChange={topic.pctChange}
                                    trend={topic.trend}
                                />
                            ))}
                            {stateData.trendingTopics.length === 0 && (
                                <p className="text-sm text-muted-foreground">No topic data available.</p>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Users className="h-5 w-5" />
                            Legislator activity leaderboard
                        </CardTitle>
                        <CardDescription className="text-foreground/70">
                            {isCongressDashboard
                                ? "Members of Congress ranked by sponsorship activity."
                                : `State legislators ranked by sponsorship activity in ${jurisdictionLabel}.`}
                            {activeSponsorShare > 0 && (
                                <span className="mt-1 block text-xs text-foreground/65">
                                    {stateData.statistics.activeSponsors} sponsors across {stateData.statistics.totalLegislation.toLocaleString()} total bills.
                                </span>
                            )}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="divide-y rounded-lg border">
                            {stateData.topSponsors.map((sponsor, index) => (
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
                        {stateData.topSponsors.length === 0 && (
                            <p className="text-sm text-muted-foreground">No sponsor activity recorded.</p>
                        )}
                    </CardContent>
                </Card>

                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <MapPin className="h-5 w-5" />
                            Cross-cutting insights
                        </CardTitle>
                        <CardDescription className="text-foreground/70">Patterns across bills, topics, and sponsors.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid gap-3 md:grid-cols-2">
                            <div className="rounded-lg border bg-card p-4">
                                <SectionHeader
                                    title="Hottest topics this month"
                                    description="Policy areas with recent bill actions."
                                />
                                <div className="mt-3 flex flex-wrap gap-2">
                                    {stateData.trendingTopics
                                        .filter((t) => t.recentCount > 0)
                                        .slice(0, 8)
                                        .map((topic) => (
                                            <Badge key={topic.name} variant="secondary">
                                                {topic.name}
                                                <span className="ml-1.5 opacity-80">
                                                    ({topic.recentCount}{topic.pctChange != null ? `, ${formatSignedPercent(topic.pctChange)}` : ''})
                                                </span>
                                            </Badge>
                                        ))}
                                </div>
                            </div>
                            <div className="rounded-lg border bg-card p-4">
                                <SectionHeader
                                    title="8-week activity"
                                    description="Bill actions by week, oldest on the left."
                                />
                                <div className="mt-3">
                                    {stateData.statistics.weeklyActivity && stateData.statistics.weeklyActivity.some((n) => n > 0) ? (
                                        <Sparkline counts={stateData.statistics.weeklyActivity} className="h-10" />
                                    ) : (
                                        <p className="text-sm text-muted-foreground">No weekly movement in the last 8 weeks.</p>
                                    )}
                                </div>
                            </div>
                            <div className="rounded-lg border bg-card p-4">
                                <SectionHeader
                                    title="Chamber mix"
                                    description="Where bills originate across the full tracked set."
                                />
                                <div className="mt-3">
                                    <MixBar
                                        items={[
                                            { label: "Upper", value: stateData.chamberMix?.upper || 0, className: "bg-violet-500/80" },
                                            { label: "Lower", value: stateData.chamberMix?.lower || 0, className: "bg-sky-500/80" },
                                            { label: "Unicameral", value: stateData.chamberMix?.unicameral || 0, className: "bg-emerald-500/80" },
                                            { label: "Other", value: stateData.chamberMix?.other || 0, className: "bg-muted-foreground/40" },
                                        ]}
                                    />
                                </div>
                            </div>
                            <div className="rounded-lg border bg-card p-4">
                                <SectionHeader
                                    title="Classification mix"
                                    description="Bills vs resolutions vs memorials."
                                />
                                <div className="mt-3">
                                    <MixBar
                                        items={[
                                            { label: "Bills", value: stateData.classificationMix?.bills || 0, className: "bg-primary/80" },
                                            { label: "Resolutions", value: stateData.classificationMix?.resolutions || 0, className: "bg-amber-500/80" },
                                            { label: "Memorials", value: stateData.classificationMix?.memorials || 0, className: "bg-rose-500/70" },
                                            { label: "Other", value: stateData.classificationMix?.other || 0, className: "bg-muted-foreground/40" },
                                        ]}
                                    />
                                </div>
                            </div>
                            <div className="rounded-lg border bg-card p-4 md:col-span-2">
                                <SectionHeader
                                    title="Session calendar phase"
                                    description={stateData.sessionPhase?.session
                                        ? `Introductions in session ${stateData.sessionPhase.session}, split into early / mid / late.`
                                        : "Introductions across the dominant session window."}
                                />
                                <div className="mt-3">
                                    <MixBar
                                        items={[
                                            { label: "Early", value: stateData.sessionPhase?.early || 0, className: "bg-emerald-500/80" },
                                            { label: "Mid", value: stateData.sessionPhase?.mid || 0, className: "bg-amber-500/80" },
                                            { label: "Late", value: stateData.sessionPhase?.late || 0, className: "bg-orange-600/80" },
                                        ]}
                                    />
                                </div>
                            </div>
                        </div>
                        <Separator />
                        <div className="flex flex-col gap-2 sm:flex-row">
                            <Button onClick={() => router.push(legislationUrl)} className="sm:flex-1">
                                Explore all {jurisdictionLabel} legislation
                            </Button>
                            <Button variant="outline" onClick={() => router.push(representativesUrl)} className="sm:flex-1">
                                Find representatives
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </AnimatedSection>
    );
}
