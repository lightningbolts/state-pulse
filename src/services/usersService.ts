import { getCollection } from '../lib/mongodb';
import { Collection, ObjectId } from 'mongodb';

export interface User {
    id: string;
    name?: string;
    email?: string;
    role?: string;
    createdAt?: Date;
    updatedAt?: Date;
    preferences?: Record<string, any>;
    savedLegislation: [],
    trackingTopics: [],
    clerkId?: string;
    // Other fields as needed
}

interface UserMongoDbDocument extends Omit<User, 'id' | 'createdAt' | 'updatedAt'> {
    _id: ObjectId;
    id: string;
    createdAt?: Date;
    updatedAt?: Date;
}

function cleanupDataForMongoDB<T extends Record<string, any>>(data: T): T {
    const cleanData = { ...data };
    // Add any specific cleanup logic if needed
    return cleanData;
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

        const collection: Collection<UserMongoDbDocument> = await getCollection('users');
        await collection.updateOne(
            { id },
            { $set: cleanedData },
            { upsert: true }
        );
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
        return userDoc ? { ...userDoc, id: userDoc.id } : null;
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

export async function addSavedLegislation(userId: string, legislationId: string): Promise<void> {
    if (!userId || !legislationId) {
        console.error('User ID and legislation ID are required to save legislation.');
        throw new Error('User ID and legislation ID are required to save legislation.');
    }
    try {
        const collection: Collection<UserMongoDbDocument> = await getCollection('users');
        await collection.updateOne(
            { id: userId },
            {
                $addToSet: { savedLegislation: legislationId },
                $set: { updatedAt: new Date() }
            }
        );
    } catch (error) {
        console.error('Error adding saved legislation:', error);
        throw error;
    }
}

export async function removeSavedLegislation(userId: string, legislationId: string): Promise<void> {
    if (!userId || !legislationId) {
        console.error('User ID and legislation ID are required to remove saved legislation.');
        throw new Error('User ID and legislation ID are required to remove saved legislation.');
    }
    try {
        const collection: Collection<UserMongoDbDocument> = await getCollection('users');
        await collection.updateOne(
            { id: userId },
            {
                $pull: { savedLegislation: legislationId },
                $set: { updatedAt: new Date() }
            }
        );
    } catch (error) {
        console.error('Error removing saved legislation:', error);
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