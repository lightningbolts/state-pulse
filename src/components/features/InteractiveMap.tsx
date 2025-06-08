
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import type { LatLngExpression } from 'leaflet';
import dynamic from 'next/dynamic';
import { useMemo } from 'react';

// Dynamically import MapContainer and TileLayer to ensure they only load on the client-side
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), {
  ssr: false,
  loading: () => <div className="h-[500px] w-full flex items-center justify-center bg-muted"><p>Loading map...</p></div>,
});

const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), {
  ssr: false,
});


export function InteractiveMap() {
  const defaultPosition: LatLngExpression = useMemo(() => [39.8283, -98.5795], []); // Center of the US
  const defaultZoom = 4;

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
            className="h-full w-full"
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

