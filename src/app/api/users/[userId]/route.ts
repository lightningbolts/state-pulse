import { NextRequest, NextResponse } from 'next/server';
import { getUserById } from '@/services/usersService';
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

    // Get user data
    const user = await getUserById(userId);

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Get additional user info from Clerk (username, etc.)
    let username = user.name || 'Anonymous';
    let userImage = user.preferences?.imageUrl;

    try {
      const userResponse = await fetch(`https://api.clerk.dev/v1/users/${userId}`, {
        headers: {
          'Authorization': `Bearer ${process.env.CLERK_SECRET_KEY}`,
        },
      });

      if (userResponse.ok) {
        const userData = await userResponse.json();
        username = userData.username || userData.first_name || userData.email_addresses?.[0]?.email_address || username;
        userImage = userData.image_url || userImage;
      }
    } catch (clerkError) {
      console.warn('Could not fetch user data from Clerk:', clerkError);
    }

    // Get user's posts and comments count
    const { db } = await connectToDatabase();

    const postsCount = await db.collection('posts').countDocuments({ userId });

    // Count comments across all posts
    const commentsAggregation = await db.collection('posts').aggregate([
      { $unwind: '$comments' },
      { $match: { 'comments.userId': userId } },
      { $count: 'totalComments' }
    ]).toArray();

    const commentsCount = commentsAggregation[0]?.totalComments || 0;

    // Get user's most recent posts
    const recentPosts = await db.collection('posts')
      .find({ userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();

    return NextResponse.json({
      user: {
        id: user.id,
        name: username,
        email: user.email,
        createdAt: user.createdAt,
        trackingTopics: user.trackingTopics,
        imageUrl: userImage
      },
      stats: {
        postsCount,
        commentsCount
      },
      recentPosts
    });
  } catch (error) {
    console.error('Error fetching user profile:', error);
    return NextResponse.json(
      { error: 'Failed to fetch user profile' },
      { status: 500 }
    );
  }
}
