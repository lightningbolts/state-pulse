import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

// PUT - Update a specific comment
export async function PUT(
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

    const { id, commentId } = await params;
    const body = await request.json();
    const { content } = body;

    if (!content || !content.trim()) {
      return NextResponse.json(
        { error: 'Comment content is required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    // Check if post exists and user owns the comment
    const post = await db.collection('posts').findOne({
      _id: new ObjectId(id),
      'comments._id': new ObjectId(commentId),
      'comments.userId': userId
    });

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found or you are not authorized to edit this comment' },
        { status: 404 }
      );
    }

    // Update the comment
    const result = await db.collection('posts').updateOne(
      {
        _id: new ObjectId(id),
        'comments._id': new ObjectId(commentId)
      },
      {
        $set: {
          'comments.$.content': content.trim(),
          'comments.$.updatedAt': new Date().toISOString()
        }
      }
    );

    if (result.modifiedCount === 0) {
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Comment updated successfully'
    });
  } catch (error) {
    console.error('Error updating comment:', error);
    return NextResponse.json(
      { error: 'Failed to update comment' },
      { status: 500 }
    );
  }
}

// DELETE - Remove a specific comment
export async function DELETE(
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

    const { id, commentId } = await params;
    const { db } = await connectToDatabase();

    // Check if post exists and user owns the comment
    const post = await db.collection('posts').findOne({
      _id: new ObjectId(id),
      'comments._id': new ObjectId(commentId),
      'comments.userId': userId
    });

    if (!post) {
      return NextResponse.json(
        { error: 'Post not found or you are not authorized to delete this comment' },
        { status: 404 }
      );
    }

    // Remove the comment
    const result = await db.collection('posts').updateOne(
      { _id: new ObjectId(id) },
      {
        $pull: {
          comments: {
            _id: new ObjectId(commentId)
          }
        }
      }
    );

    if (result.modifiedCount === 0) {
      return NextResponse.json(
        { error: 'Comment not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      message: 'Comment deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting comment:', error);
    return NextResponse.json(
      { error: 'Failed to delete comment' },
      { status: 500 }
    );
  }
}
