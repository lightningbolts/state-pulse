import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';

import fetch from 'node-fetch';

type ClerkUser = {
  email_addresses?: { email_address: string }[];
  [key: string]: any;
};

// Helper to fetch Clerk user email via REST API
async function getClerkUserEmail(userId: string): Promise<string | undefined> {
  const apiKey = process.env.CLERK_SECRET_KEY;
  if (!apiKey) throw new Error('Missing CLERK_SECRET_KEY in env');
  const resp = await fetch(`https://api.clerk.dev/v1/users/${userId}`, {
    headers: { Authorization: `Bearer ${apiKey}` }
  });
  const body = await resp.text();
  if (!resp.ok) {
    console.warn(`DEBUG: Clerk API call failed for user ${userId}. Status: ${resp.status}. Body: ${body}`);
    return undefined;
  }
  let clerkUser: ClerkUser;
  try {
    clerkUser = JSON.parse(body) as ClerkUser;
  } catch (e) {
    console.warn(`DEBUG: Failed to parse Clerk API response for user ${userId}:`, body);
    return undefined;
  }
  console.warn(`DEBUG: Clerk API response for user ${userId}:`, JSON.stringify(clerkUser, null, 2));
  return clerkUser?.email_addresses?.[0]?.email_address;
}

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB_NAME || 'statepulse-data';

async function main() {
  let client: MongoClient | null = null;
  try {
    client = new MongoClient(MONGO_URI);
    await client.connect();
    console.log('Connected to MongoDB.');
    const db = client.db(DB_NAME);
    const subsCol = db.collection('topic_subscriptions');
    const usersCol = db.collection('users');
  // Find all topic_subscriptions with missing email, regardless of notifyByEmail
  const cursor = subsCol.find({ $or: [ { email: { $exists: false } }, { email: null }, { email: '' } ] });
    // Count and migrate topic_subscriptions missing notifyByEmail for audit and data hygiene
    const missingNotifyCount = await subsCol.countDocuments({ notifyByEmail: { $exists: false } });
    if (missingNotifyCount > 0) {
      console.warn(`There are ${missingNotifyCount} topic_subscriptions missing the notifyByEmail field. Setting to false for data hygiene...`);
      const result = await subsCol.updateMany(
        { notifyByEmail: { $exists: false } },
        { $set: { notifyByEmail: false } }
      );
      console.log(`Set notifyByEmail: false on ${result.modifiedCount} topic_subscriptions.`);
    }
    let updatedCount = 0;
    while (await cursor.hasNext()) {
      const sub = await cursor.next();
      if (!sub || !sub.userId) continue;
      let email = undefined;
      let source = '';
      try {
        email = await getClerkUserEmail(sub.userId);
        if (email) source = 'Clerk';
      } catch (e) {
        // Ignore Clerk errors
      }
      if (!email) {
        // Try users collection by userId or clerkId
        const userDoc = await usersCol.findOne({ $or: [ { id: sub.userId }, { clerkId: sub.userId } ] });
        if (userDoc && userDoc.email) {
          email = userDoc.email;
          source = 'users collection';
        }
      }
      if (email) {
        await subsCol.updateMany(
          { userId: sub.userId, $or: [ { email: { $exists: false } }, { email: null }, { email: '' } ] },
          { $set: { email } }
        );
        updatedCount++;
        console.log(`Backfilled email for user ${sub.userId} from ${source}: ${email}`);
      } else {
        console.warn(`No email found for user ${sub.userId}`);
      }
    }
    console.log(`\nBackfill complete. Updated ${updatedCount} users.`);
  } catch (err) {
    console.error('Failed to backfill emails:', err);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('Closed MongoDB connection.');
    }
  }
}

main().then(() => process.exit(0));
