/**
 * Send a maintenance / downtime announcement to everyone on the StatePulse email list
 * via the configured SMTP (Brevo / StatePulse Gmail).
 *
 * Usage:
 *   npx tsx src/scripts/sendMaintenanceAnnouncement.ts --dry-run
 *   npx tsx src/scripts/sendMaintenanceAnnouncement.ts --confirm
 *   npx tsx src/scripts/sendMaintenanceAnnouncement.ts --confirm --return-window "1–2 weeks"
 */

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import path from 'path';
import { sendMaintenanceBroadcast } from '@/lib/broadcastEmail';
import {
  DEFAULT_MAINTENANCE_HEADING,
  DEFAULT_MAINTENANCE_SUBJECT,
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

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run') || args.includes('-n');
  const confirm = args.includes('--confirm') || args.includes('-y');
  const returnWindow =
    getArgValue('--return-window') || getArgValue('-w') || 'a week or two';
  const subject = getArgValue('--subject') || DEFAULT_MAINTENANCE_SUBJECT;
  const heading = getArgValue('--heading') || DEFAULT_MAINTENANCE_HEADING;
  const extraNote = getArgValue('--note');

  if (!dryRun && !confirm) {
    console.error(
      'Refusing to send without --dry-run or --confirm.\n' +
        '  Preview recipients:  npx tsx src/scripts/sendMaintenanceAnnouncement.ts --dry-run\n' +
        '  Send for real:       npx tsx src/scripts/sendMaintenanceAnnouncement.ts --confirm',
    );
    process.exit(1);
  }

  console.log(`MongoDB: ${MONGO_URI}`);
  console.log(`Mode: ${dryRun ? 'DRY RUN (no emails sent)' : 'SENDING'}`);
  console.log(`Subject: ${subject}`);
  console.log(`Return window: ${returnWindow}`);
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
