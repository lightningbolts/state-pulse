import { NextRequest, NextResponse } from 'next/server';
import { addSavedLegislation, removeSavedLegislation, getUserById } from '@/services/usersService';
import { auth } from '@clerk/nextjs/server';

// POST /api/bookmarks - Add a bookmark
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { legislationId } = await request.json();

    if (!legislationId) {
      return NextResponse.json({ error: 'Legislation ID is required' }, { status: 400 });
    }

    await addSavedLegislation(userId, legislationId);

    return NextResponse.json({ success: true, message: 'Legislation bookmarked successfully' });
  } catch (error) {
    console.error('Error bookmarking legislation:', error);
    return NextResponse.json({ error: 'Failed to bookmark legislation' }, { status: 500 });
  }
}

// DELETE /api/bookmarks - Remove a bookmark
export async function DELETE(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { legislationId } = await request.json();

    if (!legislationId) {
      return NextResponse.json({ error: 'Legislation ID is required' }, { status: 400 });
    }

    await removeSavedLegislation(userId, legislationId);

    return NextResponse.json({ success: true, message: 'Bookmark removed successfully' });
  } catch (error) {
    console.error('Error removing bookmark:', error);
    return NextResponse.json({ error: 'Failed to remove bookmark' }, { status: 500 });
  }
}

// GET /api/bookmarks - Get user's bookmarks
export async function GET() {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = await getUserById(userId);

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ bookmarks: user.savedLegislation || [] });
  } catch (error) {
    console.error('Error fetching bookmarks:', error);
    return NextResponse.json({ error: 'Failed to fetch bookmarks' }, { status: 500 });
  }
}
