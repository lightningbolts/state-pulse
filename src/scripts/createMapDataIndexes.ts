import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the project root
dotenv.config({ path: path.join(process.cwd(), '.env') });

import { connectToDatabase } from '@/lib/mongodb';

async function createMapDataIndexes() {
  try {
    console.log('Connecting to MongoDB...');
    console.log('MongoDB URI:', process.env.MONGODB_URI ? 'Set' : 'Not set');
    console.log('MongoDB DB Name:', process.env.MONGODB_DB_NAME || 'statepulse-data');

    const { db } = await connectToDatabase();

    console.log('Creating indexes for map data optimization...');

    // Index for jurisdictionName (most important for grouping)
    await db.collection('legislation').createIndex(
      { jurisdictionName: 1 },
      { background: true, name: 'jurisdiction_name_idx' }
    );

    // Compound index for jurisdictionName and latestActionAt (for recent activity queries)
    await db.collection('legislation').createIndex(
      { jurisdictionName: 1, latestActionAt: -1 },
      { background: true, name: 'jurisdiction_latest_action_idx' }
    );

    // Index for latestActionAt (for date-based filtering)
    await db.collection('legislation').createIndex(
      { latestActionAt: -1 },
      { background: true, name: 'latest_action_idx' }
    );

    // List all indexes to verify
    const indexes = await db.collection('legislation').listIndexes().toArray();
    console.log('Created indexes:');
    indexes.forEach(index => {
      console.log(`- ${index.name}: ${JSON.stringify(index.key)}`);
    });

    console.log('Index creation completed successfully!');

  } catch (error) {
    console.error('Error creating indexes:', error);
  } finally {
    process.exit(0);
  }
}

// Run the script
createMapDataIndexes();
