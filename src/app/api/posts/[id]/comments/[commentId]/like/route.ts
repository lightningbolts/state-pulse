import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; commentId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id, commentId } = params;
    const { db } = await connectToDatabase();

    // Find the post and comment
    const post = await db.collection('posts').findOne({ _id: new ObjectId(id) });
    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }
    const comment = (post.comments || []).find((c: any) => c._id.toString() === commentId);
    if (!comment) {
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404 }
      );
    }
    const likes = comment.likes || [];
    const isLiked = likes.includes(userId);
    const updatedLikes = isLiked ? likes.filter((id: string) => id !== userId) : [...likes, userId];

    // Update the comment's likes in the post document
    await db.collection('posts').updateOne(
      { _id: new ObjectId(id), 'comments._id': new ObjectId(commentId) },
      { $set: { 'comments.$.likes': updatedLikes } }
    );

    // Fetch the updated post
    const updatedPost = await db.collection('posts').findOne({ _id: new ObjectId(id) });
    return NextResponse.json({ post: updatedPost });
  } catch (error) {
    console.error('Error toggling comment like:', error);
    return NextResponse.json(
      { error: 'Failed to toggle comment like' },
      { status: 500 }
    );
  }
}
