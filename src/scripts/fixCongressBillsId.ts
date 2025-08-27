import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config({ path: require('path').resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB_NAME || 'statepulse-data';

interface LegislationDocument {
  _id: any;
  id: string;
  session: string;
  identifier: string;
  jurisdictionName: string;
}

async function fixCongressBillsId() {
  console.log(`Connecting to MongoDB: ${MONGO_URI}`);
  console.log(`Database: ${DB_NAME}`);

  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(DB_NAME);
    const legislationCollection = db.collection('legislation');

    // Find all Congress bills with ocd-bill IDs
    const query = {
      jurisdictionName: 'United States Congress',
      id: { $regex: '^ocd-bill' }
    };

    console.log('Searching for Congress bills with ocd-bill IDs...');
    const congressBills = await legislationCollection.find(query).toArray() as LegislationDocument[];

    console.log(`Found ${congressBills.length} Congress bills to convert`);

    if (congressBills.length === 0) {
      console.log('No bills to convert. Exiting.');
      return;
    }

    let successCount = 0;
    let errorCount = 0;
    const errors: Array<{ id: string; error: string }> = [];

    // Process each bill
    for (const bill of congressBills) {
      try {
        // Extract session and identifier
        const { session, identifier } = bill;

        if (!session || !identifier) {
          throw new Error(`Missing session or identifier. Session: ${session}, Identifier: ${identifier}`);
        }

        // Create new ID format: congress-bill-[session]-[identifier]
        // Replace spaces in identifier with hyphens
        const sanitizedIdentifier = identifier.replace(/\s+/g, '-');
        const newId = `congress-bill-${session}-${sanitizedIdentifier}`.toLowerCase();

        console.log(`Converting: ${bill.id} -> ${newId}`);

        // Check if the new ID already exists
        const existingBill = await legislationCollection.findOne({ id: newId });
        if (existingBill && existingBill._id.toString() !== bill._id.toString()) {
          throw new Error(`New ID ${newId} already exists for a different bill`);
        }

        // Update the bill with new ID
        const updateResult = await legislationCollection.updateOne(
          { _id: bill._id },
          { $set: { id: newId } }
        );

        if (updateResult.modifiedCount === 1) {
          successCount++;
          console.log(`Successfully updated: ${bill.id} -> ${newId}`);
        } else {
          throw new Error('Update operation did not modify any document');
        }

      } catch (error) {
        errorCount++;
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        console.error(`Error updating ${bill.id}: ${errorMsg}`);
        errors.push({ id: bill.id, error: errorMsg });
      }
    }

    // Summary
    console.log('\n=== CONVERSION SUMMARY ===');
    console.log(`Total bills processed: ${congressBills.length}`);
    console.log(`Successfully converted: ${successCount}`);
    console.log(`Errors: ${errorCount}`);

    if (errors.length > 0) {
      console.log('\n=== ERRORS ===');
      errors.forEach(({ id, error }) => {
        console.log(`${id}: ${error}`);
      });
    }

    // Verify the conversion
    console.log('\n=== VERIFICATION ===');
    const remainingOcdBills = await legislationCollection.countDocuments(query);
    console.log(`Remaining Congress bills with ocd-bill IDs: ${remainingOcdBills}`);

    const newCongressBills = await legislationCollection.countDocuments({
      jurisdictionName: 'United States Congress',
      id: { $regex: '^congress-bill-' }
    });
    console.log(`Total Congress bills with congress-bill- IDs: ${newCongressBills}`);

    if (remainingOcdBills === 0) {
      console.log('All Congress bills successfully converted!');
    } else {
      console.log('Some bills still need conversion');
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
  fixCongressBillsId()
    .then(() => {
      console.log('Script completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Script failed:', error);
      process.exit(1);
    });
}

export { fixCongressBillsId };
