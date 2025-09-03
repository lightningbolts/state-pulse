import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config({ path: require('path').resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = process.env.MONGODB_DB_NAME || 'statepulse';
const COLLECTION_NAME = 'representatives';

function mergeObjects(a: any, b: any) {
  // Recursively merge objects, merge arrays, prefer most complete primitive values
  const merged: any = { ...a };
  for (const key of Object.keys(b)) {
    const aVal = merged[key];
    const bVal = b[key];
    if (bVal == null) continue;
    if (aVal == null) {
      merged[key] = bVal;
    } else if (Array.isArray(aVal) && Array.isArray(bVal)) {
      // Merge arrays and deduplicate
      merged[key] = Array.from(new Set([...aVal, ...bVal]));
    } else if (typeof aVal === 'object' && typeof bVal === 'object' && !Array.isArray(aVal) && !Array.isArray(bVal)) {
      // Recursively merge objects
      merged[key] = mergeObjects(aVal, bVal);
    } else if (typeof bVal === 'string' && bVal.length > (aVal?.length || 0)) {
      merged[key] = bVal;
    } else if (typeof bVal === 'number' && isNaN(aVal)) {
      merged[key] = bVal;
    } else if (bVal instanceof Date && (!aVal || (aVal instanceof Date && bVal > aVal))) {
      merged[key] = bVal;
    }
    // Otherwise, keep existing value
  }
  return merged;
}

async function main() {
  if (!MONGODB_URI) throw new Error('Missing MONGODB_URI');
  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const collection = db.collection(COLLECTION_NAME);

  // Fetch all representatives
  const reps = await collection.find({}).toArray();
  // Group by id or bioguideId
  const groups: Record<string, any[]> = {};
  for (const rep of reps) {
    const key = rep.id || rep.bioguideId;
    if (!key) continue;
    if (!groups[key]) groups[key] = [];
    groups[key].push(rep);
  }

  let mergedCount = 0;
  for (const key of Object.keys(groups)) {
    const group = groups[key];
    if (group.length < 2) continue;
    // Merge all duplicates
    let merged = group[0];
    for (let i = 1; i < group.length; i++) {
      merged = mergeObjects(merged, group[i]);
    }
    // Remove all duplicates
    await collection.deleteMany({ id: key });
    // Insert merged record
    await collection.insertOne(merged);
    mergedCount++;
    console.log(`Merged ${group.length} records for id ${key}`);
  }
  console.log(`Done. Merged ${mergedCount} duplicate sets.`);
  await client.close();
}

main().catch(err => {
  console.error('Error in mergeDuplicateRepresentatives:', err);
  process.exit(1);
});
