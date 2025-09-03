import {getCollection} from '@/lib/mongodb';
import {Collection, ObjectId} from 'mongodb';
import {User, UserMongoDbDocument} from '@/types/user';

function cleanupDataForMongoDB<T extends Record<string, any>>(data: T): T {
    return {...data};
}

export async function addUser(userData: User): Promise<void> {
    if (!userData.id) {
        console.error('User ID is required to add user.');
        throw new Error('User ID is required to add user.');
    }
    try {
        const { id, ...dataToAdd } = userData;
        let cleanedData = cleanupDataForMongoDB(dataToAdd);
        cleanedData.createdAt = new Date();
        cleanedData.updatedAt = new Date();

        const collection: Collection<UserMongoDbDocument> = await getCollection('users');
        await collection.insertOne({
            _id: new ObjectId(),
            id,
            ...cleanedData
        });
    } catch (error) {
        console.error('Error adding user:', error);
        throw error;
    }
}

export async function upsertUser(userData: User): Promise<void> {
    if (!userData.id) {
        console.error('User ID is required to upsert user.');
        throw new Error('User ID is required to upsert user.');
    }
    try {
        const { id, ...dataToUpsert } = userData;
        let cleanedData = cleanupDataForMongoDB(dataToUpsert);
        cleanedData.updatedAt = new Date();

        // Ensure trackingTopics are always arrays
        if (!cleanedData.trackingTopics) {
            cleanedData.trackingTopics = [];
        }

        // console.log('Upserting user with data:', { id, ...cleanedData });

        const collection: Collection<UserMongoDbDocument> = await getCollection('users');
        const result = await collection.updateOne(
            { id },
            { $set: cleanedData },
            { upsert: true }
        );

        // console.log('Upsert result:', result);

        // Verify the user was created/updated correctly
        const verifyUser = await collection.findOne({ id });
        // console.log('User after upsert:', {
        //     id: verifyUser?.id,
        //     trackingTopics: verifyUser?.trackingTopics
        // });

    } catch (error) {
        console.error('Error upserting user:', error);
        throw error;
    }
}

export async function getUserById(userId: string): Promise<User | null> {
    if (!userId) {
        console.error('User ID is required to get user.');
        throw new Error('User ID is required to get user.');
    }
    try {
        const collection: Collection<UserMongoDbDocument> = await getCollection('users');
        const userDoc = await collection.findOne({ id: userId });

        // console.log('getUserById - Raw MongoDB document:', userDoc);

        if (!userDoc) {
            return null;
        }

        // console.log('getUserById - Processed user object:', {
        //     id: user.id,
        //     trackingTopics: user.trackingTopics
        // });

        return {
            ...userDoc,
            id: userDoc.id,
            trackingTopics: Array.isArray(userDoc.trackingTopics) ? userDoc.trackingTopics : [],
        };
    } catch (error) {
        console.error('Error getting user by ID:', error);
        throw error;
    }
}

export async function getAllUsers(): Promise<User[]> {
    try {
        const collection: Collection<UserMongoDbDocument> = await getCollection('users');
        const users = await collection.find().toArray();
        return users.map(user => ({ ...user, id: user.id }));
    } catch (error) {
        console.error('Error getting all users:', error);
        throw error;
    }
}

export async function deleteUser(userId: string): Promise<void> {
    if (!userId) {
        console.error('User ID is required to delete user.');
        throw new Error('User ID is required to delete user.');
    }
    try {
        const collection: Collection<UserMongoDbDocument> = await getCollection('users');
        await collection.deleteOne({ id: userId });
    } catch (error) {
        console.error('Error deleting user:', error);
        throw error;
    }
}

export async function updateUserPreferences(userId: string, preferences: Record<string, any>): Promise<void> {
    if (!userId) {
        console.error('User ID is required to update preferences.');
        throw new Error('User ID is required to update preferences.');
    }
    try {
        const collection: Collection<UserMongoDbDocument> = await getCollection('users');
        await collection.updateOne(
            { id: userId },
            { $set: { preferences, updatedAt: new Date() } }
        );
    } catch (error) {
        console.error('Error updating user preferences:', error);
        throw error;
    }
}

export async function addTrackingTopic(userId: string, topic: string): Promise<void> {
    if (!userId || !topic) {
        console.error('User ID and topic are required to track a topic.');
        throw new Error('User ID and topic are required to track a topic.');
    }
    try {
        const collection: Collection<UserMongoDbDocument> = await getCollection('users');
        await collection.updateOne(
            { id: userId },
            {
                $addToSet: { trackingTopics: topic },
                $set: { updatedAt: new Date() }
            }
        );
    } catch (error) {
        console.error('Error adding tracking topic:', error);
        throw error;
    }
}

export async function removeTrackingTopic(userId: string, topic: string): Promise<void> {
    if (!userId || !topic) {
        console.error('User ID and topic are required to stop tracking a topic.');
        throw new Error('User ID and topic are required to stop tracking a topic.');
    }
    try {
        const collection: Collection<UserMongoDbDocument> = await getCollection('users');
        await collection.updateOne(
            { id: userId },
            {
                $pull: { trackingTopics: topic },
                $set: { updatedAt: new Date() }
            }
        );
    } catch (error) {
        console.error('Error removing tracking topic:', error);
        throw error;
    }
}

export async function getUserByClerkId(clerkId: string): Promise<User | null> {
    if (!clerkId) {
        console.error('Clerk ID is required to get user.');
        throw new Error('Clerk ID is required to get user.');
    }
    try {
        const collection: Collection<UserMongoDbDocument> = await getCollection('users');
        const userDoc = await collection.findOne({ clerkId });
        return userDoc ? { ...userDoc, id: userDoc.id } : null;
    } catch (error) {
        console.error('Error getting user by Clerk ID:', error);
        throw error;
    }
}

// Clean up legacy savedLegislation array from user document after migration
export async function cleanupLegacySavedLegislation(userId: string): Promise<void> {
    if (!userId) {
        console.error('User ID is required to cleanup legacy savedLegislation.');
        throw new Error('User ID is required to cleanup legacy savedLegislation.');
    }
    try {
        const collection: Collection<UserMongoDbDocument> = await getCollection('users');
        await collection.updateOne(
            { id: userId },
            {
                $unset: { savedLegislation: "" },
                $set: { updatedAt: new Date() }
            }
        );
        console.log('Successfully removed savedLegislation array from user document');
    } catch (error) {
        console.error('Error cleaning up legacy savedLegislation:', error);
        throw error;
    }
}

// This code provides a service for managing users in a MongoDB database.
// It includes functions to add, upsert, retrieve, delete users, and manage user preferences,
// saved legislation, and tracking topics. It also includes error handling and data cleanup
// to ensure data integrity when interacting with the database.
//       ...clerkUser,
//     createdAt: new Date(),
//     updatedAt: new Date(),
//     preferences: clerkUser.preferences || {},
//     savedLegislation: [],
//     trackingTopics: [],
//   };