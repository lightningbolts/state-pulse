import { NextRequest, NextResponse } from 'next/server';
import { addSavedLegislation, removeSavedLegislation, getUserById, upsertUser } from '@/services/usersService';
import { auth } from '@clerk/nextjs/server';

// POST /api/bookmarks - Add a bookmark
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    console.log('POST /api/bookmarks - userId:', userId);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { legislationId } = await request.json();
    console.log('POST /api/bookmarks - legislationId:', legislationId);

    if (!legislationId) {
      return NextResponse.json({ error: 'Legislation ID is required' }, { status: 400 });
    }

    // Ensure user exists in database before bookmarking
    let user = await getUserById(userId);
    console.log('POST /api/bookmarks - existing user:', user ? 'found' : 'not found');

    if (!user) {
      console.log('POST /api/bookmarks - creating new user');
      // Create user if doesn't exist
      await upsertUser({
        id: userId,
        savedLegislation: [],
        trackingTopics: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log('POST /api/bookmarks - user created');
    }

    console.log('POST /api/bookmarks - calling addSavedLegislation');
    await addSavedLegislation(userId, legislationId);
    console.log('POST /api/bookmarks - bookmark added successfully');

    return NextResponse.json({ success: true, message: 'Legislation bookmarked successfully' });
  } catch (error) {
    console.error('POST /api/bookmarks - Error bookmarking legislation:', error);
    return NextResponse.json({ error: `Failed to bookmark legislation: ${error.message}` }, { status: 500 });
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

    console.log('GET /api/bookmarks - userId:', userId);

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let user = await getUserById(userId);
    console.log('GET /api/bookmarks - user found:', user ? 'yes' : 'no');
    console.log('GET /api/bookmarks - user.savedLegislation:', user?.savedLegislation);

    // If user doesn't exist, create them and return empty bookmarks
    if (!user) {
      console.log('GET /api/bookmarks - creating new user');
      await upsertUser({
        id: userId,
        savedLegislation: [],
        trackingTopics: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      console.log('GET /api/bookmarks - returning empty bookmarks for new user');
      return NextResponse.json({ bookmarks: [] });
    }

    const bookmarks = user.savedLegislation || [];
    console.log('GET /api/bookmarks - returning bookmarks:', bookmarks);
    return NextResponse.json({ bookmarks });
  } catch (error) {
    console.error('GET /api/bookmarks - Error fetching bookmarks:', error);
    return NextResponse.json({ error: 'Failed to fetch bookmarks' }, { status: 500 });
  }
}
