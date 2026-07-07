"use client";

import { Badge } from "@/components/ui/badge";
import { Calendar, FileText, TrendingUp, Users } from "lucide-react";
import type { StateData } from "@/types/jurisdictions";
import { cn } from "@/lib/utils";

const MODE_LABELS: Record<string, string> = {
  legislation: "Legislation",
  representatives: "Representatives",
  trends: "Topics",
  recent: "Recent",
};

type StateMapTooltipProps = {
  mapMode: string;
  state: StateData;
  activityLevel?: string;
};

export function StateMapTooltip({ mapMode, state, activityLevel }: StateMapTooltipProps) {
  const modeLabel = MODE_LABELS[mapMode] ?? "Overview";

  const primary = (() => {
    switch (mapMode) {
      case "legislation":
        return { label: "Bills", value: state.legislationCount, icon: FileText, color: "text-blue-500" };
      case "representatives":
        return { label: "Legislators", value: state.activeRepresentatives, icon: Users, color: "text-green-500" };
      case "trends":
        return { label: "Topics", value: state.topicDiversity, icon: TrendingUp, color: "text-orange-500" };
      case "recent":
        return { label: "30-day actions", value: state.recentActivity, icon: Calendar, color: "text-amber-500" };
      default:
        return { label: "Bills", value: state.legislationCount, icon: FileText, color: "text-blue-500" };
    }
  })();

  const Icon = primary.icon;

  return (
    <div className="space-y-1 py-0.5">
      <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{modeLabel}</p>
      <p className="text-sm font-semibold leading-tight">{state.name}</p>
      <div className="flex items-center gap-1.5">
        <Icon className={cn("h-3.5 w-3.5 shrink-0", primary.color)} />
        <span className="text-base font-bold tabular-nums leading-none">{primary.value.toLocaleString()}</span>
        <span className="text-[10px] text-muted-foreground">{primary.label}</span>
      </div>
      {activityLevel && (
        <Badge variant="outline" className="mt-0.5 px-1.5 py-0 text-[9px] font-normal">
          {activityLevel}
        </Badge>
      )}
    </div>
  );
}
