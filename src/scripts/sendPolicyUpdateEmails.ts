dotenv.config({ path: require('path').resolve(__dirname, '../../.env') });

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { sendEmail } from '../lib/email';
import { users } from '@clerk/clerk-sdk-node';
import { searchLegislationByTopic } from '../services/legislationService';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB_NAME || 'statepulse-data';


async function main() {
  console.log('Using MongoDB URI:', MONGO_URI);
  let client: MongoClient | null = null;
  try {
    client = new MongoClient(MONGO_URI);
    await client.connect();
    console.log('Connected to MongoDB.');
    const db = client.db(DB_NAME);
    const subsCol = db.collection('topic_subscriptions');
    // Find all subscriptions with notifyByEmail: true
    const subsCursor = subsCol.find({ notifyByEmail: true });
    const subsArr = await subsCursor.toArray();
    // Group subscriptions by userId
    const userTopicsMap: Record<string, string[]> = {};
    for (const sub of subsArr) {
      if (!sub.userId || !sub.topic) continue;
      if (!userTopicsMap[sub.userId]) userTopicsMap[sub.userId] = [];
      userTopicsMap[sub.userId].push(sub.topic);
    }
    for (const userId of Object.keys(userTopicsMap)) {
      const topics = userTopicsMap[userId];
      let newLegislation: { topic: string; bills: any[] }[] = [];
      for (const topic of topics) {
        // Only get bills from the last 1 day
        const bills = await searchLegislationByTopic(topic, 1);
        if (bills && bills.length > 0) {
          newLegislation.push({ topic, bills });
        }
      }
      if (newLegislation.length > 0) {
        // Fetch user email (try Clerk first, fallback to topic_subscriptions.email if present)
        let email = undefined;
        try {
          if (users && userId) {
            const clerkUser = await users.getUser(userId);
            email = clerkUser?.emailAddresses?.[0]?.emailAddress;
          }
        } catch (e) {
          console.warn('Could not fetch Clerk user for', userId, e);
        }
        // Fallback: try to get email from any subscription for this user
        if (!email) {
          const subWithEmail = subsArr.find(s => s.userId === userId && s.email);
          email = subWithEmail?.email;
        }
        if (email) {
          let html = `<h2>New Legislation Updates for Your Tracked Topics</h2>`;
          for (const entry of newLegislation) {
            html += `<h3>Topic: ${entry.topic}</h3><ul>`;
            for (const bill of entry.bills) {
              html += `<li><b>${bill.identifier}</b>: ${bill.title} <br/>`;
              html += `Session: ${bill.session}, Jurisdiction: ${bill.jurisdictionName}`;
              if (bill.latestActionAt) html += `, Latest Action: ${new Date(bill.latestActionAt).toLocaleDateString()}`;
              html += `</li>`;
            }
            html += `</ul>`;
          }
          try {
            await sendEmail({
              to: email,
              subject: 'New Legislation Updates for Your Tracked Topics',
              html,
              text: 'You have new legislation updates for your tracked topics.'
            });
            console.log(`Sent update email to ${email}`);
          } catch (e) {
            console.error('Failed to send update email:', e);
          }
        } else {
          console.warn('No email found for user', userId);
        }
      }
    }
  } catch (err) {
    console.error('Failed to connect to MongoDB or process emails:', err);
    process.exit(1);
  } finally {
    if (client) {
      await client.close();
      console.log('Closed MongoDB connection.');
    }
  }
}

main().then(() => process.exit(0));
