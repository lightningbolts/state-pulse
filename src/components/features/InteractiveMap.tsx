"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import 'leaflet/dist/leaflet.css';
import { MapContainer, TileLayer } from 'react-leaflet';
import type { LatLngExpression } from 'leaflet';

export function InteractiveMap() {
  const defaultPosition: LatLngExpression = [39.8283, -98.5795]; // Center of the US
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
            scrollWheelZoom={true} // Can set to false if preferred
            className="h-full w-full"
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {/* Markers and other map features can be added here later */}
          </MapContainer>
        </div>
        <p className="mt-4 text-sm text-muted-foreground">
          Interact with the map to explore policy information. Future enhancements could include clicking states for details or overlaying data.
        </p>
      </CardContent>
    </Card>
  );
}
