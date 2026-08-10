import { sendEmail } from '@/lib/email';
import { collectEmailList, type EmailListEntry } from '@/lib/emailList';
import {
  DEFAULT_MAINTENANCE_HEADING,
  DEFAULT_MAINTENANCE_SUBJECT,
  renderMaintenanceAnnouncementEmail,
} from '@/lib/maintenanceEmail';
import type { Db } from 'mongodb';

export type BroadcastResult = {
  totalRecipients: number;
  sent: number;
  failed: number;
  dryRun: boolean;
  recipients: EmailListEntry[];
  errors: Array<{ email: string; error: string }>;
};

export async function sendBroadcastEmail({
  db,
  subject,
  html,
  text,
  dryRun = false,
  replyTo,
  delayMs = 150,
}: {
  db: Db;
  subject: string;
  html: string;
  text?: string;
  dryRun?: boolean;
  replyTo?: string;
  /** Small delay between sends to be kind to SMTP rate limits */
  delayMs?: number;
}): Promise<BroadcastResult> {
  const recipients = await collectEmailList(db);
  const errors: Array<{ email: string; error: string }> = [];
  let sent = 0;

  if (dryRun) {
    return {
      totalRecipients: recipients.length,
      sent: 0,
      failed: 0,
      dryRun: true,
      recipients,
      errors,
    };
  }

  for (const recipient of recipients) {
    try {
      await sendEmail({
        to: recipient.email,
        subject,
        html,
        text,
        replyTo,
      });
      sent += 1;
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    } catch (err) {
      errors.push({
        email: recipient.email,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    totalRecipients: recipients.length,
    sent,
    failed: errors.length,
    dryRun: false,
    recipients,
    errors,
  };
}

export async function sendMaintenanceBroadcast({
  db,
  dryRun = false,
  subject = DEFAULT_MAINTENANCE_SUBJECT,
  heading = DEFAULT_MAINTENANCE_HEADING,
  returnWindow = 'a week or two',
  extraNote,
  messageHtml,
  replyTo = process.env.BROADCAST_REPLY_TO || 'timberlake2025@gmail.com',
}: {
  db: Db;
  dryRun?: boolean;
  subject?: string;
  heading?: string;
  returnWindow?: string;
  extraNote?: string;
  messageHtml?: string;
  replyTo?: string;
}): Promise<BroadcastResult> {
  const html = renderMaintenanceAnnouncementEmail({
    heading,
    returnWindow,
    extraNote,
    messageHtml,
  });

  const text = [
    'StatePulse is temporarily unavailable.',
    `The site is down for maintenance and will be back in ${returnWindow}.`,
    'Daily and weekly legislative email digests are paused during the outage.',
    'Your tracked topics, follows, and preferences are safe.',
    `Questions? Email ${process.env.SMTP_FROM || 'contact@statepulse.me'}.`,
  ].join('\n\n');

  return sendBroadcastEmail({
    db,
    subject,
    html,
    text,
    dryRun,
    replyTo,
  });
}
