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
}


export const DistrictMapGL: React.FC<DistrictMapGLProps> = ({
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
}) => {
  const mapRef = React.useRef<MapRef>(null);
  const markerRef = React.useRef<any>(null);

  // Create a MapLibre GL expression for dynamic coloring based on district properties
  const fillColorExpression = React.useMemo((): any => {
    // Priority: Gerrymandering > Party Affiliation > Default Color
    
    // Gerrymandering coloring takes precedence
    if (showGerrymandering && Object.keys(gerryScores).length > 0) {
      const caseExpression: any[] = ['case'];
      
      Object.entries(gerryScores).forEach(([districtId, score]) => {
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
      
      // Default fallback color
      let fallbackColor = color;
      if (color.includes('var(')) {
        fallbackColor = '#e0e0e0'; // Gray fallback
      }
      caseExpression.push(fallbackColor);
      
      return caseExpression;
    }
    
    // Party affiliation coloring (if gerrymandering is not active)
    if (showPartyAffiliation && Object.keys(districtPartyMapping).length > 0) {
      const caseExpression: any[] = ['case'];
      
      Object.entries(districtPartyMapping).forEach(([districtId, party]) => {
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
      
      // Default fallback color - ensure it's not a CSS variable
      let fallbackColor = color;
      if (color.includes('var(')) {
        console.warn('[DistrictMapGL] CSS variable detected in fallback color, using hardcoded fallback');
        fallbackColor = '#2563eb'; // Blue fallback
      }
      caseExpression.push(fallbackColor);
      
      return caseExpression;
    }
    
    // Default color (no special coloring active)
    let defaultColor = color;
    if (color.includes('var(')) {
      console.warn('[DistrictMapGL] CSS variable detected in color, using fallback');
      defaultColor = '#2563eb'; // Blue fallback
    }
    return defaultColor;
  }, [showPartyAffiliation, districtPartyMapping, partyColors, showGerrymandering, gerryScores, getGerrymanderingColor, color]);

  const handleClick = React.useCallback((event: any) => {
    const features = event.features || [];
    const polygon = features.find((f: any) => f.layer.id === 'district-fill');
    if (polygon && onDistrictClick) {
      onDistrictClick(polygon, event.lngLat);
    }
  }, [onDistrictClick]);

  React.useEffect(() => {
    const map = mapRef.current?.getMap?.();
    if (!map) return;

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
          const lngLat = marker.getLngLat();
          if (popupMarker.onDragEnd) {
            popupMarker.onDragEnd({ lng: lngLat.lng, lat: lngLat.lat });
          }
        });
      }
      markerRef.current = marker;
    }

    return () => {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
    };
  }, [popupMarker]);

  // Force map repaint when party mapping changes
  React.useEffect(() => {
    const map = mapRef.current?.getMap?.();
    if (!map || !showPartyAffiliation) return;
    
    // console.log('[DistrictMapGL] Party mapping changed, map should update automatically');
    
  }, [fillColorExpression, showPartyAffiliation]);

  return (
    <Map
      ref={mapRef}
      initialViewState={initialViewState}
      style={{ width: '100%', height: '100%' }}
      mapStyle={mapStyle}
      interactiveLayerIds={['district-fill']}
      onClick={handleClick}
    >
      <Source id="districts" type="geojson" data={geojsonUrl}>
        <Layer
          id="district-fill"
          type="fill"
          paint={{
            'fill-color': fillColorExpression,
            'fill-opacity': showPartyAffiliation ? 0.3 : 0.08,
          }}
        />
        <Layer
          id="district-outline"
          type="line"
          paint={{
            'line-color': showPartyAffiliation ? '#333333' : (color.includes('var(') ? '#2563eb' : color),
            'line-width': showPartyAffiliation ? 1 : 2,
          }}
        />
      </Source>
    </Map>
  );
};
