"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Calendar, FileText, MapPin, TrendingUp, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { StateData } from '@/types/jurisdictions';
import { MapMode } from "@/types/geo";
import { AnimatedSection } from "@/components/ui/AnimatedSection";
import { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useTheme } from 'next-themes';
import { DistrictMapGL } from './DistrictMapGL';
const DISTRICT_GEOJSON_URLS: Record<string, string> = {
  'congressional-districts': '/districts/congressional-districts.geojson',
  'state-upper-districts': '/districts/state-upper-districts.geojson',
  'state-lower-districts': '/districts/state-lower-districts.geojson',
};

// Helper: Color by district type
const DISTRICT_COLORS: Record<string, string> = {
  'congressional-districts': '#2563eb',
  'state-upper-districts': '#a21caf',
  'state-lower-districts': '#16a34a',
};

const PARTY_COLORS: Record<string, string> = {
  'Democratic': '#2563eb', // Blue
  'Republican': '#dc2626', // Red
  'Independent': '#22c55e', // Green (solid color instead of CSS variable)
  'Nonpartisan': '#8b5cf6', // Purple
  'Unknown': '#6b7280' // Gray
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

const DISTRICT_TO_CHAMBER: Record<string, string> = {
  'congressional-districts': 'us_house',
  'state-upper-districts': 'state_upper',
  'state-lower-districts': 'state_lower',
};
import { RepresentativesResults } from "./RepresentativesResults";
import { ChamberMakeup } from "./ChamberMakeup";
import Map, { Marker as MapLibreMarker, Popup as MapLibrePopup, MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

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

export function InteractiveMap() {
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
    

    useEffect(() => {
        setIsClient(true);
        fetchMapData();
    }, []);

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

    const fetchDistrictPartyData = async (chamber: string) => {
        // console.log('fetchDistrictPartyData called with chamber:', chamber);
        setPartyDataLoading(true);
        setPartyDataError(null);
        try {
            const response = await fetch(`/api/dashboard/representatives/${chamber}`);
            // console.log('API response status:', response.status);
            if (!response.ok) {
                throw new Error(`Failed to fetch representatives: ${response.status}`);
            }
            const result = await response.json();
            // console.log('API result:', { count: result.representatives?.length });
            if (result.representatives) {
                // Build district -> party mapping
                const mapping: Record<string, string> = {};
                result.representatives.forEach((rep: any) => {
                    const party = rep.party || 'Unknown';
                    // Use our normalization function
                    const normalizedParty = normalizePartyName(party);
                    
                    // Use the exact map_boundary.district value (contains FIPS code + district)
                    // This matches how the civic API works with GEOID
                    if (rep.map_boundary?.district) {
                        const districtCode = rep.map_boundary.district;
                        mapping[districtCode] = normalizedParty;
                        // console.log(`Mapped ${districtCode} -> ${normalizedParty} (from ${party})`);
                    }
                    
                    // Also use the GEOID from map_boundary if available (backup)
                    if (rep.map_boundary?.geoidfq) {
                        const geoid = rep.map_boundary.geoidfq;
                        mapping[geoid] = normalizedParty;
                        // console.log(`Mapped GEOID ${geoid} -> ${normalizedParty} (from ${party})`);
                    }
                    
                    // For backward compatibility with simple district numbers
                    if (rep.district) {
                        mapping[rep.district.toString()] = normalizedParty;
                    }
                    
                    // Also check current_role.district or division_id
                    const altDistrict = rep.current_role?.district || 
                                      rep.current_role?.division_id?.split(':').pop();
                    if (altDistrict) {
                        mapping[altDistrict.toString()] = normalizedParty;
                    }
                    
                    // For congressional districts, create state+district format  
                    if (rep.state && rep.district) {
                        mapping[`${rep.state}-${rep.district}`] = normalizedParty;
                    }
                    
                    // Special handling for at-large representatives (district is null)
                    if (chamber === 'us_house' && rep.state && (rep.district === null || rep.district === undefined)) {
                        const stateToAtLargeGeoid: Record<string, string> = {
                            'Alaska': '0200',
                            'Delaware': '1000',  
                            'Montana': '3000',
                            'Vermont': '5000',
                            'Wyoming': '5600'
                        };
                        
                        const geoid = stateToAtLargeGeoid[rep.state];
                        if (geoid) {
                            mapping[geoid] = normalizedParty;
                            // console.log(`Mapped at-large representative ${rep.name} (${rep.state}) -> ${geoid} -> ${normalizedParty} (from ${party})`);
                        }
                    }
                });
                
                // Fallback for any at-large districts still not mapped
                if (chamber === 'us_house') {
                    const atLargeStates = {
                        '0200': 'Alaska',
                        '1000': 'Delaware',  
                        '3000': 'Montana',
                        '5000': 'Vermont',
                        '5600': 'Wyoming'
                    };
                    
                    Object.entries(atLargeStates).forEach(([geoid, stateName]) => {
                        if (!mapping[geoid]) {
                            mapping[geoid] = 'Unknown';
                            // console.log(`Added fallback mapping for ${stateName} at-large district ${geoid} -> Unknown`);
                        }
                    });
                }

                // console.log('District party mapping created:', Object.keys(mapping).length, 'mappings');
                // console.log('Sample mappings:', Object.entries(mapping).slice(0, 15));
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
    };    // Effect to fetch party data when district map mode is selected and party affiliation is enabled
    useEffect(() => {
        // console.log('[DEBUG] useEffect triggered:', { mapMode, showPartyAffiliation });
        const isDistrictMode = ['congressional-districts', 'state-upper-districts', 'state-lower-districts'].includes(mapMode);
        // console.log('[DEBUG] isDistrictMode:', isDistrictMode);
        if (isDistrictMode && showPartyAffiliation) {
            const chamber = DISTRICT_TO_CHAMBER[mapMode];
            // console.log('[DEBUG] Fetching party data for chamber:', chamber);
            if (chamber) {
                fetchDistrictPartyData(chamber);
            }
        } else {
            // console.log('[DEBUG] Clearing district party mapping');
            setDistrictPartyMapping({});
        }
    }, [mapMode, showPartyAffiliation]);

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

    // Handler for district click (for MapLibre GL)
    const onDistrictClickGL = async (feature: any, lngLat: {lng: number, lat: number}) => {
        setSelectedDistrict(feature);
        setDistrictPopupLatLng(lngLat);
        setDistrictReps([]); // Clear while loading
        try {
            // Map FIPS code to state abbreviation if needed
            const FIPS_TO_ABBR: Record<string, string> = {
                '01': 'AL','02': 'AK','04': 'AZ','05': 'AR','06': 'CA','08': 'CO','09': 'CT','10': 'DE','11': 'DC','12': 'FL','13': 'GA','15': 'HI','16': 'ID','17': 'IL','18': 'IN','19': 'IA','20': 'KS','21': 'KY','22': 'LA','23': 'ME','24': 'MD','25': 'MA','26': 'MI','27': 'MN','28': 'MS','29': 'MO','30': 'MT','31': 'NE','32': 'NV','33': 'NH','34': 'NJ','35': 'NM','36': 'NY','37': 'NC','38': 'ND','39': 'OH','40': 'OK','41': 'OR','42': 'PA','44': 'RI','45': 'SC','46': 'SD','47': 'TN','48': 'TX','49': 'UT','50': 'VT','51': 'VA','53': 'WA','54': 'WV','55': 'WI','56': 'WY','72': 'PR'
            };
            let state = feature.properties.state || feature.properties.STATE || feature.properties.STATEFP || '';
            if (!state && feature.properties.STATEFP) {
                state = FIPS_TO_ABBR[feature.properties.STATEFP] || '';
            } else if (/^\d{2}$/.test(state)) {
                state = FIPS_TO_ABBR[state] || '';
            }
            const url = `/api/civic?lat=${encodeURIComponent(lngLat.lat)}&lng=${encodeURIComponent(lngLat.lng)}&state=${encodeURIComponent(state)}`;
            const resp = await fetch(url);
            let reps = [];
            if (resp.ok) {
                const data = await resp.json();
                if (data && data.representatives) {
                    reps = data.representatives;
                }
            }
            setDistrictReps(reps);
        } catch (e) {
            setDistrictReps([]);
        }
    };

    return (
        <AnimatedSection>
            <div className="space-y-6">
                <Card className="shadow-lg">
                    <CardHeader className="pb-3 md:pb-6">
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
                                    // Enable all modes
                                    return (
                                        <Button
                                            key={mode.id}
                                            variant={mapMode === mode.id ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => setMapMode(mode.id)}
                                            className={`flex flex-col items-center gap-1 lg:flex-row lg:gap-2 h-auto p-2 lg:p-3 min-h-[60px] lg:min-h-[auto]`}
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


                        {/* Map Container with district overlays */}
                        <div className="relative">
                            <div className="h-[300px] sm:h-[400px] md:h-[500px] w-full rounded-md overflow-hidden border">
                                {(mapMode === 'congressional-districts' || mapMode === 'state-upper-districts' || mapMode === 'state-lower-districts') ? (
                                    <DistrictMapGL
                                        geojsonUrl={DISTRICT_GEOJSON_URLS[mapMode]}
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
                                        popupMarker={districtPopupLatLng ? {
                                            lng: districtPopupLatLng.lng,
                                            lat: districtPopupLatLng.lat,
                                            iconHtml: `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' fill='none' stroke='#eb7725ff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='lucide lucide-map-pin' viewBox='0 0 24 24' style='display:block;'><path d='M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0Z'/><circle cx='12' cy='10' r='3'/></svg>`,
                                            draggable: true,
                                            onDragEnd: (lngLat) => {
                                                setDistrictPopupLatLng(lngLat);
                                                if (selectedDistrict) {
                                                    onDistrictClickGL(selectedDistrict, lngLat);
                                                }
                                            }
                                        } : undefined}
                                    />
                                ) : (
                                    <Map
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
                                                                        <Badge key={`${topic}-${index}`} variant="secondary"
                                                                            className="text-xs">
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
                                    </Map>
                                )}
                            </div>

                            {(loading || districtLoading) && (
                                <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                                    <div className="flex items-center space-x-2">
                                        <div className="animate-spin rounded-full h-3 w-3 md:h-4 md:w-4 border-b-2 border-primary"></div>
                                        <span className="text-xs md:text-sm">
                                            <span className="hidden sm:inline">Updating map data...</span>
                                            <span className="sm:hidden">Loading...</span>
                                        </span>
                                    </div>
                                </div>
                            )}
                            {districtError && (
                                <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                                    <span className="text-xs text-red-500">{districtError}</span>
                                </div>
                            )}
                {selectedDistrict && (
                  <div className="mt-4 bg-card text-foreground border border-border rounded-lg shadow-lg p-3 dark:!bg-zinc-900 dark:!text-white dark:!border-zinc-700">
                    <h3 className="font-semibold text-base md:text-lg mb-2">
                      {districtPopupLatLng ? ` (${districtPopupLatLng.lat.toFixed(5)}, ${districtPopupLatLng.lng.toFixed(5)})` : ''}
                      <button
                        className="ml-2 text-lg text-gray-400 hover:text-gray-700"
                        onClick={() => { setSelectedDistrict(null); setDistrictPopupLatLng(null); }}
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

                        {/* Legend */}
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
}
