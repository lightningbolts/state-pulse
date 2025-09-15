"use client";

import React, { useEffect, useState, useMemo } from 'react';
import MapLibreMap, { Source, Layer } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

interface StateVotingPowerData {
  name: string;
  abbreviation: string;
  population: number;
  seats: number;
  votingPower: number;
  normalizedPower: number;
  relativeToMaryland: number;
}

interface StateMapGLProps {
  votingPowerData: Record<string, StateVotingPowerData>;
  chamber: 'house' | 'senate';
  onStateClick?: (stateAbbr: string, stateData: StateVotingPowerData) => void;
  mapStyle?: string;
  className?: string;
}

// Color scheme for voting power visualization - matches MapUI.tsx exactly
const getVotingPowerColor = (normalizedPower: number): string => {
  if (normalizedPower <= 0) return 'rgb(255, 255, 255)'; // White for minimum power
  const clampedScore = Math.max(0, Math.min(1, normalizedPower));
  
  // Use linear interpolation for better color distribution across full spectrum
  // This ensures we get the full range from white to proper dark blue
  const white = { r: 255, g: 255, b: 255 };
  const darkBlue = { r: 30, g: 100, b: 200 }; // Proper blue instead of nearly black
  
  // Simple linear interpolation from white to dark blue
  const r = Math.round(white.r + (darkBlue.r - white.r) * clampedScore);
  const g = Math.round(white.g + (darkBlue.g - white.g) * clampedScore);
  const b = Math.round(white.b + (darkBlue.b - white.b) * clampedScore);
  
  return `rgb(${r}, ${g}, ${b})`;
};

// Default map style
const DEFAULT_MAP_STYLE = 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

export const StateMapGL: React.FC<StateMapGLProps> = ({
  votingPowerData,
  chamber,
  onStateClick,
  mapStyle = DEFAULT_MAP_STYLE,
  className = ''
}) => {
  const [statesGeoJson, setStatesGeoJson] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load states GeoJSON data
  useEffect(() => {
    const loadStatesData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/districts/states.geojson');
        if (!response.ok) {
          throw new Error(`Failed to load states data: ${response.status}`);
        }
        const data = await response.json();
        setStatesGeoJson(data);
        setError(null);
      } catch (err) {
        console.error('Error loading states GeoJSON:', err);
        setError(err instanceof Error ? err.message : 'Failed to load map data');
      } finally {
        setLoading(false);
      }
    };

    loadStatesData();
  }, []);

  // Enhance GeoJSON with voting power data
  const enhancedGeoJson = useMemo(() => {
    if (!statesGeoJson || !votingPowerData) return null;

    const enhanced = {
      ...statesGeoJson,
      features: statesGeoJson.features.map((feature: any) => {
        // Get state abbreviation from properties
        const stateAbbr = feature.properties.STUSPS || 
                         feature.properties.STATE_ABBR || 
                         feature.properties.abbr ||
                         feature.properties.ABBR;

        const votingData = votingPowerData[stateAbbr];
        
        return {
          ...feature,
          properties: {
            ...feature.properties,
            stateAbbr,
            votingPower: votingData?.votingPower || 0,
            normalizedPower: votingData?.normalizedPower || 0,
            population: votingData?.population || 0,
            seats: votingData?.seats || 0,
            stateName: votingData?.name || feature.properties.NAME || 'Unknown'
          }
        };
      })
    };

    return enhanced;
  }, [statesGeoJson, votingPowerData]);

  // Calculate color stops based on relative power values for proper color mapping
  const colorStops = useMemo(() => {
    if (!votingPowerData || Object.keys(votingPowerData).length === 0) {
      // Fallback to standard 0-1 range with proper colors
      return [
        0, 'rgb(255, 255, 255)',     
        0.125, 'rgb(233, 240, 250)', 
        0.25, 'rgb(210, 224, 244)',  
        0.375, 'rgb(188, 209, 239)', 
        0.5, 'rgb(143, 178, 228)',   
        0.625, 'rgb(120, 162, 222)', 
        0.75, 'rgb(98, 147, 217)',   
        0.875, 'rgb(75, 131, 211)',   
        1, 'rgb(30, 100, 200)'          
      ];
    }

    // Get all relative power values and map them properly to colors
    const allRelatives = Object.values(votingPowerData)
      .map(d => d.relativeToMaryland)
      .filter(v => isFinite(v))
      .sort((a, b) => a - b);
    
    if (allRelatives.length === 0) {
      return [0, 'rgb(255, 255, 255)', 1, 'rgb(30, 100, 200)'];
    }

    const minRel = allRelatives[0];
    const maxRel = allRelatives[allRelatives.length - 1];

    // Map relative power values directly to colors for each state's normalizedPower
    // This creates color stops that correspond to the actual normalized power distribution
    const stops: (number | string)[] = [];
    
    // Create evenly distributed color stops across the 0-1 normalized range
    // Each normalized power value should map to a color from white (0) to dark blue (1)
    for (let i = 0; i <= 10; i++) {
      const normalizedValue = i / 10; // 0, 0.1, 0.2, ... 1.0
      const color = getVotingPowerColor(normalizedValue);
      stops.push(normalizedValue, color);
    }

    return stops;
  }, [votingPowerData]);

  // Layer style for choropleth
  const layerStyle: any = useMemo(() => ({
    id: 'states-fill',
    type: 'fill',
    paint: {
      'fill-color': [
        'case',
        ['has', 'normalizedPower'],
        [
          'interpolate',
          ['linear'],
          ['get', 'normalizedPower'],
          ...colorStops
        ],
        'rgba(200, 200, 200, 0.5)' // Gray for no data
      ],
      'fill-opacity': 0.8
    }
  }), [colorStops]);

  // Border layer style
  const borderLayerStyle: any = useMemo(() => ({
    id: 'states-border',
    type: 'line',
    paint: {
      'line-color': '#ffffff',
      'line-width': 1,
      'line-opacity': 0.8
    }
  }), []);

  // Handle map click events
  const handleMapClick = (event: any) => {
    if (!onStateClick) return;

    const features = event.features;
    if (features && features.length > 0) {
      const feature = features[0];
      const stateAbbr = feature.properties.stateAbbr;
      const votingData = votingPowerData[stateAbbr];
      
      if (stateAbbr && votingData) {
        onStateClick(stateAbbr, votingData);
      }
    }
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
          <span className="text-sm text-muted-foreground">Loading map...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <div className="text-center">
          <p className="text-sm text-red-500">Error loading map</p>
          <p className="text-xs text-muted-foreground mt-1">{error}</p>
        </div>
      </div>
    );
  }

  if (!enhancedGeoJson) {
    return (
      <div className={`flex items-center justify-center h-full ${className}`}>
        <p className="text-sm text-muted-foreground">No map data available</p>
      </div>
    );
  }

  return (
    <div className={`w-full h-full ${className}`}>
      <MapLibreMap
        initialViewState={{
          longitude: -98.5795,
          latitude: 39.8283,
          zoom: 3.5
        }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={mapStyle}
        onClick={handleMapClick}
        interactiveLayerIds={['states-fill']}
        cursor="pointer"
      >
        <Source id="states-source" type="geojson" data={enhancedGeoJson}>
          <Layer {...layerStyle} />
          <Layer {...borderLayerStyle} />
        </Source>
      </MapLibreMap>
    </div>
  );
};