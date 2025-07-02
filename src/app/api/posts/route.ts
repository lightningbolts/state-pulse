import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { connectToDatabase } from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'legislation' or 'bug_report'
    const userId = searchParams.get('userId');

    const { db } = await connectToDatabase();

    let filter: any = {};
    if (type) filter.type = type;
    if (userId) filter.userId = userId;

    const posts = await db.collection('posts')
      .find(filter)
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray();

    return NextResponse.json({ posts });
  } catch (error) {
    console.error('Error fetching posts:', error);
    return NextResponse.json(
      { error: 'Failed to fetch posts' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { type, title, content, linkedBills, tags } = body;

    if (!type || !title || !content) {
      return NextResponse.json(
        { error: 'Type, title, and content are required' },
        { status: 400 }
      );
    }

    if (!['legislation', 'bug_report'].includes(type)) {
      return NextResponse.json(
        { error: 'Invalid post type' },
        { status: 400 }
      );
    }

    const { db } = await connectToDatabase();

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

    const newPost = {
      userId,
      username,
      userImage,
      type,
      title: title.trim(),
      content: content.trim(),
      linkedBills: type === 'legislation' ? (linkedBills || []) : undefined,
      tags: tags || [],
      likes: [],
      comments: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    const result = await db.collection('posts').insertOne(newPost);

    return NextResponse.json({
      message: 'Post created successfully',
      postId: result.insertedId
    });
  } catch (error) {
    console.error('Error creating post:', error);
    return NextResponse.json(
      { error: 'Failed to create post' },
      { status: 500 }
    );
  }
}
