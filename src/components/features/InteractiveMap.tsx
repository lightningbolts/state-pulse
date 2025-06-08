
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { LatLngExpression } from 'leaflet';
import dynamic from 'next/dynamic';
import { useMemo, useState, useEffect } from 'react';

// Dynamically import MapContainer and TileLayer to ensure they only load on the client-side
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), {
  ssr: false,
  loading: () => <div className="h-[500px] w-full flex items-center justify-center bg-muted"><p>Loading map assets...</p></div>,
});

const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), {
  ssr: false,
  // No loading prop needed for TileLayer as it's a child of MapContainer
});


export function InteractiveMap() {
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    // This effect runs only once on the client after initial mount
    setIsClient(true);
  }, []); // Empty dependency array ensures this runs once on mount

  const defaultPosition: LatLngExpression = useMemo(() => [39.8283, -98.5795], []); // Center of the US
  const defaultZoom = 4;

  // If not on the client yet, or before the useEffect has run, render a placeholder.
  // This ensures map-specific components are not rendered server-side.
  if (!isClient) {
    return (
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle className="font-headline text-2xl">Interactive State Map</CardTitle>
          <CardDescription>Explore state-level developments across the U.S. Pan and zoom to navigate.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[500px] w-full rounded-md overflow-hidden border flex items-center justify-center bg-muted">
            <p>Loading map...</p>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Interact with the map to explore policy information. Future enhancements could include clicking states for details or overlaying data.
          </p>
        </CardContent>
      </Card>
    );
  }

  // Once isClient is true, render the actual map.
  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="font-headline text-2xl">Interactive State Map</CardTitle>
        <CardDescription>Explore state-level developments across the U.S. Pan and zoom to navigate.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="h-[500px] w-full rounded-md overflow-hidden border">
          <MapContainer
            center={defaultPosition}
            zoom={defaultZoom}
            scrollWheelZoom={true}
            className="h-full w-full" // Important for Leaflet to fill its container
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
          </MapContainer>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Interact with the map to explore policy information. Future enhancements could include clicking states for details or overlaying data.
        </p>
      </CardContent>
    </Card>
  );
}
