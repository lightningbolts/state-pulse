import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config({ path: require('path').resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB_NAME || 'statepulse-data';

async function createEnactedAtIndexes() {
  console.log(`Connecting to MongoDB: ${MONGO_URI}`);
  console.log(`Database: ${DB_NAME}`);

  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(DB_NAME);
    const legislationCollection = db.collection('legislation');

    console.log('Creating indexes for enactedAt field...');

    // Create compound index for enactedAt and latestActionAt (for sorting enacted legislation)
    // Use exists filter instead of $ne for partial index
    await legislationCollection.createIndex(
      { enactedAt: 1, latestActionAt: -1 },
      {
        name: 'enactedAt_1_latestActionAt_-1',
        background: true,
        partialFilterExpression: { enactedAt: { $exists: true, $type: "date" } }
      }
    );
    console.log('Created index: enactedAt_1_latestActionAt_-1');

    // Create compound index for enactedAt, jurisdictionName, and latestActionAt
    await legislationCollection.createIndex(
      { enactedAt: 1, jurisdictionName: 1, latestActionAt: -1 },
      {
        name: 'enactedAt_1_jurisdictionName_1_latestActionAt_-1',
        background: true,
        partialFilterExpression: { enactedAt: { $exists: true, $type: "date" } }
      }
    );
    console.log('Created index: enactedAt_1_jurisdictionName_1_latestActionAt_-1');

    // Create index for enactedAt field alone (for general enacted filtering)
    await legislationCollection.createIndex(
      { enactedAt: 1 },
      {
        name: 'enactedAt_1',
        background: true
      }
    );
    console.log('Created index: enactedAt_1');

    // Create index for enactedFieldUpdatedAt (for incremental updates)
    await legislationCollection.createIndex(
      { enactedFieldUpdatedAt: 1 },
      {
        name: 'enactedFieldUpdatedAt_1',
        background: true
      }
    );
    console.log('Created index: enactedFieldUpdatedAt_1');

    // List all indexes to verify
    const indexes = await legislationCollection.listIndexes().toArray();
    console.log('\nAll indexes in legislation collection:');
    indexes.forEach(index => {
      console.log(`  - ${index.name}: ${JSON.stringify(index.key)}`);
    });

    console.log('\nAll enactedAt indexes created successfully!');

  } catch (error) {
    console.error('Failed to create enactedAt indexes:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('MongoDB connection closed');
  }
}

if (require.main === module) {
  createEnactedAtIndexes()
    .then(() => {
      console.log('Index creation completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Index creation failed:', error);
      process.exit(1);
    });
}

export { createEnactedAtIndexes };
