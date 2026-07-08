import 'dotenv/config';
import { MongoClient } from 'mongodb';
import { findEnactedDate } from '@/utils/enacted-legislation';

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB_NAME || 'statepulse-data';
const BATCH_SIZE = 2000;

async function backfillMissingEnactedAt() {
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  const col = client.db(DB_NAME).collection('legislation');

  let updated = 0;
  let processed = 0;
  let skip = 0;

  while (true) {
    const batch = await col
      .find({ enactedAt: null })
      .skip(skip)
      .limit(BATCH_SIZE)
      .project({
        _id: 1,
        isEnacted: 1,
        latestActionDescription: 1,
        latestActionAt: 1,
        latestPassageAt: 1,
        history: 1,
        updatedAt: 1,
        createdAt: 1,
      })
      .toArray();

    if (!batch.length) break;

    const bulkOps = [];
    for (const doc of batch) {
      const enactedAt = findEnactedDate(doc);
      if (enactedAt) {
        bulkOps.push({
          updateOne: {
            filter: { _id: doc._id },
            update: { $set: { enactedAt, enactedFieldUpdatedAt: new Date() } },
          },
        });
        updated++;
      }
    }

    if (bulkOps.length) {
      await col.bulkWrite(bulkOps);
    }

    processed += batch.length;
    skip += batch.length;
    if (processed % 20000 === 0) {
      console.log(`Processed ${processed}, updated ${updated}`);
    }
  }

  const congressLatest = await col
    .find({ enactedAt: { $ne: null }, jurisdictionName: 'United States Congress' })
    .sort({ enactedAt: -1 })
    .limit(1)
    .project({ identifier: 1, enactedAt: 1 })
    .toArray();
  const totalEnacted = await col.countDocuments({ enactedAt: { $ne: null } });

  console.log({ processed, updated, totalEnacted, congressLatest });
  await client.close();
}

backfillMissingEnactedAt().catch((error) => {
  console.error(error);
  process.exit(1);
});
