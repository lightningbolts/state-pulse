import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/mongodb';
import { getAuth } from '@clerk/nextjs/server';

// POST /api/policy-tracker
export async function POST(req: NextRequest) {
  const auth = getAuth(req);
  if (!auth.userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 401 });
  }
  const { topic, notifyByEmail } = await req.json();
  if (!topic) {
    return NextResponse.json({ error: 'Missing topic' }, { status: 400 });
  }
  const db = await getDb();
  // Store subscriptions in topic_subscriptions collection
  const result = await db.collection('topic_subscriptions').updateOne(
    { userId: auth.userId, topic },
    { $set: { userId: auth.userId, topic, notifyByEmail: !!notifyByEmail }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true }
  );

  // If this is a new subscription (upserted), send confirmation email
  if (result.upsertedCount > 0 || result.matchedCount === 0) {
    // Fetch user email using Clerk
    let email = undefined;
    try {
      const { users } = await import('@clerk/clerk-sdk-node');
      const clerkUser = await users.getUser(auth.userId);
      email = clerkUser?.emailAddresses?.[0]?.emailAddress;
    } catch (e) {
      console.warn('Could not fetch Clerk user for', auth.userId, e);
    }
    // Fallback: try to get email from users collection
    if (!email) {
      const userDoc = await db.collection('users').findOne({ id: auth.userId });
      email = userDoc?.email;
    }
    if (email) {
      const { sendEmail } = await import('@/lib/email');
      try {
        await sendEmail({
          to: email,
          subject: `Subscribed to topic: ${topic}`,
          text: `You are now subscribed to updates for the topic: ${topic}. You will receive notifications when new legislation is available.`,
          html: `<h2>Subscription Confirmed</h2><p>You are now subscribed to updates for the topic: <b>${topic}</b>. You will receive notifications when new legislation is available.</p>`
        });
        console.log(`Sent subscription confirmation email to ${email}`);
      } catch (e) {
        console.error('Failed to send subscription confirmation email:', e);
      }
    } else {
      console.warn('No email found for user', auth.userId);
    }
  }
  return NextResponse.json({ success: true });
}

// GET /api/policy-tracker/updates?userId=xxx
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }
  const db = await getDb();
  // Find all topics user is subscribed to
  const subs = await db.collection('topic_subscriptions').find({ userId }).toArray();
  const topics = subs.map((s) => s.topic);
  // Find updates for these topics
  const updates = await db.collection('topic_subscriptions')
    .find({ topic: { $in: topics } })
    .sort({ date: -1 })
    .limit(20)
    .toArray();
  return NextResponse.json({ updates });
}

// DELETE /api/policy-tracker
export async function DELETE(req: NextRequest) {
  const auth = getAuth(req);
  if (!auth.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { topic } = await req.json();
  if (!topic) {
    return NextResponse.json({ error: 'Missing topic' }, { status: 400 });
  }

  const db = await getDb();
  const result = await db
    .collection('topic_subscriptions')
    .deleteOne({ userId: auth.userId, topic });

  if (result.deletedCount === 0) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

// PUT /api/policy-tracker
export async function PUT(req: NextRequest) {
  const auth = getAuth(req);
  if (!auth.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { oldTopic, newTopic, notifyByEmail } = await req.json();
  if (!oldTopic && !newTopic && typeof notifyByEmail === 'undefined') {
    return NextResponse.json(
      { error: 'Missing update fields' },
      { status: 400 }
    );
  }

  const db = await getDb();
  let update: any = {};
  if (newTopic) update.topic = newTopic;
  if (typeof notifyByEmail !== 'undefined') update.notifyByEmail = !!notifyByEmail;
  const result = await db.collection('topic_subscriptions').updateOne(
    { userId: auth.userId, topic: oldTopic || newTopic },
    { $set: update }
  );

  if (result.matchedCount === 0) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
