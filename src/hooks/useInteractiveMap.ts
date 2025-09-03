"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTheme } from 'next-themes';
import { StateData } from '@/types/jurisdictions';
import { FIPS_TO_ABBR } from '@/types/geo';

// Mobile detection utility
const isMobileDevice = (): boolean => {
    if (typeof window === 'undefined') return false;
    const userAgent = navigator.userAgent;
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    const hasSmallScreen = window.innerWidth <= 768;
    const isMobileUserAgent = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(userAgent);
    return isTouchDevice && (hasSmallScreen || isMobileUserAgent);
};

// Memory management utility for mobile
const checkMemoryPressure = (): boolean => {
    if (typeof window === 'undefined' || !('memory' in performance)) return false;
    const memInfo = (performance as any).memory;
    if (!memInfo) return false;
    const usedMemoryMB = memInfo.usedJSHeapSize / 1024 / 1024;
    const totalMemoryMB = memInfo.totalJSHeapSize / 1024 / 1024;
    const memoryPressure = usedMemoryMB / totalMemoryMB;
    return memoryPressure > 0.8; // 80% memory usage
};

// Force garbage collection (if available)
const forceGarbageCollection = () => {
    try {
        if ((window as any).gc) {
            (window as any).gc();
        }
    } catch (e) {
        // gc() not available in production, ignore
    }
};

// Performance optimization: Cache for API responses
const apiCache = new Map<string, { data: any; timestamp: number; ttl: number }>();

// Performance optimization: Debounce utility
const debounce = <T extends (...args: any[]) => any>(func: T, delay: number) => {
    let timeoutId: NodeJS.Timeout;
    return (...args: Parameters<T>) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
};

// Performance optimization: Cached fetch with TTL
const cachedFetch = async (url: string, ttl: number = 300000): Promise<any> => {
    const now = Date.now();
    const cached = apiCache.get(url);
    if (cached && (now - cached.timestamp) < cached.ttl) {
        return cached.data;
    }
    const response = await fetch(url, {
        cache: 'no-cache',
        headers: {
            'Cache-Control': 'no-cache',
            'Pragma': 'no-cache'
        }
    });
    if (!response.ok) {
        console.error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const data = await response.json();
    apiCache.set(url, { data, timestamp: now, ttl });
    return data;
};

export const useInteractiveMap = () => {
    const { resolvedTheme } = useTheme ? useTheme() : { resolvedTheme: 'light' };
    const [isClient, setIsClient] = useState(false);
    const [selectedState, setSelectedState] = useState<string | null>(null);
    const [selectedStatePopupCoords, setSelectedStatePopupCoords] = useState<[number, number] | null>(null);
    const [mapMode, setMapMode] = useState<string>('legislation');
    const [stateStats, setStateStats] = useState<Record<string, StateData>>({});
    const [stateDetails, setStateDetails] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();
    const [districtGeoJson, setDistrictGeoJson] = useState<any>(null);
    const [districtLoading, setDistrictLoading] = useState(false);
    const [districtError, setDistrictError] = useState<string | null>(null);
    const [selectedDistrict, setSelectedDistrict] = useState<any>(null);
    const [districtReps, setDistrictReps] = useState<any[]>([]);
    const [districtPopupLatLng, setDistrictPopupLatLng] = useState<any>(null);
    const mapRef = useRef<any>(null);
    const [showPartyAffiliation, setShowPartyAffiliation] = useState<boolean>(false);
    const [districtPartyMapping, setDistrictPartyMapping] = useState<Record<string, string>>({});
    const [partyDataLoading, setPartyDataLoading] = useState<boolean>(false);
    const [partyDataError, setPartyDataError] = useState<string | null>(null);
    const [showGerrymandering, setShowGerrymandering] = useState<boolean>(false);
    const [gerryScores, setGerryScores] = useState<Record<string, number>>({});
    const [gerryDataLoading, setGerryDataLoading] = useState<boolean>(false);
    const [gerryDataError, setGerryDataError] = useState<string | null>(null);
    const [showTopicHeatmap, setShowTopicHeatmap] = useState<boolean>(false);
    const [topicScores, setTopicScores] = useState<Record<string, number>>({});
    const [availableTopics, setAvailableTopics] = useState<string[]>([]);
    const [selectedTopic, setSelectedTopic] = useState<string>('all');
    const [topicDataLoading, setTopicDataLoading] = useState<boolean>(false);
    const [topicDataError, setTopicDataError] = useState<string | null>(null);
    const [showRepHeatmap, setShowRepHeatmap] = useState<boolean>(false);
    const [repScores, setRepScores] = useState<Record<string, number>>({});
    const [repDetails, setRepDetails] = useState<Record<string, any>>({});
    const [selectedRepMetric, setSelectedRepMetric] = useState<string>('sponsored_bills');
    const [repDataLoading, setRepDataLoading] = useState<boolean>(false);
    const [repDataError, setRepDataError] = useState<string | null>(null);
    const [availableRepMetrics] = useState<string[]>(['sponsored_bills', 'recent_activity', 'enacted_bills', 'enacted_recent_activity']);
    const [showEnactedOnly, setShowEnactedOnly] = useState<boolean>(false);
    const [showDistrictBorders, setShowDistrictBorders] = useState<boolean>(true);
    const [isMobile, setIsMobile] = useState<boolean>(false);
    const [mapModeTransitioning, setMapModeTransitioning] = useState<boolean>(false);
    const [memoryPressure, setMemoryPressure] = useState<boolean>(false);
    const cleanupTimeoutRef = useRef<NodeJS.Timeout | null>(null);
    const [isFullScreen, setIsFullScreen] = useState<boolean>(false);

    const fetchMapData = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/dashboard/map-data');
            if (!response.ok) console.error('Failed to fetch map data');
            const result = await response.json();
            if (result.success) setStateStats(result.data);
            else console.error(result.error || 'Unknown error');
        } catch (error) {
            console.error('Error fetching map data:', error);
            setError('Failed to load map data. Please try again.');
            setStateStats({});
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setIsClient(true);
        fetchMapData();
        const checkMobileAndMemory = () => {
            const mobile = isMobileDevice();
            setIsMobile(mobile);
            if (mobile) {
                const pressure = checkMemoryPressure();
                setMemoryPressure(pressure);
            }
        };
        checkMobileAndMemory();
        let memoryMonitorInterval: NodeJS.Timeout | null = null;
        if (isMobileDevice()) {
            memoryMonitorInterval = setInterval(checkMobileAndMemory, 5000);
        }
        window.addEventListener('resize', checkMobileAndMemory);
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape' && isFullScreen) {
                setIsFullScreen(false);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('resize', checkMobileAndMemory);
            window.removeEventListener('keydown', handleKeyDown);
            if (memoryMonitorInterval) {
                clearInterval(memoryMonitorInterval);
            }
        };
    }, [isFullScreen]);

    const handleMapModeChange = useCallback(async (newMode: string) => {
        try {
            setMapModeTransitioning(true);
            if (isMobile && newMode === 'state-lower-districts') {
                forceGarbageCollection();
                if (checkMemoryPressure()) {
                    setMemoryPressure(true);
                }
            }
            setSelectedDistrict(null);
            setDistrictPopupLatLng(null);
            setDistrictReps([]);
            setDistrictPartyMapping({});
            setGerryScores({});
            setTopicScores({});
            setRepScores({});
            if (cleanupTimeoutRef.current) {
                clearTimeout(cleanupTimeoutRef.current);
                cleanupTimeoutRef.current = null;
            }
            if (isMobile && ['state-lower-districts', 'state-upper-districts'].includes(mapMode)) {
                cleanupTimeoutRef.current = setTimeout(() => {
                    forceGarbageCollection();
                    setMemoryPressure(false);
                }, 1000);
            }
            setMapMode(newMode);
        } catch (error) {
            console.error('[InteractiveMap] Error changing map mode:', error);
        } finally {
            setMapModeTransitioning(false);
        }
    }, [isMobile, mapMode]);

    const fetchStateDetails = async (stateAbbr: string) => {
        setDetailsLoading(true);
        try {
            const response = await fetch(`/api/dashboard/state/${stateAbbr}`);
            if (!response.ok) console.error('Failed to fetch state details');
            const result = await response.json();
            if (result.success) setStateDetails(result.data);
            else console.error(result.error || 'Unknown error');
        } catch (error) {
            console.error('Error fetching state details:', error);
            setStateDetails(null);
        } finally {
            setDetailsLoading(false);
        }
    };

    const fetchDistrictGerryData = useCallback(async (districtType: string) => {
        setGerryDataLoading(true);
        setGerryDataError(null);
        try {
            const url = `/api/dashboard/gerry-index-optimized?type=${districtType}`;
            const result = await cachedFetch(url, 600000);
            if (result.success && result.scores) setGerryScores(result.scores);
            else console.error(result.error || 'No gerrymandering data returned');
        } catch (error) {
            console.error('Error fetching gerrymandering data:', error);
            setGerryDataError(error instanceof Error ? error.message : 'Unknown error');
            setGerryScores({});
        } finally {
            setGerryDataLoading(false);
        }
    }, []);

    const fetchDistrictPartyData = useCallback(debounce(async (chamber: string) => {
        setPartyDataLoading(true);
        setPartyDataError(null);
        setDistrictPartyMapping({});
        try {
            const url = `/api/dashboard/representatives/${chamber}`;
            const result = await cachedFetch(url, 300000);
            if (result.representatives) {
                const mapping: Record<string, string> = {};
                const expectedChamber = chamber === 'us_house' ? 'House of Representatives' : chamber === 'state_upper' ? 'State Senate' : chamber === 'state_lower' ? 'State House' : '';
                const filteredReps = result.representatives.filter((rep: any) => rep.chamber === expectedChamber);
                filteredReps.forEach((rep: any) => {
                    const normalizedParty = normalizePartyName(rep.party || 'Unknown');
                    const districtIds = new Set<string>();
                    if (rep.map_boundary?.district) districtIds.add(rep.map_boundary.district);
                    if (rep.map_boundary?.geoidfq) districtIds.add(rep.map_boundary.geoidfq);
                    if (rep.district) districtIds.add(rep.district.toString());
                    const altDistrict = rep.current_role?.district || rep.current_role?.division_id?.split(':').pop();
                    if (altDistrict) districtIds.add(altDistrict.toString());
                    if (rep.state && rep.district) districtIds.add(`${rep.state}-${rep.district}`);
                    if (chamber === 'us_house' && rep.state && (rep.district === null || rep.district === undefined)) {
                        const atLargeGeoids: Record<string, string> = { 'Alaska': '0200', 'Delaware': '1000', 'Montana': '3000', 'North Dakota': '3800', 'South Dakota': '4600', 'Vermont': '5000', 'Wyoming': '5600' };
                        const geoid = atLargeGeoids[rep.state];
                        if (geoid) districtIds.add(geoid);
                    }
                    districtIds.forEach(id => { mapping[id] = normalizedParty; });
                    const isNebraska = rep.jurisdiction?.name === 'Nebraska' || rep.current_role?.division_id?.includes('/state:ne/') || rep.state === 'Nebraska' || rep.state === 'NE';
                    if (isNebraska && chamber === 'state_upper') {
                        if (rep.current_role?.division_id) {
                            const divisionMatch = rep.current_role.division_id.match(/\/state:ne\/sldu:(\d+)/);
                            if (divisionMatch) {
                                const districtNum = divisionMatch[1];
                                const nebraskaIds = [districtNum, `31${districtNum.padStart(3, '0')}`, `3100${districtNum.padStart(2, '0')}`, `NE-${districtNum}`, `Nebraska-${districtNum}`, `31${districtNum}`, `ne${districtNum}`];
                                nebraskaIds.forEach(id => { mapping[id] = normalizedParty; });
                            }
                        }
                    }
                });
                setDistrictPartyMapping(mapping);
            } else {
                console.error('No representatives data returned');
            }
        } catch (error) {
            console.error('Error fetching district party data:', error);
            setPartyDataError(error instanceof Error ? error.message : 'Unknown error');
            setDistrictPartyMapping({});
        } finally {
            setPartyDataLoading(false);
        }
    }, 500), []);

    useEffect(() => {
        const isDistrictMode = ['congressional-districts', 'state-upper-districts', 'state-lower-districts'].includes(mapMode);
        if (isDistrictMode && showPartyAffiliation) {
            const chamber = DISTRICT_TO_CHAMBER[mapMode];
            if (chamber) {
                setDistrictPartyMapping({});
                fetchDistrictPartyData(chamber);
            }
        } else {
            setDistrictPartyMapping({});
        }
    }, [mapMode, showPartyAffiliation, fetchDistrictPartyData]);

    useEffect(() => {
        const isDistrictMode = ['congressional-districts', 'state-upper-districts', 'state-lower-districts'].includes(mapMode);
        if (isDistrictMode && showGerrymandering) {
            fetchDistrictGerryData(mapMode);
        } else {
            setGerryScores({});
        }
    }, [mapMode, showGerrymandering, fetchDistrictGerryData]);

    const handleStateClick = (stateAbbr: string, coords?: [number, number]) => {
        setSelectedState(stateAbbr);
        if (coords) {
            setSelectedStatePopupCoords(coords);
        } else {
            setSelectedStatePopupCoords(null);
        }
        setDetailsLoading(true);
        setStateDetails(null);
        fetchStateDetails(stateAbbr);
    };

    const fetchTopicHeatmapData = async (districtType: string, selectedTopic: string, enactedOnly: boolean = false) => {
        setTopicDataLoading(true);
        setTopicDataError(null);
        setTopicScores({});
        try {
            const url = `/api/dashboard/topic-heatmap?type=${districtType}&topic=${selectedTopic}&enacted=${enactedOnly}`;
            const result = await cachedFetch(url, 600000);
            if (result.success && result.scores) {
                setTopicScores(result.scores);
                if (result.availableTopics) {
                    setAvailableTopics(result.availableTopics);
                }
            } else {
                console.error(result.error || 'No topic data returned');
            }
        } catch (error) {
            console.error('Error fetching topic heatmap data:', error);
            setTopicDataError(error instanceof Error ? error.message : 'Unknown error');
            setTopicScores({});
        } finally {
            setTopicDataLoading(false);
        }
    };

    const fetchRepresentativeHeatmapData = async (districtType: string, metric: string) => {
        setRepDataLoading(true);
        setRepDataError(null);
        setRepScores({});
        setRepDetails({});
        try {
            const url = `/api/dashboard/representative-heatmap?type=${districtType}&metric=${metric}`;
            const result = await cachedFetch(url, 600000);
            if (result.success && result.scores) {
                setRepScores(result.scores);
                if (result.details) {
                    setRepDetails(result.details);
                }
            } else {
                console.error(result.error || 'No representative data returned');
            }
        } catch (error) {
            console.error('Error fetching representative heatmap data:', error);
            setRepDataError(error instanceof Error ? error.message : 'Unknown error');
            setRepScores({});
        } finally {
            setRepDataLoading(false);
        }
    };

    const memoizedFetchTopicHeatmapData = useCallback(debounce(fetchTopicHeatmapData, 500), []);
    const memoizedFetchRepresentativeHeatmapData = useCallback(debounce(fetchRepresentativeHeatmapData, 500), []);

    useEffect(() => {
        if (showTopicHeatmap) {
            memoizedFetchTopicHeatmapData(mapMode, selectedTopic, showEnactedOnly);
        } else {
            setTopicScores({});
        }
    }, [showTopicHeatmap, mapMode, memoizedFetchTopicHeatmapData, selectedTopic, showEnactedOnly]);

    useEffect(() => {
        if (showRepHeatmap) {
            const districtType = mapMode;
            memoizedFetchRepresentativeHeatmapData(districtType, selectedRepMetric);
        } else {
            setRepScores({});
        }
    }, [showRepHeatmap, mapMode, selectedRepMetric, memoizedFetchRepresentativeHeatmapData]);

    const onDistrictClickGL = async (feature: any, lngLat: { lng: number, lat: number }) => {
        const isDistrictMode = ['congressional-districts', 'state-upper-districts', 'state-lower-districts'].includes(mapMode);
        if (isFullScreen && isDistrictMode) return;
        try {
            setSelectedDistrict(feature);
            setDistrictPopupLatLng(lngLat);
            setDistrictReps([]);
            let state = feature.properties.state || feature.properties.STATE || feature.properties.STATEFP || '';
            if (!state && feature.properties.STATEFP) {
                state = FIPS_TO_ABBR[feature.properties.STATEFP] || '';
            } else if (/^\d{2}$/.test(state)) {
                state = FIPS_TO_ABBR[state] || '';
            }
            const url = `/api/civic?lat=${encodeURIComponent(lngLat.lat)}&lng=${encodeURIComponent(lngLat.lng)}&state=${encodeURIComponent(state)}`;
            const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
            let reps = [];
            if (resp.ok) {
                const data = await resp.json();
                if (data && data.representatives) {
                    reps = data.representatives;
                }
            }
            setDistrictReps(reps);
        } catch (error) {
            console.error('[InteractiveMap] Error in district click handler:', error);
            setDistrictReps([]);
        }
    };

    return {
        resolvedTheme,
        isClient,
        selectedState,
        setSelectedState,
        selectedStatePopupCoords,
        setSelectedStatePopupCoords,
        mapMode,
        setMapMode,
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
    };
};

// Party normalization function
const normalizePartyName = (party: string): string => {
    if (!party) return 'Unknown';
    const lowerParty = party.toLowerCase();
    if (lowerParty.includes('democratic') || lowerParty.includes('democrat')) return 'Democratic';
    if (lowerParty.includes('republican') || lowerParty.includes('conservative')) return 'Republican';
    if (lowerParty.includes('nonpartisan')) return 'Nonpartisan';
    if (lowerParty.includes('independent') || lowerParty.includes('forward') || lowerParty.includes('other') || lowerParty.includes('libertarian') || lowerParty.includes('green')) return 'Independent';
    return 'Unknown';
};

const DISTRICT_TO_CHAMBER: Record<string, string> = {
    'congressional-districts': 'us_house',
    'state-upper-districts': 'state_upper',
    'state-lower-districts': 'state_lower',
};
