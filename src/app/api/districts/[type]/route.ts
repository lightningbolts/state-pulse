import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';

// Map mode to type in DB
const TYPE_MAP: Record<string, string> = {
  'congressional-districts': 'congressional',
  'state-upper-districts': 'state_leg_upper',
  'state-lower-districts': 'state_leg_lower',
};

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
    const collection = await getCollection('map_boundaries');
    // Only fetch the geometry and properties needed for GeoJSON
    const cursor = collection.find({ type: dbType }, { projection: { geometry: 1, properties: 1, _id: 0 } });
    const features = await cursor.toArray();
    const geojson = {
      type: 'FeatureCollection',
      features: features.map(f => ({
        type: 'Feature',
        geometry: f.geometry,
        properties: f.properties || {},
      })),
    };
    return NextResponse.json(geojson);
  } catch (err) {
    return NextResponse.json({ error: 'Failed to fetch district boundaries', details: String(err) }, { status: 500 });
  }
}
