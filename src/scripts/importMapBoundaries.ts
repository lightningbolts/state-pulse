import fs from 'fs/promises';
import path from 'path';
import { getCollection } from '@/lib/mongodb';
import * as shapefile from 'shapefile';

const DATA_DIRS = [
  path.join(__dirname, '../data/congressional_districts_zips'),
  path.join(__dirname, '../data/state_leg_lower_zips'),
  path.join(__dirname, '../data/state_leg_upper_zips'),
];

async function findShapefiles(dir: string): Promise<string[]> {
  const files = await fs.readdir(dir);
  return files.filter(f => f.endsWith('.shp')).map(f => path.join(dir, f));
}

async function importShapefile(shpPath: string, type: string) {
  const dbCollection = await getCollection('map_boundaries');
  const base = shpPath.replace(/\.shp$/, '');
  const dbfPath = base + '.dbf';
  try {
    const source = await shapefile.open(shpPath, dbfPath);
    let count = 0;
    while (true) {
      const result = await source.read();
      if (result.done) break;
      const feature = result.value;
      await dbCollection.insertOne({ ...feature, type });
      count++;
    }
    console.log(`Imported ${count} features from ${path.basename(shpPath)} as ${type}`);
  } catch (err) {
    console.error(`Failed to import ${shpPath}:`, err);
  }
}

async function main() {
  for (const dir of DATA_DIRS) {
    let type = 'unknown';
    if (dir.includes('congressional')) type = 'congressional';
    else if (dir.includes('lower')) type = 'state_leg_lower';
    else if (dir.includes('upper')) type = 'state_leg_upper';
    try {
      const shapefiles = await findShapefiles(dir);
      for (const shp of shapefiles) {
        await importShapefile(shp, type);
      }
    } catch (err) {
      console.error(`Error processing directory ${dir}:`, err);
    }
  }
  process.exit(0);
}

main();
