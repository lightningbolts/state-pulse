/**
 * Send a maintenance / downtime or "we're back" announcement to everyone on
 * the StatePulse email list via the configured SMTP (Brevo / StatePulse Gmail).
 *
 * Usage:
 *   npx tsx src/scripts/sendMaintenanceAnnouncement.ts --dry-run
 *   npx tsx src/scripts/sendMaintenanceAnnouncement.ts --confirm
 *   npx tsx src/scripts/sendMaintenanceAnnouncement.ts --confirm --return-window "1–2 weeks"
 *   npx tsx src/scripts/sendMaintenanceAnnouncement.ts --dry-run --template restored
 *   npx tsx src/scripts/sendMaintenanceAnnouncement.ts --confirm --template restored
 */

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { sendMaintenanceBroadcast } from '@/lib/broadcastEmail';
import {
  type BroadcastTemplate,
  getBroadcastDefaults,
} from '@/lib/maintenanceEmail';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const MONGO_URI =
  process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB_NAME || 'statepulse-data';

function getArgValue(flag: string): string | undefined {
  const args = process.argv.slice(2);
  const idx = args.findIndex((a) => a === flag || a.startsWith(`${flag}=`));
  if (idx === -1) return undefined;
  const arg = args[idx];
  if (arg.includes('=')) return arg.split('=').slice(1).join('=');
  return args[idx + 1];
}

function parseTemplate(raw: string | undefined): BroadcastTemplate {
  return raw === 'restored' ? 'restored' : 'downtime';
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-n');
  const confirm = args.includes('--confirm') || args.includes('-y');
  const template = parseTemplate(getArgValue('--template') || getArgValue('-t'));
  const defaults = getBroadcastDefaults(template);
  const returnWindow =
    getArgValue('--return-window') || getArgValue('-w') || defaults.returnWindow || 'a week or two';
  const subject = getArgValue('--subject') || defaults.subject;
  const heading = getArgValue('--heading') || defaults.heading;
  const extraNote = getArgValue('--note');

  if (!dryRun && !confirm) {
    console.error(
      'Refusing to send without --dry-run or --confirm.\n' +
        '  Preview recipients:  npx tsx src/scripts/sendMaintenanceAnnouncement.ts --dry-run\n' +
        '  Send downtime:       npx tsx src/scripts/sendMaintenanceAnnouncement.ts --confirm\n' +
        '  Send back-online:    npx tsx src/scripts/sendMaintenanceAnnouncement.ts --confirm --template restored',
    );
    process.exit(1);
  }

  console.log(`MongoDB: ${MONGO_URI}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no emails sent)' : 'SENDING'}`);
  console.log(`Template: ${template}`);
  console.log(`Subject: ${subject}`);
  if (template === 'downtime') {
    console.log(`Return window: ${returnWindow}`);
  }
  console.log(`SMTP_FROM: ${process.env.SMTP_FROM || '(not set)'}`);
  console.log(
    `Reply-To: ${process.env.BROADCAST_REPLY_TO || 'timberlake2025@gmail.com'}`,
  );

  const client = new MongoClient(MONGO_URI);
  try {
    await client.connect();
    const db = client.db(DB_NAME);

    const result = await sendMaintenanceBroadcast({
      db,
      dryRun,
      template,
      subject,
      heading,
      returnWindow,
      extraNote,
    });

    console.log(`\nRecipients found: ${result.totalRecipients}`);
    if (dryRun) {
      console.log('\nWould send to:');
      for (const r of result.recipients) {
        console.log(`  - ${r.email} (${r.sources.join(', ')})`);
      }
      console.log(
        '\nDry run complete. Re-run with --confirm to send via Brevo SMTP.',
      );
      return;
    }

    console.log(`Sent: ${result.sent}`);
    console.log(`Failed: ${result.failed}`);
    if (result.errors.length > 0) {
      console.log('\nFailures:');
      for (const err of result.errors) {
        console.log(`  - ${err.email}: ${err.error}`);
      }
    }
  } finally {
    await client.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
