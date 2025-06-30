import { NextRequest, NextResponse } from 'next/server';
import {
  addBookmark,
  removeBookmark,
  getUserBookmarks,
  isBookmarked,
  getBookmarkCount
} from '@/services/bookmarksService';
import { auth } from '@clerk/nextjs/server';

// GET /api/bookmarks - Get user's bookmarks
export async function GET(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : undefined;
    const offset = searchParams.get('offset') ? parseInt(searchParams.get('offset')!) : undefined;
    const sortBy = searchParams.get('sortBy') as 'createdAt' | 'updatedAt' || 'createdAt';
    const sortOrder = searchParams.get('sortOrder') as 'asc' | 'desc' || 'desc';
    const tags = searchParams.get('tags')?.split(',').filter(Boolean);
    const priority = searchParams.get('priority') as 'low' | 'medium' | 'high' | undefined;

    const bookmarks = await getUserBookmarks(userId, {
      limit,
      offset,
      sortBy,
      sortOrder,
      tags,
      priority
    });

    const totalCount = await getBookmarkCount(userId);

    return NextResponse.json({
      bookmarks,
      totalCount,
      hasMore: offset !== undefined && limit !== undefined ? (offset + limit) < totalCount : false
    });
  } catch (error) {
    console.error('GET /api/bookmarks - Error fetching bookmarks:', error);
    return NextResponse.json({ error: 'Failed to fetch bookmarks' }, { status: 500 });
  }
}

// POST /api/bookmarks - Add a bookmark
export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { legislationId, metadata } = await request.json();

    if (!legislationId) {
      return NextResponse.json({ error: 'Legislation ID is required' }, { status: 400 });
    }

    // Check if already bookmarked
    const alreadyBookmarked = await isBookmarked(userId, legislationId);
    if (alreadyBookmarked) {
      return NextResponse.json({ error: 'Legislation is already bookmarked' }, { status: 409 });
    }

    const bookmark = await addBookmark(userId, legislationId, metadata);

    return NextResponse.json({
      success: true,
      message: 'Legislation bookmarked successfully',
      bookmark
    });
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

    const { searchParams } = new URL(request.url);
    const legislationId = searchParams.get('legislationId');

    // console.log('DELETE request - userId:', userId);
    // console.log('DELETE request - legislationId:', legislationId);

    if (!legislationId) {
      return NextResponse.json({ error: 'Legislation ID is required' }, { status: 400 });
    }

    const removed = await removeBookmark(userId, legislationId);

    // console.log('DELETE result - removed:', removed);

    if (!removed) {
      return NextResponse.json({ error: 'Bookmark not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      message: 'Bookmark removed successfully'
    });
  } catch (error) {
    console.error('DELETE /api/bookmarks - Error removing bookmark:', error);
    return NextResponse.json({ error: 'Failed to remove bookmark' }, { status: 500 });
  }
}
