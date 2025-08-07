"use client";

import { useEffect, useRef, useState } from 'react';
import { Card } from '@/components/ui/card';
import { MapProps } from '@/types/geo';
import { RepresentativesMapGL } from './RepresentativesMapGL';
export function RepresentativesMap({ center, zoom, representatives, userLocation, districts }: MapProps & { districts?: any[] }) {
    const validReps = Array.isArray(representatives)
        ? representatives
            .filter(rep => typeof rep.lat === 'number' && typeof rep.lon === 'number')
            .map(rep => ({ ...rep, lat: rep.lat as number, lon: rep.lon as number }))
        : representatives;

    // Legend logic (copied from previous implementation)
    const presentTypes = new Set<string>();
    if (districts && Array.isArray(districts)) {
        districts.forEach((d: any) => {
            const t = d?.type || d?.properties?.type;
            if (t) presentTypes.add(t);
        });
    }
    const typeToColor: Record<string, string> = {
        congressional: '#2563eb', // blue
        state_leg_lower: '#16a34a', // green
        state_leg_upper: '#a21caf'  // purple
    };
    const hideUpper = false; // If you want to hide upper chamber, set this to true

    return (
        <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <RepresentativesMapGL
                center={center}
                zoom={zoom}
                representatives={validReps}
                userLocation={userLocation}
                districts={districts}
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
        </div>
    );
}
