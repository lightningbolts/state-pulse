import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config({ path: require('path').resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB_NAME || 'statepulse-data';

async function createEnactedIndexes() {
  console.log(`Connecting to MongoDB: ${MONGO_URI}`);
  console.log(`Database: ${DB_NAME}`);

  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db(DB_NAME);
    const legislationCollection = db.collection('legislation');

    console.log('Creating optimized indexes for enacted legislation queries...');

    // Primary index for enacted legislation filtering
    await legislationCollection.createIndex(
      { isEnacted: 1, latestActionAt: -1 },
      { background: true, name: 'enacted_latest_action_idx' }
    );
    console.log('Created index: isEnacted + latestActionAt (descending)');

    // Index for enacted legislation with jurisdiction filtering
    await legislationCollection.createIndex(
      { isEnacted: 1, jurisdictionName: 1, latestActionAt: -1 },
      { background: true, name: 'enacted_jurisdiction_action_idx' }
    );
    console.log('Created index: isEnacted + jurisdictionName + latestActionAt');

    // Index for enacted legislation with search capabilities
    await legislationCollection.createIndex(
      { isEnacted: 1, title: 'text', summary: 'text', identifier: 'text' },
      { background: true, name: 'enacted_text_search_idx' }
    );
    console.log('Created text search index for enacted legislation');

    // Index for enacted legislation by subjects/topics
    await legislationCollection.createIndex(
      { isEnacted: 1, subjects: 1, latestActionAt: -1 },
      { background: true, name: 'enacted_subjects_idx' }
    );
    console.log('Created index: isEnacted + subjects + latestActionAt');

    // Sparse index specifically for enacted legislation (only indexes docs where isEnacted: true)
    await legislationCollection.createIndex(
      { latestActionAt: -1, jurisdictionName: 1, updatedAt: -1 },
      {
        background: true,
        name: 'enacted_only_compound_idx',
        partialFilterExpression: { isEnacted: true }
      }
    );
    console.log('Created sparse index for enacted-only documents');

    console.log('All enacted legislation indexes created successfully');

    // List all indexes to verify
    console.log('\nCurrent indexes:');
    const indexes = await legislationCollection.listIndexes().toArray();
    indexes.forEach(index => {
      console.log(`- ${index.name}: ${JSON.stringify(index.key)} ${index.partialFilterExpression ? `(partial: ${JSON.stringify(index.partialFilterExpression)})` : ''}`);
    });

  } catch (error) {
    console.error('Failed to create enacted indexes:', error);
    process.exit(1);
  } finally {
    await client.close();
    console.log('MongoDB connection closed');
  }
}

if (require.main === module) {
  createEnactedIndexes()
    .then(() => {
      console.log('Enacted indexes creation completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Enacted indexes creation failed:', error);
      process.exit(1);
    });
}

export { createEnactedIndexes };
