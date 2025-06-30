// One-time cleanup script to fix the bookmark migration issue
import { getCollection } from '../lib/mongodb';

async function cleanupUserBookmarks() {
  try {
    const userId = 'user_2ybNH0jat7ei4M4LixPBljCWFRY';

    console.log('Starting cleanup for user:', userId);

    // 1. Remove the savedLegislation array from the user document
    const usersCollection = await getCollection('users');

    const userUpdateResult = await usersCollection.updateOne(
      { id: userId },
      {
        $unset: { savedLegislation: "" },
        $set: { updatedAt: new Date() }
      }
    );

    console.log('User document update result:', userUpdateResult);

    // 2. Check current bookmarks in the collection
    const bookmarksCollection = await getCollection('bookmarks');
    const currentBookmarks = await bookmarksCollection.find({ userId }).toArray();

    console.log('Current bookmarks count:', currentBookmarks.length);
    console.log('Current bookmark legislation IDs:', currentBookmarks.map(b => b.legislationId));

    // 3. Verify user document no longer has savedLegislation
    const updatedUser = await usersCollection.findOne({ id: userId });
    console.log('User document after cleanup:', {
      id: updatedUser?.id,
      hasSavedLegislation: 'savedLegislation' in (updatedUser || {}),
      updatedAt: updatedUser?.updatedAt
    });

    console.log('Cleanup completed successfully!');

  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    process.exit(0);
  }
}

cleanupUserBookmarks();
