import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config({ path: require('path').resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB_NAME || 'statepulse-data';

// Reuse the enacted detection patterns from the existing codebase
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

function isLegislationEnacted(doc: any): boolean {
  // Check latest action description
  if (doc.latestActionDescription) {
    for (const pattern of enactedPatterns) {
      if (pattern.test(doc.latestActionDescription)) {
        return true;
      }
    }
  }

  // Check history for enacted actions
  if (doc.history && Array.isArray(doc.history)) {
    for (const historyItem of doc.history) {
      if (historyItem.action) {
        for (const pattern of enactedPatterns) {
          if (pattern.test(historyItem.action)) {
            return true;
          }
        }
      }
    }
  }

  return false;
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
        .find({}, { projection: { _id: 1, id: 1, latestActionDescription: 1, history: 1 } })
        .skip(skip)
        .limit(batchSize)
        .toArray();

      const bulkOps = [];

      for (const doc of batch) {
        const isEnacted = isLegislationEnacted(doc);

        bulkOps.push({
          updateOne: {
            filter: { _id: doc._id },
            update: {
              $set: {
                isEnacted,
                enactedFieldUpdatedAt: new Date()
              }
            }
          }
        });

        if (isEnacted) {
          enactedCount++;
        }
        processed++;
      }

      if (bulkOps.length > 0) {
        await legislationCollection.bulkWrite(bulkOps);
      }

      console.log(`Processed ${processed}/${totalCount} documents (${enactedCount} enacted)`);
    }

    console.log(`\nCompleted! Added isEnacted field to ${processed} documents.`);
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
