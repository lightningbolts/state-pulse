"use client";

import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { MapProps } from '@/types/geo';

export function RepresentativesMap({ center, zoom, representatives, userLocation }: MapProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const [isClient, setIsClient] = useState(false);

  // Ensure we're on the client side
  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!isClient || typeof window === 'undefined') return;

    // Clean up existing map and markers
    const cleanup = () => {
      if (markersRef.current.length > 0) {
        markersRef.current.forEach(marker => {
          try {
            if (marker && marker.remove) {
              marker.remove();
            }
          } catch (e) {
            console.warn('Error removing marker:', e);
          }
        });
        markersRef.current = [];
      }

      if (mapInstanceRef.current) {
        try {
          mapInstanceRef.current.remove();
          mapInstanceRef.current = null;
        } catch (e) {
          console.warn('Error removing map:', e);
        }
      }
    };

    // Initial cleanup
    cleanup();

    // Add a small delay to ensure DOM is ready
    const initializeMap = () => {
      // Dynamically import Leaflet to avoid SSR issues
      import('leaflet').then((L) => {
        // Ensure map container exists and is ready
        if (!mapRef.current) return;

        // Clear any existing content
        mapRef.current.innerHTML = '';

        try {
          // Initialize the map with error handling
          mapInstanceRef.current = L.map(mapRef.current, {
            preferCanvas: true, // Better performance
            attributionControl: true,
            zoomControl: true
          }).setView(center, zoom);

          // Add tile layer with error handling
          const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 18,
            detectRetina: true
          });

          tileLayer.on('tileerror', (e) => {
            console.warn('Tile loading error:', e);
          });

          tileLayer.addTo(mapInstanceRef.current);

          // Custom icons with proper sizing
          const userIcon = L.divIcon({
            html: `<div style="
              background-color: #3b82f6; 
              width: 12px; 
              height: 12px; 
              border-radius: 50%; 
              border: 2px solid white; 
              box-shadow: 0 0 4px rgba(0,0,0,0.3);
              position: relative;
            "></div>`,
            className: 'custom-user-icon',
            iconSize: [16, 16],
            iconAnchor: [8, 8]
          });

          const repIcon = L.divIcon({
            html: `<div style="
              background-color: #ef4444; 
              width: 10px; 
              height: 10px; 
              border-radius: 50%; 
              border: 2px solid white; 
              box-shadow: 0 0 4px rgba(0,0,0,0.3);
              position: relative;
            "></div>`,
            className: 'custom-rep-icon',
            iconSize: [14, 14],
            iconAnchor: [7, 7]
          });

          // Add user location marker
          if (userLocation && userLocation[0] && userLocation[1]) {
            try {
              const userMarker = L.marker(userLocation, { icon: userIcon })
                .addTo(mapInstanceRef.current)
                .bindPopup('<strong>Your Location</strong>');
              markersRef.current.push(userMarker);
            } catch (e) {
              console.warn('Error adding user marker:', e);
            }
          }

          // Add representative markers
          const validReps = representatives.filter(rep =>
            rep.lat && rep.lon &&
            !isNaN(rep.lat) && !isNaN(rep.lon) &&
            rep.lat >= -90 && rep.lat <= 90 &&
            rep.lon >= -180 && rep.lon <= 180
          );

          validReps.forEach((rep, index) => {
            try {
              const marker = L.marker([rep.lat!, rep.lon!], { icon: repIcon })
                .addTo(mapInstanceRef.current)
                .bindPopup(`
                  <div style="min-width: 200px;">
                    <strong>${rep.name}</strong><br>
                    ${rep.office}<br>
                    <span style="color: #666;">${rep.party}</span>
                    ${rep.distance ? `<br><small>${rep.distance.toFixed(1)} miles away</small>` : ''}
                  </div>
                `);
              markersRef.current.push(marker);
            } catch (e) {
              console.warn(`Error adding marker for ${rep.name}:`, e);
            }
          });

          // Fit bounds to show all markers with error handling
          try {
            const allMarkers = markersRef.current.filter(marker => marker);
            if (allMarkers.length > 0) {
              const group = L.featureGroup(allMarkers);
              const bounds = group.getBounds();

              if (bounds.isValid()) {
                mapInstanceRef.current.fitBounds(bounds, {
                  padding: [20, 20],
                  maxZoom: 15 // Prevent zooming in too much
                });
              }
            }
          } catch (e) {
            console.warn('Error fitting bounds:', e);
            // Fallback to center and zoom
            mapInstanceRef.current.setView(center, zoom);
          }

          // Handle map resize events
          const resizeObserver = new ResizeObserver(() => {
            if (mapInstanceRef.current) {
              setTimeout(() => {
                try {
                  mapInstanceRef.current.invalidateSize();
                } catch (e) {
                  console.warn('Error invalidating map size:', e);
                }
              }, 100);
            }
          });

          if (mapRef.current) {
            resizeObserver.observe(mapRef.current);
          }

          // Store cleanup function for ResizeObserver
          mapInstanceRef.current._resizeObserver = resizeObserver;

        } catch (error) {
          console.error('Error initializing map:', error);
        }
      }).catch(error => {
        console.error('Error loading Leaflet:', error);
      });
    };

    // Use a small delay to ensure DOM is properly initialized
    const timeoutId = setTimeout(initializeMap, 50);

    // Cleanup function
    return () => {
      clearTimeout(timeoutId);
      cleanup();
    };
  }, [center, zoom, representatives, userLocation, isClient]);

  // Additional cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current?._resizeObserver) {
        mapInstanceRef.current._resizeObserver.disconnect();
      }
    };
  }, []);

  if (!isClient) {
    return (
      <Card className="w-full h-80 bg-muted animate-pulse rounded-lg flex items-center justify-center">
        <div className="text-muted-foreground">Loading map...</div>
      </Card>
    );
  }

  return (
    <Card className="w-full h-80 overflow-hidden">
      <div
        ref={mapRef}
        className="w-full h-full"
        style={{ minHeight: '320px', zIndex: 1, position: 'relative' }}
      />
    </Card>
  );
}
