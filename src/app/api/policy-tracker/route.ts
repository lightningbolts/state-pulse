import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';
import { getAuth } from '@clerk/nextjs/server';

export async function POST(req: NextRequest) {
  const auth = getAuth(req);

  if (!auth.userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 401 });
  }
  const { topic, notifyByEmail } = await req.json();
  if (!topic) {
    return NextResponse.json({ error: 'Missing topic' }, { status: 400 });
  }
  const collection = await getCollection('topic_subscriptions');
  const result = await collection.updateOne(
    { userId: auth.userId, topic },
    { $set: { userId: auth.userId, topic, notifyByEmail: !!notifyByEmail }, $setOnInsert: { createdAt: new Date() } },
    { upsert: true }
  );

  return NextResponse.json({ success: true });
}

// GET /api/policy-tracker/updates?userId=xxx
export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get('userId');
  if (!userId) {
    return NextResponse.json({ error: 'Missing userId' }, { status: 400 });
  }
  const collection = await getCollection('topic_subscriptions');
  
  // Get the user's specific subscriptions with their notification preferences
  const userSubscriptions = await collection.find({ userId }).toArray();
  
  // Return the user's subscriptions as updates (each subscription is an "update" record)
  const updates = userSubscriptions.map(sub => ({
    topic: sub.topic,
    notifyByEmail: sub.notifyByEmail || false,
    message: `Tracking "${sub.topic}"`,
    date: sub.createdAt || new Date(),
    userId: sub.userId
  }));

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

  const collection = await getCollection('topic_subscriptions');
  const result = await collection.deleteOne({ userId: auth.userId, topic });

  if (result.deletedCount === 0) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
  }


  return NextResponse.json({ success: true });
}

export async function PUT(req: NextRequest) {
  console.log('PUT /api/policy-tracker called');
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

  const collection = await getCollection('topic_subscriptions');
  let updateFields: any = {};
  if (newTopic) updateFields.topic = newTopic;
  if (typeof notifyByEmail !== 'undefined') updateFields.notifyByEmail = !!notifyByEmail;
  const result = await collection.updateOne(
    { userId: auth.userId, topic: oldTopic || newTopic },
    { $set: updateFields }
  );

  if (result.matchedCount === 0) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 });
  }
  return NextResponse.json({ success: true });
}
