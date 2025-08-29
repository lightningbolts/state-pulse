import * as React from 'react';
import Map, { Source, Layer, MapRef } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';

interface DistrictMapGLProps {
  geojsonUrl: string;
  color: string;
  onDistrictClick?: (feature: any, lngLat: {lng: number, lat: number}) => void;
  initialViewState?: {
    longitude: number;
    latitude: number;
    zoom: number;
  };
  popupMarker?: {
    lng: number;
    lat: number;
    iconHtml?: string;
    draggable?: boolean;
    onDragEnd?: (lngLat: {lng: number, lat: number}) => void;
  };
  mapStyle?: string;
  // Party affiliation coloring
  showPartyAffiliation?: boolean;
  districtPartyMapping?: Record<string, string>; // district ID -> party
  partyColors?: Record<string, string>; // party -> color
  // Gerrymandering analysis
  showGerrymandering?: boolean;
  gerryScores?: Record<string, number>; // district ID -> Polsby-Popper score
  getGerrymanderingColor?: (score: number) => string; // score -> color
  // Representative heatmap coloring
  showRepHeatmap?: boolean;
  repScores?: Record<string, number>; // district ID -> score (0-1)
  repDetails?: Record<string, any>; // district ID -> rep details
  getRepHeatmapColor?: (score: number) => string; // score -> color
  // Topic heatmap coloring
  showTopicHeatmap?: boolean;
  topicScores?: Record<string, number>; // district ID -> score (0-1)
  getTopicHeatmapColor?: (score: number) => string; // score -> color
}

// Performance optimization: Memoize the component to prevent unnecessary re-renders
export const DistrictMapGL: React.FC<DistrictMapGLProps> = React.memo(({
  geojsonUrl,
  color,
  onDistrictClick,
  initialViewState = { longitude: -98.5795, latitude: 39.8283, zoom: 4 },
  popupMarker,
  mapStyle = "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
  showPartyAffiliation = false,
  districtPartyMapping = {},
  partyColors = {},
  showGerrymandering = false,
  gerryScores = {},
  getGerrymanderingColor = () => '#e0e0e0',
  showRepHeatmap = false,
  repScores = {},
  repDetails = {},
  getRepHeatmapColor = () => '#e0e0e0',
  showTopicHeatmap = false,
  topicScores = {},
  getTopicHeatmapColor = () => '#e0e0e0',
}) => {
  const mapRef = React.useRef<MapRef>(null);
  const markerRef = React.useRef<any>(null);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [geoJsonData, setGeoJsonData] = React.useState<any>(null);

  // Smart data loading with chunking and optimization
  React.useEffect(() => {
    let isCancelled = false;
    
    const loadGeoJsonData = async () => {
      if (!geojsonUrl) return;
      
      try {
        setLoading(true);
        setError(null);
        
        const response = await fetch(geojsonUrl);
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        
        if (isCancelled) return;
        
        // Smart loading strategy for large datasets
        if (data.features && data.features.length > 1000) {
          console.log(`[DistrictMapGL] Large dataset detected: ${data.features.length} features - using optimized loading`);
          
          // For very large datasets (like state-lower-districts), implement chunked loading
          if (data.features.length > 3000) {
            console.log(`[DistrictMapGL] Very large dataset - implementing progressive loading`);
            
            // Load initial chunk immediately
            const initialChunkSize = 1000;
            const initialChunk = {
              ...data,
              features: data.features.slice(0, initialChunkSize).map((feature: any) => ({
                ...feature,
                properties: { ...feature.properties, _optimized: true }
              }))
            };
            
            initialChunk._isLargeDataset = true;
            initialChunk._originalFeatureCount = data.features.length;
            initialChunk._isPartialLoad = true;
            
            setGeoJsonData(initialChunk);
            
            // Load remaining features progressively
            setTimeout(() => {
              if (!isCancelled) {
                const fullData = {
                  ...data,
                  features: data.features.map((feature: any) => ({
                    ...feature,
                    properties: { ...feature.properties, _optimized: true }
                  }))
                };
                fullData._isLargeDataset = true;
                fullData._originalFeatureCount = data.features.length;
                setGeoJsonData(fullData);
                console.log(`[DistrictMapGL] Progressive loading complete - ${data.features.length} features loaded`);
              }
            }, 500); // 500ms delay for progressive loading
            
          } else {
            // Standard optimization for moderately large datasets
            const optimizedData = {
              ...data,
              features: data.features.map((feature: any) => ({
                ...feature,
                properties: { ...feature.properties, _optimized: true }
              }))
            };
            
            optimizedData._isLargeDataset = true;
            optimizedData._originalFeatureCount = data.features.length;
            setGeoJsonData(optimizedData);
          }
        } else {
          setGeoJsonData(data);
        }
        
      } catch (err) {
        console.error('[DistrictMapGL] Error loading GeoJSON:', err);
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load district data');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    };
    
    loadGeoJsonData();
    
    return () => {
      isCancelled = true;
    };
  }, [geojsonUrl]);  // Memory management and cleanup
  React.useEffect(() => {
    return () => {
      // Cleanup marker
      if (markerRef.current) {
        try {
          markerRef.current.remove();
          markerRef.current = null;
        } catch (err) {
          console.error('[DistrictMapGL] Error cleaning up marker:', err);
        }
      }
    };
  }, []);

  // Performance optimization: Memoize the fill color expression to prevent recalculation on every render
  const fillColorExpression = React.useMemo((): any => {
    // Priority: Topic Heatmap > Representative Heatmap > Gerrymandering > Party Affiliation > Default Color

    const NO_DATA_COLOR = '#f8f9fa';

    // Topic heatmap coloring takes precedence
    if (showTopicHeatmap && Object.keys(topicScores).length > 0) {
      const caseExpression: any[] = ['case'];

      // Performance optimization: Batch process entries for better performance
      const topicEntries = Object.entries(topicScores);
      topicEntries.forEach(([districtId, score]) => {
        const topicColor = getTopicHeatmapColor(score);

        // Create an OR condition to match any of the possible ID fields
        caseExpression.push([
          'any',
          ['==', ['get', 'GEOID'], districtId],
          ['==', ['get', 'GEOIDFQ'], districtId],
          ['==', ['get', 'ID'], districtId],
          ['==', ['get', 'DISTRICT'], districtId]
        ]);
        caseExpression.push(topicColor);
      });

      // Default fallback color for unmapped features when heatmap active
      caseExpression.push(NO_DATA_COLOR);

      return caseExpression;
    }

    // Representative heatmap coloring
    if (showRepHeatmap && Object.keys(repScores).length > 0) {
      const caseExpression: any[] = ['case'];

      // Performance optimization: Batch process entries for better performance
      const repEntries = Object.entries(repScores);
      repEntries.forEach(([districtId, score]) => {
        const repColor = getRepHeatmapColor(score);

        // Create an OR condition to match any of the possible ID fields
        caseExpression.push([
          'any',
          ['==', ['get', 'GEOID'], districtId],
          ['==', ['get', 'GEOIDFQ'], districtId],
          ['==', ['get', 'ID'], districtId],
          ['==', ['get', 'DISTRICT'], districtId]
        ]);
        caseExpression.push(repColor);
      });

      // Default fallback color for unmapped features when heatmap active
      caseExpression.push(NO_DATA_COLOR);

      return caseExpression;
    }

    // Gerrymandering coloring takes precedence
    if (showGerrymandering && Object.keys(gerryScores).length > 0) {
      const caseExpression: any[] = ['case'];
      
      // Performance optimization: Batch process entries for better performance
      const scoreEntries = Object.entries(gerryScores);
      scoreEntries.forEach(([districtId, score]) => {
        const gerryColor = getGerrymanderingColor(score);
        
        // Create an OR condition to match any of the possible ID fields
        caseExpression.push([
          'any',
          ['==', ['get', 'GEOID'], districtId],
          ['==', ['get', 'GEOIDFQ'], districtId],
          ['==', ['get', 'ID'], districtId],
          ['==', ['get', 'DISTRICT'], districtId]
        ]);
        caseExpression.push(gerryColor);
      });
      
      // Default fallback color for unmapped features when overlay active
      caseExpression.push(NO_DATA_COLOR);

      return caseExpression;
    }
    
    // Party affiliation coloring (if gerrymandering is not active)
    if (showPartyAffiliation && Object.keys(districtPartyMapping).length > 0) {
      const caseExpression: any[] = ['case'];
      
      // Performance optimization: Batch process party mapping entries
      const partyEntries = Object.entries(districtPartyMapping);
      partyEntries.forEach(([districtId, party]) => {
        const partyColor = partyColors[party] || partyColors['Unknown'] || '#6b7280'; // fallback to gray
        
        // Create an OR condition to match any of the possible ID fields
        caseExpression.push([
          'any',
          ['==', ['get', 'GEOID'], districtId],
          ['==', ['get', 'GEOIDFQ'], districtId],
          ['==', ['get', 'ID'], districtId],
          ['==', ['get', 'DISTRICT'], districtId]
        ]);
        caseExpression.push(partyColor);
      });
      
      // Default fallback color for unmapped features when overlay active
      caseExpression.push(NO_DATA_COLOR);

      return caseExpression;
    }
    
    // Default color (no special coloring active)
    let defaultColor = color;
    if (color.includes('var(')) {
      console.warn('[DistrictMapGL] CSS variable detected in color, using fallback');
      defaultColor = '#2563eb'; // Blue fallback
    }
    return defaultColor;
  }, [showPartyAffiliation, districtPartyMapping, partyColors, showGerrymandering, gerryScores, getGerrymanderingColor, showRepHeatmap, repScores, repDetails, getRepHeatmapColor, showTopicHeatmap, topicScores, getTopicHeatmapColor, color]);

  // Performance optimization: Memoize the click handler to prevent recreation on every render
  const handleClick = React.useCallback((event: any) => {
    try {
      const features = event.features || [];
      const polygon = features.find((f: any) => f.layer.id === 'district-fill');
      if (polygon && onDistrictClick) {
        onDistrictClick(polygon, event.lngLat);
      }
    } catch (err) {
      console.error('[DistrictMapGL] Error handling click:', err);
    }
  }, [onDistrictClick]);

  // Performance optimization: Memoize marker management with error handling
  React.useEffect(() => {
    const map = mapRef.current?.getMap?.();
    if (!map) return;

    try {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }

      if (popupMarker && typeof window !== 'undefined') {
        const marker = new (require('maplibre-gl').Marker)({
          element: (() => {
            const el = document.createElement('div');
            el.innerHTML = popupMarker.iconHtml || `<svg xmlns='http://www.w3.org/2000/svg' width='28' height='28' fill='none' stroke='#eb7725ff' stroke-width='2' stroke-linecap='round' stroke-linejoin='round' class='lucide lucide-map-pin' viewBox='0 0 24 24' style='display:block;'><path d='M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 1 1 18 0Z'/><circle cx='12' cy='10' r='3'/></svg>`;
            el.style.transform = 'translate(-50%, -100%)';
            el.style.position = 'absolute';
            el.style.pointerEvents = 'none';
            return el;
          })(),
          draggable: !!popupMarker.draggable,
        })
          .setLngLat([popupMarker.lng, popupMarker.lat])
          .addTo(map);
        if (popupMarker.draggable && typeof popupMarker.onDragEnd === 'function') {
          marker.on('dragend', () => {
            try {
              const lngLat = marker.getLngLat();
              if (popupMarker.onDragEnd) {
                popupMarker.onDragEnd({ lng: lngLat.lng, lat: lngLat.lat });
              }
            } catch (err) {
              console.error('[DistrictMapGL] Error handling marker drag:', err);
            }
          });
        }
        markerRef.current = marker;
      }
    } catch (err) {
      console.error('[DistrictMapGL] Error managing marker:', err);
    }

    return () => {
      try {
        if (markerRef.current) {
          markerRef.current.remove();
          markerRef.current = null;
        }
      } catch (err) {
        console.error('[DistrictMapGL] Error cleaning up marker:', err);
      }
    };
  }, [popupMarker]);

  // Optimized layer paint properties - maintain visual quality while optimizing performance
  const layerFillPaint = React.useMemo(() => {
    const baseOpacity = (showPartyAffiliation || showGerrymandering || showTopicHeatmap || showRepHeatmap) ? 0.75 : 0.08;

    return {
      'fill-color': fillColorExpression,
      'fill-opacity': baseOpacity,
    };
  }, [fillColorExpression, showPartyAffiliation, showGerrymandering, showTopicHeatmap, showRepHeatmap]);

  const layerLinePaint = React.useMemo(() => {
    const lineWidth = (showPartyAffiliation || showGerrymandering || showTopicHeatmap || showRepHeatmap) ? 1 : 2;

    return {
      'line-color': (showPartyAffiliation || showGerrymandering || showTopicHeatmap || showRepHeatmap) ? '#000000' : (color.includes('var(') ? '#2563eb' : color),
      'line-width': lineWidth,
    };
  }, [showPartyAffiliation, showGerrymandering, showTopicHeatmap, showRepHeatmap, color, geoJsonData]);

  // Show loading state for large datasets
  if (loading) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '8px' }}>Loading district data...</div>
          <div style={{ fontSize: '12px', color: '#666' }}>This may take a moment on mobile devices</div>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', color: '#dc2626' }}>
          <div style={{ marginBottom: '8px' }}>Failed to load district data</div>
          <div style={{ fontSize: '12px' }}>{error}</div>
        </div>
      </div>
    );
  }

  // Don't render map until data is loaded
  if (!geoJsonData) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div>Preparing map...</div>
      </div>
    );
  }

  return (
    <Map
      ref={mapRef}
      initialViewState={initialViewState}
      style={{ width: '100%', height: '100%' }}
      mapStyle={mapStyle}
      interactiveLayerIds={['district-fill']}
      onClick={handleClick}
      // Conservative performance optimizations that maintain usability
      maxZoom={geoJsonData?._isLargeDataset ? 14 : 18} // Allow reasonable zoom levels
      renderWorldCopies={false} // Disable world copies for better performance
      attributionControl={false} // Disable attribution for cleaner mobile experience
      fadeDuration={geoJsonData?._isLargeDataset ? 0 : 300} // Disable fade for large datasets
    >
      <Source 
        id="districts" 
        type="geojson" 
        data={geoJsonData}
        // Conservative performance optimizations that maintain visual quality
        tolerance={geoJsonData?._isLargeDataset ? 0.5 : 0.375} // Minimal simplification to maintain detail
        buffer={geoJsonData?._isLargeDataset ? 64 : 128} // Moderate buffer reduction
        maxzoom={geoJsonData?._isLargeDataset ? 12 : 14} // Conservative zoom limit
        generateId={true} // Enable feature state for better performance
      >
        <Layer
          id="district-fill"
          type="fill"
          paint={layerFillPaint}
        />
        <Layer
          id="district-outline"
          type="line"
          paint={layerLinePaint}
          layout={{
            // Optimize line cap and join for better performance
            'line-cap': 'round',
            'line-join': 'round'
          }}
        />
      </Source>
    </Map>
  );
});
