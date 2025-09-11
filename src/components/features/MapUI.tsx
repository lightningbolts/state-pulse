"use client";

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Calendar, FileText, MapPin, Maximize, Minimize, TrendingUp, Users } from 'lucide-react';
import { AnimatedSection } from "@/components/ui/AnimatedSection";
import { DistrictMapGL } from './DistrictMapGL';
import { RepresentativesResults } from "./RepresentativesResults";
import { ChamberMakeup } from "./ChamberMakeup";
import MapLibreMap, { Marker as MapLibreMarker, Popup as MapLibrePopup } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useInteractiveMap } from '@/hooks/useInteractiveMap';
import { MapMode } from '@/types/geo';

const mapModes: MapMode[] = [
    { id: 'legislation', label: 'Legislation Activity', description: 'View states by legislative activity and bill counts', icon: FileText },
    { id: 'representatives', label: 'Representatives', description: 'Explore representative density and activity', icon: Users },
    { id: 'trends', label: 'Trending Topics', description: 'See what policy areas are most active', icon: TrendingUp },
    { id: 'recent', label: 'Recent Activity', description: 'Latest legislative developments', icon: Calendar },
    { id: 'congressional-districts', label: 'Congressional Districts', description: 'View all U.S. congressional districts', icon: MapPin },
    { id: 'state-upper-districts', label: 'State Upper Districts', description: 'View all state senate (upper chamber) districts', icon: MapPin },
    { id: 'state-lower-districts', label: 'State Lower Districts', description: 'View all state house (lower chamber) districts', icon: MapPin }
];

const getDistrictGeoJsonUrl = (mapMode: string, isMobile: boolean): string => {
    if (mapMode === 'state-lower-districts') {
        return isMobile ? '/districts/state-lower-districts-simplified.topojson' : '/districts/state-lower-districts.topojson';
    }
    const DISTRICT_GEOJSON_URLS: Record<string, string> = {
        'congressional-districts': '/districts/congressional-districts.topojson',
        'state-upper-districts': '/districts/state-upper-districts.topojson',
    };
    return DISTRICT_GEOJSON_URLS[mapMode] || '';
};

const DISTRICT_COLORS: Record<string, string> = {
    'congressional-districts': '#2563eb',
    'state-upper-districts': '#a21caf',
    'state-lower-districts': '#16a34a',
};

const PARTY_COLORS: Record<string, string> = {
    'Democratic': '#2563eb',
    'Republican': '#dc2626',
    'Independent': '#22c55e',
    'Nonpartisan': '#8b5cf6',
    'Unknown': '#6b7280'
};

const getGerrymanderingColor = (score: number): string => {
    const invertedScore = 1 - score;
    if (invertedScore >= 0.7) return '#d93706';
    if (invertedScore >= 0.55) return '#f5ce0b';
    if (invertedScore >= 0.4) return '#8cfb24';
    if (invertedScore >= 0.25) return '#60e8fa';
    return '#3b82f6';
};

const getTopicHeatmapColor = (score: number): string => {
    if (score === 0) return '#f8f9fa';
    const normalizedScore = Math.max(0, Math.min(1, score));
    const lightBlue = { r: 173, g: 216, b: 230 };
    const darkBlue = { r: 25, g: 25, b: 112 };
    const r = Math.round(lightBlue.r + (darkBlue.r - lightBlue.r) * normalizedScore);
    const g = Math.round(lightBlue.g + (darkBlue.g - lightBlue.g) * normalizedScore);
    const b = Math.round(lightBlue.b + (darkBlue.b - lightBlue.b) * normalizedScore);
    return `rgb(${r}, ${g}, ${b})`;
};

const DEFAULT_POSITION: [number, number] = [39.8283, -98.5795];
const DEFAULT_ZOOM = 4;

export const MapUI = ({ exportButton }: { exportButton: React.ReactNode }) => {
    const {
        resolvedTheme,
        isClient,
        selectedState,
        setSelectedState,
        selectedStatePopupCoords,
        setSelectedStatePopupCoords,
        mapMode,
        stateStats,
        stateDetails,
        loading,
        detailsLoading,
        error,
        router,
        districtGeoJson,
        districtLoading,
        districtError,
        selectedDistrict,
        setSelectedDistrict,
        districtReps,
        districtPopupLatLng,
        setDistrictPopupLatLng,
        mapRef,
        showPartyAffiliation,
        setShowPartyAffiliation,
        districtPartyMapping,
        partyDataLoading,
        partyDataError,
        showGerrymandering,
        setShowGerrymandering,
        gerryScores,
        gerryDataLoading,
        gerryDataError,
        showTopicHeatmap,
        setShowTopicHeatmap,
        topicScores,
        availableTopics,
        selectedTopic,
        setSelectedTopic,
        topicDataLoading,
        topicDataError,
        showRepHeatmap,
        setShowRepHeatmap,
        repScores,
        repDetails,
        selectedRepMetric,
        setSelectedRepMetric,
        repDataLoading,
        repDataError,
        availableRepMetrics,
        showEnactedOnly,
        setShowEnactedOnly,
        showDistrictBorders,
        setShowDistrictBorders,
        isMobile,
        mapModeTransitioning,
        memoryPressure,
        isFullScreen,
        setIsFullScreen,
        handleMapModeChange,
        handleStateClick,
        onDistrictClickGL,
        forceGarbageCollection
    } = useInteractiveMap();

    const maxRepScore = React.useMemo(() => {
        if (selectedRepMetric === 'voted_with_majority' || selectedRepMetric === 'voted_against_party') {
            return 100;
        }
        if (!repScores || Object.keys(repScores).length === 0) {
            return 1;
        }
        const max = Math.max(...Object.values(repScores));
        return max > 0 ? max : 1;
    }, [repScores, selectedRepMetric]);

    const repHeatmapLegendLabels = React.useMemo(() => {
        if (selectedRepMetric === 'voted_with_majority' || selectedRepMetric === 'voted_against_party') {
            return [0, 25, 50, 75, 100];
        }
        const rawLabels = [
            0,
            Math.round(maxRepScore * 0.0625),
            Math.round(maxRepScore * 0.25),
            Math.round(maxRepScore * 0.5625),
            maxRepScore
        ];
        const uniqueLabels = [...new Set(rawLabels)];
        return uniqueLabels.sort((a, b) => a - b);
    }, [maxRepScore, selectedRepMetric]);

    const getRepHeatmapColor = React.useCallback((score: number): string => {
        if (score <= 0) return 'rgb(255,255,255)';
        const normalizedScore = Math.sqrt(Math.min(score / maxRepScore, 1));
        const darkPurple = { r: 75, g: 0, b: 130 };
        const white = { r: 255, g: 255, b: 255 };
        const r = Math.round(white.r + (darkPurple.r - white.r) * normalizedScore);
        const g = Math.round(white.g + (darkPurple.g - white.g) * normalizedScore);
        const b = Math.round(white.b + (darkPurple.b - white.b) * normalizedScore);
        return `rgb(${r}, ${g}, ${b})`;
    }, [maxRepScore]);

    const repHeatmapLegendStyle = React.useMemo(() => {
        const white = 'rgb(255,255,255)';
        const darkPurple = 'rgb(75, 0, 130)';
        if (maxRepScore <= 1) {
            return { background: `linear-gradient(to right, ${white}, ${darkPurple})` };
        }
        const colorAt25 = getRepHeatmapColor(maxRepScore * (0.25 ** 2));
        const colorAt50 = getRepHeatmapColor(maxRepScore * (0.5 ** 2));
        const colorAt75 = getRepHeatmapColor(maxRepScore * (0.75 ** 2));
        return {
            background: `linear-gradient(to right, ${white}, ${colorAt25}, ${colorAt50}, ${colorAt75}, ${darkPurple})`
        };
    }, [getRepHeatmapColor, maxRepScore]);

    const getStateColor = React.useCallback((stateAbbr: string) => {
        const state = stateStats[stateAbbr];
        if (!state) return '#e0e0e0';
        switch (mapMode) {
            case 'legislation':
                const intensity = Math.min(state.legislationCount / 3000, 1);
                if (intensity >= 0.7) return 'hsl(var(--primary))';
                if (intensity >= 0.3) return 'hsl(var(--primary) / 0.5)';
                return 'hsl(var(--primary) / 0.2)';
            case 'representatives':
                const repIntensity = Math.min(state.activeRepresentatives / 250, 1);
                if (repIntensity >= 0.7) return 'hsl(var(--primary))';
                if (repIntensity >= 0.3) return 'hsl(var(--primary) / 0.5)';
                return 'hsl(var(--primary) / 0.2)';
            case 'recent':
                const recentIntensity = Math.min(state.recentActivity / 200, 1);
                if (recentIntensity >= 0.7) return 'hsl(var(--primary))';
                if (recentIntensity >= 0.3) return 'hsl(var(--primary) / 0.5)';
                return 'hsl(var(--primary) / 0.2)';
            default:
                return state.color;
        }
    }, [mapMode, stateStats]);

    const memoizedMarkers = React.useMemo(() => {
        const markers: Record<string, { color: string, size: number }> = {};
        Object.entries(stateStats).forEach(([abbr, state]) => {
            const color = getStateColor(abbr);
            let size = 20;
            if (mapMode === 'legislation') {
                const minSize = 5;
                const count = state.legislationCount || 0;
                const k = 0.63;
                if (count < 1) {
                    size = minSize;
                } else {
                    size = Math.max(minSize, k * Math.sqrt(count));
                }
            }
            markers[abbr] = { color, size };
        });
        return markers;
    }, [getStateColor, stateStats, mapMode]);

    const getActivityLevel = (stateAbbr: string) => {
        const state = stateStats[stateAbbr];
        if (!state) return 'No Data';
        switch (mapMode) {
            case 'legislation':
                const intensity = Math.min(state.legislationCount / 3000, 1);
                if (intensity >= 0.7) return 'High Activity';
                if (intensity >= 0.3) return 'Medium Activity';
                return 'Low Activity';
            case 'representatives':
                const repIntensity = Math.min(state.activeRepresentatives / 250, 1);
                if (repIntensity >= 0.7) return 'High Activity';
                if (repIntensity >= 0.3) return 'Medium Activity';
                return 'Low Activity';
            case 'recent':
                const recentIntensity = Math.min(state.recentActivity / 200, 1);
                if (recentIntensity >= 0.7) return 'High Activity';
                if (recentIntensity >= 0.3) return 'Medium Activity';
                return 'Low Activity';
            default:
                return 'General';
        }
    };

    if (!isClient) {
        return (
            <AnimatedSection>
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="font-headline text-2xl flex items-center"><MapPin className="mr-3 h-7 w-7"/>Interactive Dashboard</CardTitle>
                        <CardDescription>Explore legislative activity, representatives, and policy trends across the United States.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="h-[500px] w-full rounded-md overflow-hidden border flex items-center justify-center bg-muted">
                            <p className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"><span className="sr-only">Loading map...</span></p>
                        </div>
                    </CardContent>
                </Card>
            </AnimatedSection>
        );
    }

    return (
        <AnimatedSection>
            {isFullScreen && (
                <div className="fixed inset-0 z-50 bg-background flex flex-col h-screen overflow-hidden">
                    <div className="fixed top-0 left-0 right-0 flex-shrink-0 p-2 sm:p-4 border-b bg-background/95 backdrop-blur z-50">
                        <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                            <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-x-4 sm:space-y-0">
                                <div className="flex items-center space-x-2 lg:ml-72">
                                    <span className="text-xs sm:text-sm text-muted-foreground">Mode:</span>
                                    <select value={mapMode} onChange={(e) => handleMapModeChange(e.target.value)} className="text-xs sm:text-sm border rounded px-2 py-1 bg-background min-w-[120px] sm:min-w-[140px]" disabled={mapModeTransitioning}>
                                        {mapModes.map((mode) => (<option key={mode.id} value={mode.id}>{mode.label}</option>))}
                                    </select>
                                </div>
                            </div>
                            <div className="flex flex-col space-y-2 lg:flex-row lg:items-center lg:space-x-2 lg:space-y-0">
                                {(mapMode === 'congressional-districts' || mapMode === 'state-upper-districts' || mapMode === 'state-lower-districts') && (
                                    <div className="flex flex-wrap gap-2 sm:flex-nowrap sm:space-x-3 sm:gap-0">
                                        <div className="flex items-center space-x-1"><span className="text-xs text-muted-foreground">Party:</span><Switch checked={showPartyAffiliation} onCheckedChange={(checked) => { setShowPartyAffiliation(checked); if (checked) { setShowGerrymandering(false); setShowTopicHeatmap(false); setShowRepHeatmap(false); } }} disabled={partyDataLoading}/></div>
                                        <div className="flex items-center space-x-1"><span className="text-xs text-muted-foreground">Gerry:</span><Switch checked={showGerrymandering} onCheckedChange={(checked) => { setShowGerrymandering(checked); if (checked) { setShowPartyAffiliation(false); setShowTopicHeatmap(false); setShowRepHeatmap(false); } }} disabled={gerryDataLoading}/></div>
                                        <div className="flex items-center space-x-1"><span className="text-xs text-muted-foreground">Topic:</span><Switch checked={showTopicHeatmap} onCheckedChange={(checked) => { setShowTopicHeatmap(checked); if (checked) { setShowPartyAffiliation(false); setShowGerrymandering(false); setShowRepHeatmap(false); } }} disabled={topicDataLoading}/></div>
                                        <div className="flex items-center space-x-1"><span className="text-xs text-muted-foreground">Rep:</span><Switch checked={showRepHeatmap} onCheckedChange={(checked) => { setShowRepHeatmap(checked); if (checked) { setShowPartyAffiliation(false); setShowGerrymandering(false); setShowTopicHeatmap(false); } }} disabled={repDataLoading}/></div>
                                        <div className="flex items-center space-x-1"><span className="text-xs text-muted-foreground">Borders:</span><Switch checked={showDistrictBorders} onCheckedChange={setShowDistrictBorders}/></div>
                                    </div>
                                )}
                                <div className="flex items-center space-x-2">
                                    {exportButton}
                                    <Button variant="outline" size="sm" onClick={() => setIsFullScreen(false)} className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3"><Minimize className="h-3 w-3 sm:h-4 sm:w-4" /><span className="hidden sm:inline">Exit Full Screen</span><span className="sm:hidden">Exit</span></Button>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div className="absolute top-0 left-0 w-full h-full statepulse-map-export-target">
                        {(mapMode === 'state-lower-districts' || mapMode === 'state-upper-districts' || mapMode === 'congressional-districts') && isMobile && (
                            <div className="absolute top-2 left-2 right-2 sm:top-4 sm:left-4 sm:right-4 xl:left-72 z-10 bg-amber-50 border border-amber-200 rounded-md p-2 sm:p-3 text-xs text-amber-800">
                                <div className="flex items-center space-x-2"><svg className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg><span className="text-xs">Loading districts with mobile optimizations.{memoryPressure && ' Memory optimization active.'}</span></div>
                                <div className="mt-1 text-xs text-amber-700">Districts will load progressively to prevent crashes.</div>
                            </div>
                        )}
                        <div className="h-full w-full">
                            {(mapMode === 'congressional-districts' || mapMode === 'state-upper-districts' || mapMode === 'state-lower-districts') ? (
                                <DistrictMapGL geojsonUrl={getDistrictGeoJsonUrl(mapMode, isMobile)} color={DISTRICT_COLORS[mapMode]} onDistrictClick={onDistrictClickGL} mapStyle={resolvedTheme === 'dark' ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json' : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'} showPartyAffiliation={showPartyAffiliation} districtPartyMapping={districtPartyMapping} partyColors={PARTY_COLORS} showGerrymandering={showGerrymandering} gerryScores={gerryScores} getGerrymanderingColor={getGerrymanderingColor} showTopicHeatmap={showTopicHeatmap} topicScores={topicScores} getTopicHeatmapColor={getTopicHeatmapColor} showRepHeatmap={showRepHeatmap} repScores={repScores} repDetails={repDetails} getRepHeatmapColor={getRepHeatmapColor} showDistrictBorders={showDistrictBorders} popupMarker={districtPopupLatLng ? { lng: districtPopupLatLng.lng, lat: districtPopupLatLng.lat, iconHtml: `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' fill='none' stroke='#eb7725ff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='lucide lucide-map-pin' viewBox='0 0 24 24' style='display:block;'><path d='M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0Z'/><circle cx='12' cy='10' r='3'/></svg>`, draggable: !isMobile, onDragEnd: !isMobile ? (lngLat) => { setDistrictPopupLatLng(lngLat); if (selectedDistrict) { onDistrictClickGL(selectedDistrict, lngLat); } } : undefined } : undefined}/>
                            ) : (
                                <MapLibreMap ref={mapRef} initialViewState={{ longitude: DEFAULT_POSITION[1], latitude: DEFAULT_POSITION[0], zoom: DEFAULT_ZOOM }} style={{ height: '100%', width: '100%' }} mapStyle={resolvedTheme === 'dark' ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json' : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'}>
                                    {Object.entries(stateStats).map(([abbr, state]) => {
                                        const { color, size } = memoizedMarkers[abbr] || { color: '#e0e0e0', size: 20 };
                                        const coords: [number, number] = [(state.center as [number, number])[0], (state.center as [number, number])[1]];
                                        return (
                                            <MapLibreMarker key={abbr} longitude={coords[1]} latitude={coords[0]} anchor="center" onClick={() => handleStateClick(abbr, coords)}>
                                                <div className="transition-transform duration-150 ease-in-out hover:scale-110" style={{ width: size, height: size, backgroundColor: color, border: '2px solid #fff', borderRadius: '50%', boxShadow: '0 2px 4px rgba(0,0,0,0.3)', position: 'relative', overflow: 'hidden', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <div style={{ position: 'absolute', top: '50%', left: '50%', width: Math.max(8, size * 0.4), height: Math.max(8, size * 0.4), background: '#fff', borderRadius: '50%', transform: 'translate(-50%, -50%)' }}/>
                                                </div>
                                            </MapLibreMarker>
                                        );
                                    })}
                                    {selectedState && selectedStatePopupCoords && (
                                        <MapLibrePopup longitude={selectedStatePopupCoords[1]} latitude={selectedStatePopupCoords[0]} anchor="bottom" onClose={() => { setSelectedState(null); setSelectedStatePopupCoords(null); }} closeOnClick={false} maxWidth="260px">
                                            {detailsLoading || !stateDetails ? (
                                                <><div className="flex items-center justify-center min-h-[60px]"><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div><span className="text-xs text-muted-foreground">Loading details...</span></div></>
                                            ) : (
                                                <><div className="flex items-center justify-between mb-2"><h3 className="font-semibold text-sm md:text-lg line-clamp-1">{stateStats[selectedState].name}</h3><div className="flex items-center space-x-1"><div className={`w-2 h-2 md:w-3 md:h-3 rounded-full ${getActivityLevel(selectedState) === 'High Activity' ? 'bg-primary' : getActivityLevel(selectedState) === 'Medium Activity' ? 'bg-primary/50' : getActivityLevel(selectedState) === 'Low Activity' ? 'bg-primary/20' : 'bg-gray-300'}`}></div><span className="text-xs text-muted-foreground hidden sm:inline">{getActivityLevel(selectedState)}</span></div></div><div className="space-y-1 md:space-y-2 text-xs md:text-sm"><div className="flex justify-between"><span>Bills:</span><Badge variant="secondary" className="text-xs">{stateStats[selectedState].legislationCount}</Badge></div><div className="flex justify-between"><span>Reps:</span><Badge variant="secondary" className="text-xs">{stateStats[selectedState].activeRepresentatives}</Badge></div><div className="flex justify-between"><span>Recent:</span><Badge variant="secondary" className="text-xs">{stateStats[selectedState].recentActivity}</Badge></div><div className="pt-1 md:pt-2"><div className="text-xs text-muted-foreground mb-1"><span className="hidden sm:inline">Key Topics:</span><span className="sm:hidden">Topics:</span></div><div className="flex flex-wrap gap-1">{[...new Set(stateStats[selectedState].keyTopics)].slice(0, 3).map((topic, index) => (<Badge key={`${topic}-${index}`} variant="secondary" className="text-xs">{topic}</Badge>))}{stateStats[selectedState].keyTopics.length > 3 && (<Badge variant="outline" className="text-xs">+{stateStats[selectedState].keyTopics.length - 3}</Badge>)}</div></div></div></>
                                            )}
                                        </MapLibrePopup>
                                    )}
                                </MapLibreMap>
                            )}
                        </div>
                        {(loading || districtLoading || mapModeTransitioning) && (
                            <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-20">
                                <div className="flex flex-col items-center space-y-3 p-4">
                                    <div className="flex items-center space-x-3"><div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div><span className="text-sm sm:text-lg">{mapModeTransitioning ? 'Switching map mode...' : 'Loading map data...'}</span></div>
                                    {isMobile && (mapMode === 'state-lower-districts' || mapMode === 'state-upper-districts' || mapMode === 'congressional-districts') && (<div className="text-xs sm:text-sm text-muted-foreground text-center"><div>Mobile optimizations active</div>{memoryPressure && (<div className="text-amber-600">Memory optimization in progress</div>)}</div>)}
                                </div>
                            </div>
                        )}
                        {showGerrymandering && !gerryDataLoading && Object.keys(gerryScores).length > 0 && (<div className="absolute bottom-2 left-2 right-2 sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-sm xl:left-72 bg-background/95 backdrop-blur border rounded-lg p-2 sm:p-3 shadow-lg"><h5 className="font-medium text-xs sm:text-sm mb-1 sm:mb-2">Compactness Scale</h5><div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3 text-xs sm:text-sm"><div className="flex items-center space-x-1 sm:space-x-2"><div className="w-2 h-2 sm:w-3 sm:h-3 rounded-sm" style={{ backgroundColor: '#3b82f6' }}></div><span className="text-xs">Very Compact</span></div><div className="flex items-center space-x-1 sm:space-x-2"><div className="w-2 h-2 sm:w-3 sm:h-3 rounded-sm" style={{ backgroundColor: '#60e8fa' }}></div><span className="text-xs">Compact</span></div><div className="flex items-center space-x-1 sm:space-x-2"><div className="w-2 h-2 sm:w-3 sm:h-3 rounded-sm" style={{ backgroundColor: '#f5ce0b' }}></div><span className="text-xs">Less Compact</span></div><div className="flex items-center space-x-1 sm:space-x-2"><div className="w-2 h-2 sm:w-3 sm:h-3 rounded-sm" style={{ backgroundColor: '#d93706' }}></div><span className="text-xs">Irregular</span></div></div></div>)}
                        {showTopicHeatmap && !topicDataLoading && Object.keys(topicScores).length > 0 && (<div className="absolute bottom-2 left-2 right-2 sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-sm xl:left-72 bg-background/95 backdrop-blur border rounded-lg p-2 sm:p-3 shadow-lg"><h5 className="font-medium text-xs sm:text-sm mb-1 sm:mb-2">Topic Activity Scale</h5><div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3 text-xs sm:text-sm"><div className="flex items-center space-x-1 sm:space-x-2"><div className="w-2 h-2 sm:w-3 sm:h-3 rounded-sm" style={{ backgroundColor: 'rgb(25, 25, 112)' }}></div><span className="text-xs">High Activity</span></div><div className="flex items-center space-x-1 sm:space-x-2"><div className="w-2 h-2 sm:w-3 sm:h-3 rounded-sm" style={{ backgroundColor: 'rgb(99, 120, 171)' }}></div><span className="text-xs">Medium Activity</span></div><div className="flex items-center space-x-1 sm:space-x-2"><div className="w-2 h-2 sm:w-3 sm:h-3 rounded-sm" style={{ backgroundColor: 'rgb(173, 216, 230)' }}></div><span className="text-xs">Low Activity</span></div><div className="flex items-center space-x-1 sm:space-x-2"><div className="w-2 h-2 sm:w-3 sm:h-3 rounded-sm" style={{ backgroundColor: '#f8f9fa' }}></div><span className="text-xs">No Data</span></div></div><div className="mt-1 sm:mt-2 text-xs text-muted-foreground">Topic: {selectedTopic === 'all' ? 'All Topics' : selectedTopic}</div></div>)}
                        {showRepHeatmap && !repDataLoading && Object.keys(repScores).length > 0 && (<div className="absolute bottom-2 left-2 right-2 sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-sm xl:left-72 bg-background/95 backdrop-blur border rounded-lg p-2 sm:p-3 shadow-lg"><h5 className="font-medium text-xs sm:text-sm mb-1 sm:mb-2">{selectedRepMetric === 'sponsored_bills' ? 'Bills Sponsored Scale' : selectedRepMetric === 'recent_activity' ? 'Recent Activity Scale' : selectedRepMetric === 'voted_with_majority' ? 'Vote with Majority %' : selectedRepMetric === 'voted_against_party' ? 'Vote Against Party %' : 'Representative Scale'}</h5><div className="w-full"><div className="h-3 rounded-sm" style={repHeatmapLegendStyle}></div><div className="flex justify-between text-xs mt-1">{repHeatmapLegendLabels.map(label => <span key={label}>{label}{(selectedRepMetric === 'voted_with_majority' || selectedRepMetric === 'voted_against_party') ? '%' : ''}</span>)}</div></div><div className="mt-1 sm:mt-2 text-xs text-muted-foreground">Spectrum from white to dark purple represents absolute metric value.</div></div>)}
                        {!['congressional-districts', 'state-upper-districts', 'state-lower-districts'].includes(mapMode) && (<div className="absolute bottom-2 left-2 right-2 sm:bottom-4 sm:left-4 sm:right-auto xl:left-72 bg-background/95 backdrop-blur border rounded-lg p-2 sm:p-3 shadow-lg"><div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-x-4 sm:space-y-0 text-xs sm:text-sm"><div className="flex items-center space-x-2"><div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-primary"></div><span>High Activity</span></div><div className="flex items-center space-x-2"><div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-primary/50"></div><span>Medium Activity</span></div><div className="flex items-center space-x-2"><div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-primary/20"></div><span>Low Activity</span></div></div></div>)}
                        {showPartyAffiliation && !partyDataLoading && Object.keys(districtPartyMapping).length > 0 && (<div className="absolute bottom-2 left-2 right-2 sm:bottom-4 sm:left-4 sm:right-auto xl:left-72 bg-background/95 backdrop-blur border rounded-lg p-2 sm:p-3 shadow-lg"><h5 className="font-medium text-xs sm:text-sm mb-1 sm:mb-2">Party Legend</h5><div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3 text-xs sm:text-sm">{Object.keys(PARTY_COLORS).map(party => (<div key={party} className="flex items-center space-x-1 sm:space-x-2"><div className="w-2 h-2 sm:w-3 sm:h-3 rounded-sm" style={{ backgroundColor: PARTY_COLORS[party] }}></div><span className="text-xs">{party}</span></div>))}</div></div>)}
                        {showTopicHeatmap && availableTopics.length > 0 && (<div className="absolute top-16 sm:top-20 left-2 right-2 sm:left-4 sm:right-auto sm:max-w-xs xl:left-72 bg-background/95 backdrop-blur border rounded-lg p-2 sm:p-3 shadow-lg"><label className="text-xs sm:text-sm font-medium block mb-1 sm:mb-2">Select Topic:</label><select value={selectedTopic} onChange={(e) => setSelectedTopic(e.target.value)} className="w-full text-xs sm:text-sm border rounded px-2 py-1 bg-background" disabled={topicDataLoading}><option value="all">All Topics</option>{availableTopics.map(topic => (<option key={topic} value={topic}>{topic}</option>))}</select></div>)}
                        {showRepHeatmap && (<div className="absolute top-16 sm:top-20 left-2 right-2 sm:left-4 sm:right-auto sm:max-w-xs xl:left-72 bg-background/95 backdrop-blur border rounded-lg p-2 sm:p-3 shadow-lg"><label className="text-xs sm:text-sm font-medium block mb-1 sm:mb-2">Select Metric:</label><select value={selectedRepMetric} onChange={(e) => setSelectedRepMetric(e.target.value)} className="w-full text-xs sm:text-sm border rounded px-2 py-1 bg-background" disabled={repDataLoading}>{availableRepMetrics.map(metric => (<option key={metric} value={metric}>{metric === 'sponsored_bills' ? 'Bills Sponsored' : metric === 'recent_activity' ? 'Recent Activity' : metric === 'enacted_bills' ? 'Enacted Bills Sponsored' : metric === 'enacted_recent_activity' ? 'Enacted Bills - Recent Activity' : metric === 'voted_with_majority' ? 'Voted with Majority' : metric === 'voted_against_party' ? 'Voted Against Party' : metric}</option>))}</select></div>)}
                        <div className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 bg-background/95 backdrop-blur border rounded-lg p-2 sm:p-3 shadow-lg text-xs sm:text-sm text-muted-foreground"><div className="flex items-center space-x-2"><kbd className="px-1 py-0.5 sm:px-2 sm:py-1 text-xs bg-muted border rounded">ESC</kbd><span className="hidden sm:inline">Exit full screen</span><span className="sm:hidden">Exit</span></div></div>
                        {selectedDistrict && (<div className="absolute top-2 right-2 sm:top-4 sm:right-4 w-[calc(100%-16px)] sm:w-auto sm:max-w-sm bg-background/95 backdrop-blur border rounded-lg shadow-lg p-3 sm:p-4"><div className="flex items-center justify-between mb-2 sm:mb-3"><h3 className="font-semibold text-sm sm:text-lg">District Info</h3><button className="text-lg sm:text-xl text-gray-400 hover:text-gray-700 ml-2" onClick={() => { setSelectedDistrict(null); setDistrictPopupLatLng(null); if (isMobile) { setTimeout(forceGarbageCollection, 100); } }} aria-label="Close">×</button></div>{(!districtLoading && Array.isArray(districtReps) && districtReps.length === 0 && districtPopupLatLng && (districtPopupLatLng.lat < 24 || districtPopupLatLng.lat > 49 || districtPopupLatLng.lng < -125 || districtPopupLatLng.lng > -66)) ? (<div className="text-xs sm:text-sm text-muted-foreground mb-2">No representatives found for this location.</div>) : (<RepresentativesResults representatives={districtReps} closestReps={[]} loading={districtLoading} error={districtError} showMap={false} userLocation={null} dataSource={null} pagination={undefined} onPageChange={() => {}} districtType={selectedDistrict.properties.chamber || selectedDistrict.properties.CHAMBER || ''}/>)}</div>)}
                    </div>
                </div>
            )}
            <div className="space-y-6">
                <Card className="shadow-lg">
                    <CardHeader className="pb-3 md:pb-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="font-headline text-lg md:text-xl"><span className="hidden sm:inline">Interactive Dashboard</span></CardTitle>
                                <CardDescription className="text-xs md:text-sm"><span className="hidden sm:inline">Explore legislative activity, representatives, and policy trends across the United States.</span><span className="sm:hidden">Explore legislative activity and trends.</span></CardDescription>
                            </div>
                            <div className="flex items-center space-x-2">
                                {exportButton}
                                <Button variant="outline" size="sm" onClick={() => setIsFullScreen(!isFullScreen)} className="flex items-center gap-1" title={isFullScreen ? "Exit full screen" : "Enter full screen"}>
                                    {isFullScreen ? (<><Minimize className="h-4 w-4" /><span className="hidden sm:inline">Exit Full Screen</span></>) : (<><Maximize className="h-4 w-4" /><span className="hidden sm:inline">Full Screen</span></>)}
                                </Button>
                            </div>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4 md:space-y-6">
                        <div className="space-y-2 md:space-y-3">
                            <h4 className="font-semibold text-xs md:text-sm"><span className="hidden sm:inline">Map View Mode</span><span className="sm:hidden">View Mode</span></h4>
                            <div className="grid grid-cols-2 gap-2 md:grid-cols-2 lg:grid-cols-4 lg:gap-2">
                                {mapModes.map((mode) => {
                                    const IconComponent = mode.icon;
                                    const isDisabled = mapModeTransitioning;
                                    return (
                                        <Button key={mode.id} variant={mapMode === mode.id ? "default" : "outline"} size="sm" onClick={() => handleMapModeChange(mode.id)} disabled={isDisabled} className={`flex flex-col items-center gap-1 lg:flex-row lg:gap-2 h-auto p-2 lg:p-3 min-h-[60px] lg:min-h-[auto] ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}>
                                            <IconComponent className="h-3 w-3 lg:h-4 lg:w-4 flex-shrink-0"/>
                                            <div className="text-center lg:text-left min-w-0 flex-1"><div className="font-medium text-xs leading-tight"><span className="hidden xl:inline">{mode.label}</span><span className="xl:hidden">{mode.label.replace('Activity', '').replace('Representatives', 'Reps').replace('Legislation', 'Bills').trim()}</span></div></div>
                                        </Button>
                                    );
                                })}
                            </div>
                            <p className="text-xs text-muted-foreground hidden md:block">{mapModes.find(m => m.id === mapMode)?.description}</p>
                        </div>
                        {(mapMode === 'congressional-districts' || mapMode === 'state-upper-districts' || mapMode === 'state-lower-districts') && (
                            <div className="space-y-2 md:space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1"><h4 className="font-semibold text-xs md:text-sm"><span className="hidden sm:inline">Party Affiliation</span><span className="sm:hidden">Party Colors</span></h4><p className="text-xs text-muted-foreground"><span className="hidden sm:inline">Color districts by representative party affiliation</span><span className="sm:hidden">Color by party</span></p></div>
                                    <Switch checked={showPartyAffiliation} onCheckedChange={(checked) => { setShowPartyAffiliation(checked); if (checked) { setShowGerrymandering(false); setShowTopicHeatmap(false); setShowRepHeatmap(false); } }} disabled={partyDataLoading}/>
                                </div>
                                {partyDataLoading && (<div className="flex items-center space-x-2 text-xs text-muted-foreground"><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div><span>Loading party data...</span></div>)}
                                {partyDataError && (<div className="text-xs text-red-500">Error loading party data: {partyDataError}</div>)}
                                {showPartyAffiliation && !partyDataLoading && Object.keys(districtPartyMapping).length > 0 && (<div className="space-y-2"><h5 className="font-medium text-xs">Party Legend</h5><div className="flex flex-wrap gap-2 text-xs">{Object.keys(PARTY_COLORS).map(party => (<div key={party} className="flex items-center space-x-1"><div className="w-3 h-3 rounded-sm" style={{ backgroundColor: PARTY_COLORS[party] }}></div><span>{party}</span></div>))}</div></div>)}
                            </div>
                        )}
                        {(mapMode === 'congressional-districts' || mapMode === 'state-upper-districts' || mapMode === 'state-lower-districts') && (
                            <div className="space-y-2 md:space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1"><h4 className="font-semibold text-xs md:text-sm"><span className="hidden sm:inline">Gerrymandering Analysis</span><span className="sm:hidden">Gerrymandering</span></h4><p className="text-xs text-muted-foreground"><span className="hidden sm:inline">Color districts by compactness (Polsby-Popper test)</span><span className="sm:hidden">Show district compactness</span></p></div>
                                    <Switch checked={showGerrymandering} onCheckedChange={(checked) => { setShowGerrymandering(checked); if (checked) { setShowPartyAffiliation(false); setShowTopicHeatmap(false); setShowRepHeatmap(false); } }} disabled={gerryDataLoading}/>
                                </div>
                                {gerryDataLoading && (<div className="flex items-center space-x-2 text-xs text-muted-foreground"><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div><span>Calculating compactness scores...</span></div>)}
                                {gerryDataError && (<div className="text-xs text-red-500">Error loading gerrymandering data: {gerryDataError}</div>)}
                                {showGerrymandering && !gerryDataLoading && Object.keys(gerryScores).length > 0 && (<div className="space-y-2"><h5 className="font-medium text-xs">Compactness Scale</h5><div className="flex flex-wrap gap-2 text-xs"><div className="flex items-center space-x-1"><div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#3b82f6' }}></div><span>Very Compact</span></div><div className="flex items-center space-x-1"><div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#60e8fa' }}></div><span>Compact</span></div><div className="flex items-center space-x-1"><div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#8cfb24' }}></div><span>Moderate</span></div><div className="flex items-center space-x-1"><div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#f5ce0b' }}></div><span>Less Compact</span></div><div className="flex items-center space-x-1"><div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#d93706' }}></div><span>Irregular Shape</span></div></div><p className="text-xs text-muted-foreground">Based on enhanced Polsby-Popper compactness analysis with geographic adjustments for coastlines and state borders. Blue = more compact, Red/Orange = less compact.</p></div>)}
                            </div>
                        )}
                        {(mapMode === 'congressional-districts' || mapMode === 'state-upper-districts' || mapMode === 'state-lower-districts') && (
                            <div className="space-y-2 md:space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1"><h4 className="font-semibold text-xs md:text-sm"><span className="hidden sm:inline">Topic Heatmap</span><span className="sm:hidden">Topic Heat</span></h4><p className="text-xs text-muted-foreground"><span className="hidden sm:inline">Color districts by legislative topic activity</span><span className="sm:hidden">Show topic activity</span></p></div>
                                    <Switch checked={showTopicHeatmap} onCheckedChange={(checked) => { setShowTopicHeatmap(checked); if (checked) { setShowPartyAffiliation(false); setShowGerrymandering(false); setShowRepHeatmap(false); } }} disabled={topicDataLoading}/>
                                </div>
                                {showTopicHeatmap && availableTopics.length > 0 && (<div className="space-y-2"><label className="text-xs font-medium">Select Topic:</label><select value={selectedTopic} onChange={(e) => setSelectedTopic(e.target.value)} className="w-full text-xs border rounded px-2 py-1 bg-background" disabled={topicDataLoading}><option value="all">All Topics</option>{availableTopics.map(topic => (<option key={topic} value={topic}>{topic}</option>))}</select></div>)}
                                {topicDataLoading && (<div className="flex items-center space-x-2 text-xs text-muted-foreground"><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div><span>Loading topic data...</span></div>)}
                                {topicDataError && (<div className="text-xs text-red-500">Error loading topic data: {topicDataError}</div>)}
                                {showTopicHeatmap && !topicDataLoading && Object.keys(topicScores).length > 0 && (<div className="space-y-2"><h5 className="font-medium text-xs">Activity Scale</h5><div className="flex flex-wrap gap-2 text-xs"><div className="flex items-center space-x-1"><div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgb(25, 25, 112)' }}></div><span>High Activity</span></div><div className="flex items-center space-x-1"><div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgb(99, 120, 171)' }}></div><span>Medium Activity</span></div><div className="flex items-center space-x-1"><div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgb(173, 216, 230)' }}></div><span>Low Activity</span></div><div className="flex items-center space-x-1"><div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#f8f9fa' }}></div><span>No Data</span></div></div><p className="text-xs text-muted-foreground">Blue gradient: light blue = low activity, dark blue = high activity. Based on legislative activity in the selected topic area.</p></div>)}
                            </div>
                        )}
                        {(mapMode === 'congressional-districts' || mapMode === 'state-upper-districts' || mapMode === 'state-lower-districts') && (
                            <div className="space-y-2 md:space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1"><h4 className="font-semibold text-xs md:text-sm"><span className="hidden sm:inline">Representative Heatmap</span><span className="sm:hidden">Rep Heatmap</span></h4><p className="text-xs text-muted-foreground"><span className="hidden sm:inline">Color districts by representative metrics</span><span className="sm:hidden">Show rep metrics</span></p></div>
                                    <Switch checked={showRepHeatmap} onCheckedChange={(checked) => { setShowRepHeatmap(checked); if (checked) { setShowPartyAffiliation(false); setShowGerrymandering(false); setShowTopicHeatmap(false); } }} disabled={repDataLoading}/>
                                </div>
                                {showRepHeatmap && (<div className="space-y-2"><label className="text-xs font-medium">Select Metric:</label><select value={selectedRepMetric} onChange={(e) => setSelectedRepMetric(e.target.value)} className="w-full text-xs border rounded px-2 py-1 bg-background" disabled={repDataLoading}>{availableRepMetrics.map(metric => (<option key={metric} value={metric}>{metric === 'sponsored_bills' ? 'Bills Sponsored' : metric === 'recent_activity' ? 'Recent Activity' : metric === 'enacted_bills' ? 'Enacted Bills Sponsored' : metric === 'enacted_recent_activity' ? 'Enacted Bills - Recent Activity' : metric === 'voted_with_majority' ? 'Voted with Majority' : metric === 'voted_against_party' ? 'Voted Against Party' : metric}</option>))}</select></div>)}
                                {repDataLoading && (<div className="flex items-center space-x-2 text-xs text-muted-foreground"><div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div><span>Loading representative data...</span></div>)}
                                {repDataError && (<div className="text-xs text-red-500">Error loading representative data: {repDataError}</div>)}
                                {showRepHeatmap && !repDataLoading && Object.keys(repScores).length > 0 && (<div className="space-y-2"><h5 className="font-medium text-xs">{selectedRepMetric === 'sponsored_bills' ? 'Bills Sponsored Scale' : selectedRepMetric === 'recent_activity' ? 'Recent Activity Scale' : selectedRepMetric === 'voted_with_majority' ? 'Vote with Majority %' : selectedRepMetric === 'voted_against_party' ? 'Vote Against Party %' : 'Score Scale'}</h5><div className="w-full"><div className="h-4 rounded-sm" style={repHeatmapLegendStyle}></div><div className="flex justify-between text-xs mt-1">{repHeatmapLegendLabels.map(label => <span key={label}>{label}{(selectedRepMetric === 'voted_with_majority' || selectedRepMetric === 'voted_against_party') ? '%' : ''}</span>)}</div></div><p className="text-xs text-muted-foreground">Spectrum from white (low) to dark purple (high) representing absolute metric value.</p></div>)}
                            </div>
                        )}
                        {(mapMode === 'congressional-districts' || mapMode === 'state-upper-districts' || mapMode === 'state-lower-districts') && (showPartyAffiliation || showGerrymandering || showTopicHeatmap || showRepHeatmap) && (
                            <div className="space-y-2 md:space-y-3">
                                <div className="flex items-center justify-between"><div className="space-y-1"><h4 className="font-semibold text-xs md:text-sm"><span className="hidden sm:inline">District Borders</span><span className="sm:hidden">Borders</span></h4><p className="text-xs text-muted-foreground"><span className="hidden sm:inline">Show or hide district boundary lines</span><span className="sm:hidden">Show boundary lines</span></p></div><Switch checked={showDistrictBorders} onCheckedChange={setShowDistrictBorders}/></div>
                            </div>
                        )}
                        <div className="relative statepulse-map-export-target">
                            {(mapMode === 'state-lower-districts' || mapMode === 'state-upper-districts' || mapMode === 'congressional-districts') && isMobile && (<div className="absolute top-2 left-2 right-2 z-10 bg-amber-50 border border-amber-200 rounded-md p-2 text-xs text-amber-800"><div className="flex items-center space-x-1"><svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg><span>Loading districts with mobile optimizations.{memoryPressure && ' Memory optimization active.'}</span></div><div className="mt-1 text-xs text-amber-700">Districts will load progressively to prevent crashes.</div></div>)}
                            <div className="h-[300px] sm:h-[400px] md:h-[500px] w-full rounded-md overflow-hidden border">
                                {(mapMode === 'congressional-districts' || mapMode === 'state-upper-districts' || mapMode === 'state-lower-districts') ? (
                                    <DistrictMapGL geojsonUrl={getDistrictGeoJsonUrl(mapMode, isMobile)} color={DISTRICT_COLORS[mapMode]} onDistrictClick={onDistrictClickGL} mapStyle={resolvedTheme === 'dark' ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json' : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'} showPartyAffiliation={showPartyAffiliation} districtPartyMapping={districtPartyMapping} partyColors={PARTY_COLORS} showGerrymandering={showGerrymandering} gerryScores={gerryScores} getGerrymanderingColor={getGerrymanderingColor} showTopicHeatmap={showTopicHeatmap} topicScores={topicScores} getTopicHeatmapColor={getTopicHeatmapColor} showRepHeatmap={showRepHeatmap} repScores={repScores} repDetails={repDetails} getRepHeatmapColor={getRepHeatmapColor} showDistrictBorders={showDistrictBorders} popupMarker={districtPopupLatLng ? { lng: districtPopupLatLng.lng, lat: districtPopupLatLng.lat, iconHtml: `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' fill='none' stroke='#eb7725ff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='lucide lucide-map-pin' viewBox='0 0 24 24' style='display:block;'><path d='M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0Z'/><circle cx='12' cy='10' r='3'/></svg>`, draggable: !isMobile, onDragEnd: !isMobile ? (lngLat) => { setDistrictPopupLatLng(lngLat); if (selectedDistrict) { onDistrictClickGL(selectedDistrict, lngLat); } } : undefined } : undefined}/>
                                ) : (
                                    <MapLibreMap ref={mapRef} initialViewState={{ longitude: DEFAULT_POSITION[1], latitude: DEFAULT_POSITION[0], zoom: DEFAULT_ZOOM }} style={{ height: '100%', width: '100%' }} mapStyle={resolvedTheme === 'dark' ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json' : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'}>
                                        {Object.entries(stateStats).map(([abbr, state]) => {
                                            const { color, size } = memoizedMarkers[abbr] || { color: '#e0e0e0', size: 20 };
                                            const coords: [number, number] = [(state.center as [number, number])[0], (state.center as [number, number])[1]];
                                            return (
                                                <MapLibreMarker key={abbr} longitude={coords[1]} latitude={coords[0]} anchor="center" onClick={() => handleStateClick(abbr, coords)}>
                                                    <div className="transition-transform duration-150 ease-in-out hover:scale-110" style={{ width: size, height: size, backgroundColor: color, border: '2px solid #fff', borderRadius: '50%', boxShadow: '0 2px 4px rgba(0,0,0,0.3)', position: 'relative', overflow: 'hidden', boxSizing: 'border-box', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                        <div style={{ position: 'absolute', top: '50%', left: '50%', width: Math.max(8, size * 0.4), height: Math.max(8, size * 0.4), background: '#fff', borderRadius: '50%', transform: 'translate(-50%, -50%)' }}/>
                                                    </div>
                                                </MapLibreMarker>
                                            );
                                        })}
                                        {selectedState && selectedStatePopupCoords && (
                                            <MapLibrePopup longitude={selectedStatePopupCoords[1]} latitude={selectedStatePopupCoords[0]} anchor="bottom" onClose={() => { setSelectedState(null); setSelectedStatePopupCoords(null); }} closeOnClick={false} maxWidth="260px">
                                                {detailsLoading || !stateDetails ? (
                                                    <><div className="flex items-center justify-center min-h-[60px]"><div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div><span className="text-xs text-muted-foreground">Loading details...</span></div></>
                                                ) : (
                                                    <><div className="flex items-center justify-between mb-2"><h3 className="font-semibold text-sm md:text-lg line-clamp-1">{stateStats[selectedState].name}</h3><div className="flex items-center space-x-1"><div className={`w-2 h-2 md:w-3 md:h-3 rounded-full ${getActivityLevel(selectedState) === 'High Activity' ? 'bg-primary' : getActivityLevel(selectedState) === 'Medium Activity' ? 'bg-primary/50' : getActivityLevel(selectedState) === 'Low Activity' ? 'bg-primary/20' : 'bg-gray-300'}`}></div><span className="text-xs text-muted-foreground hidden sm:inline">{getActivityLevel(selectedState)}</span></div></div><div className="space-y-1 md:space-y-2 text-xs md:text-sm"><div className="flex justify-between"><span>Bills:</span><Badge variant="secondary" className="text-xs">{stateStats[selectedState].legislationCount}</Badge></div><div className="flex justify-between"><span>Reps:</span><Badge variant="secondary" className="text-xs">{stateStats[selectedState].activeRepresentatives}</Badge></div><div className="flex justify-between"><span>Recent:</span><Badge variant="secondary" className="text-xs">{stateStats[selectedState].recentActivity}</Badge></div><div className="pt-1 md:pt-2"><div className="text-xs text-muted-foreground mb-1"><span className="hidden sm:inline">Key Topics:</span><span className="sm:hidden">Topics:</span></div><div className="flex flex-wrap gap-1">{[...new Set(stateStats[selectedState].keyTopics)].slice(0, 3).map((topic, index) => (<Badge key={`${topic}-${index}`} variant="secondary" className="text-xs">{topic}</Badge>))}{stateStats[selectedState].keyTopics.length > 3 && (<Badge variant="outline" className="text-xs">+{stateStats[selectedState].keyTopics.length - 3}</Badge>)}</div></div></div></>
                                                )}
                                            </MapLibrePopup>
                                        )}
                                    </MapLibreMap>
                                )}
                            </div>
                            {(loading || districtLoading || mapModeTransitioning) && (<div className="absolute inset-0 bg-background/80 flex items-center justify-center"><div className="flex flex-col items-center space-y-2"><div className="flex items-center space-x-2"><div className="animate-spin rounded-full h-3 w-3 md:h-4 md:w-4 border-b-2 border-primary"></div><span className="text-xs md:text-sm">{mapModeTransitioning ? (<><span className="hidden sm:inline">Switching map mode...</span><span className="sm:hidden">Switching...</span></>) : (<><span className="hidden sm:inline">Updating map data...</span><span className="sm:hidden">Loading...</span></>)}</span></div>{(mapMode === 'state-lower-districts' || mapMode === 'state-upper-districts' || mapMode === 'congressional-districts') && isMobile && (<div className="text-xs text-muted-foreground text-center"><div>Mobile optimizations active</div>{memoryPressure && (<div className="text-amber-600">Memory optimization in progress</div>)}</div>)}</div></div>)}
                            {districtError && (<div className="absolute inset-0 bg-background/80 flex items-center justify-center"><div className="text-center"><span className="text-xs text-red-500 block">{districtError}</span>{isMobile && (<span className="text-xs text-muted-foreground block mt-1">Try switching to a smaller district view</span>)}</div></div>)}
                            {selectedDistrict && (<div className="mt-4 bg-card text-foreground border border-border rounded-lg shadow-lg p-3 dark:!bg-zinc-900 dark:!text-white dark:!border-zinc-700"><h3 className="font-semibold text-base md:text-lg mb-2">{districtPopupLatLng ? ` (${districtPopupLatLng.lat.toFixed(5)}, ${districtPopupLatLng.lng.toFixed(5)})` : ''}<button className="ml-2 text-lg text-gray-400 hover:text-gray-700" onClick={() => { setSelectedDistrict(null); setDistrictPopupLatLng(null); if (isMobile) { setTimeout(forceGarbageCollection, 100); } }} aria-label="Close">×</button></h3>{(!districtLoading && Array.isArray(districtReps) && districtReps.length === 0 && districtPopupLatLng && (districtPopupLatLng.lat < 24 || districtPopupLatLng.lat > 49 || districtPopupLatLng.lng < -125 || districtPopupLatLng.lng > -66)) ? (<div className="text-sm text-muted-foreground mb-2">No representatives found for this location.</div>) : (<RepresentativesResults representatives={districtReps} closestReps={[]} loading={districtLoading} error={districtError} showMap={false} userLocation={null} dataSource={null} pagination={undefined} onPageChange={() => {}} districtType={selectedDistrict.properties.chamber || selectedDistrict.properties.CHAMBER || ''}/>)}</div>)}
                        </div>
                        {['congressional-districts', 'state-upper-districts', 'state-lower-districts'].includes(mapMode) ? (<div className="text-xs text-muted-foreground text-center w-full py-2"><div>{isMobile ? 'Tap anywhere on the map to see legislators' : 'Click anywhere on the map to see legislators representing that location.'}</div>{isMobile && mapMode === 'state-lower-districts' && (<div className="text-amber-600 mt-1">Large dataset - optimized for mobile performance</div>)}</div>) : (<div className="flex flex-col space-y-2 md:flex-row md:items-center md:justify-between md:space-y-0 text-xs text-muted-foreground"><div className="flex items-center space-x-2 md:space-x-4 overflow-x-auto"><div className="flex items-center space-x-1 flex-shrink-0"><div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-primary"></div><span className="whitespace-nowrap">High Activity</span></div><div className="flex items-center space-x-1 flex-shrink-0"><div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-primary/50"></div><span className="whitespace-nowrap"><span className="hidden sm:inline">Medium Activity</span><span className="sm:hidden">Medium</span></span></div><div className="flex items-center space-x-1 flex-shrink-0"><div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-primary/20"></div><span className="whitespace-nowrap"><span className="hidden sm:inline">Low Activity</span><span className="sm:hidden">Low</span></span></div></div><div className="text-xs hidden md:block">Click markers for detailed state information</div><div className="text-xs md:hidden">Tap markers for details</div></div>)}
                    </CardContent>
                </Card>
                {selectedState && stateStats[selectedState] && (
                    <Card className="shadow-lg">
                        <CardHeader className="pb-3 md:pb-6"><CardTitle className="flex items-center justify-between text-lg md:text-xl"><span className="line-clamp-1">{stateStats[selectedState].name} Details</span><Button variant="ghost" size="sm" onClick={() => setSelectedState(null)} className="flex-shrink-0">×</Button></CardTitle></CardHeader>
                        <CardContent className="pt-0">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                                <div className="space-y-1 md:space-y-2"><div className="flex items-center space-x-2"><FileText className="h-3 w-3 md:h-4 md:w-4 text-blue-500 flex-shrink-0"/><span className="font-medium text-sm md:text-base"><span className="hidden sm:inline">Legislative Activity</span><span className="sm:hidden">Bills</span></span></div><p className="text-xl md:text-2xl font-bold">{stateStats[selectedState].legislationCount}</p><p className="text-xs text-muted-foreground"><span className="hidden sm:inline">Active bills and resolutions</span><span className="sm:hidden">Active bills</span></p></div>
                                <div className="space-y-1 md:space-y-2"><div className="flex items-center space-x-2"><Users className="h-3 w-3 md:h-4 md:w-4 text-green-500 flex-shrink-0"/><span className="font-medium text-sm md:text-base"><span className="hidden sm:inline">Representatives</span><span className="sm:hidden">Reps</span></span></div><p className="text-xl md:text-2xl font-bold">{stateStats[selectedState].activeRepresentatives}</p><p className="text-xs text-muted-foreground"><span className="hidden sm:inline">Active state legislators</span><span className="sm:hidden">Legislators</span></p></div>
                                <div className="space-y-1 md:space-y-2"><div className="flex items-center space-x-2"><TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-orange-500 flex-shrink-0"/><span className="font-medium text-sm md:text-base">Recent Activity</span></div><p className="text-xl md:text-2xl font-bold">{stateStats[selectedState].recentActivity}</p><p className="text-xs text-muted-foreground"><span className="hidden sm:inline">Actions in the last 30 days</span><span className="sm:hidden">Last 30 days</span></p></div>
                            </div>
                            <div className="mt-4 md:mt-6"><h4 className="font-medium mb-2 text-sm md:text-base"><span className="hidden sm:inline">Key Policy Areas</span><span className="sm:hidden">Policy Areas</span></h4><div className="flex flex-wrap gap-1 md:gap-2">{[...new Set(stateStats[selectedState].keyTopics)].map((topic, index) => (<Badge key={`${topic}-${index}`} variant="secondary" className="text-xs">{topic}</Badge>))}</div></div>
                            <div className="mt-4 md:mt-6 pt-3 md:pt-4 border-t"><div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3"><Button variant="outline" size="sm" onClick={() => router.push(`/dashboard?stateAbbr=${selectedState}`)} className="w-full"><span className="hidden sm:inline">View Full Dashboard</span><span className="sm:hidden">Full Dashboard</span></Button><Button variant="outline" size="sm" onClick={() => router.push(`/legislation?state=${encodeURIComponent(stateStats[selectedState].name)}&stateAbbr=${selectedState}`)} className="w-full"><span className="hidden sm:inline">View Legislation</span><span className="sm:hidden">View Bills</span></Button></div></div>
                        </CardContent>
                    </Card>
                )}
                {selectedState && stateStats[selectedState] && (<ChamberMakeup state={selectedState} />)}
                <AnimatedSection>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-2 lg:grid-cols-4 lg:gap-4">
                        <Card><CardContent className="p-3 md:p-4"><div className="flex items-center space-x-2"><FileText className="h-4 w-4 md:h-5 md:w-5 text-blue-500 flex-shrink-0"/><div className="min-w-0"><p className="text-xs md:text-sm font-medium truncate"><span className="hidden sm:inline">Total Legislation</span><span className="sm:hidden">Total Bills</span></p><p className="text-lg md:text-2xl font-bold">{Object.values(stateStats).reduce((sum, state) => sum + state.legislationCount, 0).toLocaleString()}</p></div></div></CardContent></Card>
                        <Card><CardContent className="p-3 md:p-4"><div className="flex items-center space-x-2"><Users className="h-4 w-4 md:h-5 md:w-5 text-green-500 flex-shrink-0"/><div className="min-w-0"><p className="text-xs md:text-sm font-medium truncate"><span className="hidden sm:inline">Active Sponsors</span><span className="sm:hidden">Active Reps</span></p><p className="text-lg md:text-2xl font-bold">{Object.values(stateStats).reduce((sum, state) => sum + state.activeRepresentatives, 0).toLocaleString()}</p></div></div></CardContent></Card>
                        <Card><CardContent className="p-3 md:p-4"><div className="flex items-center space-x-2"><TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-orange-500 flex-shrink-0"/><div className="min-w-0"><p className="text-xs md:text-sm font-medium truncate">Recent Activity</p><p className="text-lg md:text-2xl font-bold">{Object.values(stateStats).reduce((sum, state) => sum + state.recentActivity, 0).toLocaleString()}</p></div></div></CardContent></Card>
                        <Card><CardContent className="p-3 md:p-4"><div className="flex items-center space-x-2"><MapPin className="h-4 w-4 md:h-5 md:w-5 text-purple-500 flex-shrink-0"/><div className="min-w-0"><p className="text-xs md:text-sm font-medium truncate"><span className="hidden sm:inline">Jurisdictions Tracked</span><span className="sm:hidden">Jurisdictions</span></p><p className="text-lg md:text-2xl font-bold">{Object.keys(stateStats).length}</p></div></div></CardContent></Card>
                    </div>
                </AnimatedSection>
            </div>
        </AnimatedSection>
    );
};
