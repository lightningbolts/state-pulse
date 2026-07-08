import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { findEnactedDate } from '@/utils/enacted-legislation';

dotenv.config({ path: require('path').resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB_NAME || 'statepulse-data';
const BATCH_SIZE = 1000;

/**
 * Continuous background job to keep enactedAt field updated.
 */
async function updateEnactedFieldIncrementally() {
  console.log(`Connecting to MongoDB: ${MONGO_URI}`);
  console.log(`Database: ${DB_NAME}`);

  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(DB_NAME);
    const legislationCollection = db.collection('legislation');
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const documentsToUpdate = await legislationCollection.find({
      $or: [
        { enactedAt: { $exists: false } },
        { enactedAt: null },
        { enactedFieldUpdatedAt: { $exists: false } },
        { enactedFieldUpdatedAt: { $lt: oneWeekAgo } },
      ],
    }, {
      projection: {
        _id: 1,
        id: 1,
        isEnacted: 1,
        latestActionDescription: 1,
        latestActionAt: 1,
        latestPassageAt: 1,
        history: 1,
        enactedAt: 1,
        updatedAt: 1,
        createdAt: 1,
      },
    }).limit(BATCH_SIZE).toArray();

    if (documentsToUpdate.length === 0) {
      console.log('No documents need enactedAt field updates');
      return { updated: 0, total: 0 };
    }

    console.log(`Found ${documentsToUpdate.length} documents that need enactedAt field updates`);

    const bulkOps = [];
    let updatedCount = 0;

    for (const doc of documentsToUpdate) {
      const computedEnactedAt = findEnactedDate(doc);
      const currentEnactedAt = doc.enactedAt ? new Date(doc.enactedAt).getTime() : null;
      const newEnactedAt = computedEnactedAt ? computedEnactedAt.getTime() : null;

      if (currentEnactedAt !== newEnactedAt) {
        bulkOps.push({
          updateOne: {
            filter: { _id: doc._id },
            update: {
              $set: {
                enactedAt: computedEnactedAt,
                enactedFieldUpdatedAt: new Date(),
              },
            },
          },
        });
        updatedCount++;
      } else {
        bulkOps.push({
          updateOne: {
            filter: { _id: doc._id },
            update: {
              $set: {
                enactedFieldUpdatedAt: new Date(),
              },
            },
          },
        });
      }
    }

    if (bulkOps.length > 0) {
      await legislationCollection.bulkWrite(bulkOps);
    }

    console.log(`Updated ${updatedCount} documents with new enactedAt values`);
    console.log(`Processed ${documentsToUpdate.length} total documents`);

    return { updated: updatedCount, total: documentsToUpdate.length };
  } catch (error) {
    console.error('Failed to update enacted field incrementally:', error);
    throw error;
  } finally {
    await client.close();
    console.log('MongoDB connection closed');
  }
}

if (require.main === module) {
  updateEnactedFieldIncrementally()
    .then((result) => {
      console.log(`Incremental update completed: ${result.updated}/${result.total} documents updated`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Incremental update failed:', error);
      process.exit(1);
    });
}

export { updateEnactedFieldIncrementally };
