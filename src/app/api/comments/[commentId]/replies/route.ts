import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// POST - Add a reply to a comment
export async function POST(
  request: NextRequest,
  { params }: { params: { commentId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { commentId } = await params;
    const body = await request.json();
    const { content } = body;

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: 'Reply content is required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    // Find the post that contains the comment
    const post = await db.collection('posts').findOne({
      'comments._id': new ObjectId(commentId)
    });

    if (!post) {
      return NextResponse.json(
        { error: 'Comment not found' },
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

    const newReply = {
      _id: new ObjectId(),
      userId,
      username,
      userImage,
      content: content.trim(),
      createdAt: new Date().toISOString(),
    };

    // Add reply to the specific comment
    await db.collection('posts').updateOne(
      {
        '_id': post._id,
        'comments._id': new ObjectId(commentId)
      },
      {
        $push: {
          'comments.$.replies': newReply
        }
      } as any
    );

    const updatedPost = await db.collection('posts').findOne({ _id: post._id });
    return NextResponse.json({ post: updatedPost });
  } catch (error) {
    console.error('Error adding reply:', error);
    return NextResponse.json(
      { error: 'Failed to add reply' },
      { status: 500 }
    );
  }
}
