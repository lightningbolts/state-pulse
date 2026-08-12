import { sendEmail } from '@/lib/email';
import { collectEmailList, type EmailListEntry } from '@/lib/emailList';
import {
  type BroadcastTemplate,
  getBroadcastDefaults,
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

function buildPlainText({
  template,
  returnWindow,
}: {
  template: BroadcastTemplate;
  returnWindow: string;
}): string {
  if (template === 'restored') {
    return [
      "StatePulse is back online.",
      'Maintenance is complete and the site is available again.',
      'Daily and weekly legislative email digests will resume on their normal schedule.',
      'Your tracked topics, follows, and preferences are intact.',
      `Questions? Email ${process.env.SMTP_FROM || 'contact@statepulse.me'}.`,
    ].join('\n\n');
  }

  return [
    'StatePulse is temporarily unavailable.',
    `The site is down for maintenance and will be back in ${returnWindow}.`,
    'Daily and weekly legislative email digests are paused during the outage.',
    'Your tracked topics, follows, and preferences are safe.',
    `Questions? Email ${process.env.SMTP_FROM || 'contact@statepulse.me'}.`,
  ].join('\n\n');
}

export async function sendMaintenanceBroadcast({
  db,
  dryRun = false,
  template = 'downtime',
  subject,
  heading,
  returnWindow = 'a week or two',
  extraNote,
  messageHtml,
  replyTo = process.env.BROADCAST_REPLY_TO || 'timberlake2025@gmail.com',
}: {
  db: Db;
  dryRun?: boolean;
  template?: BroadcastTemplate;
  subject?: string;
  heading?: string;
  returnWindow?: string;
  extraNote?: string;
  messageHtml?: string;
  replyTo?: string;
}): Promise<BroadcastResult> {
  const defaults = getBroadcastDefaults(template);
  const resolvedSubject = subject || defaults.subject;
  const resolvedHeading = heading || defaults.heading;

  const html = renderMaintenanceAnnouncementEmail({
    template,
    heading: resolvedHeading,
    returnWindow,
    extraNote,
    messageHtml,
  });

  const text = buildPlainText({ template, returnWindow });

  return sendBroadcastEmail({
    db,
    subject: resolvedSubject,
    html,
    text,
    dryRun,
    replyTo,
  });
}
