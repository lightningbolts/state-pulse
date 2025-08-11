import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { sendEmail } from '../lib/email';
import { renderBrandedEmail } from '../lib/emailTemplate';
import { searchLegislationByTopic } from '../services/legislationService';

import fetch from 'node-fetch';

type ClerkUser = {
  email_addresses?: { email_address: string }[];
};


dotenv.config({ path: require('path').resolve(__dirname, '../../.env') });

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
  const usersCol = db.collection('users');
    // Find all subscriptions with notifyByEmail: true
    const subsCursor = subsCol.find({ notifyByEmail: true });
    const subsArr = await subsCursor.toArray();
    // Group subscriptions by userId, only including topics with notifyByEmail: true
    // (subsArr is already filtered, but we ensure per-topic correctness)
    const userTopicsMap: Record<string, string[]> = {};
    for (const sub of subsArr) {
      if (!sub.userId || !sub.topic) continue;
      if (!userTopicsMap[sub.userId]) userTopicsMap[sub.userId] = [];
      // Only add topic if this subscription has notifyByEmail: true
      if (sub.notifyByEmail) {
        userTopicsMap[sub.userId].push(sub.topic);
      }
    }
    // Helper to fetch Clerk user email via REST API
    async function getClerkUserEmail(userId: string): Promise<string | undefined> {
      const apiKey = process.env.CLERK_SECRET_KEY;
      if (!apiKey) throw new Error('Missing CLERK_SECRET_KEY in env');
      const resp = await fetch(`https://api.clerk.dev/v1/users/${userId}`, {
        headers: { Authorization: `Bearer ${apiKey}` }
      });
      if (!resp.ok) return undefined;
      const clerkUser = (await resp.json()) as ClerkUser;
      return clerkUser?.email_addresses?.[0]?.email_address;
    }

    for (const userId of Object.keys(userTopicsMap)) {
      const topics = userTopicsMap[userId];
      let newLegislation: { topic: string; bills: any[] }[] = [];
      for (const topic of topics) {
        // Only get bills from the last 1 day
        const bills = await searchLegislationByTopic(topic, 1);
        // Filter bills to only those with a recent action (latestActionAt within 1 day)
        const now = new Date();
        const oneDayMs = 24 * 60 * 60 * 1000;
        const recentBills = (bills || []).filter(bill => {
          if (!bill.latestActionAt) return false;
          const latest = new Date(bill.latestActionAt);
          return now.getTime() - latest.getTime() <= oneDayMs;
        });
        if (recentBills.length > 0) {
          newLegislation.push({ topic, bills: recentBills });
        }
      }
      if (newLegislation.length > 0) {
        // Fetch user email (try Clerk first, then users collection, then fallback to topic_subscriptions.email if present)
        let email = undefined;
        let source = '';
        try {
          email = await getClerkUserEmail(userId);
          if (email) source = 'Clerk';
        } catch (e) {
          // Ignore Clerk errors
        }
        if (!email) {
          // Try users collection by userId or clerkId
          const userDoc = await usersCol.findOne({ $or: [ { id: userId }, { clerkId: userId } ] });
          if (userDoc && userDoc.email) {
            email = userDoc.email;
            source = 'users collection';
          }
        }
        // Fallback: try to get email from any subscription for this user
        if (!email) {
          const subWithEmail = subsArr.find(s => s.userId === userId && s.email);
          email = subWithEmail?.email;
          if (email) source = 'topic_subscriptions';
        }
        if (email) {
          console.log(`Using email from ${source} for user ${userId}: ${email}`);
          // Build the message body for all topics
          let message = '';
          for (const entry of newLegislation) {
            message += `<h2 style="margin:2em 0 1em 0;font-family:Geist,Arial,sans-serif;font-size:1.2em;">Topic: ${entry.topic}</h2>`;
            for (const legislation of entry.bills) {
              message += `
                <div style="border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin-bottom:24px;background:#fff;box-shadow:0 2px 8px rgba(0,0,0,0.03);font-family:Geist,Arial,sans-serif;">
                  <div style="margin-bottom:12px;">
                    <a href="https://statepulse.me/legislation/${legislation.id}" style="font-size:1.1em;font-weight:600;color:#2563eb;text-decoration:none;">${legislation.identifier}: ${legislation.title}</a>
                  </div>
                  <div style="margin-bottom:8px;">
                    ${legislation.statusText ? `<span style='display:inline-block;background:#f3f4f6;color:#374151;border-radius:6px;padding:2px 8px;font-size:0.85em;margin-right:4px;'>${legislation.statusText}</span>` : ''}
                    ${(legislation.classification||[]).map((type:string) => `<span style='display:inline-block;border:1px solid #e5e7eb;border-radius:6px;padding:2px 8px;font-size:0.85em;margin-right:4px;'>${type}</span>`).join('')}
                  </div>
                  <div style="font-size:0.95em;color:#6b7280;margin-bottom:8px;">
                    ${legislation.session} - ${legislation.jurisdictionName}${legislation.chamber ? ` (${legislation.chamber})` : ''}
                  </div>
                  <div style="display:flex;flex-wrap:wrap;gap:12px 24px;margin-bottom:12px;">
                    ${legislation.firstActionAt ? `<div style='font-size:0.95em;color:#6b7280;'><b>First Action:</b> ${new Date(legislation.firstActionAt).toLocaleDateString()}</div>` : ''}
                    ${legislation.latestActionAt ? `<div style='font-size:0.95em;color:#6b7280;'><b>Latest Action:</b> ${new Date(legislation.latestActionAt).toLocaleDateString()}</div>` : ''}
                    ${(legislation.sponsors && legislation.sponsors.length > 0) ? `<div style='font-size:0.95em;color:#6b7280;'><b>Sponsors:</b> ${legislation.sponsors.length}</div>` : ''}
                    ${(legislation.abstracts && legislation.abstracts.length > 0) ? `<div style='font-size:0.95em;color:#6b7280;'><b>Abstracts:</b> ${legislation.abstracts.length}</div>` : ''}
                  </div>
                  ${legislation.geminiSummary ? `<div style='background:#f0f6ff;border:1px solid #c7d2fe;border-radius:8px;padding:12px;margin-bottom:10px;'><b style='color:#2563eb;'>AI Summary:</b><br/><span style='font-size:0.97em;color:#374151;'>${legislation.geminiSummary.length > 200 ? legislation.geminiSummary.substring(0, 200) + '...' : legislation.geminiSummary}</span></div>` : ''}
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-top:10px;">
                    <a href="https://statepulse.me/legislation/${legislation.id}" style="border:1px solid #e5e7eb;border-radius:6px;padding:6px 14px;font-size:0.95em;color:#2563eb;text-decoration:none;background:#f9fafb;">View Details</a>
                  </div>
                </div>
              `;
            }
          }
          const html = renderBrandedEmail({
            heading: 'New Legislation Updates for Your Tracked Topics',
            message,
            ctaUrl: 'https://statepulse.me/tracker',
            ctaText: 'View All Updates',
          });
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
