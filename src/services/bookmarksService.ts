import { getCollection } from '../lib/mongodb';
import { Collection, ObjectId } from 'mongodb';
import { LegislationBookmark, BookmarkMongoDbDocument, BookmarkMetadata } from '../types/legislation';
import { randomUUID } from 'crypto';

// Helper function to clean up data for MongoDB
function cleanupDataForMongoDB<T extends Record<string, any>>(data: T): T {
    const cleanData = { ...data };
    return cleanData;
}

// Add a new bookmark
export async function addBookmark(
    userId: string,
    legislationId: string,
    metadata?: BookmarkMetadata
): Promise<LegislationBookmark> {
    try {
        // Check if a bookmark already exists
        const existingBookmark = await getBookmark(userId, legislationId);
        if (existingBookmark) {
            throw new Error('Legislation is already bookmarked');
        }

        const bookmarkId = randomUUID();
        const now = new Date();

        const bookmarkData: LegislationBookmark = {
            id: bookmarkId,
            userId,
            legislationId,
            metadata,
            createdAt: now,
            updatedAt: now
        };

        const { id, ...dataToAdd } = bookmarkData;
        const cleanedData = cleanupDataForMongoDB(dataToAdd);

        const collection: Collection<BookmarkMongoDbDocument> = await getCollection('bookmarks');
        await collection.insertOne({
            _id: new ObjectId(),
            id: bookmarkId,
            ...cleanedData
        });

        return bookmarkData;
    } catch (error) {
        console.error('Error adding bookmark:', error);
        throw error;
    }
}

// Remove a bookmark
export async function removeBookmark(userId: string, legislationId: string): Promise<boolean> {
    try {
        const collection: Collection<BookmarkMongoDbDocument> = await getCollection('bookmarks');

        // console.log('removeBookmark - query:', { userId, legislationId });

        // First, let's see if the bookmark exists
        const existingBookmark = await collection.findOne({ userId, legislationId });
        // console.log('removeBookmark - existing bookmark found:', existingBookmark);

        const result = await collection.deleteOne({ userId, legislationId });
        // console.log('removeBookmark - delete result:', {
        //     deletedCount: result.deletedCount,
        //     acknowledged: result.acknowledged
        // });

        return result.deletedCount > 0;
    } catch (error) {
        console.error('Error removing bookmark:', error);
        throw error;
    }
}

// Get a specific bookmark
export async function getBookmark(userId: string, legislationId: string): Promise<LegislationBookmark | null> {
    try {
        const collection: Collection<BookmarkMongoDbDocument> = await getCollection('bookmarks');
        const bookmark = await collection.findOne({ userId, legislationId });

        if (!bookmark) return null;

        return {
            id: bookmark.id,
            userId: bookmark.userId,
            legislationId: bookmark.legislationId,
            metadata: bookmark.metadata,
            createdAt: bookmark.createdAt,
            updatedAt: bookmark.updatedAt
        };
    } catch (error) {
        console.error('Error getting bookmark:', error);
        throw error;
    }
}

// Get all bookmarks for a user
export async function getUserBookmarks(
    userId: string,
    options?: {
        limit?: number;
        offset?: number;
        sortBy?: 'createdAt' | 'updatedAt';
        sortOrder?: 'asc' | 'desc';
        tags?: string[];
        priority?: 'low' | 'medium' | 'high';
    }
): Promise<LegislationBookmark[]> {
    try {
        const collection: Collection<BookmarkMongoDbDocument> = await getCollection('bookmarks');

        // Build query
        let query: any = { userId };

        if (options?.tags && options.tags.length > 0) {
            query['metadata.tags'] = { $in: options.tags };
        }

        if (options?.priority) {
            query['metadata.priority'] = options.priority;
        }

        // Build sort criteria
        const sortField = options?.sortBy || 'createdAt';
        const sortOrder = options?.sortOrder === 'asc' ? 1 : -1;

        let cursor = collection.find(query).sort({ [sortField]: sortOrder });

        if (options?.offset) {
            cursor = cursor.skip(options.offset);
        }

        if (options?.limit) {
            cursor = cursor.limit(options.limit);
        }

        const bookmarks = await cursor.toArray();

        return bookmarks.map(bookmark => ({
            id: bookmark.id,
            userId: bookmark.userId,
            legislationId: bookmark.legislationId,
            metadata: bookmark.metadata,
            createdAt: bookmark.createdAt,
            updatedAt: bookmark.updatedAt
        }));
    } catch (error) {
        console.error('Error getting user bookmarks:', error);
        throw error;
    }
}

// Update bookmark metadata
export async function updateBookmarkMetadata(
    userId: string,
    legislationId: string,
    metadata: BookmarkMetadata
): Promise<LegislationBookmark | null> {
    try {
        const collection: Collection<BookmarkMongoDbDocument> = await getCollection('bookmarks');

        const result = await collection.findOneAndUpdate(
            { userId, legislationId },
            {
                $set: {
                    metadata: cleanupDataForMongoDB(metadata),
                    updatedAt: new Date()
                }
            },
            { returnDocument: 'after' }
        );

        if (!result) return null;

        return {
            id: result.id,
            userId: result.userId,
            legislationId: result.legislationId,
            metadata: result.metadata,
            createdAt: result.createdAt,
            updatedAt: result.updatedAt
        };
    } catch (error) {
        console.error('Error updating bookmark metadata:', error);
        throw error;
    }
}

// Check if legislation is bookmarked by user
export async function isBookmarked(userId: string, legislationId: string): Promise<boolean> {
    try {
        const bookmark = await getBookmark(userId, legislationId);
        return bookmark !== null;
    } catch (error) {
        console.error('Error checking if bookmarked:', error);
        return false;
    }
}

// Get bookmark count for a user
export async function getBookmarkCount(userId: string): Promise<number> {
    try {
        const collection: Collection<BookmarkMongoDbDocument> = await getCollection('bookmarks');
        return await collection.countDocuments({ userId });
    } catch (error) {
        console.error('Error getting bookmark count:', error);
        return 0;
    }
}

// Get legislation IDs that are bookmarked by user (for backward compatibility)
export async function getUserBookmarkedLegislationIds(userId: string): Promise<string[]> {
    try {
        const bookmarks = await getUserBookmarks(userId);
        return bookmarks.map(bookmark => bookmark.legislationId);
    } catch (error) {
        console.error('Error getting bookmarked legislation IDs:', error);
        return [];
    }
}