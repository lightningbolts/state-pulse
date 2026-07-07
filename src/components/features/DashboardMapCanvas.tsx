"use client";

import * as React from 'react';
import { createPortal } from 'react-dom';
import MapLibreMap, { Marker as MapLibreMarker, Popup as MapLibrePopup } from 'react-map-gl/maplibre';
import { DistrictMapGL } from './DistrictMapGL';
import { StateMapGL } from './StateMapGL';
import { RepresentativesResults } from './RepresentativesResults';
import { DashboardMapLegendDock } from './DashboardMapLegendDock';
import type { StateData, StateDetailData } from '@/types/jurisdictions';
import { StateMapTooltip } from './StateMapTooltip';

const DEFAULT_POSITION: [number, number] = [39.8283, -98.5795];
const DEFAULT_ZOOM = 4;

const DISTRICT_PIN_ICON = `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' fill='none' stroke='#eb7725ff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='lucide lucide-map-pin' viewBox='0 0 24 24' style='display:block;'><path d='M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0Z'/><circle cx='12' cy='10' r='3'/></svg>`;

export type DashboardMapCanvasProps = {
  mapMode: string;
  isFullScreen: boolean;
  isMobile: boolean;
  resolvedTheme?: string;
  mapRef: React.RefObject<any>;
  stateStats: Record<string, StateData>;
  memoizedMarkers: Record<string, { color: string; size: number }>;
  mapDataProgress: number;
  districtLoading: boolean;
  mapModeTransitioning: boolean;
  memoryPressure: boolean;
  districtError: string | null;
  getDistrictGeoJsonUrl: (mapMode: string, isMobile: boolean) => string;
  districtColors: Record<string, string>;
  onDistrictClickGL: (feature: any, lngLat: { lng: number; lat: number }) => void;
  showPartyAffiliation: boolean;
  districtPartyMapping: Record<string, string>;
  partyColors: Record<string, string>;
  showGerrymandering: boolean;
  gerryScores: Record<string, number>;
  getGerrymanderingColor: (score: number) => string;
  showTopicHeatmap: boolean;
  topicScores: Record<string, number>;
  getTopicHeatmapColor: (score: number) => string;
  showRepHeatmap: boolean;
  repScores: Record<string, number>;
  repDetails: Record<string, any>;
  getRepHeatmapColor: (score: number) => string;
  showDistrictBorders: boolean;
  districtPopupLatLng: { lng: number; lat: number } | null;
  setDistrictPopupLatLng: (lngLat: { lng: number; lat: number } | null) => void;
  selectedDistrict: any;
  setSelectedDistrict: (district: any) => void;
  districtReps: any[];
  forceGarbageCollection: () => void;
  votingPowerData: Record<string, any>;
  selectedChamber: 'house' | 'senate';
  handleStateClick: (stateAbbr: string, coords?: [number, number]) => void;
  selectedState: string | null;
  setSelectedState: (state: string | null) => void;
  selectedStatePopupCoords: [number, number] | null;
  setSelectedStatePopupCoords: (coords: [number, number] | null) => void;
  detailsLoading: boolean;
  stateDetails: StateDetailData | null;
  getActivityLevel: (stateAbbr: string) => string;
  availableTopics: string[];
  selectedTopic: string;
  setSelectedTopic: (topic: string) => void;
  topicDataLoading: boolean;
  availableRepMetrics: string[];
  selectedRepMetric: string;
  setSelectedRepMetric: (metric: string) => void;
  repDataLoading: boolean;
  repHeatmapLegendLabels: number[];
  repHeatmapLegendStyle: React.CSSProperties;
  votingPowerLegendLabels: string[];
  votingPowerLegendStyle: React.CSSProperties;
  fullscreenToolbar?: React.ReactNode;
};

function MapSurface({
  mapMode,
  isFullScreen,
  isMobile,
  resolvedTheme,
  mapRef,
  stateStats,
  memoizedMarkers,
  mapDataProgress,
  districtLoading,
  mapModeTransitioning,
  memoryPressure,
  districtError,
  getDistrictGeoJsonUrl,
  districtColors,
  onDistrictClickGL,
  showPartyAffiliation,
  districtPartyMapping,
  partyColors,
  showGerrymandering,
  gerryScores,
  getGerrymanderingColor,
  showTopicHeatmap,
  topicScores,
  getTopicHeatmapColor,
  showRepHeatmap,
  repScores,
  repDetails,
  getRepHeatmapColor,
  showDistrictBorders,
  districtPopupLatLng,
  setDistrictPopupLatLng,
  selectedDistrict,
  setSelectedDistrict,
  districtReps,
  forceGarbageCollection,
  votingPowerData,
  selectedChamber,
  handleStateClick,
  selectedState,
  setSelectedState,
  selectedStatePopupCoords,
  setSelectedStatePopupCoords,
  detailsLoading,
  stateDetails,
  getActivityLevel,
}: Omit<DashboardMapCanvasProps, 'fullscreenToolbar' | 'availableTopics' | 'selectedTopic' | 'setSelectedTopic' | 'topicDataLoading' | 'availableRepMetrics' | 'selectedRepMetric' | 'setSelectedRepMetric' | 'repDataLoading' | 'repHeatmapLegendLabels' | 'repHeatmapLegendStyle' | 'votingPowerLegendLabels' | 'votingPowerLegendStyle'>) {
  const mapStyle =
    resolvedTheme === 'dark'
      ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
      : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

  const isDistrictMode = ['congressional-districts', 'state-upper-districts', 'state-lower-districts'].includes(mapMode);

  return (
    <div className="relative h-full w-full min-w-0 overflow-hidden statepulse-map-export-target">
      {isDistrictMode && isMobile && isFullScreen && (
        <div className="absolute left-3 right-3 top-3 z-10 rounded-md border border-amber-200 bg-amber-50 p-2 text-xs text-amber-800 sm:left-4 sm:right-4 sm:top-4">
          Districts load progressively on mobile.{memoryPressure ? ' Memory optimization active.' : ''}
        </div>
      )}

      <div className={isFullScreen ? 'h-full w-full' : 'h-[300px] w-full rounded-md border sm:h-[400px] md:h-[500px]'}>
        {isDistrictMode ? (
          <DistrictMapGL
            geojsonUrl={getDistrictGeoJsonUrl(mapMode, isMobile)}
            color={districtColors[mapMode]}
            onDistrictClick={onDistrictClickGL}
            mapStyle={mapStyle}
            showPartyAffiliation={showPartyAffiliation}
            districtPartyMapping={districtPartyMapping}
            partyColors={partyColors}
            showGerrymandering={showGerrymandering}
            gerryScores={gerryScores}
            getGerrymanderingColor={getGerrymanderingColor}
            showTopicHeatmap={showTopicHeatmap}
            topicScores={topicScores}
            getTopicHeatmapColor={getTopicHeatmapColor}
            showRepHeatmap={showRepHeatmap}
            repScores={repScores}
            repDetails={repDetails}
            getRepHeatmapColor={getRepHeatmapColor}
            showDistrictBorders={showDistrictBorders}
            popupMarker={
              districtPopupLatLng
                ? {
                    lng: districtPopupLatLng.lng,
                    lat: districtPopupLatLng.lat,
                    iconHtml: DISTRICT_PIN_ICON,
                    draggable: !isMobile,
                    onDragEnd: !isMobile
                      ? (lngLat) => {
                          setDistrictPopupLatLng(lngLat);
                          if (selectedDistrict) onDistrictClickGL(selectedDistrict, lngLat);
                        }
                      : undefined,
                  }
                : undefined
            }
          />
        ) : mapMode === 'voting-power' ? (
          <StateMapGL
            votingPowerData={votingPowerData}
            chamber={selectedChamber}
            onStateClick={(stateAbbr) => {
              const state = stateStats[stateAbbr];
              if (state?.center) {
                const coords: [number, number] = Array.isArray(state.center)
                  ? [state.center[0], state.center[1]]
                  : [state.center.lat, state.center.lng];
                handleStateClick(stateAbbr, coords);
              }
            }}
            mapStyle={mapStyle}
          />
        ) : (
          <MapLibreMap
            ref={mapRef}
            initialViewState={{ longitude: DEFAULT_POSITION[1], latitude: DEFAULT_POSITION[0], zoom: DEFAULT_ZOOM }}
            style={{ height: '100%', width: '100%' }}
            mapStyle={mapStyle}
          >
            {Object.entries(stateStats)
              .filter(([, state]) =>
                mapDataProgress >= 100 ||
                state.legislationCount > 0 ||
                state.recentActivity > 0 ||
                state.activeRepresentatives > 0 ||
                state.topicDiversity > 0,
              )
              .map(([abbr, state]) => {
              const { color, size } = memoizedMarkers[abbr] || { color: '#e0e0e0', size: 20 };
              const coords: [number, number] = [(state.center as [number, number])[0], (state.center as [number, number])[1]];
              return (
                <MapLibreMarker key={abbr} longitude={coords[1]} latitude={coords[0]} anchor="center" onClick={() => handleStateClick(abbr, coords)}>
                  <div
                    className="transition-transform duration-150 ease-in-out hover:scale-110"
                    style={{
                      width: size,
                      height: size,
                      backgroundColor: color,
                      border: '2px solid #fff',
                      borderRadius: '50%',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                    }}
                  />
                </MapLibreMarker>
              );
            })}
            {selectedState && selectedStatePopupCoords && (
              <MapLibrePopup
                longitude={selectedStatePopupCoords[1]}
                latitude={selectedStatePopupCoords[0]}
                anchor="bottom"
                onClose={() => {
                  setSelectedState(null);
                  setSelectedStatePopupCoords(null);
                }}
                closeOnClick={false}
                maxWidth="160px"
              >
                <StateMapTooltip
                  mapMode={mapMode}
                  state={stateStats[selectedState]}
                  activityLevel={getActivityLevel(selectedState)}
                />
              </MapLibrePopup>
            )}
          </MapLibreMap>
        )}
      </div>

      {mapDataProgress < 100 && mapDataProgress > 0 && (
        <div className="absolute left-0 right-0 top-0 z-20 h-1 bg-border">
          <div className="h-full bg-primary transition-all duration-300" style={{ width: `${mapDataProgress}%` }} />
        </div>
      )}

      {mapDataProgress < 100 && mapDataProgress === 0 && (
        <div className="absolute left-0 right-0 top-0 z-20 h-1 bg-border">
          <div className="h-full w-[8%] animate-pulse bg-primary" />
        </div>
      )}

      {(districtLoading || mapModeTransitioning) && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/80">
          <div className="flex items-center gap-3">
            <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-primary" />
            <span className="text-sm sm:text-base">{mapModeTransitioning ? 'Switching map mode...' : 'Loading districts...'}</span>
          </div>
        </div>
      )}

      {districtError && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/80">
          <span className="text-xs text-red-500">{districtError}</span>
        </div>
      )}

      {isFullScreen && selectedDistrict && (
        <div className="absolute right-3 top-14 z-20 flex max-h-[min(70vh,32rem)] w-[min(calc(100%-1.5rem),24rem)] min-w-0 flex-col overflow-hidden rounded-lg border border-border bg-card text-foreground shadow-lg sm:right-4 sm:w-96">
          <div className="flex shrink-0 items-center justify-between border-b border-border bg-card px-3 py-2.5">
            <h3 className="text-base font-semibold">District Info</h3>
            <button
              type="button"
              className="text-lg leading-none text-muted-foreground hover:text-foreground"
              onClick={() => {
                setSelectedDistrict(null);
                setDistrictPopupLatLng(null);
                if (isMobile) setTimeout(forceGarbageCollection, 100);
              }}
              aria-label="Close"
            >
              ×
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-card p-3">
            <RepresentativesResults
              representatives={districtReps}
              closestReps={[]}
              loading={districtLoading}
              error={districtError}
              showMap={false}
              userLocation={null}
              dataSource={null}
              pagination={undefined}
              onPageChange={() => {}}
              districtType={selectedDistrict.properties.chamber || selectedDistrict.properties.CHAMBER || ''}
              compact
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function DashboardMapCanvas(props: DashboardMapCanvasProps) {
  const { isFullScreen, fullscreenToolbar } = props;
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const embeddedView = (
    <div className="relative w-full min-w-0">
      <MapSurface {...props} />
    </div>
  );

  const fullscreenView = (
    <div className="fixed inset-0 z-[200] flex h-[100dvh] max-w-[100vw] flex-col overflow-hidden bg-background">
      {fullscreenToolbar}
      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden">
        <MapSurface {...props} />
      </div>
      <DashboardMapLegendDock
        mapMode={props.mapMode}
        showPartyAffiliation={props.showPartyAffiliation}
        showGerrymandering={props.showGerrymandering}
        showTopicHeatmap={props.showTopicHeatmap}
        showRepHeatmap={props.showRepHeatmap}
        partyColors={props.partyColors}
        selectedTopic={props.selectedTopic}
        setSelectedTopic={props.setSelectedTopic}
        availableTopics={props.availableTopics}
        topicDataLoading={props.topicDataLoading}
        selectedRepMetric={props.selectedRepMetric}
        setSelectedRepMetric={props.setSelectedRepMetric}
        availableRepMetrics={props.availableRepMetrics}
        repDataLoading={props.repDataLoading}
        repHeatmapLegendLabels={props.repHeatmapLegendLabels}
        repHeatmapLegendStyle={props.repHeatmapLegendStyle}
        votingPowerLegendLabels={props.votingPowerLegendLabels}
        votingPowerLegendStyle={props.votingPowerLegendStyle}
        selectedChamber={props.selectedChamber}
      />
    </div>
  );

  if (!isFullScreen) return embeddedView;
  if (!mounted) return fullscreenView;

  return createPortal(fullscreenView, document.body);
}
