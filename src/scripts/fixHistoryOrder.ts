import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config({ path: require('path').resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB_NAME || 'statepulse-data';

interface HistoryEntry {
  date: Date;
  action: string;
  actor: string;
  classification: string[];
  order?: number;
}

async function fixHistoryOrder() {
  console.log(`Connecting to MongoDB: ${MONGO_URI}`);
  console.log(`Database: ${DB_NAME}`);

  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(DB_NAME);
    const legislationCollection = db.collection('legislation');

    // Find all legislation with history that needs sorting
    console.log('Finding legislation with history entries...');
    const legislationWithHistory = await legislationCollection.find({
      history: { $exists: true, $type: 'array', $ne: [] }
    }).toArray();

    console.log(`Found ${legislationWithHistory.length} legislation documents with history`);

    if (legislationWithHistory.length === 0) {
      console.log('No legislation with history found. Exiting.');
      return;
    }

    let processedCount = 0;
    let updatedCount = 0;
    let errorCount = 0;
    const errors: Array<{ id: string; error: string }> = [];

    // Process each legislation document
    for (const doc of legislationWithHistory) {
      try {
        processedCount++;

        if (!doc.history || !Array.isArray(doc.history) || doc.history.length === 0) {
          continue;
        }

        // Check if history is already sorted chronologically
        const history = doc.history as HistoryEntry[];
        let needsSorting = false;

        for (let i = 1; i < history.length; i++) {
          const prevDate = new Date(history[i - 1].date);
          const currentDate = new Date(history[i].date);

          if (prevDate > currentDate) {
            needsSorting = true;
            break;
          }
        }

        if (!needsSorting) {
          // History is already sorted
          continue;
        }

        // Sort history by date (chronological order - earliest first)
        const sortedHistory = [...history].sort((a, b) => {
          const dateA = new Date(a.date);
          const dateB = new Date(b.date);
          return dateA.getTime() - dateB.getTime();
        });

        console.log(`Sorting history for ${doc.id || doc._id}: ${history.length} entries`);

        // Update the document with sorted history
        const updateResult = await legislationCollection.updateOne(
          { _id: doc._id },
          {
            $set: {
              history: sortedHistory,
              updatedAt: new Date()
            }
          }
        );

        if (updateResult.modifiedCount === 1) {
          updatedCount++;
          console.log(`Successfully sorted history for: ${doc.id || doc._id}`);
        } else {
          console.error('Update operation did not modify any document');
        }

      } catch (error) {
        errorCount++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error processing ${doc.id || doc._id}: ${errorMsg}`);
        errors.push({ id: doc.id || doc._id, error: errorMsg });
      }

      // Progress update every 100 documents
      if (processedCount % 100 === 0) {
        console.log(`Progress: ${processedCount}/${legislationWithHistory.length} processed, ${updatedCount} updated`);
      }
    }

    // Summary
    console.log('\n=== HISTORY SORTING SUMMARY ===');
    console.log(`Total documents processed: ${processedCount}`);
    console.log(`Documents with history sorted: ${updatedCount}`);
    console.log(`Documents that were already sorted: ${processedCount - updatedCount - errorCount}`);
    console.log(`Errors encountered: ${errorCount}`);

    if (errors.length > 0) {
      console.log('\n=== ERRORS ===');
      errors.forEach(({ id, error }) => {
        console.log(`${id}: ${error}`);
      });
    }

    // Verification
    console.log('\n=== VERIFICATION ===');
    const unsortedCount = await legislationCollection.countDocuments({
      history: { $exists: true, $type: 'array', $ne: [] }
    });

    console.log(`Total documents with history after processing: ${unsortedCount}`);

    if (errorCount === 0) {
      console.log('All legislation history successfully sorted chronologically!');
    } else {
      console.log(`History sorting completed with ${errorCount} errors`);
    }

  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('MongoDB connection closed');
  }
}

// Run the script
if (require.main === module) {
  fixHistoryOrder()
    .then(() => {
      console.log('Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

export { fixHistoryOrder };
