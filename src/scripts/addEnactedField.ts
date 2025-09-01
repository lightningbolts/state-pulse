import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import {enactedPatterns} from "@/types/legislation";

dotenv.config({ path: require('path').resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB_NAME || 'statepulse-data';


function findEnactedDate(doc: any): Date | null {
  // First, if the bill is already marked as enacted (isEnacted: true),
  // try to find a reasonable enactment date
  if (doc.isEnacted === true) {
    // Try to use latestActionAt if it exists and seems reasonable
    // if (doc.latestActionAt) {
    //   return new Date(doc.latestActionAt);
    // }

    // Try to find the most recent date from history
    if (doc.history && Array.isArray(doc.history)) {
      const sortedHistory = [...doc.history].sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
      });

      if (sortedHistory[0] && sortedHistory[0].date) {
        return new Date(sortedHistory[0].date);
      }
    }

    // If no other date is available but it's marked as enacted,
    // use a reasonable fallback
    if (doc.latestPassageAt) {
      return new Date(doc.latestPassageAt);
    }

    // Last resort: use updatedAt or createdAt
    if (doc.updatedAt) {
      return new Date(doc.updatedAt);
    }
    if (doc.createdAt) {
      return new Date(doc.createdAt);
    }
  }

  // Check latest action description for enacted patterns
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

async function addEnactedField() {
  console.log(`Connecting to MongoDB: ${MONGO_URI}`);
  console.log(`Database: ${DB_NAME}`);

  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(DB_NAME);
    const legislationCollection = db.collection('legislation');

    // Get total count for progress tracking
    const totalCount = await legislationCollection.countDocuments();
    console.log(`Processing ${totalCount} legislation documents...`);

    let processed = 0;
    let enactedCount = 0;
    const batchSize = 1000;

    // Process in batches to avoid memory issues
    for (let skip = 0; skip < totalCount; skip += batchSize) {
      const batch = await legislationCollection
        .find({}, { projection: { _id: 1, id: 1, isEnacted: 1, latestActionDescription: 1, latestActionAt: 1, latestPassageAt: 1, history: 1, updatedAt: 1, createdAt: 1 } })
        .skip(skip)
        .limit(batchSize)
        .toArray();

      const bulkOps = [];

      for (const doc of batch) {
        const enactedAt = findEnactedDate(doc);

        bulkOps.push({
          updateOne: {
            filter: { _id: doc._id },
            update: {
              $set: {
                enactedAt,
                enactedFieldUpdatedAt: new Date()
              }
            }
          }
        });

        if (enactedAt) {
          enactedCount++;
        }
        processed++;
      }

      if (bulkOps.length > 0) {
        await legislationCollection.bulkWrite(bulkOps);
      }

      console.log(`Processed ${processed}/${totalCount} documents (${enactedCount} enacted)`);
    }

    console.log(`\nCompleted! Added enactedAt field to ${processed} documents.`);
    console.log(`Found ${enactedCount} enacted legislation documents (${((enactedCount / processed) * 100).toFixed(2)}%)`);

  } catch (error) {
    console.error('Failed to add enacted field:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('MongoDB connection closed');
  }
}

if (require.main === module) {
  addEnactedField()
    .then(() => {
      console.log('Enacted field addition completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Enacted field addition failed:', error);
      process.exit(1);
    });
}

export { addEnactedField };
