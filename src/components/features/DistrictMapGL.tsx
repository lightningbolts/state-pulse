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
}


export const DistrictMapGL: React.FC<DistrictMapGLProps> = ({
  geojsonUrl,
  color,
  onDistrictClick,
  initialViewState = { longitude: -98.5795, latitude: 39.8283, zoom: 4 },
  popupMarker,
}) => {
  const mapRef = React.useRef<MapRef>(null);
  const markerRef = React.useRef<any>(null);

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

  return (
    <Map
      ref={mapRef}
      initialViewState={initialViewState}
      style={{ width: '100%', height: '100%' }}
      mapStyle="https://basemaps.cartocdn.com/gl/positron-gl-style/style.json"
      interactiveLayerIds={['district-fill']}
      onClick={handleClick}
    >
      <Source id="districts" type="geojson" data={geojsonUrl}>
        <Layer
          id="district-fill"
          type="fill"
          paint={{
            'fill-color': color,
            'fill-opacity': 0.08,
          }}
        />
        <Layer
          id="district-outline"
          type="line"
          paint={{
            'line-color': color,
            'line-width': 2,
          }}
        />
      </Source>
    </Map>
  );
};
