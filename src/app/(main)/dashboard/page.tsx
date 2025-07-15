"use client";

import { InteractiveMap } from "@/components/features/InteractiveMap";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  MapPin,
  Users,
  FileText,
  TrendingUp,
  X,
  ArrowLeft,
} from "lucide-react";
import { useRouter } from "next/navigation";

interface StateDetailData {
  state: string;
  statistics: {
    totalLegislation: number;
    recentActivity: number;
    activeSponsors: number;
    averageBillAge: number;
  };
  recentLegislation: Array<{
    id: string;
    identifier: string;
    title: string;
    lastAction: string;
    lastActionDate: string;
    subjects: string[];
    primarySponsor: string;
    chamber: string;
  }>;
  trendingTopics: Array<{
    name: string;
    totalCount: number;
    recentCount: number;
    trend: string;
  }>;
  topSponsors: Array<{
    name: string;
    totalBills: number;
    recentBills: number;
    activity: string;
  }>;
}

function DashboardContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [stateData, setStateData] = useState<StateDetailData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const stateParam = searchParams.get("state");
  const stateAbbrParam = searchParams.get("stateAbbr");

  useEffect(() => {
    if (stateAbbrParam) {
      fetchStateData(stateAbbrParam);
    }
  }, [stateAbbrParam]);

  const fetchStateData = async (stateAbbr: string) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/dashboard/state/${stateAbbr}`);
      if (!response.ok) {
        throw new Error("Failed to fetch state data");
      }
      const result = await response.json();
      if (result.success) {
        setStateData(result.data);
      } else {
        throw new Error(result.error || "Unknown error");
      }
    } catch (error) {
      console.error("Error fetching state data:", error);
      setError("Failed to load state data. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const clearStateFilter = () => {
    router.push("/dashboard");
  };

  // If state parameters are present, show state-specific dashboard
  if (stateParam || stateAbbrParam) {
    return (
      <div className="space-y-4 md:space-y-6">
        {/* State Filter Indicator */}
        <Card className="shadow-lg">
          <CardContent className="p-3 md:p-4">
            <div className="flex flex-col space-y-3 md:space-y-0 md:flex-row md:items-center md:justify-between">
              {/* Left side content */}
              <div className="flex flex-col space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearStateFilter}
                    className="flex items-center gap-2"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    <span className="hidden sm:inline">Back to All States</span>
                    <span className="sm:hidden">Back</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={clearStateFilter}
                    className="md:hidden"
                  >
                    <X className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Clear Filter</span>
                    <span className="sm:hidden">Clear</span>
                  </Button>
                </div>
                <div className="flex flex-col space-y-1 md:space-y-0 md:flex-row md:items-center md:gap-2">
                  <Badge variant="default" className="bg-primary self-start">
                    <span className="hidden sm:inline">
                      State Dashboard: {stateParam || stateAbbrParam}
                    </span>
                    <span className="sm:hidden">{stateParam || stateAbbrParam}</span>
                  </Badge>
                  <span className="text-xs md:text-sm text-muted-foreground">
                    <span className="hidden sm:inline">
                      Showing data for {stateParam || stateAbbrParam} only
                    </span>
                    <span className="sm:hidden">State data only</span>
                  </span>
                </div>
              </div>

              {/* Right side button - hidden on mobile, shown on desktop */}
              <Button
                variant="outline"
                size="sm"
                onClick={clearStateFilter}
                className="hidden md:block"
              >
                <X className="h-4 w-4 mr-1" />
                Clear Filter
              </Button>
            </div>
          </CardContent>
        </Card>

        {loading && (
          <Card className="shadow-lg">
            <CardContent className="p-6 md:p-8 text-center">
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-5 w-5 md:h-6 md:w-6 border-b-2 border-primary"></div>
                <span className="text-sm md:text-base">
                  Loading state dashboard...
                </span>
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="shadow-lg">
            <CardContent className="p-6 md:p-8 text-center">
              <div className="flex items-center justify-center space-x-2 text-red-600">
                <span className="text-sm md:text-base">{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {stateData && !loading && (
          <>
            {/* State Statistics Overview */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
              <Card>
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-4 w-4 md:h-5 md:w-5 text-blue-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs md:text-sm font-medium truncate">
                        <span className="hidden sm:inline">
                          Total Legislation
                        </span>
                        <span className="sm:hidden">Total Bills</span>
                      </p>
                      <p className="text-lg md:text-2xl font-bold">
                        {stateData.statistics.totalLegislation.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-green-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs md:text-sm font-medium truncate">
                        <span className="hidden sm:inline">Recent Activity</span>
                        <span className="sm:hidden">Recent</span>
                      </p>
                      <p className="text-lg md:text-2xl font-bold">
                        {stateData.statistics.recentActivity.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <span className="hidden sm:inline">Last 30 days</span>
                        <span className="sm:hidden">30d</span>
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-center space-x-2">
                    <Users className="h-4 w-4 md:h-5 md:w-5 text-orange-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs md:text-sm font-medium truncate">
                        <span className="hidden sm:inline">Active Sponsors</span>
                        <span className="sm:hidden">Sponsors</span>
                      </p>
                      <p className="text-lg md:text-2xl font-bold">
                        {stateData.statistics.activeSponsors.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-3 md:p-4">
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 md:h-5 md:w-5 text-purple-500 flex-shrink-0" />
                    <div className="min-w-0">
                      <p className="text-xs md:text-sm font-medium truncate">
                        <span className="hidden sm:inline">Avg. Bill Age</span>
                        <span className="sm:hidden">Avg. Age</span>
                      </p>
                      <p className="text-lg md:text-2xl font-bold">
                        {stateData.statistics.averageBillAge}
                      </p>
                      <p className="text-xs text-muted-foreground">days</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Legislation and Trending Topics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
              {/* Recent Legislation */}
              <Card className="shadow-lg">
                <CardHeader className="pb-3 md:pb-6">
                  <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                    <FileText className="h-4 w-4 md:h-5 md:w-5" />
                    <span className="hidden sm:inline">Recent Legislation</span>
                    <span className="sm:hidden">Recent Bills</span>
                  </CardTitle>
                  <CardDescription className="text-xs md:text-sm">
                    <span className="hidden sm:inline">
                      Latest legislative activity in{" "}
                      {stateParam || stateAbbrParam}
                    </span>
                    <span className="sm:hidden">Latest activity</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-3 md:space-y-4">
                    {stateData.recentLegislation.slice(0, 5).map((bill) => (
                      <div
                        key={bill.id}
                        className="border-l-4 border-primary/20 pl-3 md:pl-4 py-2"
                      >
                        <div className="font-medium text-sm md:text-base line-clamp-2">
                          {bill.identifier} - {bill.title}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          <span className="font-medium">Last Action:</span>{" "}
                          {bill.lastAction}
                        </div>
                        <div className="text-xs text-muted-foreground line-clamp-1">
                          <span className="font-medium">Sponsor:</span>{" "}
                          {bill.primarySponsor}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {bill.subjects.slice(0, 2).map((subject, index) => (
                            <Badge
                              key={index}
                              variant="secondary"
                              className="text-xs"
                            >
                              {subject}
                            </Badge>
                          ))}
                          {bill.subjects.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{bill.subjects.length - 2}
                            </Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Use the actual state data instead of URL parameters
                        const stateName =
                          stateData?.state ||
                          stateParam ||
                          stateAbbrParam ||
                          "";
                        const stateAbbr = stateAbbrParam || "";

                        console.log("Dashboard: Navigating to legislation with:", {
                          stateName,
                          stateAbbr,
                        });

                        router.push(
                          `/legislation?state=${encodeURIComponent(
                            stateName
                          )}&stateAbbr=${stateAbbr}`
                        );
                      }}
                      className="w-full"
                    >
                      <span className="hidden sm:inline">View All Legislation</span>
                      <span className="sm:hidden">View All Bills</span>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Trending Topics */}
              <Card className="shadow-lg">
                <CardHeader className="pb-3 md:pb-6">
                  <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                    <TrendingUp className="h-4 w-4 md:h-5 md:w-5" />
                    Trending Topics
                  </CardTitle>
                  <CardDescription className="text-xs md:text-sm">
                    <span className="hidden sm:inline">
                      Most active policy areas in{" "}
                      {stateParam || stateAbbrParam}
                    </span>
                    <span className="sm:hidden">Active policy areas</span>
                  </CardDescription>
                </CardHeader>
                <CardContent className="pt-0">
                  <div className="space-y-2 md:space-y-3">
                    {stateData.trendingTopics.slice(0, 8).map((topic, index) => (
                      <div
                        key={topic.name}
                        className="flex items-center justify-between gap-2"
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="text-xs md:text-sm font-medium flex-shrink-0">
                            #{index + 1}
                          </span>
                          <span className="text-xs md:text-sm truncate">
                            {topic.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                          <Badge variant="secondary" className="text-xs">
                            <span className="hidden sm:inline">
                              {topic.recentCount} recent
                            </span>
                            <span className="sm:hidden">{topic.recentCount}</span>
                          </Badge>
                          <span className="text-xs text-muted-foreground hidden sm:inline">
                            {topic.totalCount} total
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Top Sponsors */}
            <Card className="shadow-lg">
              <CardHeader className="pb-3 md:pb-6">
                <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
                  <Users className="h-4 w-4 md:h-5 md:w-5" />
                  <span className="hidden sm:inline">Most Active Sponsors</span>
                  <span className="sm:hidden">Active Sponsors</span>
                </CardTitle>
                <CardDescription className="text-xs md:text-sm">
                  <span className="hidden sm:inline">
                    Legislators with the most recent activity in{" "}
                    {stateParam || stateAbbrParam}
                  </span>
                  <span className="sm:hidden">Most active legislators</span>
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
                  {stateData.topSponsors.slice(0, 6).map((sponsor) => (
                    <div key={sponsor.name} className="p-3 border rounded-lg">
                      <div className="font-medium text-sm line-clamp-1">
                        {sponsor.name}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        <span className="hidden sm:inline">
                          {sponsor.recentBills} recent bills •{" "}
                          {sponsor.totalBills} total bills
                        </span>
                        <span className="sm:hidden">
                          {sponsor.recentBills} recent • {sponsor.totalBills} total
                        </span>
                      </div>
                      <Badge
                        variant={
                          sponsor.activity === "active"
                            ? "default"
                            : "secondary"
                        }
                        className="text-xs mt-2"
                      >
                        {sponsor.activity}
                      </Badge>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      router.push(
                        `/civic?state=${encodeURIComponent(
                          stateParam || stateAbbrParam || ""
                        )}&stateAbbr=${stateAbbrParam || ""}`
                      )
                    }
                    className="w-full"
                  >
                    <span className="hidden sm:inline">
                      View All Representatives
                    </span>
                    <span className="sm:hidden">View Representatives</span>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    );
  }

  // Default dashboard view - show the interactive map
  return <InteractiveMap />;
}

export default function DashboardPage() {
  return (
    <Suspense fallback={<div>Loading dashboard...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
