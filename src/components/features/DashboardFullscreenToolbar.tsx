"use client";

import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Minimize } from 'lucide-react';
import { MapMode } from '@/types/geo';

type DashboardFullscreenToolbarProps = {
  mapMode: string;
  mapModes: MapMode[];
  mapModeTransitioning: boolean;
  handleMapModeChange: (mode: string) => void;
  selectedChamber: 'house' | 'senate';
  setSelectedChamber: (chamber: 'house' | 'senate') => void;
  votingPowerLoading: boolean;
  showPartyAffiliation: boolean;
  setShowPartyAffiliation: (checked: boolean) => void;
  showGerrymandering: boolean;
  setShowGerrymandering: (checked: boolean) => void;
  showTopicHeatmap: boolean;
  setShowTopicHeatmap: (checked: boolean) => void;
  showRepHeatmap: boolean;
  setShowRepHeatmap: (checked: boolean) => void;
  showDistrictBorders: boolean;
  setShowDistrictBorders: (checked: boolean) => void;
  partyDataLoading: boolean;
  gerryDataLoading: boolean;
  topicDataLoading: boolean;
  repDataLoading: boolean;
  onExit: () => void;
};

export function DashboardFullscreenToolbar({
  mapMode,
  mapModes,
  mapModeTransitioning,
  handleMapModeChange,
  selectedChamber,
  setSelectedChamber,
  votingPowerLoading,
  showPartyAffiliation,
  setShowPartyAffiliation,
  showGerrymandering,
  setShowGerrymandering,
  showTopicHeatmap,
  setShowTopicHeatmap,
  showRepHeatmap,
  setShowRepHeatmap,
  showDistrictBorders,
  setShowDistrictBorders,
  partyDataLoading,
  gerryDataLoading,
  topicDataLoading,
  repDataLoading,
  onExit,
}: DashboardFullscreenToolbarProps) {
  const isDistrictMode = ['congressional-districts', 'state-upper-districts', 'state-lower-districts'].includes(mapMode);

  return (
    <div className="shrink-0 border-b bg-background/95 backdrop-blur px-3 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:px-4">
      <div className="flex w-full min-w-0 flex-col gap-2">
        <div className="flex w-full min-w-0 items-center gap-2">
          <label className="flex min-w-0 flex-1 items-center gap-2 text-xs sm:text-sm">
            <span className="shrink-0 text-muted-foreground">Mode</span>
            <select
              value={mapMode}
              onChange={(e) => handleMapModeChange(e.target.value)}
              className="min-w-0 flex-1 rounded border bg-background px-2 py-1.5 text-xs sm:max-w-xs sm:text-sm"
              disabled={mapModeTransitioning}
            >
              {mapModes.map((mode) => (
                <option key={mode.id} value={mode.id}>{mode.label}</option>
              ))}
            </select>
          </label>

          {mapMode === 'voting-power' && (
            <label className="flex shrink-0 items-center gap-2 text-xs sm:text-sm">
              <span className="text-muted-foreground">Chamber</span>
              <select
                value={selectedChamber}
                onChange={(e) => setSelectedChamber(e.target.value as 'house' | 'senate')}
                className="rounded border bg-background px-2 py-1.5 text-xs sm:text-sm"
                disabled={votingPowerLoading}
              >
                <option value="house">House</option>
                <option value="senate">Senate</option>
              </select>
            </label>
          )}

          <Button variant="outline" size="sm" onClick={onExit} className="ml-auto shrink-0 gap-1" title="Exit full screen (Esc)">
            <Minimize className="h-4 w-4" />
            <span className="hidden sm:inline">Exit</span>
          </Button>
        </div>

        {isDistrictMode && (
          <div className="grid w-full min-w-0 grid-cols-2 gap-x-3 gap-y-2 sm:grid-cols-3 md:grid-cols-5">
            <label className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">Party</span>
              <Switch checked={showPartyAffiliation} onCheckedChange={(checked) => { setShowPartyAffiliation(checked); if (checked) { setShowGerrymandering(false); setShowTopicHeatmap(false); setShowRepHeatmap(false); } }} disabled={partyDataLoading} />
            </label>
            <label className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">Gerry</span>
              <Switch checked={showGerrymandering} onCheckedChange={(checked) => { setShowGerrymandering(checked); if (checked) { setShowPartyAffiliation(false); setShowTopicHeatmap(false); setShowRepHeatmap(false); } }} disabled={gerryDataLoading} />
            </label>
            <label className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">Topic</span>
              <Switch checked={showTopicHeatmap} onCheckedChange={(checked) => { setShowTopicHeatmap(checked); if (checked) { setShowPartyAffiliation(false); setShowGerrymandering(false); setShowRepHeatmap(false); } }} disabled={topicDataLoading} />
            </label>
            <label className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">Rep</span>
              <Switch checked={showRepHeatmap} onCheckedChange={(checked) => { setShowRepHeatmap(checked); if (checked) { setShowPartyAffiliation(false); setShowGerrymandering(false); setShowTopicHeatmap(false); } }} disabled={repDataLoading} />
            </label>
            <label className="flex items-center justify-between gap-2 text-xs">
              <span className="text-muted-foreground">Borders</span>
              <Switch checked={showDistrictBorders} onCheckedChange={setShowDistrictBorders} />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
