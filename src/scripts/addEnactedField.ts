import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import {enactedPatterns} from "@/types/legislation";

dotenv.config({ path: require('path').resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB_NAME || 'statepulse-data';

function findEnactedDate(doc: any): Date | null {
  const toDate = (dateStr: string | Date | undefined): Date | null => {
    if (!dateStr) return null;
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? null : d;
  };

  const checkPatterns = (text: string | undefined): boolean => {
    if (!text) return false;
    for (const pattern of enactedPatterns) {
      if (pattern.test(text)) {
        return true;
      }
    }
    return false;
  };

  const sortedHistory = (doc.history && Array.isArray(doc.history))
    ? [...doc.history].sort((a, b) => {
      const dateA = toDate(a.date)?.getTime() ?? 0;
      const dateB = toDate(b.date)?.getTime() ?? 0;
      return dateB - dateA;
    })
    : [];

  // 1. If isEnacted is explicitly true, find the best possible date.
  if (doc.isEnacted === true) {
    // Priority: latest history date, then latest passage, then update/create timestamps.
    return toDate(sortedHistory[0]?.date) ||
           toDate(doc.latestPassageAt) ||
           toDate(doc.updatedAt) ||
           toDate(doc.createdAt);
  }

  // 2. Check latest action description for an enacted pattern.
  if (checkPatterns(doc.latestActionDescription)) {
    return toDate(doc.latestActionAt);
  }

  // 3. Find the first history item that matches an enacted pattern.
  const enactedHistoryItem = sortedHistory.find(item => checkPatterns(item.action));
  if (enactedHistoryItem) {
    return toDate(enactedHistoryItem.date);
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
