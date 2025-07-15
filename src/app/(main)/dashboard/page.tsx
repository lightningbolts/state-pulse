"use client";

import { InteractiveMap } from "@/components/features/InteractiveMap";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
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

export default function DashboardPage() {
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
      <div className="space-y-6">
        {/* State Filter Indicator */}
        <Card className="shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearStateFilter}
                  className="flex items-center gap-2"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back to All States
                </Button>
                <div className="flex items-center gap-2">
                  <Badge variant="default" className="bg-primary">
                    State Dashboard: {stateParam || stateAbbrParam}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    Showing data for {stateParam || stateAbbrParam} only
                  </span>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={clearStateFilter}
              >
                <X className="h-4 w-4 mr-1" />
                Clear Filter
              </Button>
            </div>
          </CardContent>
        </Card>

        {loading && (
          <Card className="shadow-lg">
            <CardContent className="p-8 text-center">
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                <span>Loading state dashboard...</span>
              </div>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="shadow-lg">
            <CardContent className="p-8 text-center">
              <div className="flex items-center justify-center space-x-2 text-red-600">
                <span>{error}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {stateData && !loading && (
          <>
            {/* State Statistics Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <FileText className="h-5 w-5 text-blue-500" />
                    <div>
                      <p className="text-sm font-medium">Total Legislation</p>
                      <p className="text-2xl font-bold">
                        {stateData.statistics.totalLegislation.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5 text-green-500" />
                    <div>
                      <p className="text-sm font-medium">Recent Activity</p>
                      <p className="text-2xl font-bold">
                        {stateData.statistics.recentActivity.toLocaleString()}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Last 30 days
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <Users className="h-5 w-5 text-orange-500" />
                    <div>
                      <p className="text-sm font-medium">Active Sponsors</p>
                      <p className="text-2xl font-bold">
                        {stateData.statistics.activeSponsors.toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-5 w-5 text-purple-500" />
                    <div>
                      <p className="text-sm font-medium">Avg. Bill Age</p>
                      <p className="text-2xl font-bold">
                        {stateData.statistics.averageBillAge}
                      </p>
                      <p className="text-xs text-muted-foreground">days</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Legislation and Trending Topics */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Recent Legislation */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Recent Legislation
                  </CardTitle>
                  <CardDescription>
                    Latest legislative activity in{" "}
                    {stateParam || stateAbbrParam}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {stateData.recentLegislation.slice(0, 5).map((bill) => (
                      <div
                        key={bill.id}
                        className="border-l-4 border-primary/20 pl-4 py-2"
                      >
                        <div className="font-medium text-sm">
                          {bill.identifier} - {bill.title}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                          <span className="font-medium">Last Action:</span>{" "}
                          {bill.lastAction}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          <span className="font-medium">Sponsor:</span>{" "}
                          {bill.primarySponsor}
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                          {bill.subjects.slice(0, 3).map((subject, index) => (
                            <Badge
                              key={index}
                              variant="secondary"
                              className="text-xs"
                            >
                              {subject}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-4 pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        router.push(
                          `/legislation?state=${encodeURIComponent(
                            stateParam || stateAbbrParam || ""
                          )}&stateAbbr=${stateAbbrParam || ""}`
                        )
                      }
                      className="w-full"
                    >
                      View All Legislation
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Trending Topics */}
              <Card className="shadow-lg">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Trending Topics
                  </CardTitle>
                  <CardDescription>
                    Most active policy areas in{" "}
                    {stateParam || stateAbbrParam}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {stateData.trendingTopics.slice(0, 8).map((topic, index) => (
                      <div
                        key={topic.name}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">#{index + 1}</span>
                          <span className="text-sm">{topic.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary" className="text-xs">
                            {topic.recentCount} recent
                          </Badge>
                          <span className="text-xs text-muted-foreground">
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
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Most Active Sponsors
                </CardTitle>
                <CardDescription>
                  Legislators with the most recent activity in{" "}
                  {stateParam || stateAbbrParam}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {stateData.topSponsors.slice(0, 6).map((sponsor) => (
                    <div key={sponsor.name} className="p-3 border rounded-lg">
                      <div className="font-medium text-sm">{sponsor.name}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {sponsor.recentBills} recent bills •{" "}
                        {sponsor.totalBills} total bills
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
                    View All Representatives
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
