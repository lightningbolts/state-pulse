"use client";

import * as React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Calendar, FileText, MapPin, TrendingUp, Users, Maximize, Minimize } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { StateData } from '@/types/jurisdictions';
import {FIPS_TO_ABBR, MapMode} from "@/types/geo";
import { AnimatedSection } from "@/components/ui/AnimatedSection";
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useTheme } from 'next-themes';
import { DistrictMapGL } from './DistrictMapGL';
import { RepresentativesResults } from "./RepresentativesResults";
import { ChamberMakeup } from "./ChamberMakeup";
import MapLibreMap, { Marker as MapLibreMarker, Popup as MapLibrePopup, MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

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

    return memoryPressure > 0.8; // 80% memory usage indicates pressure
};

// Force garbage collection (if available)
const forceGarbageCollection = () => {
    try {
        if (window.gc) {
            window.gc();
        }
    } catch (e) {
        // gc() not available in production, ignore
    }
};

// Performance optimization: Create stable references for constant data
const getDistrictGeoJsonUrl = (mapMode: string, isMobile: boolean): string => {
  if (mapMode === 'state-lower-districts') {
    return isMobile
      ? '/districts/state-lower-districts-simplified.topojson'
      : '/districts/state-lower-districts.topojson';
  }
  const DISTRICT_GEOJSON_URLS: Record<string, string> = {
    'congressional-districts': '/districts/congressional-districts.topojson',
    'state-upper-districts': '/districts/state-upper-districts.topojson',
    // 'state-lower-districts' handled above
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

const DISTRICT_TO_CHAMBER: Record<string, string> = {
  'congressional-districts': 'us_house',
  'state-upper-districts': 'state_upper',
  'state-lower-districts': 'state_lower',
};

// Performance optimization: Memoized gerrymandering color function
const getGerrymanderingColor = (score: number): string => {
  const invertedScore = 1 - score;
  if (invertedScore >= 0.7) return '#d93706';
  if (invertedScore >= 0.55) return '#f5ce0b';
  if (invertedScore >= 0.4) return '#8cfb24';
  if (invertedScore >= 0.25) return '#60e8fa';
  return '#3b82f6';
};

// Performance optimization: Memoized topic heatmap color function with gradual spectrum
const getTopicHeatmapColor = (score: number): string => {
  // Create a smooth gradient from light to dark blue
  // Light means low activity, dark means high activity
  if (score === 0) return '#f8f9fa'; // Very light gray for no data

  // Ensure score is between 0 and 1
  const normalizedScore = Math.max(0, Math.min(1, score));

  // Create a more dynamic gradient - use RGB interpolation for smoother transitions
  const lightBlue = { r: 173, g: 216, b: 230 }; // Light blue
  const darkBlue = { r: 25, g: 25, b: 112 }; // Dark blue

  const r = Math.round(lightBlue.r + (darkBlue.r - lightBlue.r) * normalizedScore);
  const g = Math.round(lightBlue.g + (darkBlue.g - lightBlue.g) * normalizedScore);
  const b = Math.round(lightBlue.b + (darkBlue.b - lightBlue.b) * normalizedScore);

  return `rgb(${r}, ${g}, ${b})`;
};

// Performance optimization: Memoized representative heatmap color function with gradual spectrum
const getRepHeatmapColor = (score: number): string => {
  // Create a smooth gradient from light to dark purple
  // Light means low activity, dark means high activity
  if (score === 0) return '#f8f9fa'; // Very light gray for no data

  // Ensure score is between 0 and 1
  const normalizedScore = Math.max(0, Math.min(1, score));

  // Create a more dynamic gradient - use RGB interpolation for smoother transitions
  const lightPurple = { r: 221, g: 160, b: 221 }; // Light purple/plum
  const darkPurple = { r: 75, g: 0, b: 130 }; // Dark purple/indigo

  const r = Math.round(lightPurple.r + (darkPurple.r - lightPurple.r) * normalizedScore);
  const g = Math.round(lightPurple.g + (darkPurple.g - lightPurple.g) * normalizedScore);
  const b = Math.round(lightPurple.b + (darkPurple.b - lightPurple.b) * normalizedScore);

  return `rgb(${r}, ${g}, ${b})`;
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
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  apiCache.set(url, { data, timestamp: now, ttl });

  return data;
};

// Party normalization function
const normalizePartyName = (party: string): string => {
  if (!party) return 'Unknown';

  const lowerParty = party.toLowerCase();

  // Democratic variants
  if (lowerParty.includes('democratic') || lowerParty.includes('democrat')) {
    return 'Democratic';
  }

  // Republican variants
  if (lowerParty.includes('republican') || lowerParty.includes('conservative')) {
    return 'Republican';
  }

  // Nonpartisan category
  if (lowerParty.includes('nonpartisan')) {
    return 'Nonpartisan';
  }

  // Independent variants (including other parties)
  if (lowerParty.includes('independent') ||
      lowerParty.includes('forward') ||
      lowerParty.includes('other') ||
      lowerParty.includes('libertarian') ||
      lowerParty.includes('green')) {
    return 'Independent';
  }

  // Default to Unknown for unrecognized parties
  return 'Unknown';
};

const DEFAULT_POSITION: [number, number] = [39.8283, -98.5795];
const DEFAULT_ZOOM = 4;

const mapModes: MapMode[] = [
    {
        id: 'legislation',
        label: 'Legislation Activity',
        description: 'View states by legislative activity and bill counts',
        icon: FileText
    },
    {
        id: 'representatives',
        label: 'Representatives',
        description: 'Explore representative density and activity',
        icon: Users
    },
    {
        id: 'trends',
        label: 'Trending Topics',
        description: 'See what policy areas are most active',
        icon: TrendingUp
    },
    {
        id: 'recent',
        label: 'Recent Activity',
        description: 'Latest legislative developments',
        icon: Calendar
    },
    {
        id: 'congressional-districts',
        label: 'Congressional Districts',
        description: 'View all U.S. congressional districts',
        icon: MapPin
    },
    {
        id: 'state-upper-districts',
        label: 'State Upper Districts',
        description: 'View all state senate (upper chamber) districts',
        icon: MapPin
    },
    {
        id: 'state-lower-districts',
        label: 'State Lower Districts',
        description: 'View all state house (lower chamber) districts',
        icon: MapPin
    }
];

// Performance optimization: Memoize component to prevent unnecessary re-renders
export const InteractiveMap = React.memo(() => {
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
    const [selectedDistrict, setSelectedDistrict] = useState<any>(null); // Store clicked district feature
    const [districtReps, setDistrictReps] = useState<any[]>([]); // Store reps for selected district
    const [districtPopupLatLng, setDistrictPopupLatLng] = useState<any>(null); // Popup position
    const mapRef = useRef<any>(null);

    const [showPartyAffiliation, setShowPartyAffiliation] = useState<boolean>(false);
    const [districtPartyMapping, setDistrictPartyMapping] = useState<Record<string, string>>({});
    const [partyDataLoading, setPartyDataLoading] = useState<boolean>(false);
    const [partyDataError, setPartyDataError] = useState<string | null>(null);

    // Gerrymandering state
    const [showGerrymandering, setShowGerrymandering] = useState<boolean>(false);
    const [gerryScores, setGerryScores] = useState<Record<string, number>>({});
    const [gerryDataLoading, setGerryDataLoading] = useState<boolean>(false);
    const [gerryDataError, setGerryDataError] = useState<string | null>(null);

    // Topic heatmap state
    const [showTopicHeatmap, setShowTopicHeatmap] = useState<boolean>(false);
    const [topicScores, setTopicScores] = useState<Record<string, number>>({});
    const [availableTopics, setAvailableTopics] = useState<string[]>([]);
    const [selectedTopic, setSelectedTopic] = useState<string>('all');
    const [topicDataLoading, setTopicDataLoading] = useState<boolean>(false);
    const [topicDataError, setTopicDataError] = useState<string | null>(null);

    // Representative heatmap state
    const [showRepHeatmap, setShowRepHeatmap] = useState<boolean>(false);
    const [repScores, setRepScores] = useState<Record<string, number>>({});
    const [repDetails, setRepDetails] = useState<Record<string, any>>({});
    const [selectedRepMetric, setSelectedRepMetric] = useState<string>('sponsored_bills');
    const [repDataLoading, setRepDataLoading] = useState<boolean>(false);
    const [repDataError, setRepDataError] = useState<string | null>(null);
    const [availableRepMetrics] = useState<string[]>(['sponsored_bills', 'recent_activity', 'enacted_bills', 'enacted_recent_activity']);

    // Enacted legislation filtering state
    const [showEnactedOnly, setShowEnactedOnly] = useState<boolean>(false);

    // District border visibility state
    const [showDistrictBorders, setShowDistrictBorders] = useState<boolean>(true);

    // Mobile optimization state
    const [isMobile, setIsMobile] = useState<boolean>(false);
    const [mapModeTransitioning, setMapModeTransitioning] = useState<boolean>(false);
    const [memoryPressure, setMemoryPressure] = useState<boolean>(false);
    const cleanupTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Full screen state
    const [isFullScreen, setIsFullScreen] = useState<boolean>(false);

    useEffect(() => {
        setIsClient(true);
        fetchMapData();
        
        // Detect mobile device and monitor memory
        const checkMobileAndMemory = () => {
            const mobile = isMobileDevice();
            setIsMobile(mobile);

            if (mobile) {
                const pressure = checkMemoryPressure();
                setMemoryPressure(pressure);
            }
        };
        
        checkMobileAndMemory();

        // Monitor memory pressure on mobile devices
        let memoryMonitorInterval: NodeJS.Timeout | null = null;
        if (isMobileDevice()) {
            memoryMonitorInterval = setInterval(checkMobileAndMemory, 5000); // Check every 5 seconds
        }

        // Re-check on window resize (for responsive testing)
        window.addEventListener('resize', checkMobileAndMemory);

        // Handle Escape key to exit full screen
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

    // Map mode change handler with mobile-specific safety checks
    const handleMapModeChange = useCallback(async (newMode: string) => {
        try {
            setMapModeTransitioning(true);

            // Mobile safety check for large datasets
            if (isMobile && newMode === 'state-lower-districts') {
                console.log('[InteractiveMap] Mobile safety check for state-lower-districts');

                // Force garbage collection before loading large dataset
                forceGarbageCollection();

                // Check memory pressure
                if (checkMemoryPressure()) {
                    console.warn('[InteractiveMap] High memory pressure detected on mobile, implementing additional optimizations');
                    setMemoryPressure(true);
                }
            }

            // Clear existing overlays and data to free memory
            setSelectedDistrict(null);
            setDistrictPopupLatLng(null);
            setDistrictReps([]);
            setDistrictPartyMapping({});
            setGerryScores({});
            setTopicScores({});
            setRepScores({});
            
            // Clear any pending cleanup timeouts
            if (cleanupTimeoutRef.current) {
                clearTimeout(cleanupTimeoutRef.current);
                cleanupTimeoutRef.current = null;
            }

            // Additional cleanup for mobile devices when switching from large datasets
            if (isMobile && ['state-lower-districts', 'state-upper-districts'].includes(mapMode)) {
                // Schedule garbage collection
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

    const fetchMapData = async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await fetch('/api/dashboard/map-data');
            if (!response.ok) {
                throw new Error('Failed to fetch map data');
            }
            const result = await response.json();
            if (result.success) {
                setStateStats(result.data);
            } else {
                throw new Error(result.error || 'Unknown error');
            }
        } catch (error) {
            console.error('Error fetching map data:', error);
            setError('Failed to load map data. Please try again.');
            setStateStats({});
        } finally {
            setLoading(false);
        }
    };

    const fetchStateDetails = async (stateAbbr: string) => {
        setDetailsLoading(true);
        try {
            const response = await fetch(`/api/dashboard/state/${stateAbbr}`);
            if (!response.ok) {
                throw new Error('Failed to fetch state details');
            }
            const result = await response.json();
            if (result.success) {
                setStateDetails(result.data);
            } else {
                throw new Error(result.error || 'Unknown error');
            }
        } catch (error) {
            console.error('Error fetching state details:', error);
            setStateDetails(null);
        } finally {
            setDetailsLoading(false);
        }
    };

    // Performance optimization: Optimized gerrymandering data fetching with caching
    const fetchDistrictGerryData = useCallback(async (districtType: string) => {
        setGerryDataLoading(true);
        setGerryDataError(null);
        try {
            const url = `/api/dashboard/gerry-index-optimized?type=${districtType}`;
            const result = await cachedFetch(url, 600000); // 10 minutes cache

            if (result.success && result.scores) {
                setGerryScores(result.scores);
            } else {
                throw new Error(result.error || 'No gerrymandering data returned');
            }
        } catch (error) {
            console.error('Error fetching gerrymandering data:', error);
            setGerryDataError(error instanceof Error ? error.message : 'Unknown error');
            setGerryScores({});
        } finally {
            setGerryDataLoading(false);
        }
    }, []);

    // Performance optimization: Debounced and optimized party data fetching
    const fetchDistrictPartyData = useCallback(debounce(async (chamber: string) => {
        setPartyDataLoading(true);
        setPartyDataError(null);
        setDistrictPartyMapping({});

        try {
            const url = `/api/dashboard/representatives/${chamber}`;
            const result = await cachedFetch(url, 300000); // 5 minutes cache

            if (result.representatives) {
                // Performance optimization: Use a more efficient mapping approach
                const mapping: Record<string, string> = {};
                const expectedChamber = chamber === 'us_house' ? 'House of Representatives' :
                                       chamber === 'state_upper' ? 'State Senate' :
                                       chamber === 'state_lower' ? 'State House' : '';

                // Filter and process representatives more efficiently
                const filteredReps = result.representatives.filter((rep: any) =>
                    rep.chamber === expectedChamber
                );

                // Batch process district mapping to reduce iterations
                const districtKeys = ['map_boundary.district', 'map_boundary.geoidfq', 'district', 'current_role.district'];

                filteredReps.forEach((rep: any) => {
                    const normalizedParty = normalizePartyName(rep.party || 'Unknown');

                    // Efficiently extract all possible district identifiers
                    const districtIds = new Set<string>();

                    if (rep.map_boundary?.district) districtIds.add(rep.map_boundary.district);
                    if (rep.map_boundary?.geoidfq) districtIds.add(rep.map_boundary.geoidfq);
                    if (rep.district) districtIds.add(rep.district.toString());

                    const altDistrict = rep.current_role?.district ||
                                      rep.current_role?.division_id?.split(':').pop();
                    if (altDistrict) districtIds.add(altDistrict.toString());

                    if (rep.state && rep.district) {
                        districtIds.add(`${rep.state}-${rep.district}`);
                    }

                    // Handle at-large districts for congressional
                    if (chamber === 'us_house' && rep.state && (rep.district === null || rep.district === undefined)) {
                        const atLargeGeoids: Record<string, string> = {
                            'Alaska': '0200', 'Delaware': '1000', 'Montana': '3000',
                            'North Dakota': '3800', 'South Dakota': '4600',
                            'Vermont': '5000', 'Wyoming': '5600'
                        };
                        const geoid = atLargeGeoids[rep.state];
                        if (geoid) districtIds.add(geoid);
                    }

                    // Apply mapping for all district IDs
                    districtIds.forEach(id => {
                        mapping[id] = normalizedParty;
                    });

                    // Special handling for Nebraska - add additional district ID patterns
                    const isNebraska = rep.jurisdiction?.name === 'Nebraska' ||
                                      rep.current_role?.division_id?.includes('/state:ne/') ||
                                      rep.state === 'Nebraska' ||
                                      rep.state === 'NE';

                    if (isNebraska && chamber === 'state_upper') {
                        // Nebraska uses 'ne/sldu:XX' format in division_id
                        if (rep.current_role?.division_id) {
                            const divisionMatch = rep.current_role.division_id.match(/\/state:ne\/sldu:(\d+)/);
                            if (divisionMatch) {
                                const districtNum = divisionMatch[1];
                                // Add various possible Nebraska district ID formats
                                const nebraskaIds = [
                                    districtNum,
                                    `31${districtNum.padStart(3, '0')}`, // FIPS format: 31 + 3-digit district
                                    `3100${districtNum.padStart(2, '0')}`, // Alternative FIPS format
                                    `NE-${districtNum}`, // State-district format
                                    `Nebraska-${districtNum}`, // Full state name format
                                    `31${districtNum}`, // FIPS + district
                                    `ne${districtNum}`, // state abbrev + district
                                ];

                                // Apply all Nebraska-specific mappings
                                nebraskaIds.forEach(id => {
                                    mapping[id] = normalizedParty;
                                });

                                console.log(`[Nebraska] Mapped district ${districtNum} (${normalizedParty}) to IDs:`, nebraskaIds);
                            }
                        }
                    }
                });

                setDistrictPartyMapping(mapping);
            } else {
                throw new Error('No representatives data returned');
            }
        } catch (error) {
            console.error('Error fetching district party data:', error);
            setPartyDataError(error instanceof Error ? error.message : 'Unknown error');
            setDistrictPartyMapping({});
        } finally {
            setPartyDataLoading(false);
        }
    }, 500), []); // 500ms debounce

    // Effect to fetch party data when district map mode is selected and party affiliation is enabled
    useEffect(() => {
        const isDistrictMode = ['congressional-districts', 'state-upper-districts', 'state-lower-districts'].includes(mapMode);
        if (isDistrictMode && showPartyAffiliation) {
            const chamber = DISTRICT_TO_CHAMBER[mapMode];
            if (chamber) {
                // Clear existing mapping first
                setDistrictPartyMapping({});
                fetchDistrictPartyData(chamber);
            }
        } else {
            setDistrictPartyMapping({});
        }
    }, [mapMode, showPartyAffiliation]);

    // Effect to fetch gerrymandering data when district map mode is selected and gerrymandering is enabled
    useEffect(() => {
        const isDistrictMode = ['congressional-districts', 'state-upper-districts', 'state-lower-districts'].includes(mapMode);
        if (isDistrictMode && showGerrymandering) {
            fetchDistrictGerryData(mapMode);
        } else {
            setGerryScores({});
        }
    }, [mapMode, showGerrymandering]);

    const handleStateClick = (stateAbbr: string, coords?: [number, number]) => {
        // console.log('[handleStateClick] Clicked:', stateAbbr, coords);
        setSelectedState(stateAbbr);
        if (coords) {
            setSelectedStatePopupCoords(coords);
            // console.log('[handleStateClick] Setting popup coords:', coords);
        } else {
            setSelectedStatePopupCoords(null);
            // console.log('[handleStateClick] No coords provided');
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
            const result = await cachedFetch(url, 600000); // 10 minutes cache

            if (result.success && result.scores) {
                setTopicScores(result.scores);
                // Set available topics from API response
                if (result.availableTopics) {
                    setAvailableTopics(result.availableTopics);
                }
            } else {
                throw new Error(result.error || 'No topic data returned');
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
            const result = await cachedFetch(url, 600000); // 10 minutes cache

            if (result.success && result.scores) {
                setRepScores(result.scores);
                // Set details from API response
                if (result.details) {
                    setRepDetails(result.details);
                }
            } else {
                throw new Error(result.error || 'No representative data returned');
            }
        } catch (error) {
            console.error('Error fetching representative heatmap data:', error);
            setRepDataError(error instanceof Error ? error.message : 'Unknown error');
            setRepScores({});
        } finally {
            setRepDataLoading(false);
        }
    };

    // Performance optimization: Memoize topic and representative data fetching functions
    const memoizedFetchTopicHeatmapData = useCallback(debounce(fetchTopicHeatmapData, 500), []);
    const memoizedFetchRepresentativeHeatmapData = useCallback(debounce(fetchRepresentativeHeatmapData, 500), []);

    // Effect to fetch topic heatmap data when topic heatmap is enabled
    useEffect(() => {
        if (showTopicHeatmap) {
            const districtType = mapMode;
            memoizedFetchTopicHeatmapData(districtType, selectedTopic, showEnactedOnly);
        } else {
            setTopicScores({});
        }
    }, [showTopicHeatmap, mapMode, memoizedFetchTopicHeatmapData, selectedTopic, showEnactedOnly]);

    // Effect to fetch representative heatmap data when representative heatmap is enabled
    useEffect(() => {
        if (showRepHeatmap) {
            const districtType = mapMode;
            const metric = selectedRepMetric;
            memoizedFetchRepresentativeHeatmapData(districtType, metric);
        } else {
            setRepScores({});
        }
    }, [showRepHeatmap, mapMode, selectedRepMetric, memoizedFetchRepresentativeHeatmapData]);

    const getStateColor = useCallback((stateAbbr: string) => {
        const state = stateStats[stateAbbr];
        if (!state) return '#e0e0e0';

        switch (mapMode) {
            case 'legislation':
                const intensity = Math.min(state.legislationCount / 3000, 1);
                // Use consistent primary color scheme that matches legend
                if (intensity >= 0.7) return 'hsl(var(--primary))'; // High activity
                if (intensity >= 0.3) return 'hsl(var(--primary) / 0.5)'; // Medium activity
                return 'hsl(var(--primary) / 0.2)'; // Low activity
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

    // Memoize marker sizes/colors for MapLibre
    const memoizedMarkers = useMemo(() => {
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
                        <CardTitle className="font-headline text-2xl flex items-center">
                            <MapPin className="mr-3 h-7 w-7"/>
                            Interactive Dashboard
                        </CardTitle>
                        <CardDescription>
                            Explore legislative activity, representatives, and policy trends across the
                            United States.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div
                            className="h-[500px] w-full rounded-md overflow-hidden border flex items-center justify-center bg-muted">
                            <p className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary">
                                <span className="sr-only">Loading map...</span>
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </AnimatedSection>
        );
    }

    // Handler for district click (for MapLibre GL) with error handling
    const onDistrictClickGL = async (feature: any, lngLat: {lng: number, lat: number}) => {
        try {
            setSelectedDistrict(feature);
            setDistrictPopupLatLng(lngLat);
            setDistrictReps([]); // Clear while loading
            
            let state = feature.properties.state || feature.properties.STATE || feature.properties.STATEFP || '';
            if (!state && feature.properties.STATEFP) {
                state = FIPS_TO_ABBR[feature.properties.STATEFP] || '';
            } else if (/^\d{2}$/.test(state)) {
                state = FIPS_TO_ABBR[state] || '';
            }
            
            const url = `/api/civic?lat=${encodeURIComponent(lngLat.lat)}&lng=${encodeURIComponent(lngLat.lng)}&state=${encodeURIComponent(state)}`;
            const resp = await fetch(url, {
                signal: AbortSignal.timeout(10000) // 10 second timeout
            });
            
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

    return (
        <AnimatedSection>
            {/* Full Screen Overlay */}
            {isFullScreen && (
                <div className="fixed inset-0 z-50 bg-background flex flex-col h-screen overflow-hidden">
                    {/* Full Screen Header - Fixed and offset for vertical navbar on desktop */}
                    <div className="fixed top-0 left-0 right-0 flex-shrink-0 p-2 sm:p-4 border-b bg-background/95 backdrop-blur z-50">
                        <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:justify-between sm:space-y-0">
                            {/* Header Title and Mode Selector */}
                            <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-x-4 sm:space-y-0">
                                {/* Map mode selector in full screen, offset for navbar */}
                                <div className="flex items-center space-x-2 lg:ml-72">
                                    <span className="text-xs sm:text-sm text-muted-foreground">Mode:</span>
                                    <select
                                        value={mapMode}
                                        onChange={(e) => handleMapModeChange(e.target.value)}
                                        className="text-xs sm:text-sm border rounded px-2 py-1 bg-background min-w-[120px] sm:min-w-[140px]"
                                        disabled={mapModeTransitioning}
                                    >
                                        {mapModes.map((mode) => (
                                            <option key={mode.id} value={mode.id}>
                                                {mode.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                            
                            {/* Control Toggles and Exit Button */}
                            <div className="flex flex-col space-y-2 lg:flex-row lg:items-center lg:space-x-2 lg:space-y-0">
                                {/* Quick toggle switches for overlays in full screen */}
                                {(mapMode === 'congressional-districts' || mapMode === 'state-upper-districts' || mapMode === 'state-lower-districts') && (
                                    <div className="flex flex-wrap gap-2 sm:flex-nowrap sm:space-x-3 sm:gap-0">
                                        <div className="flex items-center space-x-1">
                                            <span className="text-xs text-muted-foreground">Party:</span>
                                            <Switch
                                                checked={showPartyAffiliation}
                                                onCheckedChange={(checked) => {
                                                    setShowPartyAffiliation(checked);
                                                    if (checked) {
                                                        setShowGerrymandering(false);
                                                        setShowTopicHeatmap(false);
                                                        setShowRepHeatmap(false);
                                                    }
                                                }}
                                                disabled={partyDataLoading}
                                            />
                                        </div>
                                        <div className="flex items-center space-x-1">
                                            <span className="text-xs text-muted-foreground">Gerry:</span>
                                            <Switch
                                                checked={showGerrymandering}
                                                onCheckedChange={(checked) => {
                                                    setShowGerrymandering(checked);
                                                    if (checked) {
                                                        setShowPartyAffiliation(false);
                                                        setShowTopicHeatmap(false);
                                                        setShowRepHeatmap(false);
                                                    }
                                                }}
                                                disabled={gerryDataLoading}
                                            />
                                        </div>
                                        <div className="flex items-center space-x-1">
                                            <span className="text-xs text-muted-foreground">Topic:</span>
                                            <Switch
                                                checked={showTopicHeatmap}
                                                onCheckedChange={(checked) => {
                                                    setShowTopicHeatmap(checked);
                                                    if (checked) {
                                                        setShowPartyAffiliation(false);
                                                        setShowGerrymandering(false);
                                                        setShowRepHeatmap(false);
                                                    }
                                                }}
                                                disabled={topicDataLoading}
                                            />
                                        </div>
                                        <div className="flex items-center space-x-1">
                                            <span className="text-xs text-muted-foreground">Rep:</span>
                                            <Switch
                                                checked={showRepHeatmap}
                                                onCheckedChange={(checked) => {
                                                    setShowRepHeatmap(checked);
                                                    if (checked) {
                                                        setShowPartyAffiliation(false);
                                                        setShowGerrymandering(false);
                                                        setShowTopicHeatmap(false);
                                                    }
                                                }}
                                                disabled={repDataLoading}
                                            />
                                        </div>
                                        <div className="flex items-center space-x-1">
                                            <span className="text-xs text-muted-foreground">Borders:</span>
                                            <Switch
                                                checked={showDistrictBorders}
                                                onCheckedChange={setShowDistrictBorders}
                                            />
                                        </div>
                                    </div>
                                )}
                                <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setIsFullScreen(false)}
                                    className="flex items-center gap-1 text-xs sm:text-sm px-2 sm:px-3"
                                >
                                    <Minimize className="h-3 w-3 sm:h-4 sm:w-4" />
                                    <span className="hidden sm:inline">Exit Full Screen</span>
                                    <span className="sm:hidden">Exit</span>
                                </Button>
                            </div>
                        </div>
                    </div>

                    {/* Full Screen Map Container */}
                    {/* Full Screen Map Container - with top padding for header and left margin for navbar */}
                    <div className="absolute top-0 left-0 w-full h-full">
                        {/* Performance warnings in full screen */}
                        {mapMode === 'state-lower-districts' && isMobile && (
                            <div className="absolute top-2 left-2 right-2 sm:top-4 sm:left-4 sm:right-4 xl:left-72 z-10 bg-amber-50 border border-amber-200 rounded-md p-2 sm:p-3 text-xs text-amber-800">
                                <div className="flex items-center space-x-2">
                                    <svg className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                    </svg>
                                    <span className="text-xs">
                                        Loading {(4879).toLocaleString()} districts with mobile optimizations.
                                        {memoryPressure && ' Memory optimization active.'}
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Full screen map */}
                        <div className="h-full w-full">
                            {(mapMode === 'congressional-districts' || mapMode === 'state-upper-districts' || mapMode === 'state-lower-districts') ? (
                                <DistrictMapGL
                                    geojsonUrl={getDistrictGeoJsonUrl(mapMode, isMobile)}
                                    color={DISTRICT_COLORS[mapMode]}
                                    onDistrictClick={onDistrictClickGL}
                                    mapStyle={
                                        resolvedTheme === 'dark'
                                            ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
                                            : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
                                    }
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
                                    popupMarker={districtPopupLatLng ? {
                                        lng: districtPopupLatLng.lng,
                                        lat: districtPopupLatLng.lat,
                                        iconHtml: `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' fill='none' stroke='#eb7725ff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='lucide lucide-map-pin' viewBox='0 0 24 24' style='display:block;'><path d='M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0Z'/><circle cx='12' cy='10' r='3'/></svg>`,
                                        draggable: !isMobile,
                                        onDragEnd: !isMobile ? (lngLat) => {
                                            setDistrictPopupLatLng(lngLat);
                                            if (selectedDistrict) {
                                                onDistrictClickGL(selectedDistrict, lngLat);
                                            }
                                        } : undefined
                                    } : undefined}
                                />
                            ) : (
                                <MapLibreMap
                                    ref={mapRef}
                                    initialViewState={{ longitude: DEFAULT_POSITION[1], latitude: DEFAULT_POSITION[0], zoom: DEFAULT_ZOOM }}
                                    style={{ height: '100%', width: '100%' }}
                                    mapStyle={
                                        resolvedTheme === 'dark'
                                            ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
                                            : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
                                    }
                                >
                                    {Object.entries(stateStats).map(([abbr, state]) => {
                                        const { color, size } = memoizedMarkers[abbr] || { color: '#e0e0e0', size: 20 };
                                        const coords: [number, number] = [
                                            (state.center as [number, number])[0],
                                            (state.center as [number, number])[1],
                                        ];
                                        return (
                                            <MapLibreMarker
                                                key={abbr}
                                                longitude={coords[1]}
                                                latitude={coords[0]}
                                                anchor="center"
                                                onClick={() => handleStateClick(abbr, coords)}
                                            >
                                                <div
                                                    className="transition-transform duration-150 ease-in-out hover:scale-110"
                                                    style={{
                                                        width: size,
                                                        height: size,
                                                        backgroundColor: color,
                                                        border: '2px solid #fff',
                                                        borderRadius: '50%',
                                                        boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                                                        position: 'relative',
                                                        overflow: 'hidden',
                                                        boxSizing: 'border-box',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                    }}
                                                >
                                                    <div
                                                        style={{
                                                            position: 'absolute',
                                                            top: '50%',
                                                            left: '50%',
                                                            width: Math.max(8, size * 0.4),
                                                            height: Math.max(8, size * 0.4),
                                                            background: '#fff',
                                                            borderRadius: '50%',
                                                            transform: 'translate(-50%, -50%)',
                                                        }}
                                                    />
                                                </div>
                                            </MapLibreMarker>
                                        );
                                    })}
                                    {/* State popup in full screen */}
                                    {selectedState && selectedStatePopupCoords && (
                                        <MapLibrePopup
                                            longitude={selectedStatePopupCoords[1]}
                                            latitude={selectedStatePopupCoords[0]}
                                            anchor="bottom"
                                            onClose={() => { setSelectedState(null); setSelectedStatePopupCoords(null); }}
                                            closeOnClick={false}
                                            maxWidth="260px"
                                        >
                                            {detailsLoading || !stateDetails ? (
                                                <>
                                                    <div className="flex items-center justify-center min-h-[60px]">
                                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                                                        <span className="text-xs text-muted-foreground">Loading details...</span>
                                                    </div>
                                                </>
                                            ) : (
                                                <>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <h3 className="font-semibold text-sm md:text-lg line-clamp-1">{stateStats[selectedState].name}</h3>
                                                        <div className="flex items-center space-x-1">
                                                            <div
                                                                className={`w-2 h-2 md:w-3 md:h-3 rounded-full ${
                                                                    getActivityLevel(selectedState) === 'High Activity' ? 'bg-primary' :
                                                                        getActivityLevel(selectedState) === 'Medium Activity' ? 'bg-primary/50' :
                                                                            getActivityLevel(selectedState) === 'Low Activity' ? 'bg-primary/20' :
                                                                                'bg-gray-300'
                                                                }`}
                                                            ></div>
                                                            <span
                                                                className="text-xs text-muted-foreground hidden sm:inline">
                                                                {getActivityLevel(selectedState)}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1 md:space-y-2 text-xs md:text-sm">
                                                        <div className="flex justify-between">
                                                            <span>Bills:</span>
                                                            <Badge variant="secondary"
                                                                className="text-xs">{stateStats[selectedState].legislationCount}</Badge>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>Reps:</span>
                                                            <Badge variant="secondary"
                                                                className="text-xs">{stateStats[selectedState].activeRepresentatives}</Badge>
                                                        </div>
                                                        <div className="flex justify-between">
                                                            <span>Recent:</span>
                                                            <Badge variant="secondary"
                                                                className="text-xs">{stateStats[selectedState].recentActivity}</Badge>
                                                        </div>
                                                        <div className="pt-1 md:pt-2">
                                                            <div className="text-xs text-muted-foreground mb-1">
                                                                <span className="hidden sm:inline">Key Topics:</span>
                                                                <span className="sm:hidden">Topics:</span>
                                                            </div>
                                                            <div className="flex flex-wrap gap-1">
                                                                {[...new Set(stateStats[selectedState].keyTopics)].slice(0, 3).map((topic, index) => (
                                                                    <Badge key={`${topic}-${index}`} variant="secondary" className="text-xs">
                                                                        {topic}
                                                                    </Badge>
                                                                ))}
                                                                {stateStats[selectedState].keyTopics.length > 3 && (
                                                                    <Badge variant="outline" className="text-xs">
                                                                        +{stateStats[selectedState].keyTopics.length - 3}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </>
                                            )}
                                        </MapLibrePopup>
                                    )}
                                </MapLibreMap>
                            )}
                        </div>

                        {/* Loading overlay for full screen */}
                        {(loading || districtLoading || mapModeTransitioning) && (
                            <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-20">
                                <div className="flex flex-col items-center space-y-3 p-4">
                                    <div className="flex items-center space-x-3">
                                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                                        <span className="text-sm sm:text-lg">
                                            {mapModeTransitioning ? 'Switching map mode...' : 'Loading map data...'}
                                        </span>
                                    </div>
                                    {isMobile && mapMode === 'state-lower-districts' && (
                                        <div className="text-xs sm:text-sm text-muted-foreground text-center">
                                            <div>Mobile optimizations active</div>
                                            {memoryPressure && (
                                                <div className="text-amber-600">Memory optimization in progress</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Gerrymandering legend in full screen */}
                        {showGerrymandering && !gerryDataLoading && Object.keys(gerryScores).length > 0 && (
                            <div className="absolute bottom-2 left-2 right-2 sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-sm xl:left-72 bg-background/95 backdrop-blur border rounded-lg p-2 sm:p-3 shadow-lg">
                                <h5 className="font-medium text-xs sm:text-sm mb-1 sm:mb-2">Compactness Scale</h5>
                                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3 text-xs sm:text-sm">
                                    <div className="flex items-center space-x-1 sm:space-x-2">
                                        <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-sm" style={{ backgroundColor: '#3b82f6' }}></div>
                                        <span className="text-xs">Very Compact</span>
                                    </div>
                                    <div className="flex items-center space-x-1 sm:space-x-2">
                                        <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-sm" style={{ backgroundColor: '#60e8fa' }}></div>
                                        <span className="text-xs">Compact</span>
                                    </div>
                                    <div className="flex items-center space-x-1 sm:space-x-2">
                                        <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-sm" style={{ backgroundColor: '#f5ce0b' }}></div>
                                        <span className="text-xs">Less Compact</span>
                                    </div>
                                    <div className="flex items-center space-x-1 sm:space-x-2">
                                        <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-sm" style={{ backgroundColor: '#d93706' }}></div>
                                        <span className="text-xs">Irregular</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Topic Heatmap legend in full screen */}
                        {showTopicHeatmap && !topicDataLoading && Object.keys(topicScores).length > 0 && (
                            <div className="absolute bottom-2 left-2 right-2 sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-sm xl:left-72 bg-background/95 backdrop-blur border rounded-lg p-2 sm:p-3 shadow-lg">
                                <h5 className="font-medium text-xs sm:text-sm mb-1 sm:mb-2">Topic Activity Scale</h5>
                                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3 text-xs sm:text-sm">
                                    <div className="flex items-center space-x-1 sm:space-x-2">
                                        <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-sm" style={{ backgroundColor: 'rgb(25, 25, 112)' }}></div>
                                        <span className="text-xs">High Activity</span>
                                    </div>
                                    <div className="flex items-center space-x-1 sm:space-x-2">
                                        <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-sm" style={{ backgroundColor: 'rgb(99, 120, 171)' }}></div>
                                        <span className="text-xs">Medium Activity</span>
                                    </div>
                                    <div className="flex items-center space-x-1 sm:space-x-2">
                                        <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-sm" style={{ backgroundColor: 'rgb(173, 216, 230)' }}></div>
                                        <span className="text-xs">Low Activity</span>
                                    </div>
                                    <div className="flex items-center space-x-1 sm:space-x-2">
                                        <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-sm" style={{ backgroundColor: '#f8f9fa' }}></div>
                                        <span className="text-xs">No Data</span>
                                    </div>
                                </div>
                                <div className="mt-1 sm:mt-2 text-xs text-muted-foreground">
                                    Topic: {selectedTopic === 'all' ? 'All Topics' : selectedTopic}
                                </div>
                            </div>
                        )}

                        {/* Representative Heatmap legend in full screen */}
                        {showRepHeatmap && !repDataLoading && Object.keys(repScores).length > 0 && (
                            <div className="absolute bottom-2 left-2 right-2 sm:bottom-4 sm:left-4 sm:right-auto sm:max-w-sm xl:left-72 bg-background/95 backdrop-blur border rounded-lg p-2 sm:p-3 shadow-lg">
                                <h5 className="font-medium text-xs sm:text-sm mb-1 sm:mb-2">
                                    {selectedRepMetric === 'sponsored_bills' ? 'Bills Sponsored Scale' :
                                     selectedRepMetric === 'recent_activity' ? 'Recent Activity Scale' : 'Representative Scale'}
                                </h5>
                                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3 text-xs sm:text-sm">
                                    <div className="flex items-center space-x-1 sm:space-x-2">
                                        <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-sm" style={{ backgroundColor: 'rgb(75, 0, 130)' }}></div>
                                        <span className="text-xs">Highest</span>
                                    </div>
                                    <div className="flex items-center space-x-1 sm:space-x-2">
                                        <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-sm" style={{ backgroundColor: 'rgb(121, 48, 158)' }}></div>
                                        <span className="text-xs">High</span>
                                    </div>
                                    <div className="flex items-center space-x-1 sm:space-x-2">
                                        <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-sm" style={{ backgroundColor: 'rgb(148, 80, 175)' }}></div>
                                        <span className="text-xs">Medium</span>
                                    </div>
                                    <div className="flex items-center space-x-1 sm:space-x-2">
                                        <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-sm" style={{ backgroundColor: 'rgb(221, 160, 221)' }}></div>
                                        <span className="text-xs">Low</span>
                                    </div>
                                    <div className="flex items-center space-x-1 sm:space-x-2">
                                        <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-sm" style={{ backgroundColor: '#f8f9fa' }}></div>
                                        <span className="text-xs">No Data</span>
                                    </div>
                                </div>
                                <div className="mt-1 sm:mt-2 text-xs text-muted-foreground">
                                    Metric: {selectedRepMetric === 'sponsored_bills' ? 'Bills Sponsored' :
                                             selectedRepMetric === 'recent_activity' ? 'Recent Activity' :
                                             selectedRepMetric === 'enacted_bills' ? 'Enacted Bills Sponsored' :
                                             selectedRepMetric === 'enacted_recent_activity' ? 'Enacted Bills - Recent Activity' :
                                             selectedRepMetric}
                                </div>
                            </div>
                        )}

                        {/* Legend in full screen - positioned as overlay without nav bar offset */}
                        {!['congressional-districts', 'state-upper-districts', 'state-lower-districts'].includes(mapMode) && (
                            <div className="absolute bottom-2 left-2 right-2 sm:bottom-4 sm:left-4 sm:right-auto xl:left-72 bg-background/95 backdrop-blur border rounded-lg p-2 sm:p-3 shadow-lg">
                                <div className="flex flex-col space-y-2 sm:flex-row sm:items-center sm:space-x-4 sm:space-y-0 text-xs sm:text-sm">
                                    <div className="flex items-center space-x-2">
                                        <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-primary"></div>
                                        <span>High Activity</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-primary/50"></div>
                                        <span>Medium Activity</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-primary/20"></div>
                                        <span>Low Activity</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Party legend in full screen */}
                        {showPartyAffiliation && !partyDataLoading && Object.keys(districtPartyMapping).length > 0 && (
                            <div className="absolute bottom-2 left-2 right-2 sm:bottom-4 sm:left-4 sm:right-auto xl:left-72 bg-background/95 backdrop-blur border rounded-lg p-2 sm:p-3 shadow-lg">
                                <h5 className="font-medium text-xs sm:text-sm mb-1 sm:mb-2">Party Legend</h5>
                                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:gap-3 text-xs sm:text-sm">
                                    {Object.keys(PARTY_COLORS).map(party => (
                                        <div key={party} className="flex items-center space-x-1 sm:space-x-2">
                                            <div
                                                className="w-2 h-2 sm:w-3 sm:h-3 rounded-sm"
                                                style={{ backgroundColor: PARTY_COLORS[party] }}
                                            ></div>
                                            <span className="text-xs">{party}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Topic selector overlay in full screen */}
                        {showTopicHeatmap && availableTopics.length > 0 && (
                            <div className="absolute top-16 sm:top-20 left-2 right-2 sm:left-4 sm:right-auto sm:max-w-xs xl:left-72 bg-background/95 backdrop-blur border rounded-lg p-2 sm:p-3 shadow-lg">
                                <label className="text-xs sm:text-sm font-medium block mb-1 sm:mb-2">Select Topic:</label>
                                <select
                                    value={selectedTopic}
                                    onChange={(e) => setSelectedTopic(e.target.value)}
                                    className="w-full text-xs sm:text-sm border rounded px-2 py-1 bg-background"
                                    disabled={topicDataLoading}
                                >
                                    <option value="all">All Topics</option>
                                    {availableTopics.map(topic => (
                                        <option key={topic} value={topic}>{topic}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Representative metric selector overlay in full screen */}
                        {showRepHeatmap && (
                            <div className="absolute top-16 sm:top-20 left-2 right-2 sm:left-4 sm:right-auto sm:max-w-xs xl:left-72 bg-background/95 backdrop-blur border rounded-lg p-2 sm:p-3 shadow-lg">
                                <label className="text-xs sm:text-sm font-medium block mb-1 sm:mb-2">Select Metric:</label>
                                <select
                                    value={selectedRepMetric}
                                    onChange={(e) => setSelectedRepMetric(e.target.value)}
                                    className="w-full text-xs sm:text-sm border rounded px-2 py-1 bg-background"
                                    disabled={repDataLoading}
                                >
                                    {availableRepMetrics.map(metric => (
                                        <option key={metric} value={metric}>
                                            {metric === 'sponsored_bills' ? 'Bills Sponsored' :
                                             metric === 'recent_activity' ? 'Recent Activity' :
                                             metric === 'enacted_bills' ? 'Enacted Bills Sponsored' :
                                             metric === 'enacted_recent_activity' ? 'Enacted Bills - Recent Activity' :
                                             metric}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Instructions overlay in full screen */}
                        <div className="absolute bottom-2 right-2 sm:bottom-4 sm:right-4 bg-background/95 backdrop-blur border rounded-lg p-2 sm:p-3 shadow-lg text-xs sm:text-sm text-muted-foreground">
                            <div className="flex items-center space-x-2">
                                <kbd className="px-1 py-0.5 sm:px-2 sm:py-1 text-xs bg-muted border rounded">ESC</kbd>
                                <span className="hidden sm:inline">Exit full screen</span>
                                <span className="sm:hidden">Exit</span>
                            </div>
                        </div>

                        {/* Selected district info in full screen */}
                        {selectedDistrict && (
                            <div className="absolute top-2 right-2 sm:top-4 sm:right-4 w-[calc(100%-16px)] sm:w-auto sm:max-w-sm bg-background/95 backdrop-blur border rounded-lg shadow-lg p-3 sm:p-4">
                                <div className="flex items-center justify-between mb-2 sm:mb-3">
                                    <h3 className="font-semibold text-sm sm:text-lg">District Info</h3>
                                    <button
                                        className="text-lg sm:text-xl text-gray-400 hover:text-gray-700 ml-2"
                                        onClick={() => {
                                            setSelectedDistrict(null);
                                            setDistrictPopupLatLng(null);
                                            // Force cleanup on mobile
                                            if (isMobile) {
                                                setTimeout(forceGarbageCollection, 100);
                                            }
                                        }}
                                        aria-label="Close"
                                    >×</button>
                                </div>
                                {/* Show a custom message and hide results if marker is outside US and no reps found */}
                                {(!districtLoading && Array.isArray(districtReps) && districtReps.length === 0 && districtPopupLatLng &&
                                  (districtPopupLatLng.lat < 24 || districtPopupLatLng.lat > 49 || districtPopupLatLng.lng < -125 || districtPopupLatLng.lng > -66)) ? (
                                  <div className="text-xs sm:text-sm text-muted-foreground mb-2">No representatives found for this location.</div>
                                ) : (
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
                                  />
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="space-y-6">
                <Card className="shadow-lg">
                    <CardHeader className="pb-3 md:pb-6">
                        <div className="flex items-center justify-between">
                            <div>
                                <CardTitle className="font-headline text-lg md:text-xl">
                                    <span className="hidden sm:inline">Interactive Dashboard</span>
                                    {/* <span className="sm:hidden">Interactive Dashboard</span> */}
                                </CardTitle>
                                <CardDescription className="text-xs md:text-sm">
                      <span className="hidden sm:inline">
                        Explore legislative activity, representatives, and policy trends across the United States.
                      </span>
                                    <span className="sm:hidden">
                        Explore legislative activity and trends.
                      </span>
                                </CardDescription>
                            </div>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setIsFullScreen(!isFullScreen)}
                                className="flex items-center gap-1"
                                title={isFullScreen ? "Exit full screen" : "Enter full screen"}
                            >
                                {isFullScreen ? (
                                    <>
                                        <Minimize className="h-4 w-4" />
                                        <span className="hidden sm:inline">Exit Full Screen</span>
                                    </>
                                ) : (
                                    <>
                                        <Maximize className="h-4 w-4" />
                                        <span className="hidden sm:inline">Full Screen</span>
                                    </>
                                )}
                            </Button>
                        </div>
                    </CardHeader>
                    <CardContent className="space-y-4 md:space-y-6">
                        {/* Map Mode Selector */}
                        <div className="space-y-2 md:space-y-3">
                            <h4 className="font-semibold text-xs md:text-sm">
                                <span className="hidden sm:inline">Map View Mode</span>
                                <span className="sm:hidden">View Mode</span>
                            </h4>
                            <div className="grid grid-cols-2 gap-2 md:grid-cols-2 lg:grid-cols-4 lg:gap-2">
                                {mapModes.map((mode) => {
                                    const IconComponent = mode.icon;
                                    const isDisabled = mapModeTransitioning;
                                    const isLargeDataset = mode.id === 'state-lower-districts';

                                    return (
                                        <Button
                                            key={mode.id}
                                            variant={mapMode === mode.id ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => handleMapModeChange(mode.id)}
                                            disabled={isDisabled}
                                            className={`flex flex-col items-center gap-1 lg:flex-row lg:gap-2 h-auto p-2 lg:p-3 min-h-[60px] lg:min-h-[auto] ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        >
                                            <IconComponent className="h-3 w-3 lg:h-4 lg:w-4 flex-shrink-0"/>
                                            <div className="text-center lg:text-left min-w-0 flex-1">
                                                <div className="font-medium text-xs leading-tight">
                                                    <span className="hidden xl:inline">{mode.label}</span>
                                                    <span className="xl:hidden">
                            {mode.label.replace('Activity', '').replace('Representatives', 'Reps').replace('Legislation', 'Bills').trim()}
                          </span>
                                                </div>
                                            </div>
                                        </Button>
                                    );
                                })}
                            </div>
                            <p className="text-xs text-muted-foreground hidden md:block">
                                {mapModes.find(m => m.id === mapMode)?.description}
                            </p>
                        </div>

                        {/* Party Affiliation Toggle - Only show for district modes */}
                        {(mapMode === 'congressional-districts' || mapMode === 'state-upper-districts' || mapMode === 'state-lower-districts') && (
                            <div className="space-y-2 md:space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <h4 className="font-semibold text-xs md:text-sm">
                                            <span className="hidden sm:inline">Party Affiliation</span>
                                            <span className="sm:hidden">Party Colors</span>
                                        </h4>
                                        <p className="text-xs text-muted-foreground">
                                            <span className="hidden sm:inline">Color districts by representative party affiliation</span>
                                            <span className="sm:hidden">Color by party</span>
                                        </p>
                                    </div>
                                    <Switch
                                        checked={showPartyAffiliation}
                                        onCheckedChange={(checked) => {
                                            console.log('Switch toggled:', checked, 'current mapMode:', mapMode);
                                            setShowPartyAffiliation(checked);
                                            // Disable all other overlays when party affiliation is enabled
                                            if (checked) {
                                                setShowGerrymandering(false);
                                                setShowTopicHeatmap(false);
                                                setShowRepHeatmap(false);
                                            }
                                        }}
                                        disabled={partyDataLoading}
                                    />
                                </div>

                                {/* Party affiliation loading/error state */}
                                {partyDataLoading && (
                                    <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
                                        <span>Loading party data...</span>
                                    </div>
                                )}

                                {partyDataError && (
                                    <div className="text-xs text-red-500">
                                        Error loading party data: {partyDataError}
                                    </div>
                                )}

                                {/* Party legend - only show when party affiliation is enabled and data is loaded */}
                                {showPartyAffiliation && !partyDataLoading && Object.keys(districtPartyMapping).length > 0 && (
                                    <div className="space-y-2">
                                        <h5 className="font-medium text-xs">Party Legend</h5>
                                        <div className="flex flex-wrap gap-2 text-xs">
                                            {/* Always show all party categories */}
                                            {Object.keys(PARTY_COLORS).map(party => (
                                                <div key={party} className="flex items-center space-x-1">
                                                    <div
                                                        className="w-3 h-3 rounded-sm"
                                                        style={{ backgroundColor: PARTY_COLORS[party] }}
                                                    ></div>
                                                    <span>{party}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Gerrymandering Toggle - Only show for district modes */}
                        {(mapMode === 'congressional-districts' || mapMode === 'state-upper-districts' || mapMode === 'state-lower-districts') && (
                            <div className="space-y-2 md:space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <h4 className="font-semibold text-xs md:text-sm">
                                            <span className="hidden sm:inline">Gerrymandering Analysis</span>
                                            <span className="sm:hidden">Gerrymandering</span>
                                        </h4>
                                        <p className="text-xs text-muted-foreground">
                                            <span className="hidden sm:inline">Color districts by compactness (Polsby-Popper test)</span>
                                            <span className="sm:hidden">Show district compactness</span>
                                        </p>
                                    </div>
                                    <Switch
                                        checked={showGerrymandering}
                                        onCheckedChange={(checked) => {
                                            setShowGerrymandering(checked);
                                            // Disable all other overlays when gerrymandering is enabled
                                            if (checked) {
                                                setShowPartyAffiliation(false);
                                                setShowTopicHeatmap(false);
                                                setShowRepHeatmap(false);
                                            }
                                        }}
                                        disabled={gerryDataLoading}
                                    />
                                </div>

                                {/* Gerrymandering loading/error state */}
                                {gerryDataLoading && (
                                    <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
                                        <span>Calculating compactness scores...</span>
                                    </div>
                                )}

                                {gerryDataError && (
                                    <div className="text-xs text-red-500">
                                        Error loading gerrymandering data: {gerryDataError}
                                    </div>
                                )}

                                {/* Gerrymandering legend - only show when gerrymandering is enabled and data is loaded */}
                                {showGerrymandering && !gerryDataLoading && Object.keys(gerryScores).length > 0 && (
                                    <div className="space-y-2">
                                        <h5 className="font-medium text-xs">Compactness Scale</h5>
                                        <div className="flex flex-wrap gap-2 text-xs">
                                            <div className="flex items-center space-x-1">
                                                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#3b82f6' }}></div>
                                                <span>Very Compact</span>
                                            </div>
                                            <div className="flex items-center space-x-1">
                                                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#60e8fa' }}></div>
                                                <span>Compact</span>
                                            </div>
                                            <div className="flex items-center space-x-1">
                                                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#8cfb24' }}></div>
                                                <span>Moderate</span>
                                            </div>
                                            <div className="flex items-center space-x-1">
                                                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#f5ce0b' }}></div>
                                                <span>Less Compact</span>
                                            </div>
                                            <div className="flex items-center space-x-1">
                                                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#d93706' }}></div>
                                                <span>Irregular Shape</span>
                                            </div>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Based on enhanced Polsby-Popper compactness analysis with geographic adjustments for coastlines and state borders. Blue = more compact, Red/Orange = less compact.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}


                        {/* Topic Heatmap Toggle - Only show for district modes */}
                        {(mapMode === 'congressional-districts' || mapMode === 'state-upper-districts' || mapMode === 'state-lower-districts') && (
                            <div className="space-y-2 md:space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <h4 className="font-semibold text-xs md:text-sm">
                                            <span className="hidden sm:inline">Topic Heatmap</span>
                                            <span className="sm:hidden">Topic Heat</span>
                                        </h4>
                                        <p className="text-xs text-muted-foreground">
                                            <span className="hidden sm:inline">Color districts by legislative topic activity</span>
                                            <span className="sm:hidden">Show topic activity</span>
                                        </p>
                                    </div>
                                    <Switch
                                        checked={showTopicHeatmap}
                                        onCheckedChange={(checked) => {
                                            setShowTopicHeatmap(checked);
                                            // Disable other heatmaps when topic heatmap is enabled
                                            if (checked) {
                                                setShowPartyAffiliation(false);
                                                setShowGerrymandering(false);
                                                setShowRepHeatmap(false);
                                            }
                                        }}
                                        disabled={topicDataLoading}
                                    />
                                </div>

                                {/* Topic selector - only show when topic heatmap is enabled */}
                                {showTopicHeatmap && availableTopics.length > 0 && (
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium">Select Topic:</label>
                                        <select
                                            value={selectedTopic}
                                            onChange={(e) => setSelectedTopic(e.target.value)}
                                            className="w-full text-xs border rounded px-2 py-1 bg-background"
                                            disabled={topicDataLoading}
                                        >
                                            <option value="all">All Topics</option>
                                            {availableTopics.map(topic => (
                                                <option key={topic} value={topic}>{topic}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* Topic heatmap loading/error state */}
                                {topicDataLoading && (
                                    <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
                                        <span>Loading topic data...</span>
                                    </div>
                                )}

                                {topicDataError && (
                                    <div className="text-xs text-red-500">
                                        Error loading topic data: {topicDataError}
                                    </div>
                                )}

                                {/* Topic legend - only show when topic heatmap is enabled and data is loaded */}
                                {showTopicHeatmap && !topicDataLoading && Object.keys(topicScores).length > 0 && (
                                    <div className="space-y-2">
                                        <h5 className="font-medium text-xs">Activity Scale</h5>
                                        <div className="flex flex-wrap gap-2 text-xs">
                                            <div className="flex items-center space-x-1">
                                                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgb(25, 25, 112)' }}></div>
                                                <span>High Activity</span>
                                            </div>
                                            <div className="flex items-center space-x-1">
                                                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgb(99, 120, 171)' }}></div>
                                                <span>Medium Activity</span>
                                            </div>
                                            <div className="flex items-center space-x-1">
                                                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgb(173, 216, 230)' }}></div>
                                                <span>Low Activity</span>
                                            </div>
                                            <div className="flex items-center space-x-1">
                                                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#f8f9fa' }}></div>
                                                <span>No Data</span>
                                            </div>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            Blue gradient: light blue = low activity, dark blue = high activity. Based on legislative activity in the selected topic area.
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Representative Heatmap Toggle - Only show for district modes */}
                        {(mapMode === 'congressional-districts' || mapMode === 'state-upper-districts' || mapMode === 'state-lower-districts') && (
                            <div className="space-y-2 md:space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <h4 className="font-semibold text-xs md:text-sm">
                                            <span className="hidden sm:inline">Representative Heatmap</span>
                                            <span className="sm:hidden">Rep Heatmap</span>
                                        </h4>
                                        <p className="text-xs text-muted-foreground">
                                            <span className="hidden sm:inline">Color districts by representative metrics</span>
                                            <span className="sm:hidden">Show rep metrics</span>
                                        </p>
                                    </div>
                                    <Switch
                                        checked={showRepHeatmap}
                                        onCheckedChange={(checked) => {
                                            setShowRepHeatmap(checked);
                                            // Disable other heatmaps when rep heatmap is enabled
                                            if (checked) {
                                                setShowPartyAffiliation(false);
                                                setShowGerrymandering(false);
                                                setShowTopicHeatmap(false);
                                            }
                                        }}
                                        disabled={repDataLoading}
                                    />
                                </div>

                                {/* Representative metric selector - only show when rep heatmap is enabled */}
                                {showRepHeatmap && (
                                    <div className="space-y-2">
                                        <label className="text-xs font-medium">Select Metric:</label>
                                        <select
                                            value={selectedRepMetric}
                                            onChange={(e) => setSelectedRepMetric(e.target.value)}
                                            className="w-full text-xs border rounded px-2 py-1 bg-background"
                                            disabled={repDataLoading}
                                        >
                                            {availableRepMetrics.map(metric => (
                                                <option key={metric} value={metric}>
                                                    {metric === 'sponsored_bills' ? 'Bills Sponsored' :
                                                     metric === 'recent_activity' ? 'Recent Activity' :
                                                     metric === 'enacted_bills' ? 'Enacted Bills Sponsored' :
                                                     metric === 'enacted_recent_activity' ? 'Enacted Bills - Recent Activity' :
                                                     metric}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {/* Representative heatmap loading/error state */}
                                {repDataLoading && (
                                    <div className="flex items-center space-x-2 text-xs text-muted-foreground">
                                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
                                        <span>Loading representative data...</span>
                                    </div>
                                )}

                                {repDataError && (
                                    <div className="text-xs text-red-500">
                                        Error loading representative data: {repDataError}
                                    </div>
                                )}

                                {/* Representative legend - only show when rep heatmap is enabled and data is loaded */}
                                {showRepHeatmap && !repDataLoading && Object.keys(repScores).length > 0 && (
                                    <div className="space-y-2">
                                        <h5 className="font-medium text-xs">
                                            {selectedRepMetric === 'sponsored_bills' ? 'Bills Sponsored Scale' :
                                             selectedRepMetric === 'recent_activity' ? 'Recent Activity Scale' : 'Score Scale'}
                                        </h5>
                                        <div className="flex flex-wrap gap-2 text-xs">
                                            <div className="flex items-center space-x-1">
                                                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgb(75, 0, 130)' }}></div>
                                                <span>Highest</span>
                                            </div>
                                            <div className="flex items-center space-x-1">
                                                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgb(121, 48, 158)' }}></div>
                                                <span>High</span>
                                            </div>
                                            <div className="flex items-center space-x-1">
                                                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgb(148, 80, 175)' }}></div>
                                                <span>Medium</span>
                                            </div>
                                            <div className="flex items-center space-x-1">
                                                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: 'rgb(221, 160, 221)' }}></div>
                                                <span>Low</span>
                                            </div>
                                            <div className="flex items-center space-x-1">
                                                <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: '#f8f9fa' }}></div>
                                                <span>No Data</span>
                                            </div>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {selectedRepMetric === 'sponsored_bills' ? 'Purple gradient: light purple = fewer bills sponsored in 2025, dark purple = more bills sponsored in 2025.' :
                                             selectedRepMetric === 'recent_activity' ? 'Purple gradient: light purple = older data updates, dark purple = more recent data updates.' :
                                             'Purple gradient based on normalized scores from 0-1.'}
                                        </p>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* District Borders Toggle - Only show for district modes when any overlay is active */}
                        {(mapMode === 'congressional-districts' || mapMode === 'state-upper-districts' || mapMode === 'state-lower-districts') &&
                         (showPartyAffiliation || showGerrymandering || showTopicHeatmap || showRepHeatmap) && (
                            <div className="space-y-2 md:space-y-3">
                                <div className="flex items-center justify-between">
                                    <div className="space-y-1">
                                        <h4 className="font-semibold text-xs md:text-sm">
                                            <span className="hidden sm:inline">District Borders</span>
                                            <span className="sm:hidden">Borders</span>
                                        </h4>
                                        <p className="text-xs text-muted-foreground">
                                            <span className="hidden sm:inline">Show or hide district boundary lines</span>
                                            <span className="sm:hidden">Show boundary lines</span>
                                        </p>
                                    </div>
                                    <Switch
                                        checked={showDistrictBorders}
                                        onCheckedChange={setShowDistrictBorders}
                                    />
                                </div>
                            </div>
                        )}

                        {/* Map Container with district overlays */}
                        <div className="relative">
                            {/* Enhanced performance warning for large datasets on mobile */}
                            {mapMode === 'state-lower-districts' && isMobile && (
                                <div className="absolute top-2 left-2 right-2 z-10 bg-amber-50 border border-amber-200 rounded-md p-2 text-xs text-amber-800">
                                    <div className="flex items-center space-x-1">
                                        <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                        </svg>
                                        <span>
                                            Loading {(4879).toLocaleString()} districts with mobile optimizations.
                                            {memoryPressure && ' Memory optimization active.'}
                                        </span>
                                    </div>
                                    <div className="mt-1 text-xs text-amber-700">
                                        Districts will load progressively to prevent crashes.
                                    </div>
                                </div>
                            )}

                            {/* General performance warning for large datasets */}
                            {(mapMode === 'state-upper-districts' || mapMode === 'congressional-districts') && isMobile && (
                                <div className="absolute top-2 left-2 right-2 z-10 bg-blue-50 border border-blue-200 rounded-md p-2 text-xs text-blue-800 md:hidden">
                                    <div className="flex items-center space-x-1">
                                        <svg className="w-3 h-3 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zm-4 4a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                        </svg>
                                        <span>Mobile optimizations active for better performance.</span>
                                    </div>
                                </div>
                            )}

                            <div className="h-[300px] sm:h-[400px] md:h-[500px] w-full rounded-md overflow-hidden border">
                                {(mapMode === 'congressional-districts' || mapMode === 'state-upper-districts' || mapMode === 'state-lower-districts') ? (
                                    <DistrictMapGL
                                        geojsonUrl={getDistrictGeoJsonUrl(mapMode, isMobile)}
                                        color={DISTRICT_COLORS[mapMode]}
                                        onDistrictClick={onDistrictClickGL}
                                        mapStyle={
                                            resolvedTheme === 'dark'
                                                ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
                                                : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
                                        }
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
                                        popupMarker={districtPopupLatLng ? {
                                            lng: districtPopupLatLng.lng,
                                            lat: districtPopupLatLng.lat,
                                            iconHtml: `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' fill='none' stroke='#eb7725ff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='lucide lucide-map-pin' viewBox='0 0 24 24' style='display:block;'><path d='M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0Z'/><circle cx='12' cy='10' r='3'/></svg>`,
                                            draggable: !isMobile,
                                            onDragEnd: !isMobile ? (lngLat) => {
                                                setDistrictPopupLatLng(lngLat);
                                                if (selectedDistrict) {
                                                    onDistrictClickGL(selectedDistrict, lngLat);
                                                }
                                            } : undefined
                                        } : undefined}
                                    />
                                ) : (
                                    <MapLibreMap
                                        ref={mapRef}
                                        initialViewState={{ longitude: DEFAULT_POSITION[1], latitude: DEFAULT_POSITION[0], zoom: DEFAULT_ZOOM }}
                                        style={{ height: '100%', width: '100%' }}
                                        mapStyle={
                                            resolvedTheme === 'dark'
                                                ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
                                                : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
                                        }
                                    >
                                        {Object.entries(stateStats).map(([abbr, state]) => {
                                            const { color, size } = memoizedMarkers[abbr] || { color: '#e0e0e0', size: 20 };
                                            const coords: [number, number] = [
                                                (state.center as [number, number])[0],
                                                (state.center as [number, number])[1],
                                            ];
                                            return (
                                                <MapLibreMarker
                                                    key={abbr}
                                                    longitude={coords[1]}
                                                    latitude={coords[0]}
                                                    anchor="center"
                                                    onClick={() => handleStateClick(abbr, coords)}
                                                >
                                                    <div
                                                        className="transition-transform duration-150 ease-in-out hover:scale-110"
                                                        style={{
                                                            width: size,
                                                            height: size,
                                                            backgroundColor: color,
                                                            border: '2px solid #fff',
                                                            borderRadius: '50%',
                                                            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                                                            position: 'relative',
                                                            overflow: 'hidden',
                                                            boxSizing: 'border-box',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                        }}
                                                    >
                                                        <div
                                                            style={{
                                                                position: 'absolute',
                                                                top: '50%',
                                                                left: '50%',
                                                                width: Math.max(8, size * 0.4),
                                                                height: Math.max(8, size * 0.4),
                                                                background: '#fff',
                                                                borderRadius: '50%',
                                                                transform: 'translate(-50%, -50%)',
                                                            }}
                                                        />
                                                    </div>
                                                </MapLibreMarker>
                                            );
                                        })}
                                        {/* State popup */}
                                        {/* Log and compare popups at fixed and dynamic coordinates */}
                                        {selectedState && selectedStatePopupCoords && (
                                            <MapLibrePopup
                                                longitude={selectedStatePopupCoords[1]}
                                                latitude={selectedStatePopupCoords[0]}
                                                anchor="bottom"
                                                onClose={() => { setSelectedState(null); setSelectedStatePopupCoords(null); }}
                                                closeOnClick={false}
                                                maxWidth="260px"
                                            >
                                                {detailsLoading || !stateDetails ? (
                                                    <>
                                                        <div className="flex items-center justify-center min-h-[60px]">
                                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary mr-2"></div>
                                                            <span className="text-xs text-muted-foreground">Loading details...</span>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <>
                                                        <div className="flex items-center justify-between mb-2">
                                                            <h3 className="font-semibold text-sm md:text-lg line-clamp-1">{stateStats[selectedState].name}</h3>
                                                            <div className="flex items-center space-x-1">
                                                                <div
                                                                    className={`w-2 h-2 md:w-3 md:h-3 rounded-full ${
                                                                        getActivityLevel(selectedState) === 'High Activity' ? 'bg-primary' :
                                                                            getActivityLevel(selectedState) === 'Medium Activity' ? 'bg-primary/50' :
                                                                                getActivityLevel(selectedState) === 'Low Activity' ? 'bg-primary/20' :
                                                                                    'bg-gray-300'
                                                                    }`}
                                                                ></div>
                                                                <span
                                                                    className="text-xs text-muted-foreground hidden sm:inline">
                                                                    {getActivityLevel(selectedState)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1 md:space-y-2 text-xs md:text-sm">
                                                            <div className="flex justify-between">
                                                                <span>Bills:</span>
                                                                <Badge variant="secondary"
                                                                    className="text-xs">{stateStats[selectedState].legislationCount}</Badge>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span>Reps:</span>
                                                                <Badge variant="secondary"
                                                                    className="text-xs">{stateStats[selectedState].activeRepresentatives}</Badge>
                                                            </div>
                                                            <div className="flex justify-between">
                                                                <span>Recent:</span>
                                                                <Badge variant="secondary"
                                                                    className="text-xs">{stateStats[selectedState].recentActivity}</Badge>
                                                            </div>
                                                            <div className="pt-1 md:pt-2">
                                                                <div className="text-xs text-muted-foreground mb-1">
                                                                    <span className="hidden sm:inline">Key Topics:</span>
                                                                    <span className="sm:hidden">Topics:</span>
                                                                </div>
                                                                <div className="flex flex-wrap gap-1">
                                                                    {[...new Set(stateStats[selectedState].keyTopics)].slice(0, 3).map((topic, index) => (
                                                                        <Badge key={`${topic}-${index}`} variant="secondary" className="text-xs">
                                                                            {topic}
                                                                        </Badge>
                                                                    ))}
                                                                    {stateStats[selectedState].keyTopics.length > 3 && (
                                                                        <Badge variant="outline" className="text-xs">
                                                                            +{stateStats[selectedState].keyTopics.length - 3}
                                                                        </Badge>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </>
                                                )}
                                            </MapLibrePopup>
                                        )}
                                    </MapLibreMap>
                                )}
                            </div>

                            {/* Enhanced loading overlay with memory pressure indicators */}
                            {(loading || districtLoading || mapModeTransitioning) && (
                                <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                                    <div className="flex flex-col items-center space-y-2">
                                        <div className="flex items-center space-x-2">
                                            <div className="animate-spin rounded-full h-3 w-3 md:h-4 md:w-4 border-b-2 border-primary"></div>
                                            <span className="text-xs md:text-sm">
                                                {mapModeTransitioning ? (
                                                    <>
                                                        <span className="hidden sm:inline">Switching map mode...</span>
                                                        <span className="sm:hidden">Switching...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <span className="hidden sm:inline">Updating map data...</span>
                                                        <span className="sm:hidden">Loading...</span>
                                                    </>
                                                )}
                                            </span>
                                        </div>
                                        {isMobile && mapMode === 'state-lower-districts' && (
                                            <div className="text-xs text-muted-foreground text-center">
                                                <div>Mobile optimizations active</div>
                                                {memoryPressure && (
                                                    <div className="text-amber-600">Memory optimization in progress</div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                            {districtError && (
                                <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                                    <div className="text-center">
                                        <span className="text-xs text-red-500 block">{districtError}</span>
                                        {isMobile && (
                                            <span className="text-xs text-muted-foreground block mt-1">
                                                Try switching to a smaller district view
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                {selectedDistrict && (
                  <div className="mt-4 bg-card text-foreground border border-border rounded-lg shadow-lg p-3 dark:!bg-zinc-900 dark:!text-white dark:!border-zinc-700">
                    <h3 className="font-semibold text-base md:text-lg mb-2">
                      {districtPopupLatLng ? ` (${districtPopupLatLng.lat.toFixed(5)}, ${districtPopupLatLng.lng.toFixed(5)})` : ''}
                      <button
                        className="ml-2 text-lg text-gray-400 hover:text-gray-700"
                        onClick={() => {
                            setSelectedDistrict(null);
                            setDistrictPopupLatLng(null);
                            // Force cleanup on mobile
                            if (isMobile) {
                                setTimeout(forceGarbageCollection, 100);
                            }
                        }}
                        aria-label="Close"
                      >×</button>
                    </h3>
                    {/* Show a custom message and hide results if marker is outside US and no reps found */}
                    {(!districtLoading && Array.isArray(districtReps) && districtReps.length === 0 && districtPopupLatLng &&
                      (districtPopupLatLng.lat < 24 || districtPopupLatLng.lat > 49 || districtPopupLatLng.lng < -125 || districtPopupLatLng.lng > -66)) ? (
                      <div className="text-sm text-muted-foreground mb-2">No representatives found for this location.</div>
                    ) : (
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
                      />
                    )}
                  </div>
                )}
                        </div>

                                                {/* Enhanced legend with mobile-specific messaging */}
                                                {['congressional-districts', 'state-upper-districts', 'state-lower-districts'].includes(mapMode) ? (
                                                    <div className="text-xs text-muted-foreground text-center w-full py-2">
                                                        <div>
                                                            {isMobile ? 'Tap anywhere on the map to see legislators' : 'Click anywhere on the map to see legislators representing that location.'}
                                                        </div>
                                                        {isMobile && mapMode === 'state-lower-districts' && (
                                                            <div className="text-amber-600 mt-1">
                                                                Large dataset - optimized for mobile performance
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div
                                                        className="flex flex-col space-y-2 md:flex-row md:items-center md:justify-between md:space-y-0 text-xs text-muted-foreground">
                                                        <div className="flex items-center space-x-2 md:space-x-4 overflow-x-auto">
                                                                <div className="flex items-center space-x-1 flex-shrink-0">
                                                                        <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-primary"></div>
                                                                        <span className="whitespace-nowrap">High Activity</span>
                                                                </div>
                                                                <div className="flex items-center space-x-1 flex-shrink-0">
                                                                        <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-primary/50"></div>
                                                                        <span className="whitespace-nowrap">
                                        <span className="hidden sm:inline">Medium Activity</span>
                                        <span className="sm:hidden">Medium</span>
                                    </span>
                                                                </div>
                                                                <div className="flex items-center space-x-1 flex-shrink-0">
                                                                        <div className="w-2 h-2 md:w-3 md:h-3 rounded-full bg-primary/20"></div>
                                                                        <span className="whitespace-nowrap">
                                        <span className="hidden sm:inline">Low Activity</span>
                                        <span className="sm:hidden">Low</span>
                                    </span>
                                                                </div>
                                                        </div>
                                                        <div className="text-xs hidden md:block">Click markers for detailed state information</div>
                                                        <div className="text-xs md:hidden">Tap markers for details</div>
                                                    </div>
                                                )}
                    </CardContent>
                </Card>

                {/* Selected State Details */}
                {selectedState && stateStats[selectedState] && (
                    <Card className="shadow-lg">
                        <CardHeader className="pb-3 md:pb-6">
                            <CardTitle className="flex items-center justify-between text-lg md:text-xl">
                                <span className="line-clamp-1">{stateStats[selectedState].name} Details</span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setSelectedState(null)}
                                    className="flex-shrink-0"
                                >
                                    ×
                                </Button>
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="pt-0">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4">
                                <div className="space-y-1 md:space-y-2">
                                    <div className="flex items-center space-x-2">
                                        <FileText className="h-3 w-3 md:h-4 md:w-4 text-blue-500 flex-shrink-0"/>
                                        <span className="font-medium text-sm md:text-base">
                      <span className="hidden sm:inline">Legislative Activity</span>
                      <span className="sm:hidden">Bills</span>
                    </span>
                                    </div>
                                    <p className="text-xl md:text-2xl font-bold">{stateStats[selectedState].legislationCount}</p>
                                    <p className="text-xs text-muted-foreground">
                                        <span className="hidden sm:inline">Active bills and resolutions</span>
                                        <span className="sm:hidden">Active bills</span>
                                    </p>
                                </div>

                                <div className="space-y-1 md:space-y-2">
                                    <div className="flex items-center space-x-2">
                                        <Users className="h-3 w-3 md:h-4 md:w-4 text-green-500 flex-shrink-0"/>
                                        <span className="font-medium text-sm md:text-base">
                      <span className="hidden sm:inline">Representatives</span>
                      <span className="sm:hidden">Reps</span>
                    </span>
                                    </div>
                                    <p className="text-xl md:text-2xl font-bold">{stateStats[selectedState].activeRepresentatives}</p>
                                    <p className="text-xs text-muted-foreground">
                                        <span className="hidden sm:inline">Active state legislators</span>
                                        <span className="sm:hidden">Legislators</span>
                                    </p>
                                </div>

                                <div className="space-y-1 md:space-y-2">
                                    <div className="flex items-center space-x-2">
                                        <TrendingUp className="h-3 w-3 md:h-4 md:w-4 text-orange-500 flex-shrink-0"/>
                                        <span className="font-medium text-sm md:text-base">Recent Activity</span>
                                                                       </div>
                                    <p className="text-xl md:text-2xl font-bold">{stateStats[selectedState].recentActivity}</p>
                                    <p className="text-xs text-muted-foreground">
                                        <span className="hidden sm:inline">Actions in the last 30 days</span>
                                        <span className="sm:hidden">Last 30 days</span>
                                    </p>
                                </div>
                            </div>

                            <div className="mt-4 md:mt-6">
                                <h4 className="font-medium mb-2 text-sm md:text-base">
                                    <span className="hidden sm:inline">Key Policy Areas</span>
                                    <span className="sm:hidden">Policy Areas</span>
                                </h4>
                                <div className="flex flex-wrap gap-1 md:gap-2">
                                    {[...new Set(stateStats[selectedState].keyTopics)].map((topic, index) => (
                                        <Badge key={`${topic}-${index}`} variant="secondary" className="text-xs">
                                            {topic}
                                        </Badge>
                                    ))}
                                </div>
                            </div>

                            <div className="mt-4 md:mt-6 pt-3 md:pt-4 border-t">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 md:gap-3">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => router.push(`/dashboard?stateAbbr=${selectedState}`)}
                                        className="w-full"
                                    >
                                        <span className="hidden sm:inline">View Full Dashboard</span>
                                        <span className="sm:hidden">Full Dashboard</span>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => router.push(`/legislation?state=${encodeURIComponent(stateStats[selectedState].name)}&stateAbbr=${selectedState}`)}
                                        className="w-full"
                                    >
                                        <span className="hidden sm:inline">View Legislation</span>
                                        <span className="sm:hidden">View Bills</span>
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Party Makeup for Selected State */}
                {selectedState && stateStats[selectedState] && (
                    <ChamberMakeup state={selectedState} />
                )}

                {/* Quick Stats Overview */}
                <AnimatedSection>
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-2 lg:grid-cols-4 lg:gap-4">
                        <Card>
                            <CardContent className="p-3 md:p-4">
                                <div className="flex items-center space-x-2">
                                    <FileText className="h-4 w-4 md:h-5 md:w-5 text-blue-500 flex-shrink-0"/>
                                    <div className="min-w-0">
                                        <p className="text-xs md:text-sm font-medium truncate">
                                            <span className="hidden sm:inline">Total Legislation</span>
                                            <span className="sm:hidden">Total Bills</span>
                                        </p>
                                        <p className="text-lg md:text-2xl font-bold">
                                            {Object.values(stateStats).reduce((sum, state) => sum + state.legislationCount, 0).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-3 md:p-4">
                                <div className="flex items-center space-x-2">
                                    <Users className="h-4 w-4 md:h-5 md:w-5 text-green-500 flex-shrink-0"/>
                                    <div className="min-w-0">
                                        <p className="text-xs md:text-sm font-medium truncate">
                                            <span className="hidden sm:inline">Active Sponsors</span>
                                            <span className="sm:hidden">Active Reps</span>
                                        </p>
                                        <p className="text-lg md:text-2xl font-bold">
                                            {Object.values(stateStats).reduce((sum, state) => sum + state.activeRepresentatives, 0).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-3 md:p-4">
                                <div className="flex items-center space-x-2">
                                    <TrendingUp className="h-4 w-4 md:h-5 md:w-5 text-orange-500 flex-shrink-0"/>
                                    <div className="min-w-0">
                                        <p className="text-xs md:text-sm font-medium truncate">Recent Activity</p>
                                        <p className="text-lg md:text-2xl font-bold">
                                            {Object.values(stateStats).reduce((sum, state) => sum + state.recentActivity, 0).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>

                        <Card>
                            <CardContent className="p-3 md:p-4">
                                <div className="flex items-center space-x-2">
                                    <MapPin className="h-4 w-4 md:h-5 md:w-5 text-purple-500 flex-shrink-0"/>
                                    <div className="min-w-0">
                                        <p className="text-xs md:text-sm font-medium truncate">
                                            <span className="hidden sm:inline">Jurisdictions Tracked</span>
                                            <span className="sm:hidden">Jurisdictions</span>
                                        </p>
                                        <p className="text-lg md:text-2xl font-bold">{Object.keys(stateStats).length}</p>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                </AnimatedSection>
            </div>
        </AnimatedSection>
    );
});

