// Run this script with: npx ts-node src/scripts/inspectLegislationSample.ts
import { getCollection } from '../lib/mongodb';
import dotenv from 'dotenv';

async function main() {
  const collection = await getCollection('legislation');
  const sample = await collection.findOne({ sponsors: { $exists: true, $ne: [] } });
  if (!sample) {
    console.log('No sample found with sponsors.');
    return;
  }
  console.log(JSON.stringify(sample, null, 2));
}

main().catch(console.error);
