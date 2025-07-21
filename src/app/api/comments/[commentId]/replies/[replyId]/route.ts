import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// PUT - Edit a specific reply
export async function PUT(
  request: NextRequest,
  { params }: { params: { commentId: string; replyId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { commentId, replyId } = await params;
    const body = await request.json();
    const { content } = body;

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: 'Reply content is required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    // Check if the user owns the reply
    const post = await db.collection('posts').findOne({
      'comments._id': new ObjectId(commentId),
      'comments.replies._id': new ObjectId(replyId),
      'comments.replies.userId': userId
    });

    if (!post) {
      return NextResponse.json(
        { error: 'Reply not found or you are not authorized to edit this reply' },
        { status: 404 }
      );
    }

    // Update the reply
    const result = await db.collection('posts').updateOne(
      {
        'comments._id': new ObjectId(commentId),
        'comments.replies._id': new ObjectId(replyId)
      },
      {
        $set: {
          'comments.$[comment].replies.$[reply].content': content.trim(),
          'comments.$[comment].replies.$[reply].updatedAt': new Date().toISOString()
        }
      } as any,
      {
        arrayFilters: [
          { 'comment._id': new ObjectId(commentId) },
          { 'reply._id': new ObjectId(replyId) }
        ]
      }
    );

    if (result.modifiedCount === 0) {
      return NextResponse.json(
        { error: 'Reply not found' },
        { status: 404 }
      );
    }

    // Find the post id for this comment
    const postDoc = await db.collection('posts').findOne({ 'comments._id': new ObjectId(commentId) });
    const postId = postDoc?._id;
    const updatedPost = postId ? await db.collection('posts').findOne({ _id: postId }) : null;
    return NextResponse.json({ post: updatedPost });
  } catch (error) {
    console.error('Error updating reply:', error);
    return NextResponse.json(
      { error: 'Failed to update reply' },
      { status: 500 }
    );
  }
}

// DELETE - Remove a specific reply
export async function DELETE(
  request: NextRequest,
  { params }: { params: { commentId: string; replyId: string } }
) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { commentId, replyId } = await params;
    const { db } = await connectToDatabase();

    // Check if the user owns the reply
    const post = await db.collection('posts').findOne({
      'comments._id': new ObjectId(commentId),
      'comments.replies._id': new ObjectId(replyId),
      'comments.replies.userId': userId
    });

    if (!post) {
      return NextResponse.json(
        { error: 'Reply not found or you are not authorized to delete this reply' },
        { status: 404 }
      );
    }

            // Remove the reply and return updated post
            const result = await db.collection('posts').updateOne(
                {
                    'comments._id': new ObjectId(commentId),
                    'comments.replies._id': new ObjectId(replyId),
                    'comments.replies.userId': userId
                },
                {
                    $pull: {
                        'comments.$[comment].replies': { _id: new ObjectId(replyId) }
                    }
                } as any,
                {
                    arrayFilters: [
                        { 'comment._id': new ObjectId(commentId) }
                    ]
                }
            );

            if (result.modifiedCount === 0) {
                return NextResponse.json(
                    { error: 'Reply not found or unauthorized' },
                    { status: 404 }
                );
            }

            // Find the post id for this comment (avoid redeclaration)
            const postDoc = await db.collection('posts').findOne({ 'comments._id': new ObjectId(commentId) });
            const postId = postDoc?._id;
            const updatedPost = postId ? await db.collection('posts').findOne({ _id: postId }) : null;
            return NextResponse.json({ post: updatedPost });
  } catch (error) {
    console.error('Error deleting reply:', error);
    return NextResponse.json(
      { error: 'Failed to delete reply' },
      { status: 500 }
    );
  }
}
