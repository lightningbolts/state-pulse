import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export async function GET(
  request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const { userId } = await params;

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

    // Get all comments by the user along with post information
    const commentsAggregation = await db.collection('posts').aggregate([
      { $unwind: '$comments' },
      { $match: { 'comments.userId': userId } },
      {
        $project: {
          _id: '$comments._id',
          userId: '$comments.userId',
          username: '$comments.username',
          userImage: '$comments.userImage',
          content: '$comments.content',
          createdAt: '$comments.createdAt',
          postId: '$_id',
          postTitle: '$title'
        }
      },
      { $sort: { createdAt: -1 } },
      { $limit: 50 }
    ]).toArray();

    return NextResponse.json({
      comments: commentsAggregation
    });
  } catch (error) {
    console.error('Error fetching user comments:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user comments' },
      { status: 500 }
    );
  }
}
