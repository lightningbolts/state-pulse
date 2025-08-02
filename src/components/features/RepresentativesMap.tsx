"use client";

import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { MapProps } from '@/types/geo';

export function RepresentativesMap({ center, zoom, representatives, userLocation, districts }: MapProps & { districts?: any[] }) {
    const mapRef = useRef<HTMLDivElement>(null);
    const mapInstanceRef = useRef<any>(null);
    const markersRef = useRef<any[]>([]);
    const [isClient, setIsClient] = useState(false);

    // Ensure we're on the client side
    useEffect(() => {
        setIsClient(true);
    }, []);

    // District borders are drawn after the map is initialized, inside the main map effect below

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

                    // Draw district boundaries as GeoJSON polygons
                    if (districts && districts.length > 0) {
                        // Remove any existing district layers
                        if (mapInstanceRef.current._districtLayer) {
                            mapInstanceRef.current.removeLayer(mapInstanceRef.current._districtLayer);
                            mapInstanceRef.current._districtLayer = null;
                        }
                        // Filter out upper districts if hideUpper is true
                        let filteredDistricts = districts;
                        if (typeof hideUpper !== 'undefined' && hideUpper) {
                            filteredDistricts = districts.filter((d: any) => {
                                const t = d?.type || d?.properties?.type;
                                return t !== 'state_leg_upper';
                            });
                        }
                        // Normalize districts to valid GeoJSON Features
                        const normalized = filteredDistricts.map((d: any) => {
                            // Always ensure properties.type is set for coloring
                            let props = d.properties ? { ...d.properties } : {};
                            if (!props.type && d.type && d.type !== 'Feature') {
                                props.type = d.type;
                            }
                            if (d.type === 'Feature' && d.geometry && d.properties) {
                                return {
                                    type: 'Feature' as const,
                                    geometry: d.geometry,
                                    properties: props
                                };
                            }
                            // Otherwise, construct a Feature
                            return {
                                type: 'Feature' as const,
                                geometry: d.geometry,
                                properties: props
                            };
                        });
                        // Style by type
                        const typeToColor: Record<string, string> = {
                            congressional: '#2563eb', // blue
                            state_leg_lower: '#16a34a', // green
                            state_leg_upper: '#a21caf'  // purple
                        };
                        const geojson = L.geoJSON(normalized, {
                            style: (feature: any) => {
                                const t = feature?.properties?.type;
                                return {
                                    color: typeToColor[t] || '#3b82f6',
                                    weight: 3,
                                    fill: false
                                };
                            }
                        });
                        geojson.addTo(mapInstanceRef.current);
                        mapInstanceRef.current._districtLayer = geojson;
                    }

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
                //     const validReps = representatives.filter(rep =>
                //         rep.lat && rep.lon &&
                //         !isNaN(rep.lat) && !isNaN(rep.lon) &&
                //         rep.lat >= -90 && rep.lat <= 90 &&
                //         rep.lon >= -180 && rep.lon <= 180
                //     );

                //     validReps.forEach((rep, index) => {
                //         try {
                //             const marker = L.marker([rep.lat!, rep.lon!], { icon: repIcon })
                //                 .addTo(mapInstanceRef.current)
                //                 .bindPopup(`
                //   <div style="min-width: 200px;">
                //     <strong>${rep.name}</strong><br>
                //     ${rep.office}<br>
                //     <span style="color: #666;">${rep.party}</span>
                //     ${rep.distance ? `<br><small>${rep.distance.toFixed(1)} miles away</small>` : ''}
                //   </div>
                // `);
                    //         markersRef.current.push(marker);
                    //     } catch (e) {
                    //         console.warn(`Error adding marker for ${rep.name}:`, e);
                    //     }
                    // });


                    // Fit map to district boundaries if present
                    try {
                        if (districts && districts.length > 0 && mapInstanceRef.current._districtLayer) {
                            const bounds = mapInstanceRef.current._districtLayer.getBounds();
                            if (bounds.isValid()) {
                                mapInstanceRef.current.fitBounds(bounds, {
                                    padding: [20, 20],
                                    maxZoom: 15 // Prevent zooming in too much
                                });
                            } else {
                                mapInstanceRef.current.setView(center, zoom);
                            }
                        } else {
                            mapInstanceRef.current.setView(center, zoom);
                        }
                    } catch (e) {
                        console.warn('Error fitting bounds to districts:', e);
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

    // Determine which district types are present and if upper/lower are identical
    const presentTypes = new Set<string>();
    let showUpper = false;
    let showLower = false;
    let upperGeoms: string[] = [];
    let lowerGeoms: string[] = [];
    if (districts && districts.length > 0) {
        for (const d of districts) {
            const t = d?.type || d?.properties?.type;
            if (t === 'state_leg_upper') {
                showUpper = true;
                if (d.geometry) upperGeoms.push(JSON.stringify(d.geometry));
            }
            if (t === 'state_leg_lower') {
                showLower = true;
                if (d.geometry) lowerGeoms.push(JSON.stringify(d.geometry));
            }
            if (t) presentTypes.add(t);
        }
    }


    // Use the same color mapping for legend and polygons
    const typeToColor: Record<string, string> = {
        congressional: '#2563eb', // blue
        state_leg_lower: '#16a34a', // green
        state_leg_upper: '#a21caf'  // purple
    };

    // If both upper and lower are present and all geometries are identical, only show lower
    let hideUpper = false;
    if (showUpper && showLower && upperGeoms.length === lowerGeoms.length && upperGeoms.length > 0) {
        // Sort and compare arrays
        const sortedUpper = [...upperGeoms].sort();
        const sortedLower = [...lowerGeoms].sort();
        hideUpper = sortedUpper.every((g, i) => g === sortedLower[i]);
    }

    return (
        <Card className="w-full h-80 overflow-hidden" style={{ position: 'relative' }}>
            <div
                ref={mapRef}
                className="w-full h-full"
                style={{ minHeight: '320px', zIndex: 1, position: 'relative' }}
            />
            {/* Map Legend */}
            <div style={{
                position: 'absolute',
                bottom: 12,
                left: 12,
                background: 'rgba(255,255,255,0.9)',
                borderRadius: 8,
                padding: '8px 14px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
                fontSize: 13,
                zIndex: 10
            }}>
                {presentTypes.has('congressional') && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{ display: 'inline-block', width: 18, height: 4, background: typeToColor['congressional'], borderRadius: 2, marginRight: 6 }}></span>
                        Congressional
                    </div>
                )}
                {presentTypes.has('state_leg_lower') && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{ display: 'inline-block', width: 18, height: 4, background: typeToColor['state_leg_lower'], borderRadius: 2, marginRight: 6 }}></span>
                        State House (Lower)
                    </div>
                )}
                {presentTypes.has('state_leg_upper') && !hideUpper && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ display: 'inline-block', width: 18, height: 4, background: typeToColor['state_leg_upper'], borderRadius: 2, marginRight: 6 }}></span>
                        State Senate (Upper)
                    </div>
                )}
            </div>
        </Card>
    );
}
