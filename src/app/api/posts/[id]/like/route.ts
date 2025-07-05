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

    const { id } = await params;
    const { db } = await connectToDatabase();

    const post = await db.collection('posts').findOne({ _id: new ObjectId(id) });
    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }

    const likes = post.likes || [];
    const isLiked = likes.includes(userId);

    let updateOperation;
    if (isLiked) {
      // Unlike the post
      updateOperation = { $pull: { likes: userId } };
    } else {
      // Like the post
      updateOperation = { $addToSet: { likes: userId } };
    }

    await db.collection('posts').updateOne(
      { _id: new ObjectId(id) },
      updateOperation
    );

    return NextResponse.json({
      message: isLiked ? 'Post unliked' : 'Post liked',
      liked: !isLiked
    });
  } catch (error) {
    console.error('Error toggling like:', error);
    return NextResponse.json(
      { error: 'Failed to toggle like' },
      { status: 500 }
    );
  }
}
