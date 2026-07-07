"use client";

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Calendar, FileText, MapPin, Maximize, Minimize, TrendingUp, Users, Scale } from 'lucide-react';
import { AnimatedSection } from "@/components/ui/AnimatedSection";
import { RepresentativesResults } from "./RepresentativesResults";
import { ChamberMakeup } from "./ChamberMakeup";
import { DashboardMapCanvas } from './DashboardMapCanvas';
import { DashboardFullscreenToolbar } from './DashboardFullscreenToolbar';
import { StateModeDetailPanel } from './StateModeDetailPanel';
import { useInteractiveMap } from '@/hooks/useInteractiveMap';
import { MapMode } from '@/types/geo';

const mapModes: MapMode[] = [
    { id: 'legislation', label: 'Legislation Activity', description: 'View states by legislative activity and bill counts', icon: FileText },
    { id: 'representatives', label: 'Representatives', description: 'Explore representative density and activity', icon: Users },
    { id: 'trends', label: 'Trending Topics', description: 'See what policy areas are most active', icon: TrendingUp },
    { id: 'recent', label: 'Recent Activity', description: 'Latest legislative developments', icon: Calendar },
    { id: 'voting-power', label: 'Voting Power', description: 'Compare voting power per person across states', icon: Scale },
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

type BubbleMapMode = 'legislation' | 'representatives' | 'trends' | 'recent';

const getModeMetric = (state: { legislationCount: number; activeRepresentatives: number; recentActivity: number; topicDiversity: number }, mode: string): number => {
    switch (mode) {
        case 'legislation': return state.legislationCount || 0;
        case 'representatives': return state.activeRepresentatives || 0;
        case 'trends': return state.topicDiversity || 0;
        case 'recent': return state.recentActivity || 0;
        default: return 0;
    }
};

const scaleBubbleSize = (value: number, maxValue: number): number => {
    const minSize = 5;
    const maxSize = 28;
    if (value < 1 || maxValue < 1) return minSize;
    const normalized = Math.sqrt(value / maxValue);
    return Math.max(minSize, minSize + normalized * (maxSize - minSize));
};

const getActivityIntensity = (value: number, maxValue: number): number => {
    if (maxValue < 1) return 0;
    return Math.min(value / maxValue, 1);
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

const getVotingPowerColor = (normalizedPower: number): string => {
    if (normalizedPower <= 0) return 'rgb(255, 255, 255)'; 
    const clampedScore = Math.max(0, Math.min(1, normalizedPower));
    
    const white = { r: 255, g: 255, b: 255 };
    const darkBlue = { r: 30, g: 100, b: 200 };
    
    const r = Math.round(white.r + (darkBlue.r - white.r) * clampedScore);
    const g = Math.round(white.g + (darkBlue.g - white.g) * clampedScore);
    const b = Math.round(white.b + (darkBlue.b - white.b) * clampedScore);
    
    return `rgb(${r}, ${g}, ${b})`;
};

// Legend with Maryland baseline (1.0×) centered and based on actual data range
const getVotingPowerLegend = (
    votingPowerData: Record<string, any>,
    getVotingPowerColor: (power: number) => string,
    chamber: 'house' | 'senate'
) => {
    const all = Object.values(votingPowerData || {}).filter((s: any) =>
        s && isFinite(s.relativeToMaryland) && isFinite(s.normalizedPower)
    );
    
    if (all.length === 0) {
        const fallbackLabels = ['0.5×', '0.75×', '1.0×', '1.25×', '1.5×'];
        const fallbackStops = [0, 0.25, 0.5, 0.75, 1].map(getVotingPowerColor);
        return { labels: fallbackLabels, style: { background: `linear-gradient(to right, ${fallbackStops.join(', ')})` } };
    }

    const relatives = all.map((s: any) => s.relativeToMaryland).sort((a, b) => a - b);
    const minRel = relatives[0];
    const maxRel = relatives[relatives.length - 1];

    const md = Object.values(votingPowerData).find((s: any) => s.abbreviation === 'MD');
    const mdRel = md?.relativeToMaryland ?? 1.0;
    const mdNorm = md?.normalizedPower ?? 0.5;

    const belowMd = Math.max(mdRel - minRel, 0.1);  // Distance from min to Maryland
    const aboveMd = Math.max(maxRel - mdRel, 0.1);  // Distance from Maryland to max
    const maxRange = Math.max(belowMd, aboveMd) * 1.1; // Use larger range for symmetry

    const legendPoints = [
        Math.max(mdRel - maxRange, minRel),     // Far left
        Math.max(mdRel - maxRange * 0.5, minRel), // Mid left  
        mdRel,                                   // Center (Maryland)
        Math.min(mdRel + maxRange * 0.5, maxRel), // Mid right
        Math.min(mdRel + maxRange, maxRel)      // Far right
    ];

    const uniquePoints = [...new Set(legendPoints.map(p => parseFloat(p.toFixed(3))))];
    if (uniquePoints.length < 3) {
        const spread = Math.max(maxRel - minRel, 0.2);
        uniquePoints.length = 0;
        uniquePoints.push(minRel, mdRel, maxRel);
        if (spread > 0.4) {
            uniquePoints.splice(1, 0, (minRel + mdRel) / 2);
            uniquePoints.splice(3, 0, (mdRel + maxRel) / 2);
        }
    }

    const needOneDecimal = maxRel >= 2 || (maxRel - minRel) > 0.5;
    const labels = uniquePoints.map(v => {
        const formatted = Math.abs(v - mdRel) < 0.001 
            ? '1.0×' // Always show Maryland as 1.0×
            : (needOneDecimal ? v.toFixed(1) : v.toFixed(2)) + '×';
        return formatted;
    });

    const colorStops = uniquePoints.map((targetRel) => {
        const matchingState = Object.values(votingPowerData).find((s: any) => 
            Math.abs(s.relativeToMaryland - targetRel) < 0.01 // Slightly larger tolerance
        );
        
        if (matchingState) {
            return getVotingPowerColor(matchingState.normalizedPower);
        }
        
        const allRelatives = Object.values(votingPowerData).map((s: any) => s.relativeToMaryland);
        const sortedRelatives = allRelatives.sort((a, b) => a - b);
        
        let rank = 0;
        for (const v of sortedRelatives) {
            if (v < targetRel) rank++;
            else break;
        }
        const estimatedNormalized = rank / Math.max(sortedRelatives.length - 1, 1);
        
        return getVotingPowerColor(estimatedNormalized);
    });

    const style = { background: `linear-gradient(to right, ${colorStops.join(', ')})` };
    return { labels, style };
};


export const MapUI = () => {
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
        mapDataProgress,
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
        forceGarbageCollection,
        // Voting power related
        votingPowerData,
        votingPowerLoading,
        votingPowerError,
        selectedChamber,
        setSelectedChamber
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

    const { labels: votingPowerLegendLabels, style: votingPowerLegendStyle } = React.useMemo(
        () => getVotingPowerLegend(votingPowerData, getVotingPowerColor, selectedChamber),
        [votingPowerData, getVotingPowerColor, selectedChamber]
    );

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

    React.useEffect(() => {
        const html = document.documentElement;
        if (isFullScreen) {
            html.style.overflow = 'hidden';
            document.body.style.overflow = 'hidden';
        } else {
            html.style.overflow = '';
            document.body.style.overflow = '';
        }
        return () => {
            html.style.overflow = '';
            document.body.style.overflow = '';
        };
    }, [isFullScreen]);

    React.useEffect(() => {
        const timer = window.setTimeout(() => {
            mapRef.current?.getMap?.()?.resize();
            window.dispatchEvent(new Event('resize'));
        }, 150);
        return () => window.clearTimeout(timer);
    }, [isFullScreen, mapMode]);

    const modeMaxMetric = React.useMemo(() => {
        if (!['legislation', 'representatives', 'trends', 'recent'].includes(mapMode)) return 1;
        const values = Object.values(stateStats).map((state) => getModeMetric(state, mapMode));
        return Math.max(...values, 1);
    }, [stateStats, mapMode]);

    const getStateColor = React.useCallback((stateAbbr: string) => {
        const state = stateStats[stateAbbr];
        if (!state) return '#e0e0e0';
        switch (mapMode) {
            case 'legislation':
            case 'representatives':
            case 'trends':
            case 'recent': {
                const intensity = getActivityIntensity(getModeMetric(state, mapMode), modeMaxMetric);
                if (intensity >= 0.7) return 'hsl(var(--primary))';
                if (intensity >= 0.3) return 'hsl(var(--primary) / 0.5)';
                return 'hsl(var(--primary) / 0.2)';
            }
            case 'voting-power':
                const votingData = votingPowerData[stateAbbr];
                if (!votingData) return '#e0e0e0';
                return getVotingPowerColor(votingData.normalizedPower);
            default:
                return state.color;
        }
    }, [mapMode, stateStats, votingPowerData, modeMaxMetric]);

    const memoizedMarkers = React.useMemo(() => {
        const markers: Record<string, { color: string, size: number }> = {};
        const bubbleModes: BubbleMapMode[] = ['legislation', 'representatives', 'trends', 'recent'];
        Object.entries(stateStats).forEach(([abbr, state]) => {
            const color = getStateColor(abbr);
            let size = 20;
            if (bubbleModes.includes(mapMode as BubbleMapMode)) {
                size = scaleBubbleSize(getModeMetric(state, mapMode), modeMaxMetric);
            }
            markers[abbr] = { color, size };
        });
        return markers;
    }, [getStateColor, stateStats, mapMode, modeMaxMetric]);

    const getActivityLevel = (stateAbbr: string) => {
        const state = stateStats[stateAbbr];
        if (!state) return 'No Data';
        switch (mapMode) {
            case 'legislation':
            case 'representatives':
            case 'trends':
            case 'recent': {
                const intensity = getActivityIntensity(getModeMetric(state, mapMode), modeMaxMetric);
                if (intensity >= 0.7) return 'High Activity';
                if (intensity >= 0.3) return 'Medium Activity';
                return 'Low Activity';
            }
            case 'voting-power':
                const votingData = votingPowerData[stateAbbr];
                if (!votingData) return 'No Data';
                if (votingData.normalizedPower >= 0.7) return 'High Power';
                if (votingData.normalizedPower >= 0.3) return 'Medium Power';
                return 'Low Power';
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

    const mapCanvas = (
        <DashboardMapCanvas
            mapMode={mapMode}
            isFullScreen={isFullScreen}
            isMobile={isMobile}
            resolvedTheme={resolvedTheme}
            mapRef={mapRef}
            stateStats={stateStats}
            memoizedMarkers={memoizedMarkers}
            mapDataProgress={mapDataProgress}
            districtLoading={districtLoading}
            mapModeTransitioning={mapModeTransitioning}
            memoryPressure={memoryPressure}
            districtError={districtError}
            getDistrictGeoJsonUrl={getDistrictGeoJsonUrl}
            districtColors={DISTRICT_COLORS}
            onDistrictClickGL={onDistrictClickGL}
            showPartyAffiliation={showPartyAffiliation}
            districtPartyMapping={districtPartyMapping}
            partyColors={PARTY_COLORS}
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
            districtPopupLatLng={districtPopupLatLng}
            setDistrictPopupLatLng={setDistrictPopupLatLng}
            selectedDistrict={selectedDistrict}
            setSelectedDistrict={setSelectedDistrict}
            districtReps={districtReps}
            forceGarbageCollection={forceGarbageCollection}
            votingPowerData={votingPowerData}
            selectedChamber={selectedChamber}
            handleStateClick={handleStateClick}
            selectedState={selectedState}
            setSelectedState={setSelectedState}
            selectedStatePopupCoords={selectedStatePopupCoords}
            setSelectedStatePopupCoords={setSelectedStatePopupCoords}
            detailsLoading={detailsLoading}
            stateDetails={stateDetails}
            getActivityLevel={getActivityLevel}
            availableTopics={availableTopics}
            selectedTopic={selectedTopic}
            setSelectedTopic={setSelectedTopic}
            topicDataLoading={topicDataLoading}
            availableRepMetrics={availableRepMetrics}
            selectedRepMetric={selectedRepMetric}
            setSelectedRepMetric={setSelectedRepMetric}
            repDataLoading={repDataLoading}
            repHeatmapLegendLabels={repHeatmapLegendLabels}
            repHeatmapLegendStyle={repHeatmapLegendStyle}
            votingPowerLegendLabels={votingPowerLegendLabels}
            votingPowerLegendStyle={votingPowerLegendStyle}
            fullscreenToolbar={
                isFullScreen ? (
                    <DashboardFullscreenToolbar
                        mapMode={mapMode}
                        mapModes={mapModes}
                        mapModeTransitioning={mapModeTransitioning}
                        handleMapModeChange={handleMapModeChange}
                        selectedChamber={selectedChamber}
                        setSelectedChamber={setSelectedChamber}
                        votingPowerLoading={votingPowerLoading}
                        showPartyAffiliation={showPartyAffiliation}
                        setShowPartyAffiliation={setShowPartyAffiliation}
                        showGerrymandering={showGerrymandering}
                        setShowGerrymandering={setShowGerrymandering}
                        showTopicHeatmap={showTopicHeatmap}
                        setShowTopicHeatmap={setShowTopicHeatmap}
                        showRepHeatmap={showRepHeatmap}
                        setShowRepHeatmap={setShowRepHeatmap}
                        showDistrictBorders={showDistrictBorders}
                        setShowDistrictBorders={setShowDistrictBorders}
                        partyDataLoading={partyDataLoading}
                        gerryDataLoading={gerryDataLoading}
                        topicDataLoading={topicDataLoading}
                        repDataLoading={repDataLoading}
                        onExit={() => setIsFullScreen(false)}
                    />
                ) : undefined
            }
        />
    );

    return (
        <AnimatedSection>
            {!isFullScreen && (
            <div className="space-y-6">
                <Card className="shadow-lg">
                    <CardHeader className="pb-3 md:pb-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="font-headline text-lg md:text-xl"><span className="hidden sm:inline">Interactive Dashboard</span></CardTitle>
                                <CardDescription className="text-xs md:text-sm"><span className="hidden sm:inline">Explore legislative activity, representatives, and policy trends across the United States.</span><span className="sm:hidden">Explore legislative activity and trends.</span></CardDescription>
                            </div>
                            <div className="flex items-center space-x-2">
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
                        {mapMode === 'voting-power' && (
                            <div className="space-y-2 md:space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <h4 className="font-semibold text-xs md:text-sm"><span className="hidden sm:inline">Congressional Chamber</span><span className="sm:hidden">Chamber</span></h4>
                                        <p className="text-xs text-muted-foreground"><span className="hidden sm:inline">Select House or Senate to compare voting power</span><span className="sm:hidden">House vs Senate voting power</span></p>
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-xs font-medium">Select Chamber:</label>
                                    <select 
                                        value={selectedChamber} 
                                        onChange={(e) => setSelectedChamber(e.target.value as 'house' | 'senate')} 
                                        className="w-full text-xs border rounded px-2 py-1 bg-background" 
                                        disabled={votingPowerLoading}
                                    >
                                        <option value="house">House of Representatives</option>
                                        <option value="senate">U.S. Senate</option>
                                    </select>
                                </div>
                                {votingPowerLoading && (
                                    <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
                                        <span>Loading voting power data...</span>
                                    </div>
                                )}
                                {votingPowerError && (
                                    <div className="text-xs text-red-500">Error loading voting power data: {votingPowerError}</div>
                                )}
                                {!votingPowerLoading && Object.keys(votingPowerData).length > 0 && (
                                    <div className="space-y-2">
                                        <h5 className="font-medium text-xs">Voting Power Scale</h5>
                                        <div className="w-full">
                                            <div className="h-4 rounded-sm" style={votingPowerLegendStyle}></div>
                                            <div className="flex justify-between text-xs mt-1">
                                                {votingPowerLegendLabels.map((label, index) => (
                                                    <span key={index}>{label}</span>
                                                ))}
                                            </div>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Voting power relative to Maryland baseline. Darker = higher per-capita influence in {selectedChamber === 'house' ? 'House' : 'Senate'}.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}
                        {(mapMode === 'congressional-districts' || mapMode === 'state-upper-districts' || mapMode === 'state-lower-districts') && (showPartyAffiliation || showGerrymandering || showTopicHeatmap || showRepHeatmap) && (
                            <div className="space-y-2 md:space-y-3">
                                <div className="flex items-center justify-between"><div className="space-y-1"><h4 className="font-semibold text-xs md:text-sm"><span className="hidden sm:inline">District Borders</span><span className="sm:hidden">Borders</span></h4><p className="text-xs text-muted-foreground"><span className="hidden sm:inline">Show or hide district boundary lines</span><span className="sm:hidden">Show boundary lines</span></p></div><Switch checked={showDistrictBorders} onCheckedChange={setShowDistrictBorders}/></div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
            )}
            {mapCanvas}
            {!isFullScreen && (
            <div className="space-y-6">
                {selectedDistrict && (
                    <div className="bg-card text-foreground border border-border rounded-lg shadow-lg p-3">
                        <div className="mb-2 flex items-center justify-between">
                            <h3 className="font-semibold text-base md:text-lg">District Info</h3>
                            <button type="button" className="ml-2 text-lg text-gray-400 hover:text-gray-700" onClick={() => { setSelectedDistrict(null); setDistrictPopupLatLng(null); if (isMobile) setTimeout(forceGarbageCollection, 100); }} aria-label="Close">×</button>
                        </div>
                        <RepresentativesResults representatives={districtReps} closestReps={[]} loading={districtLoading} error={districtError} showMap={false} userLocation={null} dataSource={null} pagination={undefined} onPageChange={() => {}} districtType={selectedDistrict.properties.chamber || selectedDistrict.properties.CHAMBER || ''} />
                    </div>
                )}
                {['congressional-districts', 'state-upper-districts', 'state-lower-districts'].includes(mapMode) ? (<div className="text-xs text-muted-foreground text-center w-full py-2"><div>{isMobile ? 'Tap anywhere on the map to see legislators' : 'Click anywhere on the map to see legislators representing that location.'}</div>{isMobile && mapMode === 'state-lower-districts' && (<div className="text-amber-600 mt-1">Large dataset - optimized for mobile performance</div>)}</div>) : (<div className="flex flex-col space-y-2 md:flex-row md:items-center md:justify-between md:space-y-0 text-xs text-muted-foreground"><div className="flex items-center space-x-2 md:space-x-4 overflow-x-auto"><div className="flex items-center space-x-1 flex-shrink-0"><div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-primary"></div><span className="whitespace-nowrap">High Activity</span></div><div className="flex items-center space-x-1 flex-shrink-0"><div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-primary/50"></div><span className="whitespace-nowrap"><span className="hidden sm:inline">Medium Activity</span><span className="sm:hidden">Medium</span></span></div><div className="flex items-center space-x-1 flex-shrink-0"><div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-primary/20"></div><span className="whitespace-nowrap"><span className="hidden sm:inline">Low Activity</span><span className="sm:hidden">Low</span></span></div></div><div className="text-xs hidden md:block">Click markers for detailed state information</div><div className="text-xs md:hidden">Tap markers for details</div></div>)}
                {selectedState && stateStats[selectedState] && (
                    <Card className="shadow-lg overflow-hidden">
                        <CardContent className="p-4 md:p-6">
                            <StateModeDetailPanel
                                mapMode={mapMode}
                                stateAbbr={selectedState}
                                state={stateStats[selectedState]}
                                stateDetails={stateDetails}
                                detailsLoading={detailsLoading}
                                activityLevel={getActivityLevel(selectedState)}
                                onViewDashboard={() => router.push(`/dashboard?stateAbbr=${selectedState}`)}
                                onViewLegislation={() => router.push(`/legislation?state=${encodeURIComponent(stateStats[selectedState].name)}&stateAbbr=${selectedState}`)}
                            />
                            <div className="mt-4 flex justify-end">
                                <Button variant="ghost" size="sm" onClick={() => setSelectedState(null)}>Close</Button>
                            </div>
                        </CardContent>
                    </Card>
                )}
                {selectedState && stateStats[selectedState] && mapMode === 'representatives' && (<ChamberMakeup state={selectedState} />)}
                <AnimatedSection>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-2 lg:grid-cols-4 lg:gap-4">
                        <Card><CardContent className="p-3 md:p-4"><div className="flex items-center space-x-2"><FileText className="h-4 w-4 md:h-5 md:w-5 text-blue-500 flex-shrink-0"/><div className="min-w-0"><p className="text-xs md:text-sm font-medium truncate"><span className="hidden sm:inline">Total Legislation</span><span className="sm:hidden">Total Bills</span></p><p className="text-lg md:text-2xl font-bold">{Object.values(stateStats).reduce((sum, state) => sum + state.legislationCount, 0).toLocaleString()}</p></div></div></CardContent></Card>
                        <Card><CardContent className="p-3 md:p-4"><div className="flex items-center space-x-2"><Users className="h-4 w-4 md:h-5 md:w-5 text-green-500 flex-shrink-0"/><div className="min-w-0"><p className="text-xs md:text-sm font-medium truncate"><span className="hidden sm:inline">State Legislators</span><span className="sm:hidden">Legislators</span></p><p className="text-lg md:text-2xl font-bold">{Object.values(stateStats).reduce((sum, state) => sum + state.activeRepresentatives, 0).toLocaleString()}</p></div></div></CardContent></Card>
                        <Card><CardContent className="p-3 md:p-4"><div className="flex items-center space-x-2"><TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-orange-500 flex-shrink-0"/><div className="min-w-0"><p className="text-xs md:text-sm font-medium truncate">Recent Activity</p><p className="text-lg md:text-2xl font-bold">{Object.values(stateStats).reduce((sum, state) => sum + state.recentActivity, 0).toLocaleString()}</p></div></div></CardContent></Card>
                        <Card><CardContent className="p-3 md:p-4"><div className="flex items-center space-x-2"><MapPin className="h-4 w-4 md:h-5 md:w-5 text-purple-500 flex-shrink-0"/><div className="min-w-0"><p className="text-xs md:text-sm font-medium truncate"><span className="hidden sm:inline">Jurisdictions Tracked</span><span className="sm:hidden">Jurisdictions</span></p><p className="text-lg md:text-2xl font-bold">{Object.keys(stateStats).length}</p></div></div></CardContent></Card>
                    </div>
                </AnimatedSection>
            </div>
            )}
        </AnimatedSection>
    );
};
