import { auth } from '@clerk/nextjs/server';
import { connectToDatabase } from './mongodb';
import type { MongoClient, Db } from 'mongodb';

/**
 * Get the current authenticated user from Clerk and their data from MongoDB
 * @returns User data from MongoDB with Clerk auth info
 */
export async function getCurrentUser() {
  const { userId } = auth();

  if (!userId) {
    return null;
  }

  // Connect to MongoDB
  const { client, db } = await connectToDatabase();

  try {
    // Try to find user in MongoDB by Clerk userId
    const user = await db
      .collection('users')
      .findOne({ clerkId: userId });

    // If user doesn't exist in MongoDB yet, create them
    if (!user) {
      const newUser = {
        clerkId: userId,
        createdAt: new Date(),
        updatedAt: new Date(),
        // Add any additional default fields you want
        preferences: {},
        savedLegislation: [],
        trackingTopics: [],
      };

      await db.collection('users').insertOne(newUser);
      return newUser;
    }

    return user;
  } catch (error) {
    console.error('Error fetching user from MongoDB:', error);
    throw error;
  }
}

/**
 * Sync user data from Clerk to MongoDB when user is created or updated
 * @param clerkUser User data from Clerk
 */
export async function syncUserToMongoDB(clerkUser: any) {
  if (!clerkUser.id) {
    throw new Error('User ID is required');
  }

  const { client, db } = await connectToDatabase();

  // Extract relevant data from Clerk user
  const userData = {
    clerkId: clerkUser.id,
    email: clerkUser.emailAddresses?.[0]?.emailAddress,
    firstName: clerkUser.firstName,
    lastName: clerkUser.lastName,
    imageUrl: clerkUser.imageUrl,
    updatedAt: new Date(),
  };

  try {
    // Update user in MongoDB or create if doesn't exist
    await db.collection('users').updateOne(
      { clerkId: clerkUser.id },
      {
        $set: userData,
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true }
    );

    return { success: true };
  } catch (error) {
    console.error('Error syncing user to MongoDB:', error);
    throw error;
  }
}

/**
 * Save user preferences to MongoDB
 * @param userId Clerk user ID
 * @param preferences User preferences to save
 */
export async function saveUserPreferences(userId: string, preferences: any) {
  if (!userId) {
    throw new Error('User ID is required');
  }

  const { client, db } = await connectToDatabase();

  try {
    await db.collection('users').updateOne(
      { clerkId: userId },
      {
        $set: {
          preferences,
          updatedAt: new Date()
        }
      }
    );

    return { success: true };
  } catch (error) {
    console.error('Error saving user preferences:', error);
    throw error;
  }
}
