import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { getCollection } from '@/lib/mongodb';

export async function GET(request: NextRequest) {
  const auth = getAuth(request);
  if (!auth.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const follows = await getCollection('user_follows');
  const repsCollection = await getCollection('representatives');
  const followed = await follows.find({ userId: auth.userId }).toArray();
  const repIds = followed.map(f => f.repId);
  const reps = await repsCollection.find({ id: { $in: repIds } }).toArray();
  return NextResponse.json({ representatives: reps });
}
