import dotenv from 'dotenv';
import path from 'path';
import { MongoClient } from 'mongodb';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function removeLongGeminiSummaries() {
  let client: MongoClient | null = null;

  try {
    console.log('Environment check:');
    console.log('MONGODB_URI exists:', !!process.env.MONGODB_URI);
    console.log('MONGODB_URI value:', process.env.MONGODB_URI ? `${process.env.MONGODB_URI.substring(0, 30)}...` : 'undefined');
    console.log('MONGODB_DB_NAME:', process.env.MONGODB_DB_NAME || 'statepulse');

    if (!process.env.MONGODB_URI) {
      console.error('MONGODB_URI is not loaded. Exiting.');
      process.exit(1);
    }

    console.log('Connecting directly to MongoDB...');
    client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();

    const db = client.db(process.env.MONGODB_DB_NAME || 'statepulse');
    const collection = db.collection('legislation');

    console.log('Connected successfully. Searching for documents with long geminiSummary...');

    const query = {
      geminiSummary: {
        $exists: true,
        $type: "string",
        $regex: /.{2001,}/
      }
    };

    const result = await collection.updateMany(query, { $set: { geminiSummary: "" } });

    console.log(`\nScan and update complete.`);
    console.log(`Documents updated (summary set to empty string): ${result.modifiedCount}`);

  } catch (error) {
    console.error('An error occurred:', error);
  } finally {
    if (client) {
      await client.close();
    }
    process.exit(0);
  }
}

removeLongGeminiSummaries();
