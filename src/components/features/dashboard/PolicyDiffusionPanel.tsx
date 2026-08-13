"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Share2 } from "lucide-react";
import type { PolicyDiffusionTopic } from "@/types/jurisdictions";
import { LoadingBlock, SectionHeader } from "./DashboardDetailParts";

export function PolicyDiffusionPanel({
  topics,
  loading,
}: {
  topics: PolicyDiffusionTopic[];
  loading: boolean;
}) {
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <Share2 className="h-5 w-5" />
          Spreading policies
        </CardTitle>
        <CardDescription className="text-foreground/70">
          Topics that showed up in at least three states over the last 30 days.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {loading && topics.length === 0 ? (
          <LoadingBlock label="Loading spreading policies…" />
        ) : topics.length === 0 ? (
          <p className="text-sm text-muted-foreground">No cross-state topic movement in the last 30 days.</p>
        ) : (
          <div className="space-y-4">
            {topics.map((topic) => (
              <div key={topic.name} className="rounded-lg border bg-card p-3">
                <SectionHeader
                  title={topic.name}
                  description={`${topic.stateCount} states · ${topic.billCount.toLocaleString()} recent bills`}
                />
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {topic.states.map((abbr) => (
                    <Badge key={abbr} variant="outline" className="text-[10px] font-normal">
                      {abbr}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
