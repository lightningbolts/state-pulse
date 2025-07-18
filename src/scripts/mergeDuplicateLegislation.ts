import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from "path";
dotenv.config({ path: require('path').resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017';
console.log('Using MongoDB URI:', MONGO_URI);
const DB_NAME = 'statepulse';
const COLLECTION_NAME = 'legislation';

function dedupeArray(arr: any[], key: string = 'order') {
  const seen = new Set();
  return arr.filter(item => {
    const k = item[key] !== undefined ? item[key] : JSON.stringify(item);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function mergeLegislationGroup(docs: any[]) {
  if (docs.length === 1) return docs[0];
  const merged: any = { ...docs[0] };

  // Merge arrays
  merged.actions = dedupeArray(docs.flatMap(d => d.actions || []));
  merged.sponsors = dedupeArray(docs.flatMap(d => d.sponsors || []), 'name');
  merged.versions = dedupeArray(docs.flatMap(d => d.versions || []), 'note');
  merged.subjects = Array.from(new Set(docs.flatMap(d => d.subjects || [])));

  // Merge scalar fields
  merged.summary = docs.map(d => d.summary).filter(Boolean).sort((a, b) => b.length - a.length)[0] || null;
  merged.title = docs.map(d => d.title).filter(Boolean).sort((a, b) => b.length - a.length)[0] || null;
  merged.latestActionDescription = docs.map(d => d.latestActionDescription).filter(Boolean).pop() || null;

  // Merge metadata
  merged.createdAt = docs.map(d => d.createdAt).sort()[0] || null;
  merged.updatedAt = docs.map(d => d.updatedAt).sort().pop() || null;

  // Merge links
  merged.congressUrl = docs.map(d => d.congressUrl).filter(Boolean).pop() || null;
  merged.openstatesUrl = docs.map(d => d.openstatesUrl).filter(Boolean).pop() || null;
  merged.stateLegislatureUrl = docs.map(d => d.stateLegislatureUrl).filter(Boolean).pop() || null;

  // Merge other fields as needed
  // ...

  return merged;
}

async function main() {
  console.log('Connecting to MongoDB...');
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  console.log('Connected.');
  const db = client.db(DB_NAME);
  const col = db.collection(COLLECTION_NAME);

  // Define the allCongressQuery
  const allCongressQuery = {
    $or: [
      {
        jurisdictionName: {
          $regex: 'United States|US|USA|Federal|Congress',
          $options: 'i'
        }
      },
      {
        $and: [
          {
            $or: [
              { jurisdictionName: { $exists: false } },
              { jurisdictionName: null },
              { jurisdictionName: '' }
            ]
          },
          { session: { $regex: 'Congress', $options: 'i' } }
        ]
      }
    ]
  };

  console.log('Finding all federal/Congress legislation entries...');
  const allCongressDocs = await col.find(allCongressQuery).toArray();
  console.log(`Found ${allCongressDocs.length} federal/Congress entries.`);

  // Group by sources array (urls)
  const groups: Record<string, any[]> = {};
  for (const doc of allCongressDocs) {
    // sources: [{url: string, ...}]
    const urls = (doc.sources || []).map((s: any) => s.url).sort();
    const key = urls.join('|');
    if (!key) continue; // skip if no sources
    if (!groups[key]) groups[key] = [];
    groups[key].push(doc);
  }

  const duplicateGroups = Object.values(groups).filter(g => g.length > 1);
  console.log(`Found ${duplicateGroups.length} duplicate groups by sources array.`);

  for (const group of duplicateGroups) {
    const urls = (group[0].sources || []).map((s: any) => s.url).sort();
    const key = urls.join('|');
    console.log(`Merging group with sources: ${key}, count=${group.length}`);
    const merged = mergeLegislationGroup(group);
    // Remove all duplicates
    const ids = group.map(d => d._id);
    console.log(`Deleting ${ids.length} duplicate documents...`);
    await col.deleteMany({ _id: { $in: ids } });
    // Insert merged doc
    console.log('Inserting merged document...');
    await col.insertOne(merged);
    console.log(`Merged ${ids.length} docs for sources: ${key}`);
  }

  console.log('Done. Closing connection.');
  await client.close();
}

main().catch(console.error);
