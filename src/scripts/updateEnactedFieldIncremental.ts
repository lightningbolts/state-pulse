import { MongoClient } from 'mongodb';
import { detectEnactedByPatterns } from '../utils/enacted-legislation';
import dotenv from 'dotenv';

dotenv.config({ path: require('path').resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB_NAME || 'statepulse-data';

/**
 * Continuous background job to keep isEnacted field updated
 * This ensures new legislation automatically gets the isEnacted field computed
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

    // Find documents that don't have the isEnacted field or haven't been updated in the last week
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const documentsToUpdate = await legislationCollection.find({
      $or: [
        { isEnacted: { $exists: false } },
        { enactedFieldUpdatedAt: { $exists: false } },
        { enactedFieldUpdatedAt: { $lt: oneWeekAgo } },
        { updatedAt: { $gt: '$enactedFieldUpdatedAt' } } // Document was updated after isEnacted field
      ]
    }, {
      projection: { _id: 1, id: 1, latestActionDescription: 1, history: 1, isEnacted: 1 }
    }).limit(1000).toArray(); // Process in batches of 1000

    if (documentsToUpdate.length === 0) {
      console.log('No documents need isEnacted field updates');
      return { updated: 0, total: 0 };
    }

    console.log(`Found ${documentsToUpdate.length} documents that need isEnacted field updates`);

    const bulkOps = [];
    let updatedCount = 0;

    for (const doc of documentsToUpdate) {
      const computedEnacted = detectEnactedByPatterns(doc);

      // Only update if the value has changed or doesn't exist
      if (doc.isEnacted !== computedEnacted) {
        bulkOps.push({
          updateOne: {
            filter: { _id: doc._id },
            update: {
              $set: {
                isEnacted: computedEnacted,
                enactedFieldUpdatedAt: new Date()
              }
            }
          }
        });
        updatedCount++;
      } else {
        // Just update the timestamp to mark it as checked
        bulkOps.push({
          updateOne: {
            filter: { _id: doc._id },
            update: {
              $set: {
                enactedFieldUpdatedAt: new Date()
              }
            }
          }
        });
      }
    }

    if (bulkOps.length > 0) {
      await legislationCollection.bulkWrite(bulkOps);
    }

    console.log(`Updated ${updatedCount} documents with new isEnacted values`);
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
