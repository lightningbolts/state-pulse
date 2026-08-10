import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import { sendEmail } from '@/lib/email';
import { renderBrandedEmail } from '@/lib/emailTemplate';
import {
  emailMutedNote,
  emailSectionHeading,
  emailSponsorshipBillCard,
  emailSubheading,
  emailSummaryBox,
  emailTopicBillCard,
} from '@/lib/emailBrand';
import { getAllLegislationWithFiltering } from '@/services/legislationService';

import fetch from 'node-fetch';

type ClerkUser = {
  email_addresses?: { email_address: string }[];
};

// Helper function to parse location information from topic strings
function parseTopicForLocation(topic: string) {
  const topicLower = topic.toLowerCase();
  
  // State names mapping (longer names first to prevent partial matches)
  const stateNames = [
    'new hampshire', 'new jersey', 'new mexico', 'new york', 'north carolina', 'north dakota',
    'rhode island', 'south carolina', 'south dakota', 'west virginia', 'massachusetts',
    'pennsylvania', 'connecticut', 'washington', 'wisconsin', 'minnesota', 'mississippi',
    'louisiana', 'california', 'colorado', 'delaware', 'illinois', 'indiana', 'kentucky',
    'maryland', 'michigan', 'missouri', 'montana', 'nebraska', 'oklahoma', 'tennessee',
    'virginia', 'wyoming', 'alabama', 'alaska', 'arizona', 'arkansas', 'florida', 'georgia',
    'hawaii', 'idaho', 'kansas', 'maine', 'nevada', 'oregon', 'vermont', 'iowa', 'ohio',
    'texas', 'utah'
  ];

  // Federal keywords
  const federalKeywords = [
    'congress', 'united states congress', 'us congress', 'federal', 'national', 
    'house of representatives', 'senate', 'capitol hill', 'washington dc', 'dc congress'
  ];

  // Check for federal terms first
  const detectedFederal = federalKeywords.some(fed => topicLower.includes(fed));
  if (detectedFederal) {
    // Remove federal terms and return cleaned search with congress flag
    let cleanedSearch = topic;
    federalKeywords.forEach(fed => {
      const regex = new RegExp(`\\b${fed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      cleanedSearch = cleanedSearch.replace(regex, '').replace(/\s+/g, ' ').trim();
    });
    // Remove common prepositions and connecting words
    cleanedSearch = cleanedSearch.replace(/\b(in|for|about|on|at|from|to|with|by)\s*/gi, '').trim();
    
    return {
      search: cleanedSearch,
      showCongress: true,
      jurisdictionName: undefined
    };
  }

  // Check for state names
  for (const state of stateNames) {
    if (topicLower.includes(state)) {
      // Extract the state name and clean the search term
      let cleanedSearch = topic;
      const regex = new RegExp(`\\b${state.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'gi');
      cleanedSearch = cleanedSearch.replace(regex, '').replace(/\s+/g, ' ').trim();
    // Remove common prepositions and connecting words
    cleanedSearch = cleanedSearch.replace(/\b(in|for|about|on|at|from|to|with|by)\s*/gi, '').trim();      // Capitalize state name properly
      const properStateName = state.split(' ').map(word => 
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');

      return {
        search: cleanedSearch,
        showCongress: false,
        jurisdictionName: properStateName
      };
    }
  }

  // If no location detected, return original search
  return {
    search: topic,
    showCongress: false,
    jurisdictionName: undefined
  };
}

// Helper function to search legislation by topic using the new unified function
async function searchLegislationByTopicReplacement(topic: string, daysBack: number = 7) {
  try {
    // Calculate cutoff date for filtering recent legislation
    const cutoffDate = new Date(Date.now() - (daysBack * 24 * 60 * 60 * 1000));
    
    // Parse the topic to extract location information
    const { search, showCongress, jurisdictionName } = parseTopicForLocation(topic);
    
    return await getAllLegislationWithFiltering({
      search: search || undefined,
      limit: 100,
      sortBy: 'updatedAt',
      sortDir: 'desc',
      showCongress,
      jurisdictionName,
      latestActionAt_gte: cutoffDate.toISOString(),
      context: 'email-script'
    });
  } catch (error) {
    console.error('Error searching legislation by topic:', error);
    return [];
  }
}

dotenv.config({ path: require('path').resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB_NAME || 'statepulse-data';

// Check command line arguments for mode
const args = process.argv.slice(2);
const isWeeklyMode = args.includes('--weekly') || args.includes('-w');

async function main() {
  console.log(`Using MongoDB URI: ${MONGO_URI}`);
  console.log(`Running in ${isWeeklyMode ? 'WEEKLY DIGEST' : 'DAILY NOTIFICATION'} mode`);

  let client: MongoClient | null = null;
  try {
    client = new MongoClient(MONGO_URI);
    await client.connect();
    console.log('Connected to MongoDB.');
    const db = client.db(DB_NAME);
    const subsCol = db.collection('topic_subscriptions');
    const usersCol = db.collection('users');
    const followsCollection = db.collection('user_follows');
    const representativesCollection = db.collection('representatives');
    const legislationCollection = db.collection('legislation');
    const notificationsCollection = db.collection('sponsorship_notifications');
    const preferencesCollection = db.collection('user_notification_preferences');

    // Get users based on mode (daily vs weekly)
    const userTopicsMap: Record<string, string[]> = {};
    const userPreferencesMap: Record<string, any> = {};

    if (isWeeklyMode) {
      // Weekly mode: get users with weekly digest enabled
      console.log('Collecting users with weekly digest enabled...');
      const weeklyPrefs = await preferencesCollection.find({
        'emailNotifications.weeklyDigest': true
      }).toArray();

      // Get all subscriptions for these users
      const weeklyUserIds = weeklyPrefs.map(p => p.userId);
      const subsForWeeklyUsers = await subsCol.find({ userId: { $in: weeklyUserIds } }).toArray();

      // Store preferences and build topics map
      for (const pref of weeklyPrefs) {
        userPreferencesMap[pref.userId] = pref;
      }

      for (const sub of subsForWeeklyUsers) {
        if (!sub.userId || !sub.topic) continue;
        if (!userTopicsMap[sub.userId]) userTopicsMap[sub.userId] = [];
        userTopicsMap[sub.userId].push(sub.topic);
      }

      console.log(`Found ${weeklyUserIds.length} users with weekly digest enabled, tracking ${subsForWeeklyUsers.length} total topics`);
    } else {
      // Daily mode: get users with daily notifications enabled
      console.log('Collecting users with daily notifications enabled...');
      const dailySubsCursor = subsCol.find({ notifyByEmail: true });
      const subsArr = await dailySubsCursor.toArray();

      for (const sub of subsArr) {
        if (!sub.userId || !sub.topic) continue;
        if (!userTopicsMap[sub.userId]) userTopicsMap[sub.userId] = [];
        if (sub.notifyByEmail) {
          userTopicsMap[sub.userId].push(sub.topic);
        }
      }

      console.log(`Found ${Object.keys(userTopicsMap).length} users with daily notifications enabled`);
    }

    // Set time range based on mode
    const timeRange = isWeeklyMode ? 7 : 1; // 7 days for weekly, 1 day for daily
    const timeRangeMs = timeRange * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(Date.now() - timeRangeMs);

    console.log(`Looking for legislation since: ${cutoffDate.toISOString()}`);

    // Get recent legislation with sponsors for sponsorship notifications
    // Add debugging and optimize the query
    console.log('Querying for recent legislation with sponsors...');
    const query: any = {
      updatedAt: { $gte: cutoffDate },
      sponsors: { $exists: true, $ne: [], $not: { $size: 0 } }
    };

    // First, check if updatedAt field exists on documents
    console.log('Checking if updatedAt field exists...');
    const countWithUpdatedAt = await legislationCollection.countDocuments({ updatedAt: { $exists: true } });
    console.log(`Documents with updatedAt field: ${countWithUpdatedAt}`);

    // If no documents have updatedAt, fall back to createdAt
    let actualQuery: any = query;
    if (countWithUpdatedAt === 0) {
      console.log('No documents with updatedAt found, falling back to createdAt');
      actualQuery = {
        createdAt: { $gte: cutoffDate },
        sponsors: { $exists: true, $ne: [], $not: { $size: 0 } }
      };
    }

    const recentLegislation = await legislationCollection.find(actualQuery).toArray();
    console.log(`Found ${recentLegislation.length} recent legislation documents with sponsors`);

    // Get sponsorship alerts for users
    const userSponsorshipMap: Record<string, Array<{
      representative: any;
      legislation: any[];
    }>> = {};

    for (const legislation of recentLegislation) {
      if (!legislation.sponsors || legislation.sponsors.length === 0) continue;

      for (const sponsor of legislation.sponsors) {
        if (!sponsor.id) continue;

        // Find users following this representative
        const follows = await followsCollection.find({ repId: sponsor.id }).toArray();
        if (follows.length === 0) continue;

        // Get representative details
        const representative = await representativesCollection.findOne({ id: sponsor.id });
        if (!representative) continue;

        for (const follow of follows) {
          // For daily mode: check if notification was already sent
          // For weekly mode: include all activity from the week
          if (!isWeeklyMode) {
            const existingNotification = await notificationsCollection.findOne({
              userId: follow.userId,
              representativeId: sponsor.id,
              legislationId: legislation.id
            });
            if (existingNotification) continue;
          }

          // Check user notification preferences
          let preferences = userPreferencesMap[follow.userId];
          if (!preferences) {
            preferences = await preferencesCollection.findOne({ userId: follow.userId });
          }

          // For daily mode: check sponsorshipAlerts preference (default enabled)
          // For weekly mode: check weeklyDigest preference (must be explicitly enabled)
          if (isWeeklyMode) {
            if (!preferences || !preferences.emailNotifications?.weeklyDigest) continue;
          } else {
            if (preferences && preferences.emailNotifications?.sponsorshipAlerts === false) continue;
          }

          // Add to user's sponsorship notifications
          if (!userSponsorshipMap[follow.userId]) {
            userSponsorshipMap[follow.userId] = [];
          }

          let repEntry = userSponsorshipMap[follow.userId].find(
            entry => entry.representative.id === representative.id
          );
          if (!repEntry) {
            repEntry = { representative, legislation: [] };
            userSponsorshipMap[follow.userId].push(repEntry);
          }
          repEntry.legislation.push(legislation);
        }
      }
    }

    // Combine all users who need notifications
    const allNotificationUsers = new Set([
      ...Object.keys(userTopicsMap),
      ...Object.keys(userSponsorshipMap)
    ]);

    console.log(`Processing notifications for ${allNotificationUsers.size} users`);

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

    for (const userId of allNotificationUsers) {
      let hasContent = false;
      let message = '';
      let topicCount = 0;
      let repCount = 0;

      // Add topic tracking content
      const topics = userTopicsMap[userId] || [];
      let newLegislation: { topic: string; bills: any[] }[] = [];

      for (const topic of topics) {
        const bills = await searchLegislationByTopicReplacement(topic, timeRange);
        const recentBills = (bills || []).filter((bill: any) => {
          const latestAction = bill.latestActionAt && (Date.now() - new Date(bill.latestActionAt).getTime() <= timeRangeMs);
          const latestUpdate = bill.updatedAt && (Date.now() - new Date(bill.updatedAt).getTime() <= timeRangeMs);
          return latestAction || latestUpdate;
        });
        if (recentBills.length > 0) {
          newLegislation.push({ topic, bills: recentBills });
          topicCount += recentBills.length;
        }
      }

      if (newLegislation.length > 0) {
        hasContent = true;
        const sectionTitle = isWeeklyMode
          ? `Your Tracked Topics — This Week (${topicCount} updates)`
          : `Your Tracked Topics`;

        message += emailSectionHeading(sectionTitle);

        for (const entry of newLegislation) {
          message += emailSubheading(
            `Topic: ${entry.topic} (${entry.bills.length} ${entry.bills.length === 1 ? 'update' : 'updates'})`,
          );

          // For weekly digest, limit to 3 most recent per topic to keep email manageable
          const billsToShow = isWeeklyMode ? entry.bills.slice(0, 3) : entry.bills;

          for (const legislation of billsToShow) {
            message += emailTopicBillCard(legislation);
          }

          // Show "and X more" if we truncated for weekly digest
          if (isWeeklyMode && entry.bills.length > 3) {
            message += emailMutedNote(
              `...and ${entry.bills.length - 3} more ${entry.bills.length - 3 === 1 ? 'update' : 'updates'} for this topic`,
            );
          }
        }
      }

      // Add sponsorship alerts content
      const sponsorshipAlerts = userSponsorshipMap[userId] || [];
      if (sponsorshipAlerts.length > 0) {
        hasContent = true;
        repCount = sponsorshipAlerts.reduce((sum, alert) => sum + alert.legislation.length, 0);

        const sectionTitle = isWeeklyMode
          ? `New Legislation from Your Followed Representatives — This Week (${repCount} updates)`
          : `New Legislation from Your Followed Representatives`;

        message += emailSectionHeading(sectionTitle);

        for (const alert of sponsorshipAlerts) {
          const rep = alert.representative;
          const repTitle = rep.current_role?.title || 'Representative';
          const repState = rep.current_role?.jurisdiction_name || '';

          message += emailSubheading(
            `${rep.name} (${repTitle}${repState ? ` — ${repState}` : ''}) — ${alert.legislation.length} ${alert.legislation.length === 1 ? 'update' : 'updates'}`,
          );

          // For weekly digest, limit to 2 most recent per representative
          const legislationToShow = isWeeklyMode ? alert.legislation.slice(0, 2) : alert.legislation;

          for (const legislation of legislationToShow) {
            message += emailSponsorshipBillCard(legislation);

            // Record the sponsorship notification as sent (only for daily mode)
            if (!isWeeklyMode) {
              await notificationsCollection.insertOne({
                userId: userId,
                userEmail: '', // Will be filled after we get the email
                representativeId: rep.id,
                representativeName: rep.name,
                legislationId: legislation.id,
                legislationTitle: legislation.title,
                legislationIdentifier: legislation.identifier,
                jurisdictionName: legislation.jurisdictionName,
                sentAt: new Date(),
                createdAt: new Date()
              });
            }
          }

          // Show "and X more" if we truncated for weekly digest
          if (isWeeklyMode && alert.legislation.length > 2) {
            message += emailMutedNote(
              `...and ${alert.legislation.length - 2} more ${alert.legislation.length - 2 === 1 ? 'update' : 'updates'} from ${rep.name}`,
            );
          }
        }
      }

      // Send email if there's content
      if (hasContent) {
        // Get user email
        let email = undefined;
        let source = '';
        try {
          email = await getClerkUserEmail(userId);
          if (email) source = 'Clerk';
        } catch (e) {
          // Ignore Clerk errors
        }
        if (!email) {
          const userDoc = await usersCol.findOne({ $or: [ { id: userId }, { clerkId: userId } ] });
          if (userDoc && userDoc.emailAddress) {
            email = userDoc.emailAddress;
            source = 'users collection';
          } else if (userDoc && userDoc.email) {
            email = userDoc.email;
            source = 'users collection';
          }
        }
        if (!email) {
          // Try to find email from topic subscriptions
          const subWithEmail = await subsCol.findOne({ userId: userId, email: { $exists: true, $ne: null } });
          email = subWithEmail?.email;
          if (email) source = 'topic_subscriptions';
        }

        if (email) {
          console.log(`Using email from ${source} for user ${userId}: ${email}`);

          // Update sponsorship notifications with email (only for daily mode)
          if (!isWeeklyMode) {
            await notificationsCollection.updateMany(
              { userId: userId, userEmail: '' },
              { $set: { userEmail: email } }
            );
          }

          const hasTopics = newLegislation.length > 0;
          const hasSponsorships = sponsorshipAlerts.length > 0;

          // Create appropriate heading based on mode and content
          let heading = '';
          let subject = '';

          if (isWeeklyMode) {
            const totalUpdates = topicCount + repCount;
            if (hasTopics && hasSponsorships) {
              heading = `Your Weekly StatePulse Digest`;
              subject = `Weekly Digest: ${totalUpdates} Legislative Updates`;
            } else if (hasTopics) {
              heading = `Your Weekly Policy Tracking Digest`;
              subject = `Weekly Digest: ${topicCount} Topic Updates`;
            } else if (hasSponsorships) {
              heading = `Your Weekly Representative Activity Digest`;
              subject = `Weekly Digest: ${repCount} Representative Updates`;
            }

            // Add weekly summary intro
            const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
            const weekEnd = new Date();
            message =
              emailSummaryBox(
                'Weekly Summary',
                `${weekStart.toLocaleDateString()} – ${weekEnd.toLocaleDateString()}<br/><strong>${totalUpdates}</strong> total updates from your tracked topics and followed representatives`,
              ) + message;
          } else {
            if (hasTopics && hasSponsorships) {
              heading = 'New Legislation Updates & Representative Activity';
              subject = 'Daily Updates: New Legislation & Representative Activity';
            } else if (hasTopics) {
              heading = 'New Legislation Updates for Your Tracked Topics';
              subject = 'Daily Updates: New Legislation for Your Topics';
            } else if (hasSponsorships) {
              heading = 'New Legislation from Your Followed Representatives';
              subject = 'Daily Updates: Representative Activity';
            }
          }

          const html = renderBrandedEmail({
            heading,
            message,
            ctaUrl: 'https://statepulse.me/tracker',
            ctaText: isWeeklyMode ? 'Manage Your Tracking' : 'View Your Tracker',
            preheader: isWeeklyMode
              ? `Your weekly StatePulse digest: ${topicCount + repCount} updates`
              : `New StatePulse updates for your tracked legislation`,
          });

          try {
            await sendEmail({
              to: email,
              subject,
              html,
              text: `You have new legislation updates on StatePulse. ${isWeeklyMode ? 'This is your weekly digest.' : ''} Visit https://statepulse.me/tracker to manage preferences.`,
            });

            const modeText = isWeeklyMode ? 'weekly digest' : 'daily notification';
            console.log(`Sent ${modeText} to ${email} (topics: ${topicCount}, reps: ${repCount})`);
          } catch (e) {
            console.error('Failed to send update email:', e);
          }
        } else {
          console.warn('No email found for user', userId);
        }
      }
    }

    console.log(`Completed ${isWeeklyMode ? 'weekly digest' : 'daily notifications'} processing`);
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

if (require.main === module) {
  main().then(() => {
    const modeText = isWeeklyMode ? 'weekly digest' : 'daily notifications';
    console.log(`${modeText.charAt(0).toUpperCase() + modeText.slice(1)} script completed successfully`);
    process.exit(0);
  });
}
