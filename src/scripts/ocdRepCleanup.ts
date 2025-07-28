
// Script to clean up all ocd-person ids by replacing / with _
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config({ path: require('path').resolve(__dirname, '../../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.DB_NAME || 'statepulse';
const COLLECTION_NAME = 'representatives';

async function cleanupOcdPersonIds() {
  const client = new MongoClient(MONGODB_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const reps = db.collection(COLLECTION_NAME);

    // Find all docs with ocd-person/ in id
    const query = { id: { $regex: /^ocd-person\// } };
    const docs = await reps.find(query).toArray();
    if (docs.length === 0) {
      console.log('No ocd-person/ ids found.');
      return;
    }

    let updatedCount = 0;
    for (const doc of docs) {
      const newId = doc.id.replace(/\//g, '_');
      if (newId !== doc.id) {
        await reps.updateOne({ _id: doc._id }, { $set: { id: newId } });
        updatedCount++;
        console.log(`Updated id: ${doc.id} -> ${newId}`);
      }
    }
    console.log(`Cleanup complete. Updated ${updatedCount} documents.`);
  } catch (err) {
    console.error('Error during cleanup:', err);
  } finally {
    await client.close();
  }
}

cleanupOcdPersonIds();
