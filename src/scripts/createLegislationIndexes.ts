import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config({ path: require('path').resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB_NAME || 'statepulse-data';

async function createLegislationIndexes() {
  console.log(`Connecting to MongoDB: ${MONGO_URI}`);
  console.log(`Database: ${DB_NAME}`);

  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(DB_NAME);
    const legislationCollection = db.collection('legislation');

    console.log('Creating indexes for legislation collection...');

    // Create index for updatedAt field (used in email notifications)
    await legislationCollection.createIndex({ updatedAt: 1 });
    console.log('Created index on updatedAt');

    // Create compound index for updatedAt + sponsors (for sponsorship notifications)
    await legislationCollection.createIndex({ updatedAt: 1, sponsors: 1 });
    console.log('Created compound index on updatedAt + sponsors');

    // Create index for jurisdictionName (frequently queried)
    await legislationCollection.createIndex({ jurisdictionName: 1 });
    console.log('Created index on jurisdictionName');

    // Create compound index for jurisdictionName + updatedAt
    await legislationCollection.createIndex({ jurisdictionName: 1, updatedAt: 1 });
    console.log('Created compound index on jurisdictionName + updatedAt');

    console.log('All indexes created successfully');

    // List all indexes to verify
    console.log('\nCurrent indexes:');
    const indexes = await legislationCollection.listIndexes().toArray();
    indexes.forEach(index => {
      console.log(`- ${index.name}: ${JSON.stringify(index.key)}`);
    });

  } catch (error) {
    console.error('Failed to create indexes:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('MongoDB connection closed');
  }
}

if (require.main === module) {
  createLegislationIndexes()
    .then(() => {
      console.log('Index creation completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Index creation failed:', error);
      process.exit(1);
    });
}
