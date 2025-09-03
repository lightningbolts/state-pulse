import dotenv from 'dotenv';
dotenv.config();

import { connectToDatabase, getDb } from '@/lib/mongodb';
import { syncUserToMongoDB } from '@/lib/clerkMongoIntegration';

// Sample Clerk user data for testing
const sampleClerkUser = {
  id: 'test_user_' + Date.now(), // Generate unique ID for testing
  firstName: 'Test',
  lastName: 'User',
  emailAddresses: [
    {
      emailAddress: 'test@example.com'
    }
  ],
  imageUrl: 'https://example.com/avatar.jpg'
};

async function testIntegration() {
  try {
    console.log('Testing Clerk-MongoDB integration...');
    console.log('Sample user:', sampleClerkUser);

    // Test MongoDB connection
    console.log('Connecting to MongoDB...');
    await connectToDatabase();
    console.log('Successfully connected to MongoDB');

    // Test user syncing
    console.log('Syncing user to MongoDB...');
    const result = await syncUserToMongoDB(sampleClerkUser);
    console.log('Sync result:', result);

    // Verify user was created
    const db = await getDb();
    const user = await db.collection('users').findOne({ id: sampleClerkUser.id });
    console.log('User in database:', user);

    console.log('Test completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error during test:', error);
    process.exit(1);
  }
}

testIntegration();
