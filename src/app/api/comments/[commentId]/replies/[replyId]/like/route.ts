import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function POST(
  request: NextRequest,
  context: { params: { commentId: string; replyId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const params = await context.params;
    const { commentId, replyId } = params;
    const { db } = await connectToDatabase();

    // Find the post containing the comment
    const post = await db.collection('posts').findOne({ 'comments._id': new ObjectId(commentId) });
    if (!post) {
      return NextResponse.json(
        { error: 'Post not found' },
        { status: 404 }
      );
    }
    // Find the comment
    const comment = (post.comments || []).find((c: any) => c._id.toString() === commentId);
    if (!comment) {
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404 }
      );
    }
    // Find the reply
    const reply = (comment.replies || []).find((r: any) => r._id.toString() === replyId);
    if (!reply) {
      return NextResponse.json(
        { error: 'Reply not found' },
        { status: 404 }
      );
    }
    const likes = reply.likes || [];
    const isLiked = likes.includes(userId);
    const updatedLikes = isLiked ? likes.filter((id: string) => id !== userId) : [...likes, userId];

    // Update the reply's likes in the post document
    await db.collection('posts').updateOne(
      { 'comments._id': new ObjectId(commentId), 'comments.replies._id': new ObjectId(replyId) },
      { $set: { 'comments.$[c].replies.$[r].likes': updatedLikes } },
      { arrayFilters: [ { 'c._id': new ObjectId(commentId) }, { 'r._id': new ObjectId(replyId) } ] }
    );

    // Fetch the updated post
    const updatedPost = await db.collection('posts').findOne({ 'comments._id': new ObjectId(commentId) });
    return NextResponse.json({ post: updatedPost });
  } catch (error) {
    console.error('Error toggling reply like:', error);
    return NextResponse.json(
      { error: 'Failed to toggle reply like' },
      { status: 500 }
    );
  }
}
