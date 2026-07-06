"use client";

import type { CSSProperties } from 'react';

type DashboardMapLegendDockProps = {
  mapMode: string;
  showPartyAffiliation: boolean;
  showGerrymandering: boolean;
  showTopicHeatmap: boolean;
  showRepHeatmap: boolean;
  partyColors: Record<string, string>;
  selectedTopic: string;
  setSelectedTopic: (topic: string) => void;
  availableTopics: string[];
  topicDataLoading: boolean;
  selectedRepMetric: string;
  setSelectedRepMetric: (metric: string) => void;
  availableRepMetrics: string[];
  repDataLoading: boolean;
  repHeatmapLegendLabels: number[];
  repHeatmapLegendStyle: CSSProperties;
  votingPowerLegendLabels: string[];
  votingPowerLegendStyle: CSSProperties;
  selectedChamber: 'house' | 'senate';
};

const METRIC_LABELS: Record<string, string> = {
  sponsored_bills: 'Bills Sponsored',
  recent_activity: 'Recent Activity',
  enacted_bills: 'Enacted Bills Sponsored',
  enacted_recent_activity: 'Enacted Bills - Recent Activity',
  voted_with_majority: 'Voted with Majority',
  voted_against_party: 'Voted Against Party',
};

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex shrink-0 items-center gap-1.5 text-xs">
      <div className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ backgroundColor: color }} />
      <span className="whitespace-nowrap">{label}</span>
    </div>
  );
}

export function DashboardMapLegendDock({
  mapMode,
  showPartyAffiliation,
  showGerrymandering,
  showTopicHeatmap,
  showRepHeatmap,
  partyColors,
  selectedTopic,
  setSelectedTopic,
  availableTopics,
  topicDataLoading,
  selectedRepMetric,
  setSelectedRepMetric,
  availableRepMetrics,
  repDataLoading,
  repHeatmapLegendLabels,
  repHeatmapLegendStyle,
  votingPowerLegendLabels,
  votingPowerLegendStyle,
  selectedChamber,
}: DashboardMapLegendDockProps) {
  const isDistrictMode = ['congressional-districts', 'state-upper-districts', 'state-lower-districts'].includes(mapMode);
  const isPercentMetric = selectedRepMetric === 'voted_with_majority' || selectedRepMetric === 'voted_against_party';

  const districtModeLabels: Record<string, string> = {
    'congressional-districts': 'U.S. congressional districts',
    'state-upper-districts': 'State upper chamber districts',
    'state-lower-districts': 'State lower chamber districts',
  };

  let title = 'Activity';
  let content: React.ReactNode = (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <LegendItem color="hsl(var(--primary))" label="High" />
      <LegendItem color="hsl(var(--primary) / 0.5)" label="Medium" />
      <LegendItem color="hsl(var(--primary) / 0.2)" label="Low" />
    </div>
  );

  if (isDistrictMode && !showPartyAffiliation && !showGerrymandering && !showTopicHeatmap && !showRepHeatmap) {
    title = 'Districts';
    content = (
      <p className="text-xs text-muted-foreground">
        {districtModeLabels[mapMode] ?? 'District boundaries'}. Tap or click a district for legislators.
      </p>
    );
  } else if (isDistrictMode && showPartyAffiliation) {
    title = 'Party';
    content = (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        {Object.entries(partyColors).map(([party, color]) => (
          <LegendItem key={party} color={color} label={party} />
        ))}
      </div>
    );
  } else if (isDistrictMode && showGerrymandering) {
    title = 'Compactness';
    content = (
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <LegendItem color="#3b82f6" label="Very compact" />
        <LegendItem color="#60e8fa" label="Compact" />
        <LegendItem color="#f5ce0b" label="Less compact" />
        <LegendItem color="#d93706" label="Irregular" />
      </div>
    );
  } else if (isDistrictMode && showTopicHeatmap) {
    title = 'Topic activity';
    content = (
      <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <LegendItem color="rgb(25, 25, 112)" label="High" />
          <LegendItem color="rgb(99, 120, 171)" label="Medium" />
          <LegendItem color="rgb(173, 216, 230)" label="Low" />
          <LegendItem color="#f8f9fa" label="None" />
        </div>
        {availableTopics.length > 0 && (
          <label className="flex min-w-0 flex-1 items-center gap-2 text-xs sm:max-w-xs">
            <span className="shrink-0 text-muted-foreground">Topic</span>
            <select
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
              className="min-w-0 flex-1 rounded border bg-background px-2 py-1 text-xs"
              disabled={topicDataLoading}
            >
              <option value="all">All topics</option>
              {availableTopics.map((topic) => (
                <option key={topic} value={topic}>{topic}</option>
              ))}
            </select>
          </label>
        )}
      </div>
    );
  } else if (isDistrictMode && showRepHeatmap) {
    title = METRIC_LABELS[selectedRepMetric] ?? 'Representative metric';
    content = (
      <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <div className="min-w-0 flex-1 sm:max-w-md">
          <div className="h-3 w-full rounded-sm" style={repHeatmapLegendStyle} />
          <div className="mt-1 flex justify-between gap-1 text-[10px] sm:text-xs">
            {repHeatmapLegendLabels.map((label) => (
              <span key={label} className="shrink-0">
                {label}{isPercentMetric ? '%' : ''}
              </span>
            ))}
          </div>
        </div>
        <label className="flex min-w-0 items-center gap-2 text-xs sm:max-w-xs">
          <span className="shrink-0 text-muted-foreground">Metric</span>
          <select
            value={selectedRepMetric}
            onChange={(e) => setSelectedRepMetric(e.target.value)}
            className="min-w-0 flex-1 rounded border bg-background px-2 py-1 text-xs"
            disabled={repDataLoading}
          >
            {availableRepMetrics.map((metric) => (
              <option key={metric} value={metric}>{METRIC_LABELS[metric] ?? metric}</option>
            ))}
          </select>
        </label>
      </div>
    );
  } else if (mapMode === 'voting-power') {
    title = `Voting power (${selectedChamber === 'house' ? 'House' : 'Senate'})`;
    content = (
      <div className="min-w-0 flex-1 sm:max-w-lg">
        <div className="h-3 w-full rounded-sm" style={votingPowerLegendStyle} />
        <div className="mt-1 flex justify-between gap-1 text-[10px] sm:text-xs">
          {votingPowerLegendLabels.map((label, index) => (
            <span key={index} className="shrink-0">{label}</span>
          ))}
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground sm:text-xs">Relative to Maryland (1.0×). Darker = higher per-capita influence.</p>
      </div>
    );
  }

  return (
    <div className="shrink-0 border-t bg-background/95 px-3 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-4">
      <div className="mx-auto flex w-full max-w-full min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
        <span className="shrink-0 text-xs font-medium text-foreground sm:pt-0.5">{title}</span>
        <div className="min-w-0 flex-1">{content}</div>
      </div>
    </div>
  );
}
