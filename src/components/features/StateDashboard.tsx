
"use client";

import { StateDetailData } from "@/types/jurisdictions";
import { AnimatedSection } from "@/components/ui/AnimatedSection";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, MapPin, TrendingUp, Users, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useRouter } from "next/navigation";

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
        return null; // Or some other placeholder for no data
    }

    return (
        <AnimatedSection>
            <div className="space-y-4 md:space-y-6">
                <AnimatedSection>
                    <Card className="shadow-lg">
                        <CardContent className="p-3 md:p-4">
                            <div className="flex flex-col space-y-3 md:space-y-0 md:flex-row md:items-center md:justify-between">
                                <div className="flex flex-col space-y-2">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <Button variant="ghost" size="sm" onClick={clearStateFilter} className="flex items-center gap-2">
                                            <ArrowLeft className="h-4 w-4" />
                                            <span className="hidden sm:inline">{isCongressDashboard ? "Back to All Jurisdictions" : "Back to All States"}</span>
                                            <span className="sm:hidden">Back</span>
                                        </Button>
                                        <Button variant="outline" size="sm" onClick={clearStateFilter} className="md:hidden flex items-center gap-2">
                                            <X className="h-4 w-4" />
                                            <span className="hidden sm:inline">Clear Filter</span>
                                            <span className="sm:hidden">Clear</span>
                                        </Button>
                                    </div>
                                    <div className="flex flex-col space-y-1 md:space-y-0 md:flex-row md:items-center md:gap-2">
                                        {isCongressDashboard ? (
                                            <>
                                                <Badge variant="default" className="bg-blue-600 self-start">
                                                    <span className="hidden sm:inline">U.S. Congress Dashboard</span>
                                                    <span className="sm:hidden">U.S. Congress</span>
                                                </Badge>
                                                <span className="text-xs md:text-sm text-muted-foreground">
                                                    <span className="hidden sm:inline">Showing federal legislation only</span>
                                                    <span className="sm:hidden">Federal data only</span>
                                                </span>
                                            </>
                                        ) : (
                                            <>
                                                <Badge variant="default" className="bg-primary self-start">
                                                    <span className="hidden sm:inline">State Dashboard: {stateParam || stateAbbrParam}</span>
                                                    <span className="sm:hidden">{stateParam || stateAbbrParam}</span>
                                                </Badge>
                                                <span className="text-xs md:text-sm text-muted-foreground">
                                                    <span className="hidden sm:inline">Showing data for {stateParam || stateAbbrParam} only</span>
                                                    <span className="sm:hidden">State data only</span>
                                                </span>
                                            </>
                                        )}
                                    </div>
                                </div>
                                <Button variant="outline" size="sm" onClick={clearStateFilter} className="hidden md:flex items-center gap-2">
                                    <X className="h-4 w-4" />
                                    Clear Filter
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </AnimatedSection>

                <AnimatedSection>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
                        <Card>
                            <CardContent className="p-3 md:p-4">
                                <div className="flex items-center space-x-2">
                                    <FileText className="h-4 w-4 md:h-5 md:w-5 text-blue-500 flex-shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-xs md:text-sm font-medium truncate"><span className="hidden sm:inline">Total Legislation</span><span className="sm:hidden">Total Bills</span></p>
                                        <p className="text-lg md:text-2xl font-bold">{stateData.statistics.totalLegislation.toLocaleString()}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-3 md:p-4">
                                <div className="flex items-center space-x-2">
                                    <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-green-500 flex-shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-xs md:text-sm font-medium truncate"><span className="hidden sm:inline">Recent Activity</span><span className="sm:hidden">Recent</span></p>
                                        <p className="text-lg md:text-2xl font-bold">{stateData.statistics.recentActivity.toLocaleString()}</p>
                                        <p className="text-xs text-muted-foreground"><span className="hidden sm:inline">Last 30 days</span><span className="sm:hidden">30d</span></p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-3 md:p-4">
                                <div className="flex items-center space-x-2">
                                    <Users className="h-4 w-4 md:h-5 md:w-5 text-orange-500 flex-shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-xs md:text-sm font-medium truncate"><span className="hidden sm:inline">Active Sponsors</span><span className="sm:hidden">Sponsors</span></p>
                                        <p className="text-lg md:text-2xl font-bold">{stateData.statistics.activeSponsors.toLocaleString()}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                        <Card>
                            <CardContent className="p-3 md:p-4">
                                <div className="flex items-center space-x-2">
                                    <MapPin className="h-4 w-4 md:h-5 md:w-5 text-purple-500 flex-shrink-0" />
                                    <div className="min-w-0">
                                        <p className="text-xs md:text-sm font-medium truncate"><span className="hidden sm:inline">Avg. Bill Age</span><span className="sm:hidden">Avg. Age</span></p>
                                        <p className="text-lg md:text-2xl font-bold">{stateData.statistics.averageBillAge}</p>
                                        <p className="text-xs text-muted-foreground">days</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </AnimatedSection>

                <AnimatedSection>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
                        <Card className="shadow-lg">
                            <CardHeader className="pb-3 md:pb-6">
                                <CardTitle className="font-headline flex items-center gap-2 text-lg md:text-xl"><FileText className="h-4 w-4 md:h-5 md:w-5" /><span className="hidden sm:inline">Recent Legislation</span><span className="sm:hidden">Recent Bills</span></CardTitle>
                                <CardDescription className="text-xs md:text-sm"><span className="hidden sm:inline">Latest legislative activity {isCongressDashboard ? "in U.S. Congress" : `in ${stateParam || stateAbbrParam}`}</span><span className="sm:hidden">Latest activity</span></CardDescription>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <div className="space-y-3 md:space-y-4">
                                    {stateData.recentLegislation.slice(0, 5).map((bill) => (
                                        <AnimatedSection key={bill.id}>
                                            <div className="border-l-4 border-primary/20 pl-3 md:pl-4 py-2">
                                                <div className="font-medium text-sm md:text-base line-clamp-2">{bill.identifier} - {bill.title}</div>
                                                <div className="text-xs text-muted-foreground mt-1 line-clamp-2"><span className="font-medium">Last Action:</span> {bill.lastAction}</div>
                                                <div className="text-xs text-muted-foreground line-clamp-1"><span className="font-medium">Sponsor:</span> {bill.primarySponsor}</div>
                                                <div className="flex flex-wrap gap-1 mt-2">
                                                    {bill.subjects.slice(0, 2).map((subject, index) => (<Badge key={index} variant="secondary" className="text-xs">{subject}</Badge>))}
                                                    {bill.subjects.length > 2 && (<Badge variant="outline" className="text-xs">+{bill.subjects.length - 2}</Badge>)}
                                                </div>
                                            </div>
                                        </AnimatedSection>
                                    ))}
                                </div>
                                <div className="mt-4 pt-4 border-t">
                                    <Button variant="outline" size="sm" onClick={() => { if (isCongressDashboard) { router.push("/legislation?congress=true"); } else { const stateName = stateData?.state || stateParam || stateAbbrParam || ""; const stateAbbr = stateAbbrParam || ""; router.push(`/legislation?state=${encodeURIComponent(stateName)}&stateAbbr=${stateAbbr}`); } }} className="w-full">
                                        <span className="hidden sm:inline">View All Legislation</span><span className="sm:hidden">View All Bills</span>
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                        <Card className="shadow-lg">
                            <CardHeader className="pb-3 md:pb-6">
                                <CardTitle className="font-headline flex items-center gap-2 text-lg md:text-xl"><TrendingUp className="h-4 w-4 md:h-5 md:w-5" />Trending Topics</CardTitle>
                                <CardDescription className="text-xs md:text-sm"><span className="hidden sm:inline">Most active policy areas {isCongressDashboard ? "in U.S. Congress" : `in ${stateParam || stateAbbrParam}`}</span><span className="sm:hidden">Active policy areas</span></CardDescription>
                            </CardHeader>
                            <CardContent className="pt-0">
                                <div className="space-y-2 md:space-y-3">
                                    {stateData.trendingTopics.slice(0, 8).map((topic, index) => (
                                        <AnimatedSection key={topic.name}>
                                            <div className="flex items-center justify-between gap-2">
                                                <div className="flex items-center gap-2 min-w-0 flex-1"><span className="text-xs md:text-sm font-medium flex-shrink-0">#{index + 1}</span><span className="text-xs md:text-sm truncate">{topic.name}</span></div>
                                                <div className="flex items-center gap-1 md:gap-2 flex-shrink-0"><Badge variant="secondary" className="text-xs"><span className="hidden sm:inline">{topic.recentCount} recent</span><span className="sm:hidden">{topic.recentCount}</span></Badge><span className="text-xs text-muted-foreground hidden sm:inline">{topic.totalCount} total</span></div>
                                            </div>
                                        </AnimatedSection>
                                    ))}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </AnimatedSection>

                <AnimatedSection>
                    <Card className="shadow-lg">
                        <CardHeader className="pb-3 md:pb-6">
                            <CardTitle className="font-headline flex items-center gap-2 text-lg md:text-xl"><Users className="h-4 w-4 md:h-5 md:w-5" />Most Active Sponsors</CardTitle>
                            <CardDescription className="text-xs md:text-sm"><span className="hidden sm:inline">{isCongressDashboard ? "Members of Congress with the most recent activity" : `Legislators with the most recent activity in ${stateParam || stateAbbrParam}`}</span><span className="sm:hidden">Most active legislators</span></CardDescription>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                                {stateData.topSponsors.slice(0, 6).map((sponsor) => (
                                    <AnimatedSection key={sponsor.name}>
                                        <div className="p-3 border rounded-lg">
                                            <div className="font-medium text-sm line-clamp-1">{sponsor.name}</div>
                                            <div className="text-xs text-muted-foreground mt-1"><span className="hidden sm:inline">{sponsor.recentBills} recent bills • {sponsor.totalBills} total bills</span><span className="sm:hidden">{sponsor.recentBills} recent • {sponsor.totalBills} total</span></div>
                                            <Badge variant={sponsor.activity === "active" ? "default" : "secondary"} className="text-xs mt-2">{sponsor.activity}</Badge>
                                        </div>
                                    </AnimatedSection>
                                ))}
                            </div>
                            <div className="mt-4 pt-4 border-t">
                                <Button variant="outline" size="sm" onClick={() => { if (isCongressDashboard) { router.push("/representatives?congress=true"); } else { router.push(`/representatives?state=${encodeURIComponent(stateParam || stateAbbrParam || "")}&stateAbbr=${stateAbbrParam || ""}`); } }} className="w-full">
                                    <span className="hidden sm:inline">View All Representatives</span><span className="sm:hidden">View Representatives</span>
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </AnimatedSection>
            </div>
        </AnimatedSection>
    );
}
