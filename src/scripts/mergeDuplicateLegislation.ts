import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config({ path: require('path').resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017';
console.log('Using MongoDB URI:', MONGO_URI);
const DB_NAME = process.env.MONGODB_DB_NAME || 'statepulse-data';
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

  // Handle ID preference: prefer congress-bill over ocd-bill
  const preferredDoc = docs.find(doc => doc.id && doc.id.startsWith('congress-bill-')) || docs[0];
  merged.id = preferredDoc.id;

  // Merge arrays
  merged.actions = dedupeArray(docs.flatMap(d => d.actions || []));
  merged.sponsors = dedupeArray(docs.flatMap(d => d.sponsors || []), 'name');
  merged.versions = dedupeArray(docs.flatMap(d => d.versions || []), 'note');
  merged.subjects = Array.from(new Set(docs.flatMap(d => d.subjects || [])));
  merged.history = dedupeArray(docs.flatMap(d => d.history || []));
  merged.sources = dedupeArray(docs.flatMap(d => d.sources || []));
  merged.abstracts = dedupeArray(docs.flatMap(d => d.abstracts || []));

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

  // Merge dates
  merged.firstActionAt = docs.map(d => d.firstActionAt).sort()[0] || null;
  merged.latestActionAt = docs.map(d => d.latestActionAt).sort().pop() || null;
  merged.latestPassageAt = docs.map(d => d.latestPassageAt).sort().pop() || null;

  // Merge text
  merged.fullText = docs.map(d => d.fullText).filter(Boolean).sort
    ((a, b) => b.length - a.length)[0] || null;
  merged.geminiSummary = docs.map(d => d.geminiSummary).filter(Boolean).sort
    ((a, b) => b.length - a.length)[0] || null;

  // Merge classifications
  merged.classification = Array.from(new Set(docs.flatMap(d => d.classification || [])));

  // Merge jurisdictions
  merged.jurisdictionId = docs.map(d => d.jurisdictionId).filter(Boolean).pop() || null;
  merged.jurisdictionName = docs.map(d => d.jurisdictionName).filter(Boolean).pop() || null;

  // Merge chamber
  merged.chamber = docs.map(d => d.chamber).filter(Boolean).pop() || null;

  // Merge session
  merged.session = docs.map(d => d.session).filter(Boolean).pop() || null;

  // Merge identifier
  merged.identifier = docs.map(d => d.identifier).filter(Boolean).pop() || null;

  // Merge statusText
  merged.statusText = docs.map(d => d.statusText).filter(Boolean).pop() || null;

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
    jurisdictionName: 'United States Congress'
  };

  console.log('Finding all federal/Congress legislation entries...');
  const allCongressDocs = await col.find(allCongressQuery).toArray();
  console.log(`Found ${allCongressDocs.length} federal/Congress entries.`);

  // Create a map to find duplicates between ocd-bill and congress-bill IDs
  const congressBillMap = new Map<string, any[]>(); // congress-bill ID -> array of docs
  const ocdBillsToCheck: any[] = [];

  // First, collect all congress-bill entries
  for (const doc of allCongressDocs) {
    if (doc.id && doc.id.startsWith('congress-bill-')) {
      const key = doc.id;
      if (!congressBillMap.has(key)) congressBillMap.set(key, []);
      congressBillMap.get(key)!.push(doc);
    } else if (doc.id && doc.id.startsWith('ocd-bill')) {
      ocdBillsToCheck.push(doc);
    }
  }

  console.log(`Found ${congressBillMap.size} unique congress-bill IDs`);
  console.log(`Found ${ocdBillsToCheck.length} ocd-bill entries to check for duplicates`);

  // Check each ocd-bill to see if it has a congress-bill equivalent
  let duplicateGroupsCount = 0;
  const groups: any[][] = [];

  for (const ocdDoc of ocdBillsToCheck) {
    if (!ocdDoc.session || !ocdDoc.identifier) {
      console.log(`Skipping ocd-bill ${ocdDoc.id} - missing session or identifier`);
      continue;
    }

    // Generate what the congress-bill ID would be for this ocd-bill
    const sanitizedIdentifier = ocdDoc.identifier.replace(/\s+/g, '-');
    const expectedCongressId = `congress-bill-${ocdDoc.session}-${sanitizedIdentifier}`.toLowerCase();

    // Check if this expected ID exists in the congress-bill map
    if (congressBillMap.has(expectedCongressId)) {
      const congressDocs = congressBillMap.get(expectedCongressId)!;
      const duplicateGroup = [ocdDoc, ...congressDocs];
      groups.push(duplicateGroup);
      duplicateGroupsCount++;

      console.log(`Found duplicate: ocd-bill ${ocdDoc.id} matches congress-bill ${expectedCongressId}`);

      // Remove from map to avoid processing again
      congressBillMap.delete(expectedCongressId);
    }
  }

  // Also check for duplicates within congress-bill entries (same session/identifier)
  for (const [congressId, docs] of congressBillMap.entries()) {
    if (docs.length > 1) {
      groups.push(docs);
      duplicateGroupsCount++;
      console.log(`Found ${docs.length} duplicate congress-bill entries for ID: ${congressId}`);
    }
  }

  console.log(`Found ${duplicateGroupsCount} duplicate groups total.`);

  for (const group of groups) {
    const hasOcdBill = group.some(doc => doc.id && doc.id.startsWith('ocd-bill'));
    const hasCongressBill = group.some(doc => doc.id && doc.id.startsWith('congress-bill-'));

    console.log(`Merging group with ${group.length} documents:`);

    // Show which IDs are being merged
    const idsBeingMerged = group.map(doc => doc.id || 'no-id').join(', ');
    console.log(`  IDs being merged: ${idsBeingMerged}`);

    if (hasOcdBill && hasCongressBill) {
      console.log(`  This group contains both ocd-bill and congress-bill entries`);
    }

    const merged = mergeLegislationGroup(group);
    console.log(`  Using preferred ID: ${merged.id}`);

    // Remove all duplicates
    const ids = group.map(d => d._id);
    console.log(`Deleting ${ids.length} duplicate documents...`);
    await col.deleteMany({ _id: { $in: ids } });
    // Insert merged doc
    console.log('Inserting merged document...');
    await col.insertOne(merged);
    console.log(`Successfully merged ${ids.length} documents`);
  }

  console.log('Done. Closing connection.');
  await client.close();
}

main().catch(console.error);
