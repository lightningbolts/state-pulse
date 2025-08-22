"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, MapPin, ArrowRight, TrendingUp, Users } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { StateData } from '@/types/jurisdictions';
import { AnimatedSection } from "@/components/ui/AnimatedSection";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTheme } from 'next-themes';
import Map, { Marker as MapLibreMarker, Popup as MapLibrePopup } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import Link from 'next/link';

const DEFAULT_POSITION: [number, number] = [39.8283, -98.5795];
const DEFAULT_ZOOM = 3.5;

export default function MapShowcase() {
    const { resolvedTheme } = useTheme ? useTheme() : { resolvedTheme: 'light' };
    const [isClient, setIsClient] = useState(false);
    const [selectedState, setSelectedState] = useState<string | null>(null);
    const [selectedStatePopupCoords, setSelectedStatePopupCoords] = useState<[number, number] | null>(null);
    const [stateStats, setStateStats] = useState<Record<string, StateData>>({});
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

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

    const handleStateClick = (stateAbbr: string, coords?: [number, number]) => {
        setSelectedState(stateAbbr);
        if (coords) {
            setSelectedStatePopupCoords(coords);
        } else {
            setSelectedStatePopupCoords(null);
        }
    };

    const getStateColor = useCallback((stateAbbr: string) => {
        const state = stateStats[stateAbbr];
        if (!state) return '#e0e0e0';

        const intensity = Math.min(state.legislationCount / 3000, 1);
        // Use consistent primary color scheme that matches legend
        if (intensity >= 0.7) return 'hsl(var(--primary))'; // High activity
        if (intensity >= 0.3) return 'hsl(var(--primary) / 0.5)'; // Medium activity
        return 'hsl(var(--primary) / 0.2)'; // Low activity
    }, [stateStats]);

    // Memoize marker sizes/colors for MapLibre
    const memoizedMarkers = useMemo(() => {
        const markers: Record<string, { color: string, size: number }> = {};
        Object.entries(stateStats).forEach(([abbr, state]) => {
            const color = getStateColor(abbr);
            const minSize = 8;
            const count = state.legislationCount || 0;
            const k = 0.5;
            let size = 15;
            if (count < 1) {
                size = minSize;
            } else {
                size = Math.max(minSize, k * Math.sqrt(count));
            }
            markers[abbr] = { color, size };
        });
        return markers;
    }, [getStateColor, stateStats]);

    const getActivityLevel = (stateAbbr: string) => {
        const state = stateStats[stateAbbr];
        if (!state) return 'No Data';

        const intensity = Math.min(state.legislationCount / 3000, 1);
        if (intensity >= 0.7) return 'High Activity';
        if (intensity >= 0.3) return 'Medium Activity';
        return 'Low Activity';
    };

    if (!isClient) {
        return (
            <AnimatedSection className="py-20 px-6 md:px-10">
                <div className="container mx-auto">
                    <Card className="shadow-lg">
                        <CardHeader className="text-center">
                            <CardTitle className="text-3xl font-bold mb-4">Legislative Activity Across America</CardTitle>
                            <CardDescription>
                                Explore real-time legislative data and trends from all 50 states
                            </CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="h-[400px] w-full rounded-md overflow-hidden border flex items-center justify-center bg-muted">
                                <div className="flex items-center space-x-2">
                                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                                    <span>Loading map...</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </AnimatedSection>
        );
    }

    const totalLegislation = Object.values(stateStats).reduce((sum, state) => sum + state.legislationCount, 0);
    const totalRepresentatives = Object.values(stateStats).reduce((sum, state) => sum + state.activeRepresentatives, 0);
    const totalRecentActivity = Object.values(stateStats).reduce((sum, state) => sum + state.recentActivity, 0);

    return (
        <AnimatedSection className="rounded-md py-20 px-6 md:px-10 bg-muted/30">
            <div className="container mx-auto">
                <div className="text-center mb-12">
                    <h2 className="text-2xl md:text-4xl font-bold mb-4 tracking-tight">
                        <span className="hidden sm:inline">Legislative Activity Across America</span>
                        <span className="sm:hidden">Legislative Activity</span>
                    </h2>
                    <p className="text-muted-foreground text-sm md:text-lg mb-8 max-w-2xl mx-auto leading-relaxed">
                        <span className="hidden sm:inline">Explore real-time legislative data and trends from all 50 states. Click on any state to see detailed information.</span>
                        <span className="sm:hidden">Explore legislative data from all 50 states. Tap any state for details.</span>
                    </p>
                </div>

                <Card className="shadow-xl mb-8">
                    <CardContent className="p-3 md:p-6">
                        <div className="relative">
                            <div className="h-[250px] sm:h-[350px] md:h-[400px] w-full rounded-md overflow-hidden border">
                                {loading ? (
                                    <div className="flex items-center justify-center h-full bg-muted">
                                        <div className="flex items-center space-x-2">
                                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                                            <span>Loading legislative data...</span>
                                        </div>
                                    </div>
                                ) : error ? (
                                    <div className="flex items-center justify-center h-full bg-muted">
                                        <span className="text-red-500">{error}</span>
                                    </div>
                                ) : (
                                    <Map
                                        initialViewState={{ longitude: DEFAULT_POSITION[1], latitude: DEFAULT_POSITION[0], zoom: DEFAULT_ZOOM }}
                                        style={{ height: '100%', width: '100%' }}
                                        mapStyle={
                                            resolvedTheme === 'dark'
                                                ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
                                                : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
                                        }
                                        interactiveLayerIds={[]}
                                    >
                                        {Object.entries(stateStats).map(([abbr, state]) => {
                                            const { color, size } = memoizedMarkers[abbr] || { color: '#e0e0e0', size: 15 };
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
                                                        className="transition-all duration-200 ease-in-out hover:scale-125 active:scale-110 cursor-pointer touch-manipulation"
                                                        style={{
                                                            width: Math.max(size, 12), // Minimum touch target of 12px on mobile
                                                            height: Math.max(size, 12),
                                                            backgroundColor: color,
                                                            border: '2px solid #fff',
                                                            borderRadius: '50%',
                                                            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
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
                                                                width: Math.max(4, Math.max(size, 12) * 0.3),
                                                                height: Math.max(4, Math.max(size, 12) * 0.3),
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
                                        {selectedState && selectedStatePopupCoords && stateStats[selectedState] && (
                                            <MapLibrePopup
                                                longitude={selectedStatePopupCoords[1]}
                                                latitude={selectedStatePopupCoords[0]}
                                                anchor="bottom"
                                                onClose={() => { setSelectedState(null); setSelectedStatePopupCoords(null); }}
                                                closeOnClick={false}
                                                maxWidth="90vw"
                                                className="!max-w-[280px] sm:!max-w-[320px]"
                                            >
                                                <div className="p-2 sm:p-3">
                                                    <div className="flex items-center justify-between mb-3">
                                                        <h3 className="font-semibold text-sm sm:text-lg line-clamp-1 pr-2">{stateStats[selectedState].name}</h3>
                                                        <div className="flex items-center space-x-1">
                                                            <div
                                                                className={`w-3 h-3 rounded-full ${
                                                                    getActivityLevel(selectedState) === 'High Activity' ? 'bg-primary' :
                                                                        getActivityLevel(selectedState) === 'Medium Activity' ? 'bg-primary/50' :
                                                                            'bg-primary/20'
                                                                }`}
                                                            ></div>
                                                            <span className="text-xs text-muted-foreground hidden sm:inline">
                                                                {getActivityLevel(selectedState).replace(' Activity', '')}
                                                            </span>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-2 text-xs sm:text-sm">
                                                        <div className="flex justify-between items-center">
                                                            <span className="flex items-center">
                                                                <FileText className="w-3 h-3 sm:w-4 sm:h-4 mr-1 flex-shrink-0" />
                                                                <span className="hidden sm:inline">Active Bills:</span>
                                                                <span className="sm:hidden">Bills:</span>
                                                            </span>
                                                            <Badge variant="secondary" className="text-xs">{stateStats[selectedState].legislationCount}</Badge>
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <span className="flex items-center">
                                                                <Users className="w-3 h-3 sm:w-4 sm:h-4 mr-1 flex-shrink-0" />
                                                                <span className="hidden sm:inline">Representatives:</span>
                                                                <span className="sm:hidden">Reps:</span>
                                                            </span>
                                                            <Badge variant="secondary" className="text-xs">{stateStats[selectedState].activeRepresentatives}</Badge>
                                                        </div>
                                                        <div className="flex justify-between items-center">
                                                            <span className="flex items-center">
                                                                <TrendingUp className="w-3 h-3 sm:w-4 sm:h-4 mr-1 flex-shrink-0" />
                                                                <span className="hidden sm:inline">Recent Activity:</span>
                                                                <span className="sm:hidden">Recent:</span>
                                                            </span>
                                                            <Badge variant="secondary" className="text-xs">{stateStats[selectedState].recentActivity}</Badge>
                                                        </div>
                                                        <div className="pt-2 border-t">
                                                            <p className="text-xs text-muted-foreground mb-2">
                                                                <span className="hidden sm:inline">Key Topics:</span>
                                                                <span className="sm:hidden">Topics:</span>
                                                            </p>
                                                            <div className="flex flex-wrap gap-1">
                                                                {[...new Set(stateStats[selectedState].keyTopics)].slice(0, 2).map((topic, index) => (
                                                                    <Badge key={`${topic}-${index}`} variant="outline" className="text-xs">
                                                                        <span className="line-clamp-1">{topic.length > 15 ? topic.substring(0, 15) + '...' : topic}</span>
                                                                    </Badge>
                                                                ))}
                                                                {stateStats[selectedState].keyTopics.length > 2 && (
                                                                    <Badge variant="outline" className="text-xs">
                                                                        +{stateStats[selectedState].keyTopics.length - 2}
                                                                    </Badge>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </MapLibrePopup>
                                        )}
                                    </Map>
                                )}
                            </div>

                            {/* Legend */}
                            <div className="mt-3 md:mt-4 flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-2 sm:space-y-0 text-xs text-muted-foreground">
                                <div className="flex items-center space-x-2 sm:space-x-4 overflow-x-auto">
                                    <div className="flex items-center space-x-1 flex-shrink-0">
                                        <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-primary"></div>
                                        <span className="whitespace-nowrap">
                                            <span className="hidden sm:inline">High Activity</span>
                                            <span className="sm:hidden">High</span>
                                        </span>
                                    </div>
                                    <div className="flex items-center space-x-1 flex-shrink-0">
                                        <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-primary/50"></div>
                                        <span className="whitespace-nowrap">
                                            <span className="hidden sm:inline">Medium Activity</span>
                                            <span className="sm:hidden">Medium</span>
                                        </span>
                                    </div>
                                    <div className="flex items-center space-x-1 flex-shrink-0">
                                        <div className="w-2 h-2 sm:w-3 sm:h-3 rounded-full bg-primary/20"></div>
                                        <span className="whitespace-nowrap">
                                            <span className="hidden sm:inline">Low Activity</span>
                                            <span className="sm:hidden">Low</span>
                                        </span>
                                    </div>
                                </div>
                                <div className="text-xs text-center sm:text-right">
                                    <span className="hidden sm:inline">Click on any state to see detailed information</span>
                                    <span className="sm:hidden">Tap any state for details</span>
                                </div>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Quick Stats */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-8">
                    <Card className="hover:shadow-xl hover:-translate-y-1 active:translate-y-0 transition-all duration-300">
                        <CardContent className="p-4 md:p-6 text-center">
                            <div className="flex items-center justify-center mb-2">
                                <FileText className="h-6 w-6 md:h-8 md:w-8 text-blue-500" />
                            </div>
                            <p className="text-2xl md:text-3xl font-bold mb-1">{totalLegislation.toLocaleString()}</p>
                            <p className="text-xs md:text-sm text-muted-foreground">
                                <span className="hidden sm:inline">Active Bills & Resolutions</span>
                                <span className="sm:hidden">Active Bills</span>
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="hover:shadow-xl hover:-translate-y-1 active:translate-y-0 transition-all duration-300">
                        <CardContent className="p-4 md:p-6 text-center">
                            <div className="flex items-center justify-center mb-2">
                                <Users className="h-6 w-6 md:h-8 md:w-8 text-green-500" />
                            </div>
                            <p className="text-2xl md:text-3xl font-bold mb-1">{totalRepresentatives.toLocaleString()}</p>
                            <p className="text-xs md:text-sm text-muted-foreground">
                                <span className="hidden sm:inline">Active Sponsors</span>
                                <span className="sm:hidden">Sponsors</span>
                            </p>
                        </CardContent>
                    </Card>

                    <Card className="hover:shadow-xl hover:-translate-y-1 active:translate-y-0 transition-all duration-300">
                        <CardContent className="p-4 md:p-6 text-center">
                            <div className="flex items-center justify-center mb-2">
                                <TrendingUp className="h-6 w-6 md:h-8 md:w-8 text-orange-500" />
                            </div>
                            <p className="text-2xl md:text-3xl font-bold mb-1">{totalRecentActivity.toLocaleString()}</p>
                            <p className="text-xs md:text-sm text-muted-foreground">
                                <span className="hidden sm:inline">Recent Actions (30 days)</span>
                                <span className="sm:hidden">Recent Actions</span>
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Call to Action */}
                <div className="text-center">
                    <Button asChild size="lg" className="px-6 md:px-8 py-3 text-base md:text-lg shadow-lg hover:shadow-xl transition-shadow">
                        <Link href="/dashboard">
                            <span className="hidden sm:inline">Explore Full Interactive Dashboard</span>
                            <span className="sm:hidden">Explore Full Dashboard</span>
                            <ArrowRight className="ml-2 h-4 w-4 md:h-5 md:w-5" />
                        </Link>
                    </Button>
                    <p className="text-xs md:text-sm text-muted-foreground mt-4 px-4">
                        <span className="hidden sm:inline">Discover congressional districts, party affiliations, gerrymandering analysis, and more</span>
                        <span className="sm:hidden">Discover districts, party data, and more</span>
                    </p>
                </div>
            </div>
        </AnimatedSection>
    );
}
