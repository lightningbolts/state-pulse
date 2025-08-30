import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config({ path: require('path').resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB_NAME || 'statepulse-data';

// Reuse the enacted detection patterns
const enactedPatterns = [
  /signed.*(into|by).*(law|governor)/i,
  /approved.*by.*governor/i,
  /became.*law/i,
  /effective.*date/i,
  /chapter.*laws/i,
  /public.*law.*no/i,
  /acts.*of.*assembly.*chapter/i,
  /governor.*signed/i,
  /signed.*into.*law/i
];

function findEnactedDate(doc: any): Date | null {
  // Check latest action description first
  if (doc.latestActionDescription) {
    for (const pattern of enactedPatterns) {
      if (pattern.test(doc.latestActionDescription)) {
        // If latest action indicates enactment, use latestActionAt date
        return doc.latestActionAt ? new Date(doc.latestActionAt) : null;
      }
    }
  }

  // Check history for enacted actions (search in reverse chronological order)
  if (doc.history && Array.isArray(doc.history)) {
    // Sort by date in descending order to find the most recent enacted action
    const sortedHistory = [...doc.history].sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    });

    for (const historyItem of sortedHistory) {
      if (historyItem.action) {
        for (const pattern of enactedPatterns) {
          if (pattern.test(historyItem.action)) {
            // Return the date of the enacted action
            return historyItem.date ? new Date(historyItem.date) : null;
          }
        }
      }
    }
  }

  return null;
}

/**
 * Continuous background job to keep enactedAt field updated
 * This ensures new legislation automatically gets the enactedAt field computed
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

    // Find documents that don't have the enactedAt field or haven't been updated in the last week
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const documentsToUpdate = await legislationCollection.find({
      $or: [
        { enactedAt: { $exists: false } },
        { enactedFieldUpdatedAt: { $exists: false } },
        { enactedFieldUpdatedAt: { $lt: oneWeekAgo } },
        { updatedAt: { $gt: '$enactedFieldUpdatedAt' } } // Document was updated after enactedAt field
      ]
    }, {
      projection: { _id: 1, id: 1, latestActionDescription: 1, latestActionAt: 1, history: 1, enactedAt: 1 }
    }).limit(1000).toArray(); // Process in batches of 1000

    if (documentsToUpdate.length === 0) {
      console.log('No documents need enactedAt field updates');
      return { updated: 0, total: 0 };
    }

    console.log(`Found ${documentsToUpdate.length} documents that need enactedAt field updates`);

    const bulkOps = [];
    let updatedCount = 0;

    for (const doc of documentsToUpdate) {
      const computedEnactedAt = findEnactedDate(doc);

      // Only update if the value has changed or doesn't exist
      const currentEnactedAt = doc.enactedAt ? new Date(doc.enactedAt).getTime() : null;
      const newEnactedAt = computedEnactedAt ? computedEnactedAt.getTime() : null;

      if (currentEnactedAt !== newEnactedAt) {
        bulkOps.push({
          updateOne: {
            filter: { _id: doc._id },
            update: {
              $set: {
                enactedAt: computedEnactedAt,
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
