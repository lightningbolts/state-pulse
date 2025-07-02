import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;
    const body = await request.json();
    const { content } = body;

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: 'Comment content is required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    const post = await db.collection('posts').findOne({ _id: new ObjectId(id) });
    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    // Get user info from Clerk
    const userResponse = await fetch(`https://api.clerk.dev/v1/users/${userId}`, {
      headers: {
        'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
      },
    });

    let username = 'Anonymous';
    let userImage = undefined;

    if (userResponse.ok) {
      const userData = await userResponse.json();
      username = userData.username || userData.first_name || userData.email_addresses?.[0]?.email_address || 'Anonymous';
      userImage = userData.image_url;
    }

    const newComment = {
      _id: new ObjectId(),
      userId,
      username,
      userImage,
      content: content.trim(),
      createdAt: new Date().toISOString(),
    };

    await db.collection('posts').updateOne(
      { _id: new ObjectId(id) },
      { $push: { comments: newComment } }
    );

    return NextResponse.json({
      message: 'Comment added successfully',
      comment: newComment
    });
  } catch (error) {
    console.error('Error adding comment:', error);
    return NextResponse.json(
      { error: 'Failed to add comment' },
      { status: 500 }
    );
  }
}
