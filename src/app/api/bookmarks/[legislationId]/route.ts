import { NextRequest, NextResponse } from 'next/server';
import {
  getBookmark,
  updateBookmarkMetadata,
  isBookmarked
} from '@/services/bookmarksService';
import { auth } from '@clerk/nextjs/server';

// GET /api/bookmarks/[legislationId] - Get a specific bookmark
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ legislationId: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { legislationId } = await params;

    if (!legislationId) {
      return NextResponse.json({ error: 'Legislation ID is required' }, { status: 400 });
    }

    const bookmark = await getBookmark(userId, legislationId);

    if (!bookmark) {
      return NextResponse.json({ error: 'Bookmark not found' }, { status: 404 });
    }

    return NextResponse.json({ bookmark });
  } catch (error) {
    console.error('GET /api/bookmarks/[legislationId] - Error fetching bookmark:', error);
    return NextResponse.json({ error: 'Failed to fetch bookmark' }, { status: 500 });
  }
}

// PATCH /api/bookmarks/[legislationId] - Update bookmark metadata
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ legislationId: string }> }
) {
  try {
    const { userId } = await auth();

    if (!userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { legislationId } = await params;
    const { metadata } = await request.json();

    if (!legislationId) {
      return NextResponse.json({ error: 'Legislation ID is required' }, { status: 400 });
    }

    if (!metadata) {
      return NextResponse.json({ error: 'Metadata is required' }, { status: 400 });
    }

    // Check if bookmark exists
    const bookmarkExists = await isBookmarked(userId, legislationId);
    if (!bookmarkExists) {
      return NextResponse.json({ error: 'Bookmark not found' }, { status: 404 });
    }

    const updatedBookmark = await updateBookmarkMetadata(userId, legislationId, metadata);

    if (!updatedBookmark) {
      return NextResponse.json({ error: 'Failed to update bookmark' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      message: 'Bookmark updated successfully',
      bookmark: updatedBookmark
    });
  } catch (error) {
    console.error('PATCH /api/bookmarks/[legislationId] - Error updating bookmark:', error);
    return NextResponse.json({ error: 'Failed to update bookmark' }, { status: 500 });
  }
}
