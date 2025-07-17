"use client";

import {Card, CardContent, CardDescription, CardHeader, CardTitle} from "@/components/ui/card";
import {Badge} from "@/components/ui/badge";
import {Button} from "@/components/ui/button";
import type {LatLngExpression} from 'leaflet';
import dynamic from 'next/dynamic';
import {useCallback, useEffect, useMemo, useState} from 'react';
import {Calendar, FileText, MapPin, TrendingUp, Users} from 'lucide-react';
import {useRouter} from 'next/navigation';
import {StateData} from '@/types/jurisdictions';
import {MapMode} from "@/types/geo";
import {AnimatedSection} from "@/components/ui/AnimatedSection";

// Import Leaflet for custom icons
let L: any = null;
if (typeof window !== 'undefined') {
    L = require('leaflet');
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

        const uniqueColors = [...new Set(Object.keys(stateStats).map(abbr => getStateColor(abbr)))];
        const icons: Record<string, any> = {};

        uniqueColors.forEach(color => {
            if (color) {
                icons[color] = L.divIcon({
                    className: 'custom-marker',
                    html: `
            <div class="marker-pin" style="
              width: 20px;
              height: 20px;
              background-color: ${color};
              border: 2px solid hsl(var(--background));
              border-radius: 50%;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              position: relative;
            ">
              <div style="
                position: absolute;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                width: 8px;
                height: 8px;
                background-color: hsl(var(--background));
                border-radius: 50%;
              "></div>
            </div>
          `,
                    iconSize: [20, 20],
                    iconAnchor: [10, 10],
                    popupAnchor: [0, -10],
                });
            }
        });

        return icons;
    }, [getStateColor, stateStats]);

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
                            Interactive State Dashboard
                        </CardTitle>
                        <CardDescription>
                            Explore state-level legislative activity, representatives, and policy trends across the
                            United States.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div
                            className="h-[500px] w-full rounded-md overflow-hidden border flex items-center justify-center bg-muted">
                            <p>Loading interactive map...</p>
                        </div>
                    </CardContent>
                </Card>
            </AnimatedSection>
        );
    }

    return (
        <AnimatedSection>
            <div className="space-y-6">
                <Card className="shadow-lg">
                    <CardHeader className="pb-3 md:pb-6">
                        <CardTitle className="text-lg md:text-xl">
                            <span className="hidden sm:inline">Interactive State Dashboard</span>
                            <span className="sm:hidden">State Dashboard</span>
                        </CardTitle>
                        <CardDescription className="text-xs md:text-sm">
              <span className="hidden sm:inline">
                Explore state-level legislative activity, representatives, and policy trends across the United States.
              </span>
                            <span className="sm:hidden">
                Explore state legislative activity and trends.
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
                                    const isDisabled = mode.id !== 'legislation'; // Only legislation mode is active
                                    return (
                                        <Button
                                            key={mode.id}
                                            variant={mapMode === mode.id ? "default" : "outline"}
                                            size="sm"
                                            onClick={() => !isDisabled && setMapMode(mode.id)}
                                            disabled={isDisabled}
                                            className={`flex flex-col items-center gap-1 lg:flex-row lg:gap-2 h-auto p-2 lg:p-3 min-h-[60px] lg:min-h-[auto] ${
                                                isDisabled ? 'opacity-50 cursor-not-allowed' : ''
                                            }`}
                                        >
                                            <IconComponent className="h-3 w-3 lg:h-4 lg:w-4 flex-shrink-0"/>
                                            <div className="text-center lg:text-left min-w-0 flex-1">
                                                <div className="font-medium text-xs leading-tight">
                                                    <span className="hidden xl:inline">{mode.label}</span>
                                                    <span className="xl:hidden">
                            {mode.label.replace('Activity', '').replace('Representatives', 'Reps').replace('Legislation', 'Bills').trim()}
                          </span>
                                                </div>
                                                {isDisabled && (
                                                    <div
                                                        className="text-xs text-muted-foreground hidden lg:block mt-1">Coming
                                                        Soon</div>
                                                )}
                                            </div>
                                        </Button>
                                    );
                                })}
                            </div>
                            <p className="text-xs text-muted-foreground hidden md:block">
                                {mapModes.find(m => m.id === mapMode)?.description}
                            </p>
                        </div>

                        {/* Map Container */}
                        <div className="relative">
                            <div
                                className="h-[300px] sm:h-[400px] md:h-[500px] w-full rounded-md overflow-hidden border">
                                <MapContainer
                                    key="dashboard-map"
                                    center={DEFAULT_POSITION}
                                    zoom={DEFAULT_ZOOM}
                                    style={{height: '100%', width: '100%'}}
                                    className="z-0"
                                >
                                    <TileLayer
                                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                    />

                                    {/* State Markers */}
                                    {Object.entries(stateStats).map(([abbr, state]) => (
                                        <Marker
                                            key={abbr}
                                            position={state.center}
                                            eventHandlers={{
                                                click: () => handleStateClick(abbr),
                                            }}
                                            icon={memoizedIcons[getStateColor(abbr)]}
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

                            {loading && (
                                <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                                    <div className="flex items-center space-x-2">
                                        <div
                                            className="animate-spin rounded-full h-3 w-3 md:h-4 md:w-4 border-b-2 border-primary"></div>
                                        <span className="text-xs md:text-sm">
                      <span className="hidden sm:inline">Updating map data...</span>
                      <span className="sm:hidden">Loading...</span>
                    </span>
                                    </div>
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
                                            <span className="sm:hidden">States</span>
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
