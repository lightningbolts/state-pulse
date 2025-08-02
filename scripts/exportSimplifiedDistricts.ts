import { getCollection } from '../src/lib/mongodb';
import simplify from '@turf/simplify';
import fs from 'fs';
import path from 'path';
import type { Feature, Geometry, GeoJsonProperties, FeatureCollection } from 'geojson';

const TYPE_MAP: Record<string, string> = {
  'congressional-districts': 'congressional',
  'state-upper-districts': 'state_leg_upper',
  'state-lower-districts': 'state_leg_lower',
};

const OUTPUT_DIR = path.join(__dirname, '../public/districts');
const SIMPLIFY_TOLERANCE = 0.01; // Adjust as needed

async function exportType(typeKey: string, dbType: string) {
  const collection = await getCollection('map_boundaries');
  const cursor = collection.find({ type: dbType }, { projection: { geometry: 1, properties: 1, _id: 0 } });
  const features = await cursor.toArray();
  const simplifiedFeatures: Feature<Geometry, GeoJsonProperties>[] = [];
  let failedCount = 0;
  for (const f of features) {
    const feature: Feature<Geometry, GeoJsonProperties> = {
      type: 'Feature',
      geometry: f.geometry,
      properties: f.properties || {},
    };
    try {
      const simplified = simplify(feature, { tolerance: SIMPLIFY_TOLERANCE, highQuality: false, mutate: false }) as Feature<Geometry, GeoJsonProperties>;
      simplifiedFeatures.push({
        type: 'Feature',
        geometry: simplified.geometry,
        properties: f.properties || {},
      });
    } catch (e) {
      failedCount++;
    }
  }
  const geojson: FeatureCollection = {
    type: 'FeatureCollection',
    features: simplifiedFeatures,
  };
  if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  const outPath = path.join(OUTPUT_DIR, `${typeKey}.geojson`);
  fs.writeFileSync(outPath, JSON.stringify(geojson));
  console.log(`Exported ${typeKey}: ${simplifiedFeatures.length} features, ${failedCount} failed, to ${outPath}`);
}

async function main() {
  for (const [typeKey, dbType] of Object.entries(TYPE_MAP)) {
    await exportType(typeKey, dbType);
  }
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
