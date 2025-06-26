import { NextRequest, NextResponse } from 'next/server';
import { getMongoClient } from '@/lib/mongodb';

// POST /api/policy-tracker
export async function POST(req: NextRequest) {
  const { topic, userId } = await req.json();
  if (!topic || !userId) {
    return NextResponse.json({ error: 'Missing topic or userId' }, { status: 400 });
  }
  const client = await getMongoClient();
  const db = client.db();
  // Store subscriptions in users collection
  await db.collection('users').updateOne(
    { userId, topic },
    { $set: { userId, topic }, $setOnInsert: { createdAt: new Date() } },
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
  const client = await getMongoClient();
  const db = client.db();
  // Find all topics user is subscribed to
  const subs = await db.collection('users').find({ userId }).toArray();
  const topics = subs.map((s) => s.topic);
  // Find updates for these topics
  const updates = await db.collection('users')
    .find({ topic: { $in: topics } })
    .sort({ date: -1 })
    .limit(20)
    .toArray();
  return NextResponse.json({ updates });
}
