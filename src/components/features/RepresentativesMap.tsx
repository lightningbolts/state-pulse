"use client";

import { useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';

interface MapProps {
  center: [number, number];
  zoom: number;
  representatives: Array<{
    id: string;
    name: string;
    office: string;
    party: string;
    lat?: number;
    lon?: number;
    distance?: number;
  }>;
  userLocation?: [number, number];
}

export function RepresentativesMap({ center, zoom, representatives, userLocation }: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Dynamically import Leaflet to avoid SSR issues
    import('leaflet').then((L) => {
      // Only initialize if we haven't already
      if (!mapInstanceRef.current && mapRef.current) {
        // Initialize the map
        mapInstanceRef.current = L.map(mapRef.current).setView(center, zoom);

        // Add tile layer
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }).addTo(mapInstanceRef.current);

        // Custom icons
        const userIcon = L.divIcon({
          html: '<div style="background-color: #3b82f6; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.3);"></div>',
          className: 'custom-div-icon',
          iconSize: [16, 16],
          iconAnchor: [8, 8]
        });

        const repIcon = L.divIcon({
          html: '<div style="background-color: #ef4444; width: 10px; height: 10px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 4px rgba(0,0,0,0.3);"></div>',
          className: 'custom-div-icon',
          iconSize: [14, 14],
          iconAnchor: [7, 7]
        });

        // Add user location marker
        if (userLocation) {
          L.marker(userLocation, { icon: userIcon })
            .addTo(mapInstanceRef.current)
            .bindPopup('<strong>Your Location</strong>');
        }

        // Add representative markers
        representatives.forEach((rep, index) => {
          if (rep.lat && rep.lon) {
            const marker = L.marker([rep.lat, rep.lon], { icon: repIcon })
              .addTo(mapInstanceRef.current)
              .bindPopup(`
                <div style="min-width: 200px;">
                  <strong>${rep.name}</strong><br>
                  ${rep.office}<br>
                  <span style="color: #666;">${rep.party}</span>
                  ${rep.distance ? `<br><small>${rep.distance.toFixed(1)} miles away</small>` : ''}
                </div>
              `);
          }
        });

        // Fit bounds to show all markers
        if (representatives.length > 0 || userLocation) {
          const group = L.featureGroup([
            ...(userLocation ? [L.marker(userLocation)] : []),
            ...representatives
              .filter(rep => rep.lat && rep.lon)
              .map(rep => L.marker([rep.lat!, rep.lon!]))
          ]);

          if (group.getLayers().length > 0) {
            mapInstanceRef.current.fitBounds(group.getBounds(), { padding: [20, 20] });
          }
        }
      }
    });

    // Cleanup function
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [center, zoom, representatives, userLocation]);

  return (
    <Card className="w-full h-80 overflow-hidden">
      <div ref={mapRef} className="w-full h-full" />
    </Card>
  );
}
