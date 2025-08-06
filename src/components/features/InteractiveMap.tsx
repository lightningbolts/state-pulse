"use client";

import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import type {LatLngExpression} from 'leaflet';
import dynamic from 'next/dynamic';
import {useCallback, useEffect, useMemo, useState, useRef} from 'react';
// Helper: API URLs for district GeoJSON overlays
const DISTRICT_GEOJSON_URLS: Record<string, string> = {
  'congressional-districts': '/districts/congressional-districts.geojson',
  'state-upper-districts': '/districts/state-upper-districts.geojson',
  'state-lower-districts': '/districts/state-lower-districts.geojson',
};

// Helper: Color by district type
const DISTRICT_COLORS: Record<string, string> = {
  'congressional-districts': '#2563eb', // blue
  'state-upper-districts': '#a21caf',   // purple
  'state-lower-districts': '#16a34a',   // green
};
import {Calendar, FileText, MapPin, TrendingUp, Users} from 'lucide-react';
import {useRouter} from 'next/navigation';
import {StateData} from '@/types/jurisdictions';
import {MapMode} from "@/types/geo";
import {AnimatedSection} from "@/components/ui/AnimatedSection";

// Import Leaflet for custom icons
import { RepresentativesResults } from "./RepresentativesResults";
import { ChamberMakeup } from "./ChamberMakeup";
let L: any = null;
if (typeof window !== 'undefined') {
    L = require('leaflet');
    // Inject custom marker hover CSS if not already present
    if (!document.getElementById('custom-marker-hover-style')) {
      const style = document.createElement('style');
      style.id = 'custom-marker-hover-style';
      style.innerHTML = `
        .custom-marker {
          transition: transform 0.18s cubic-bezier(0.4,0.2,0.2,1), box-shadow 0.18s cubic-bezier(0.4,0.2,0.2,1);
          border-radius: 50%;
          overflow: hidden;
          box-sizing: border-box;
          background-clip: padding-box;
          background-color: inherit;
        }
        .custom-marker-inner {
          transform: translate(-50%, -50%);
        }
        .custom-marker:hover {
          transform: scale(1.18);
          z-index: 10;
          box-shadow: 0 4px 12px rgba(0,0,0,0.25);
        }
      `;
      document.head.appendChild(style);
    }
}

// Dynamically import map components
const MapContainer = dynamic(
    () => import('react-leaflet').then((mod) => mod.MapContainer),
    {
        ssr: false,
        loading: () => <div
            className="h-[500px] w-full rounded-md overflow-hidden border flex items-center justify-center bg-muted">
            <p>Loading map assets...</p></div>,
    }
);

const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), {
    ssr: false,
});

const GeoJSON = dynamic(() => import('react-leaflet').then(mod => mod.GeoJSON), {
    ssr: false,
});

const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), {
    ssr: false,
});

const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), {
    ssr: false,
});

const DEFAULT_POSITION: LatLngExpression = [39.8283, -98.5795];
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
    const [isClient, setIsClient] = useState(false);
    const [selectedState, setSelectedState] = useState<string | null>(null);
    const [mapMode, setMapMode] = useState<string>('legislation');
    const [stateStats, setStateStats] = useState<Record<string, StateData>>({});
    const [stateDetails, setStateDetails] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [detailsLoading, setDetailsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    // District overlays
    const [districtGeoJson, setDistrictGeoJson] = useState<any>(null);
    const [districtLoading, setDistrictLoading] = useState(false);
    const [districtError, setDistrictError] = useState<string | null>(null);
    const [selectedDistrict, setSelectedDistrict] = useState<any>(null); // Store clicked district feature
    const [districtReps, setDistrictReps] = useState<any[]>([]); // Store reps for selected district
    const [districtPopupLatLng, setDistrictPopupLatLng] = useState<any>(null); // Popup position
    const mapRef = useRef<any>(null);
    // Fetch district GeoJSON when district map mode is selected
    useEffect(() => {
        if (mapMode === 'congressional-districts' || mapMode === 'state-upper-districts' || mapMode === 'state-lower-districts') {
            setDistrictLoading(true);
            setDistrictError(null);
            // Add cache-busting query param
            const url = DISTRICT_GEOJSON_URLS[mapMode] + '?cb=' + Date.now();
            fetch(url)
                .then(res => {
                    if (!res.ok) throw new Error('Failed to fetch district boundaries');
                    return res.json();
                })
                .then(geojson => {
                    setDistrictGeoJson(geojson);
                    setDistrictLoading(false);
                })
                .catch(err => {
                    setDistrictError('Failed to load district boundaries');
                    setDistrictGeoJson(null);
                    setDistrictLoading(false);
                });
        } else {
            setDistrictGeoJson(null);
        }
    }, [mapMode]);

    useEffect(() => {
        setIsClient(true);
        // Fetch initial data
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
            // Fallback to empty data
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

    const handleStateClick = (stateAbbr: string) => {
        setSelectedState(stateAbbr);
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

    // Memoize icons to prevent re-creating them on every render
    const memoizedIcons = useMemo(() => {
        if (!L) return {};

        const icons: Record<string, any> = {};
        Object.entries(stateStats).forEach(([abbr, state]) => {
            const color = getStateColor(abbr);
            let size = 20;
            if (mapMode === 'legislation') {
                // Area ∝ count, so diameter ∝ sqrt(count)
                const minSize = 5;
                const count = state.legislationCount || 0;
                // Choose a scaling constant so that 1000 bills = reasonable size (e.g., 20px)
                const k = 0.63; // sqrt(1000) * 0.63 ≈ 20
                if (count < 1) {
                    size = minSize;
                } else {
                    size = Math.max(minSize, k * Math.sqrt(count));
                }
            }
            icons[abbr] = L.divIcon({
                className: 'custom-marker',
                html: `
            <div class="marker-pin custom-marker" style="
              width: ${size}px;
              height: ${size}px;
              background-color: ${color};
              border: 2px solid hsl(var(--background));
              border-radius: 50%;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              position: relative;
              overflow: hidden;
              box-sizing: border-box;
            ">
              <div class="custom-marker-inner" style="
                position: absolute;
                top: 50%;
                left: 50%;
                width: ${Math.max(8, size * 0.4)}px;
                height: ${Math.max(8, size * 0.4)}px;
                background: none;
                background-color: hsl(var(--background));
                border-radius: 50%;
                overflow: hidden;
                outline: none;
                box-sizing: border-box;
              "></div>
            </div>
          `,
                iconSize: [size, size],
                iconAnchor: [size / 2, size / 2],
                popupAnchor: [0, -size / 2],
            });
        });
        return icons;
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

    // Handler for district click
    const onDistrictClick = async (event: any) => {
        const feature = event.sourceTarget.feature;
        setSelectedDistrict(feature);
        setDistrictPopupLatLng(event.latlng);
        setDistrictReps([]); // Clear while loading
        try {
            // Get lat/lng from click event
            const lat = event.latlng.lat;
            const lng = event.latlng.lng;
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
            // Compose API call to internal civic endpoint
            const url = `/api/civic?lat=${encodeURIComponent(lat)}&lng=${encodeURIComponent(lng)}&state=${encodeURIComponent(state)}`;
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


                        {/* Map Container with district overlays */}
                        <div className="relative">
                            <div className="h-[300px] sm:h-[400px] md:h-[500px] w-full rounded-md overflow-hidden border">
                                <MapContainer
                                    key="dashboard-map"
                                    center={DEFAULT_POSITION}
                                    zoom={DEFAULT_ZOOM}
                                    style={{height: '100%', width: '100%'}}
                                    className="z-0"
                                    ref={mapRef}
                                >
                                    <TileLayer
                                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    />


                                    {/* District overlays */}
                                    {districtGeoJson && (mapMode === 'congressional-districts' || mapMode === 'state-upper-districts' || mapMode === 'state-lower-districts') && (
                                        <GeoJSON
                                            key={mapMode + '-' + (districtGeoJson?.features?.length || 0)}
                                            data={districtGeoJson}
                                            style={() => ({
                                                color: DISTRICT_COLORS[mapMode],
                                                weight: 2,
                                                fillOpacity: 0,
                                            })}
                                            eventHandlers={{
                                                click: onDistrictClick
                                            }}
                                        />
                                    )}

                                    {districtPopupLatLng && (
                                        <Marker
                                            position={districtPopupLatLng}
                                            draggable={true}
                                            eventHandlers={{
                                                dragend: async (e: any) => {
                                                    const latlng = e.target.getLatLng();
                                                    setDistrictPopupLatLng(latlng);
                                                    // Simulate a map click at the new location to update reps
                                                    try {
                                                        // Map FIPS code to state abbreviation if needed
                                                        const FIPS_TO_ABBR: Record<string, string> = {
                                                            '01': 'AL','02': 'AK','04': 'AZ','05': 'AR','06': 'CA','08': 'CO','09': 'CT','10': 'DE','11': 'DC','12': 'FL','13': 'GA','15': 'HI','16': 'ID','17': 'IL','18': 'IN','19': 'IA','20': 'KS','21': 'KY','22': 'LA','23': 'ME','24': 'MD','25': 'MA','26': 'MI','27': 'MN','28': 'MS','29': 'MO','30': 'MT','31': 'NE','32': 'NV','33': 'NH','34': 'NJ','35': 'NM','36': 'NY','37': 'NC','38': 'ND','39': 'OH','40': 'OK','41': 'OR','42': 'PA','44': 'RI','45': 'SC','46': 'SD','47': 'TN','48': 'TX','49': 'UT','50': 'VT','51': 'VA','53': 'WA','54': 'WV','55': 'WI','56': 'WY','72': 'PR'
                                                        };
                                                        let state = selectedDistrict?.properties?.state || selectedDistrict?.properties?.STATE || selectedDistrict?.properties?.STATEFP || '';
                                                        if (!state && selectedDistrict?.properties?.STATEFP) {
                                                            state = FIPS_TO_ABBR[selectedDistrict.properties.STATEFP] || '';
                                                        } else if (/^\d{2}$/.test(state)) {
                                                            state = FIPS_TO_ABBR[state] || '';
                                                        }
                                                        const url = `/api/civic?lat=${encodeURIComponent(latlng.lat)}&lng=${encodeURIComponent(latlng.lng)}&state=${encodeURIComponent(state)}`;
                                                        setDistrictReps([]);
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
                                                }
                                            }}
                                            icon={L && L.divIcon ? L.divIcon({
                                                className: 'selected-point-marker',
                                                html: `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' fill='none' stroke='#eb7725ff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='lucide lucide-map-pin' viewBox='0 0 24 24' style='display:block;'><path d='M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0Z'/><circle cx='12' cy='10' r='3'/></svg>`,
                                                iconSize: [28, 28],
                                                iconAnchor: [14, 28],
                                                popupAnchor: [0, -28],
                                            }) : undefined}
                                        />
                                    )}

    {!(mapMode === 'congressional-districts' || mapMode === 'state-upper-districts' || mapMode === 'state-lower-districts') &&
        Object.entries(stateStats).map(([abbr, state]) => (
            <Marker
                key={abbr}
                position={state.center}
                eventHandlers={{
                    click: () => handleStateClick(abbr),
                }}
                icon={memoizedIcons[abbr]}
            >
                <Popup>
                    <div className="p-2 min-w-[180px] sm:min-w-[200px]">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="font-semibold text-sm md:text-lg line-clamp-1">{state.name}</h3>
                            <div className="flex items-center space-x-1">
                                <div
                                    className={`w-2 h-2 md:w-3 md:h-3 rounded-full ${
                                        getActivityLevel(abbr) === 'High Activity' ? 'bg-primary' :
                                            getActivityLevel(abbr) === 'Medium Activity' ? 'bg-primary/50' :
                                                getActivityLevel(abbr) === 'Low Activity' ? 'bg-primary/20' :
                                                    'bg-gray-300'
                                    }`}
                                ></div>
                                <span
                                    className="text-xs text-muted-foreground hidden sm:inline">
                                    {getActivityLevel(abbr)}
                                </span>
                            </div>
                        </div>
                        <div className="space-y-1 md:space-y-2 text-xs md:text-sm">
                            <div className="flex justify-between">
                                <span>Bills:</span>
                                <Badge variant="secondary"
                                       className="text-xs">{state.legislationCount}</Badge>
                            </div>
                            <div className="flex justify-between">
                                <span>Reps:</span>
                                <Badge variant="secondary"
                                       className="text-xs">{state.activeRepresentatives}</Badge>
                            </div>
                            <div className="flex justify-between">
                                <span>Recent:</span>
                                <Badge variant="secondary"
                                       className="text-xs">{state.recentActivity}</Badge>
                            </div>
                            <div className="pt-1 md:pt-2">
                                <div className="text-xs text-muted-foreground mb-1">
                                    <span className="hidden sm:inline">Key Topics:</span>
                                    <span className="sm:hidden">Topics:</span>
                                </div>
                                <div className="flex flex-wrap gap-1">
                                    {[...new Set(state.keyTopics)].slice(0, 3).map((topic, index) => (
                                        <Badge key={`${topic}-${index}`} variant="secondary"
                                               className="text-xs">
                                            {topic}
                                        </Badge>
                                    ))}
                                    {state.keyTopics.length > 3 && (
                                        <Badge variant="outline" className="text-xs">
                                            +{state.keyTopics.length - 3}
                                        </Badge>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </Popup>
            </Marker>
        ))}
                                </MapContainer>
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
                  <div className="mt-4">
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
                                            <span className="hidden sm:inline">Active Representatives</span>
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
