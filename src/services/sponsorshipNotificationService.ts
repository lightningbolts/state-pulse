import { getCollection } from '@/lib/mongodb';
import { sendEmail } from '@/lib/email';
import { ObjectId } from 'mongodb';

export interface SponsorshipNotification {
  _id?: ObjectId;
  userId: string;
  userEmail: string;
  representativeId: string;
  representativeName: string;
  legislationId: string;
  legislationTitle: string;
  legislationIdentifier?: string;
  jurisdictionName?: string;
  sentAt: Date;
  createdAt: Date;
}

/**
 * Check for new sponsorships and send email notifications
 * NOTE: This function is now integrated into the main policy tracking email system.
 * Use sendPolicyUpdateEmails.ts instead for combined notifications.
 * This function is kept for backwards compatibility but should not be used directly.
 *
 * @deprecated Use the integrated policy tracking email system instead
 */
export async function checkAndSendSponsorshipNotifications(): Promise<void> {
  console.log('This function is deprecated. Sponsorship notifications are now integrated into the policy tracking email system.');
  console.log('Please use the sendPolicyUpdateEmails script instead for combined notifications.');

  // For backwards compatibility, we can still track new sponsorships without sending emails
  try {
    console.log('Checking for new sponsorships (tracking only, no emails sent)...');

    const legislationCollection = await getCollection('legislation');
    const followsCollection = await getCollection('user_follows');
    const representativesCollection = await getCollection('representatives');
    const notificationsCollection = await getCollection('sponsorship_notifications');

    // Get legislation created in the last 24 hours with sponsors
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentLegislation = await legislationCollection.find({
      createdAt: { $gte: oneDayAgo },
      sponsors: { $exists: true, $ne: [], $not: { $size: 0 } }
    }).toArray();

    console.log(`Found ${recentLegislation.length} recent legislation with sponsors (for tracking purposes only)`);

    // Just log what would be processed, but don't send emails
    let potentialNotifications = 0;

    for (const legislation of recentLegislation) {
      if (!legislation.sponsors || legislation.sponsors.length === 0) continue;

      for (const sponsor of legislation.sponsors) {
        if (!sponsor.id) continue;

        // Find users following this representative
        const follows = await followsCollection.find({
          repId: sponsor.id
        }).toArray();

        if (follows.length === 0) continue;

        for (const follow of follows) {
          // Check if we've already tracked this notification
          const existingNotification = await notificationsCollection.findOne({
            userId: follow.userId,
            representativeId: sponsor.id,
            legislationId: legislation.id
          });

          if (!existingNotification) {
            potentialNotifications++;
          }
        }
      }
    }

    console.log(`Would have generated ${potentialNotifications} notifications (handled by integrated system instead)`);
    console.log('Sponsorship tracking completed (no emails sent - handled by integrated system)');
  } catch (error) {
    console.error('Error in deprecated checkAndSendSponsorshipNotifications:', error);
    throw error;
  }
}

/**
 * Send sponsorship notification email
 */
async function sendSponsorshipNotificationEmail({
  userEmail,
  userName,
  representativeName,
  representativeTitle,
  representativeState,
  legislationTitle,
  legislationIdentifier,
  legislationSummary,
  jurisdictionName,
  legislationUrl
}: {
  userEmail: string;
  userName: string;
  representativeName: string;
  representativeTitle?: string;
  representativeState?: string;
  legislationTitle: string;
  legislationIdentifier?: string;
  legislationSummary?: string;
  jurisdictionName?: string;
  legislationUrl: string;
}): Promise<void> {
  const subject = `New Legislation: ${representativeName} sponsors ${legislationIdentifier || 'new bill'}`;

  const repTitle = representativeTitle ? ` (${representativeTitle})` : '';
  const repState = representativeState ? ` from ${representativeState}` : '';
  const identifier = legislationIdentifier ? ` (${legislationIdentifier})` : '';
  const jurisdiction = jurisdictionName ? ` in ${jurisdictionName}` : '';
  const summary = legislationSummary ? `\n\nSummary: ${legislationSummary}` : '';

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>New Legislation Sponsored</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="margin: 0; font-size: 24px;">📋 New Legislation Alert</h1>
            <p style="margin: 5px 0 0 0; opacity: 0.9;">StatePulse Notification</p>
        </div>
        
        <div style="background: #f8f9fa; padding: 20px; border-radius: 0 0 8px 8px; border: 1px solid #e9ecef;">
            <p>Hi ${userName},</p>
            
            <p><strong>${representativeName}${repTitle}${repState}</strong>, whom you follow on StatePulse, has sponsored new legislation${jurisdiction}:</p>
            
            <div style="background: white; padding: 16px; border-radius: 6px; border-left: 4px solid #667eea; margin: 16px 0;">
                <h3 style="margin: 0 0 8px 0; color: #2d3748;">${legislationTitle}${identifier}</h3>
                ${summary ? `<p style="margin: 8px 0 0 0; color: #4a5568; font-size: 14px;">${legislationSummary}</p>` : ''}
            </div>
            
            <div style="text-align: center; margin: 24px 0;">
                <a href="${legislationUrl}" style="background: #667eea; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; display: inline-block;">View Legislation Details</a>
            </div>
            
            <hr style="border: none; border-top: 1px solid #e9ecef; margin: 24px 0;">
            
            <p style="font-size: 12px; color: #6c757d;">
                You received this notification because you follow ${representativeName} on StatePulse. 
                <br>
                <a href="${process.env.NEXT_PUBLIC_BASE_URL || 'https://statepulse.me'}/settings" style="color: #667eea;">Manage your notification preferences</a>
            </p>
            
            <div style="text-align: center; margin-top: 20px;">
                <p style="font-size: 12px; color: #6c757d; margin: 0;">
                    © ${new Date().getFullYear()} StatePulse - Stay informed about civic engagement
                </p>
            </div>
        </div>
    </body>
    </html>
  `;

  const text = `
Hi ${userName},

${representativeName}${repTitle}${repState}, whom you follow on StatePulse, has sponsored new legislation${jurisdiction}:

${legislationTitle}${identifier}${summary}

View details: ${legislationUrl}

You received this notification because you follow ${representativeName} on StatePulse.
Manage your notification preferences: ${process.env.NEXT_PUBLIC_BASE_URL || 'https://statepulse.me'}/settings

© ${new Date().getFullYear()} StatePulse
  `;

  await sendEmail({
    to: userEmail,
    subject,
    html,
    text
  });
}

/**
 * Get sponsorship notification history for a user
 */
export async function getUserSponsorshipNotifications(userId: string, limit: number = 50): Promise<SponsorshipNotification[]> {
  const notificationsCollection = await getCollection('sponsorship_notifications');

  const notifications = await notificationsCollection
    .find({ userId })
    .sort({ sentAt: -1 })
    .limit(limit)
    .toArray();

  return notifications as SponsorshipNotification[];
}

/**
 * Mark notifications as read (for future enhancement)
 */
export async function markNotificationsAsRead(userId: string, notificationIds: string[]): Promise<void> {
  const notificationsCollection = await getCollection('sponsorship_notifications');

  await notificationsCollection.updateMany(
    {
      userId,
      _id: { $in: notificationIds.map(id => new ObjectId(id)) }
    },
    {
      $set: { readAt: new Date() }
    }
  );
}
