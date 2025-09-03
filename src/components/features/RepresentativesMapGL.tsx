
import * as React from 'react';
import Map, { Source, Layer, MapRef, Marker } from 'react-map-gl/maplibre';
import 'maplibre-gl/dist/maplibre-gl.css';
import { useTheme } from 'next-themes';
import { Card } from '@/components/ui/card';


interface Rep {
  lat: number;
  lon: number;
  name: string;
  office?: string;
  party?: string;
  distance?: number;
}

interface RepresentativesMapGLProps {
  center: [number, number];
  zoom: number;
  representatives: Rep[];
  userLocation?: [number, number];
  districts?: any[];
}

const typeToColor: Record<string, string> = {
  congressional: '#2563eb',
  state_leg_lower: '#16a34a',
  state_leg_upper: '#a21caf',
};

export function RepresentativesMapGL({ center, zoom, representatives, userLocation, districts }: RepresentativesMapGLProps) {
  const mapRef = React.useRef<MapRef>(null);
  const [popup, setPopup] = React.useState<any>(null);
  const { resolvedTheme } = useTheme ? useTheme() : { resolvedTheme: 'light' };

  // Prepare GeoJSON for districts
  const geojson = React.useMemo(() => {
    if (!districts || districts.length === 0) return null;
    return {
      type: "FeatureCollection" as const,
      features: districts.map((d: any) => {
        let props = d.properties ? { ...d.properties } : {};
        if (!props.type && d.type && d.type !== 'Feature') props.type = d.type;
        return {
          type: 'Feature' as const,
          geometry: d.geometry,
          properties: props,
        };
      }),
    };
  }, [districts]);

  // Fit to bounds when districts change
  React.useEffect(() => {
    if (!geojson || !mapRef.current) return;
    const map = mapRef.current.getMap();
    if (!map) return;
    // Compute bounds
    const coords: [number, number][] = [];
    geojson.features.forEach((f: any) => {
      if (f.geometry.type === 'Polygon') {
        f.geometry.coordinates[0].forEach((c: any) => coords.push(c));
      } else if (f.geometry.type === 'MultiPolygon') {
        f.geometry.coordinates.forEach((poly: any) => poly[0].forEach((c: any) => coords.push(c)));
      }
    });
    if (coords.length > 0) {
      const lons = coords.map(c => c[0]);
      const lats = coords.map(c => c[1]);
      const minLon = Math.min(...lons), maxLon = Math.max(...lons);
      const minLat = Math.min(...lats), maxLat = Math.max(...lats);
      map.fitBounds([[minLon, minLat], [maxLon, maxLat]], { padding: 20, maxZoom: 15 });
    }
  }, [geojson]);

  return (
    <Card className="w-full h-80 overflow-hidden" style={{ position: 'relative' }}>
      <Map
        ref={mapRef}
        initialViewState={{ longitude: center[1], latitude: center[0], zoom }}
        style={{ width: '100%', height: '100%' }}
        mapStyle={
          resolvedTheme === 'dark'
            ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
            : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json'
        }
      >
        {/* District boundaries */}
        {geojson && (
          <Source id="districts" type="geojson" data={geojson}>
            {Object.entries(typeToColor).map(([type, color]) => (
              <Layer
                key={type}
                id={`district-${type}`}
                type="line"
                filter={["==", ["get", "type"], type]}
                paint={{
                  'line-color': color,
                  'line-width': 3,
                }}
              />
            ))}
          </Source>
        )}
        {/* User location marker */}
        {userLocation && (
          <Marker longitude={userLocation[1]} latitude={userLocation[0]} anchor="center">
            <div style={{
              backgroundColor: '#3b82f6',
              width: 12,
              height: 12,
              borderRadius: '50%',
              border: '2px solid white',
              boxShadow: '0 0 4px rgba(0,0,0,0.3)',
            }}/>
          </Marker>
        )}
        {/* Representative markers */}
        {representatives.filter(rep => rep.lat && rep.lon).map((rep, i) => (
          <Marker
            key={i}
            longitude={rep.lon}
            latitude={rep.lat}
            anchor="center"
            onClick={e => {
              e.originalEvent.stopPropagation();
              setPopup({ ...rep });
            }}
          >
            <div style={{
              backgroundColor: '#ef4444',
              width: 10,
              height: 10,
              borderRadius: '50%',
              border: '2px solid white',
              boxShadow: '0 0 4px rgba(0,0,0,0.3)',
              cursor: 'pointer',
            }}/>
          </Marker>
        ))}
      </Map>
    </Card>
  );
}
