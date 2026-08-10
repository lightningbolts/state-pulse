import { NextRequest, NextResponse } from 'next/server';
import { getAuth, clerkClient } from '@clerk/nextjs/server';
import { connectToDatabase } from '@/lib/mongodb';
import { collectEmailList, isBroadcastAdmin } from '@/lib/emailList';
import { sendMaintenanceBroadcast } from '@/lib/broadcastEmail';
import {
  DEFAULT_MAINTENANCE_HEADING,
  DEFAULT_MAINTENANCE_SUBJECT,
  renderMaintenanceAnnouncementEmail,
} from '@/lib/maintenanceEmail';

async function requireBroadcastAdmin(request: NextRequest) {
  const auth = getAuth(request);
  if (!auth.userId) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const client = await clerkClient();
  const user = await client.users.getUser(auth.userId);
  const email =
    user.emailAddresses.find((e) => e.id === user.primaryEmailAddressId)
      ?.emailAddress || user.emailAddresses[0]?.emailAddress;

  if (!isBroadcastAdmin(email)) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { userId: auth.userId, email: email! };
}

/** GET: list recipient count + preview HTML for the maintenance template */
export async function GET(request: NextRequest) {
  const gate = await requireBroadcastAdmin(request);
  if ('error' in gate) return gate.error;

  try {
    const { db } = await connectToDatabase();
    const recipients = await collectEmailList(db);
    const previewHtml = renderMaintenanceAnnouncementEmail();

    return NextResponse.json({
      adminEmail: gate.email,
      recipientCount: recipients.length,
      recipients: recipients.map((r) => ({
        email: r.email,
        sources: r.sources,
      })),
      defaults: {
        subject: DEFAULT_MAINTENANCE_SUBJECT,
        heading: DEFAULT_MAINTENANCE_HEADING,
        returnWindow: 'a week or two',
      },
      previewHtml,
      smtpFrom: process.env.SMTP_FROM || null,
    });
  } catch (error) {
    console.error('Failed to load broadcast preview:', error);
    return NextResponse.json(
      { error: 'Failed to load broadcast data' },
      { status: 500 },
    );
  }
}

/** POST: dry-run or send maintenance broadcast */
export async function POST(request: NextRequest) {
  const gate = await requireBroadcastAdmin(request);
  if ('error' in gate) return gate.error;

  try {
    const body = await request.json();
    const dryRun = Boolean(body.dryRun);
    const confirm = Boolean(body.confirm);

    if (!dryRun && !confirm) {
      return NextResponse.json(
        { error: 'Set confirm:true to send, or dryRun:true to preview.' },
        { status: 400 },
      );
    }

    const { db } = await connectToDatabase();
    const result = await sendMaintenanceBroadcast({
      db,
      dryRun,
      subject: typeof body.subject === 'string' ? body.subject : undefined,
      heading: typeof body.heading === 'string' ? body.heading : undefined,
      returnWindow:
        typeof body.returnWindow === 'string' ? body.returnWindow : undefined,
      extraNote: typeof body.extraNote === 'string' ? body.extraNote : undefined,
      messageHtml:
        typeof body.messageHtml === 'string' ? body.messageHtml : undefined,
      replyTo:
        typeof body.replyTo === 'string'
          ? body.replyTo
          : gate.email || 'timberlake2025@gmail.com',
    });

    const previewHtml = renderMaintenanceAnnouncementEmail({
      heading: typeof body.heading === 'string' ? body.heading : undefined,
      returnWindow:
        typeof body.returnWindow === 'string' ? body.returnWindow : undefined,
      extraNote: typeof body.extraNote === 'string' ? body.extraNote : undefined,
      messageHtml:
        typeof body.messageHtml === 'string' ? body.messageHtml : undefined,
    });

    return NextResponse.json({
      ok: true,
      adminEmail: gate.email,
      ...result,
      previewHtml,
      // Don't echo full recipient list on send responses unless dry-run
      recipients: dryRun ? result.recipients : undefined,
    });
  } catch (error) {
    console.error('Failed to send broadcast:', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : 'Failed to send broadcast',
      },
      { status: 500 },
    );
  }
}
