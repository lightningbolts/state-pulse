import { getCollection } from '../lib/mongodb';
import fs from 'fs/promises';
import path from 'path';
import simplify from '@turf/simplify';
import { featureCollection } from '@turf/helpers';
import type { Feature, Geometry, GeoJsonProperties } from 'geojson';

// Disable simplification for maximum accuracy
const TOLERANCE = 0.0001;
const OUTPUT_DIR = path.join(__dirname, '../../public/districts');

const TYPE_MAP: Record<string, string> = {
  'congressional-districts': 'congressional',
  'state-upper-districts': 'state_leg_upper',
  'state-lower-districts': 'state_leg_lower',
};

function stripProperties(props: any) {
  // Keep only minimal properties for display
  const keep: Record<string, any> = {};
  if (props && props.name) keep.name = props.name;
  if (props && props.state) keep.state = props.state;
  if (props && props.district) keep.district = props.district;
  if (props && props.type) keep.type = props.type;
  return keep;
}

function reducePrecision(coords: any, decimals = 5): any {
  if (Array.isArray(coords)) {
    return coords.map((c: any) => reducePrecision(c, decimals));
  } else if (typeof coords === 'number') {
    return Number(coords.toFixed(decimals));
  } else {
    return coords;
  }
}

async function exportDistricts() {
  const dbCollection = await getCollection('map_boundaries');
  await fs.mkdir(OUTPUT_DIR, { recursive: true });
  for (const [outName, dbType] of Object.entries(TYPE_MAP)) {
    const features = await dbCollection.find({ type: dbType }, { projection: { geometry: 1, properties: 1, _id: 0 } }).toArray();
    const simplified: Feature<Geometry, GeoJsonProperties>[] = features.map(f => {
      let geom = f.geometry;
      const props = stripProperties(f.properties || {});
      const feature: Feature<Geometry, GeoJsonProperties> = {
        type: 'Feature',
        geometry: geom,
        properties: props,
      };
      try {
        const s = simplify(feature, { tolerance: TOLERANCE, highQuality: false, mutate: false }) as Feature<Geometry, GeoJsonProperties>;
        geom = s.geometry;
      } catch {}
      // Reduce coordinate precision
      if (geom && geom.coordinates) {
        geom.coordinates = reducePrecision(geom.coordinates, 5);
      }
      return {
        type: 'Feature',
        geometry: geom,
        properties: props,
      };
    });
    const fc = featureCollection(simplified);
    const outPath = path.join(OUTPUT_DIR, `${outName}.geojson`);
    await fs.writeFile(outPath, JSON.stringify(fc));
    console.log(`Exported ${outName} to ${outPath} (${simplified.length} features)`);
  }
  console.log('All district overlays exported.');
}

exportDistricts().catch(err => {
  console.error('Error exporting districts:', err);
  process.exit(1);
});
