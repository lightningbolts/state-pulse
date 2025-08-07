import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { getCollection } from '@/lib/mongodb';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuth(request);
  if (!auth.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id: repId } = await params;
  const follows = await getCollection('user_follows');
  await follows.updateOne(
    { userId: auth.userId, repId },
    { $set: { userId: auth.userId, repId, createdAt: new Date() } },
    { upsert: true }
  );
  return NextResponse.json({ success: true });
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuth(request);
  if (!auth.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { id: repId } = await params;
  const follows = await getCollection('user_follows');
  await follows.deleteOne({ userId: auth.userId, repId });
  return NextResponse.json({ success: true });
}
