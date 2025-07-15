"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { LatLngExpression } from 'leaflet';
import dynamic from 'next/dynamic';
import { useState, useEffect } from 'react';
import { MapPin, Users, FileText, TrendingUp, Calendar, AlertCircle } from 'lucide-react';

// Import Leaflet for custom icons
let L: any = null;
if (typeof window !== 'undefined') {
  L = require('leaflet');
}

// Dynamically import map components
const MapContainer = dynamic(
  () => import('react-leaflet').then((mod) => mod.MapContainer),
  { ssr: false,
    loading: () => <div className="h-[500px] w-full rounded-md overflow-hidden border flex items-center justify-center bg-muted"><p>Loading map assets...</p></div>,
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

// US States data structure
interface StateData {
  name: string;
  abbreviation: string;
  legislationCount: number;
  activeRepresentatives: number;
  recentActivity: number;
  keyTopics: string[];
  center: LatLngExpression;
  color: string;
}

interface MapMode {
  id: string;
  label: string;
  description: string;
  icon: any;
}

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

  // Create custom marker icon
  const createCustomIcon = (color: string) => {
    if (!L) return undefined;

    return L.divIcon({
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
  };

  const getStateColor = (stateAbbr: string) => {
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
  };

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
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-2xl flex items-center">
            <MapPin className="mr-3 h-7 w-7" />
            Interactive State Dashboard
          </CardTitle>
          <CardDescription>
            Explore state-level legislative activity, representatives, and policy trends across the United States.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[500px] w-full rounded-md overflow-hidden border flex items-center justify-center bg-muted">
            <p>Loading interactive map...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-2xl flex items-center">
            <MapPin className="mr-3 h-7 w-7" />
            Interactive State Dashboard
          </CardTitle>
          <CardDescription>
            Explore state-level legislative activity, representatives, and policy trends across the United States.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Map Mode Selector */}
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Map View Mode</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
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
                    className={`flex items-center gap-2 h-auto p-3 ${
                      isDisabled ? 'opacity-50 cursor-not-allowed' : ''
                    }`}
                  >
                    <IconComponent className="h-4 w-4" />
                    <div className="text-left">
                      <div className="font-medium text-xs">{mode.label}</div>
                      {isDisabled && (
                        <div className="text-xs text-muted-foreground">Coming Soon</div>
                      )}
                    </div>
                  </Button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">
              {mapModes.find(m => m.id === mapMode)?.description}
            </p>
          </div>

          {/* Map Container */}
          <div className="relative">
            <div className="h-[500px] w-full rounded-md overflow-hidden border">
              <MapContainer
                key="dashboard-map"
                center={DEFAULT_POSITION}
                zoom={DEFAULT_ZOOM}
                style={{ height: '100%', width: '100%' }}
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
                    icon={createCustomIcon(getStateColor(abbr))}
                  >
                    <Popup>
                      <div className="p-2 min-w-[200px]">
                        <div className="flex items-center justify-between mb-2">
                          <h3 className="font-semibold text-lg">{state.name}</h3>
                          <div className="flex items-center space-x-1">
                            <div
                              className={`w-3 h-3 rounded-full ${
                                getActivityLevel(abbr) === 'High Activity' ? 'bg-primary' :
                                getActivityLevel(abbr) === 'Medium Activity' ? 'bg-primary/50' :
                                getActivityLevel(abbr) === 'Low Activity' ? 'bg-primary/20' :
                                'bg-gray-300'
                              }`}
                            ></div>
                            <span className="text-xs text-muted-foreground">
                              {getActivityLevel(abbr)}
                            </span>
                          </div>
                        </div>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span>Legislation:</span>
                            <Badge variant="secondary">{state.legislationCount}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>Representatives:</span>
                            <Badge variant="secondary">{state.activeRepresentatives}</Badge>
                          </div>
                          <div className="flex justify-between">
                            <span>Recent Activity:</span>
                            <Badge variant="secondary">{state.recentActivity}</Badge>
                          </div>
                          <div className="pt-2">
                            <div className="text-xs text-muted-foreground mb-1">Key Topics:</div>
                            <div className="flex flex-wrap gap-1">
                              {[...new Set(state.keyTopics)].map((topic, index) => (
                                <Badge key={`${topic}-${index}`} variant="secondary" className="text-xs">
                                  {topic}
                                </Badge>
                              ))}
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
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
                  <span className="text-sm">Updating map data...</span>
                </div>
              </div>
            )}
          </div>

          {/* Legend */}
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 rounded-full bg-primary"></div>
                <span>High Activity</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 rounded-full bg-primary/50"></div>
                <span>Medium Activity</span>
              </div>
              <div className="flex items-center space-x-1">
                <div className="w-3 h-3 rounded-full bg-primary/20"></div>
                <span>Low Activity</span>
              </div>
            </div>
            <div className="text-xs">Click markers for detailed state information</div>
          </div>
        </CardContent>
      </Card>

      {/* Selected State Details */}
      {selectedState && stateStats[selectedState] && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>{stateStats[selectedState].name} Details</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedState(null)}
              >
                ×
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <FileText className="h-4 w-4 text-blue-500" />
                  <span className="font-medium">Legislative Activity</span>
                </div>
                <p className="text-2xl font-bold">{stateStats[selectedState].legislationCount}</p>
                <p className="text-xs text-muted-foreground">Active bills and resolutions</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <Users className="h-4 w-4 text-green-500" />
                  <span className="font-medium">Representatives</span>
                </div>
                <p className="text-2xl font-bold">{stateStats[selectedState].activeRepresentatives}</p>
                <p className="text-xs text-muted-foreground">Active state legislators</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="h-4 w-4 text-orange-500" />
                  <span className="font-medium">Recent Activity</span>
                </div>
                <p className="text-2xl font-bold">{stateStats[selectedState].recentActivity}</p>
                <p className="text-xs text-muted-foreground">Actions in the last 30 days</p>
              </div>
            </div>

            <div className="mt-6">
              <h4 className="font-medium mb-2">Key Policy Areas</h4>
              <div className="flex flex-wrap gap-2">
                {stateStats[selectedState].keyTopics.map((topic) => (
                  <Badge key={topic} variant="secondary">
                    {topic}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="mt-6 pt-4 border-t">
              <div className="flex space-x-2">
                <Button size="sm" variant="outline">
                  View Representatives
                </Button>
                <Button size="sm" variant="outline">
                  View Legislation
                </Button>
                <Button size="sm" variant="outline">
                  State Profile
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-blue-500" />
              <div>
                <p className="text-sm font-medium">Total Legislation</p>
                <p className="text-2xl font-bold">
                  {Object.values(stateStats).reduce((sum, state) => sum + state.legislationCount, 0).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Users className="h-5 w-5 text-green-500" />
              <div>
                <p className="text-sm font-medium">Active Representatives</p>
                <p className="text-2xl font-bold">
                  {Object.values(stateStats).reduce((sum, state) => sum + state.activeRepresentatives, 0).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-5 w-5 text-orange-500" />
              <div>
                <p className="text-sm font-medium">Recent Activity</p>
                <p className="text-2xl font-bold">
                  {Object.values(stateStats).reduce((sum, state) => sum + state.recentActivity, 0).toLocaleString()}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <MapPin className="h-5 w-5 text-purple-500" />
              <div>
                <p className="text-sm font-medium">Jurisdictions Tracked</p>
                <p className="text-2xl font-bold">{Object.keys(stateStats).length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
