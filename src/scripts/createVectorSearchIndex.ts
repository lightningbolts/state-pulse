import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config({ path: require('path').resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB_NAME || 'statepulse-data';
const VECTOR_INDEX_NAME = 'legislation_embedding';

/**
 * Creates supporting indexes and prints Atlas Vector Search index JSON.
 *
 * Atlas vector indexes must be created in the Atlas UI or via Atlas Admin API.
 * Run: npx tsx src/scripts/createVectorSearchIndex.ts
 */
async function createVectorSearchIndex() {
  console.log(`Connecting to MongoDB: ${MONGO_URI}`);
  console.log(`Database: ${DB_NAME}`);

  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    const db = client.db(DB_NAME);
    const legislationCollection = db.collection('legislation');

    await legislationCollection.createIndex({ embedding: 1, jurisdictionName: 1, latestActionAt: -1 });
    console.log('Created compound index on embedding + jurisdictionName + latestActionAt');

    const vectorIndexDefinition = {
      name: VECTOR_INDEX_NAME,
      type: 'vectorSearch',
      definition: {
        fields: [
          {
            type: 'vector',
            path: 'embedding',
            numDimensions: 384,
            similarity: 'cosine',
          },
          {
            type: 'filter',
            path: 'jurisdictionName',
          },
          {
            type: 'filter',
            path: 'enactedAt',
          },
        ],
      },
    };

    console.log('\n--- Atlas Vector Search Index Definition ---');
    console.log('Create this index in MongoDB Atlas (Search → Create Search Index → JSON Editor):\n');
    console.log(JSON.stringify(vectorIndexDefinition, null, 2));
    console.log('\nAfter creating the index, server-side vector search will be used automatically.');
    console.log('Until then, the compare API falls back to in-memory ranking over filtered candidates.');
  } catch (error) {
    console.error('Failed:', error);
    process.exit(1);
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  createVectorSearchIndex()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { createVectorSearchIndex };
