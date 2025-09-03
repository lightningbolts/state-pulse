import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';
import simplify from '@turf/simplify';
import type { Feature, Geometry, GeoJsonProperties } from 'geojson';

// Map mode to type in DB
const TYPE_MAP: Record<string, string> = {
  'congressional-districts': 'congressional',
  'state-upper-districts': 'state_leg_upper',
  'state-lower-districts': 'state_leg_lower',
};

// In-memory cache for GeoJSON by type
const geojsonCache: Record<string, { data: any, timestamp: number }> = {};
const CACHE_TTL = 1000 * 60 * 10; // 10 minutes

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ type: string }> }
) {
  const { type } = await params;
  const dbType = TYPE_MAP[type];
  if (!dbType) {
    return NextResponse.json({ error: 'Invalid district type' }, { status: 400 });
  }
  try {
    // Serve from cache if available and fresh
    const now = Date.now();
    if (geojsonCache[type] && now - geojsonCache[type].timestamp < CACHE_TTL) {
      return NextResponse.json(geojsonCache[type].data);
    }

    const collection = await getCollection('map_boundaries');
    // Only fetch the geometry and properties needed for GeoJSON
    const cursor = collection.find({ type: dbType }, { projection: { geometry: 1, properties: 1, _id: 0 } });
    const features = await cursor.toArray();

    // Simplify each geometry (tolerance can be tuned for your needs)
    const simplifiedFeatures = features.map(f => {
      let simplifiedGeom = f.geometry;
      const feature: Feature = {
        type: 'Feature',
        geometry: f.geometry,
        properties: f.properties || {},
      };
      try {
        const simplified = simplify(feature, { tolerance: 0.01, highQuality: false, mutate: false }) as Feature;
        simplifiedGeom = simplified.geometry;
      } catch (e) {
        // Fallback to original geometry if simplification fails
      }
      return {
        type: 'Feature',
        geometry: simplifiedGeom,
        properties: f.properties || {},
      };
    });

    const geojson = {
      type: 'FeatureCollection',
      features: simplifiedFeatures,
    };

    // Cache the result
    geojsonCache[type] = { data: geojson, timestamp: now };

    return NextResponse.json(geojson);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch district boundaries', details: String(err) }, { status: 500 });
  }
}
