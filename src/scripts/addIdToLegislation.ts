import { getCollection } from '../lib/mongodb';

/**
 * This script will iterate through all legislation documents in MongoDB and set the `id` field
 * to the string value of the document's `_id` if `id` is missing, or leave it as-is if present.
 * You can customize this logic to use another unique field if desired.
 */
async function main() {
  const collection = await getCollection('legislation');
  const batchSize = 100;
  let lastId = undefined;
  let count = 0;

  while (true) {
    const query = lastId ? { _id: { $gt: lastId } } : {};
    // Update ALL docs, regardless of whether 'id' exists
    const docs = await collection
      .find({ ...query })
      .sort({ _id: 1 })
      .limit(batchSize)
      .toArray();
    if (docs.length === 0) break;
    for (const doc of docs) {
      const id = doc._id?.toString();
      if (!id) continue;
      await collection.updateOne(
        { _id: doc._id },
        { $set: { id } }
      );
      count++;
      lastId = doc._id;
      console.log(`Updated legislation ${id}`);
    }
  }
  console.log(`Done. Updated ${count} documents.`);
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
