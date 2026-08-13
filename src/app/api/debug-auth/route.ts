import { auth } from '@clerk/nextjs/server';
import { NextResponse } from 'next/server';

export async function GET() {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const { userId } = auth();

  if (!userId) {
    return NextResponse.json({ error: 'You are not authenticated.' }, { status: 401 });
  }

  return NextResponse.json({ message: 'You are authenticated!', userId });
}

