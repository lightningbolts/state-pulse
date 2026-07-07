"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export function formatDashboardDate(value: string | Date | undefined): string {
  if (!value) return "—";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function StatCard({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border bg-card p-3 shadow-sm", className)}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-foreground/70">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums">{typeof value === "number" ? value.toLocaleString() : value}</p>
      {hint && <p className="mt-0.5 text-xs text-foreground/65">{hint}</p>}
    </div>
  );
}

export function SectionHeader({ title, description }: { title: string; description?: string }) {
  return (
    <div className="space-y-0.5">
      <h4 className="text-sm font-semibold">{title}</h4>
      {description && <p className="text-xs text-foreground/70">{description}</p>}
    </div>
  );
}

export function LoadingBlock({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-dashed bg-muted/20 px-4 py-6">
      <div className="h-4 w-4 animate-spin rounded-full border-b-2 border-primary" />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}

export function BillRow({
  identifier,
  title,
  meta,
  action,
  subjects,
  compact,
  sponsor,
}: {
  identifier: string;
  title: string;
  meta?: string;
  action?: string;
  subjects?: string[];
  compact?: boolean;
  sponsor?: string;
}) {
  return (
    <div className="rounded-md border bg-card px-3 py-2.5">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-xs font-semibold text-primary">{identifier}</span>
        {meta && <span className="text-xs text-foreground/70">{meta}</span>}
      </div>
      {!compact && <p className="mt-1 text-sm leading-snug text-foreground">{title}</p>}
      {sponsor && <p className="mt-1 text-xs text-foreground/70">Sponsor: {sponsor}</p>}
      {action && <p className="mt-1 text-xs text-foreground/70 line-clamp-2">{action}</p>}
      {subjects && subjects.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {subjects.slice(0, compact ? 2 : 6).map((subject) => (
            <Badge key={subject} variant="secondary" className="text-[10px] font-normal">
              {subject}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}

export function TopicBar({
  name,
  recent,
  total,
  maxRecent,
  rank,
}: {
  name: string;
  recent: number;
  total: number;
  maxRecent: number;
  rank?: number;
}) {
  const width = maxRecent > 0 ? Math.max(8, Math.round((recent / maxRecent) * 100)) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className="truncate font-medium">
          {rank != null && <span className="mr-1.5 text-foreground/60">#{rank}</span>}
          {name}
        </span>
        <span className="shrink-0 tabular-nums text-foreground/70">
          {recent} recent · {total} total
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary/80 transition-all" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export function SponsorRow({
  rank,
  name,
  totalBills,
  recentBills,
  activity,
}: {
  rank: number;
  name: string;
  totalBills: number;
  recentBills: number;
  activity: string;
}) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5">
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground/80">
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{name}</p>
        <p className="text-xs text-foreground/70">
          {totalBills} bills sponsored · {recentBills} with recent action
        </p>
      </div>
      <Badge variant={activity === "active" ? "default" : "secondary"} className="shrink-0 text-[10px]">
        {activity === "active" ? "Active" : "Quiet"}
      </Badge>
    </div>
  );
}
