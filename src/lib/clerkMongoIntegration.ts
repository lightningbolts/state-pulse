import { auth } from '@clerk/nextjs/server';
import {
  addUser,
  upsertUser,
  getUserById,
  cleanupLegacySavedLegislation
} from '@/services/usersService';
import { User } from '@/types/user';
/**
 * Get the current authenticated user from Clerk and their data from MongoDB
 * @returns User data from MongoDB with Clerk auth info
 */
export async function getCurrentUser(): Promise<User | null> {
  const { userId } = auth();

  if (!userId) {
    return null;
  }

  try {
    // Try to find user in MongoDB by Clerk userId
    const user = await getUserById(userId);

    // If user doesn't exist in MongoDB yet, create them
    if (!user) {
      const newUser: User = {
        id: userId,
        clerkId: userId, // Store both as id and clerkId for compatibility
        email: '',
        name: '',
        trackingTopics: [],
        preferences: {},
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      await addUser(newUser);
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
export async function syncUserToMongoDB(clerkUser: any): Promise<{success: boolean}> {
  if (!clerkUser.id) {
    throw new Error('User ID is required');
  }

  try {
    // Check if user already exists in MongoDB
    const existingUser = await getUserById(clerkUser.id);

    // Handle migration of savedLegislation to bookmarks collection
    let legacySavedLegislation: string[] = [];
    let shouldMigrate = false;

    if (existingUser && (existingUser as any).savedLegislation) {
      legacySavedLegislation = (existingUser as any).savedLegislation;
      shouldMigrate = legacySavedLegislation.length > 0;
      console.log('Found legacy savedLegislation to migrate:', legacySavedLegislation);
    }

    // Extract relevant data from Clerk user
    const userData: User = {
      id: clerkUser.id,
      clerkId: clerkUser.id,
      name: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim(),
      email: clerkUser.emailAddresses?.[0]?.emailAddress ||
             clerkUser.email_addresses?.[0]?.email_address,
      // Preserve existing arrays or initialize as empty if user is new
      trackingTopics: existingUser?.trackingTopics || [],
      updatedAt: new Date(),
      // Additional fields from Clerk that might be useful
      preferences: {
        imageUrl: clerkUser.imageUrl || clerkUser.image_url,
        // Preserve existing preferences
        ...existingUser?.preferences,
      }
    };

    // console.log('syncUserToMongoDB - preserving existing data:', {
    //   userId: userData.id,
    //   trackingTopics: userData.trackingTopics
    // });

    // Update user in MongoDB or create if doesn't exist
    await upsertUser(userData);

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
export async function saveUserPreferences(userId: string, preferences: any): Promise<{success: boolean}> {
  if (!userId) {
    throw new Error('User ID is required');
  }

  try {
    const user = await getUserById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    const updatedUser: User = {
      ...user,
      preferences: {
        ...user.preferences,
        ...preferences
      },
      updatedAt: new Date()
    };

    await upsertUser(updatedUser);

    return { success: true };
  } catch (error) {
    console.error('Error saving user preferences:', error);
    throw error;
  }
}

/**
 * Add a topic to user's tracking list
 * @param userId Clerk user ID
 * @param topic Topic to track
 */
export async function addUserTrackingTopic(userId: string, topic: string): Promise<{success: boolean}> {
  if (!userId || !topic) {
    throw new Error('User ID and topic are required');
  }

  try {
    const user = await getUserById(userId);

    if (!user) {
      throw new Error('User not found');
    }

    // Check if topic is already tracked
    const trackingTopics = user.trackingTopics || [];
    if (!trackingTopics.includes(topic)) {
      const updatedUser: User = {
        ...user,
        trackingTopics: [...trackingTopics, topic],
        updatedAt: new Date()
      };

      await upsertUser(updatedUser);
    }

    return { success: true };
  } catch (error) {
    console.error('Error adding tracking topic to user:', error);
    throw error;
  }
}
