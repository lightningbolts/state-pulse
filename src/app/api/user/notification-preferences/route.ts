import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from '@clerk/nextjs/server';
import { getCollection } from '@/lib/mongodb';

export interface NotificationPreferences {
  userId: string;
  emailNotifications: {
    sponsorshipAlerts: boolean;
    weeklyDigest: boolean;
  };
  updatedAt: Date;
  createdAt: Date;
}

export async function GET(request: NextRequest) {
  const auth = getAuth(request);
  if (!auth.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const preferencesCollection = await getCollection('user_notification_preferences');

    let preferences = await preferencesCollection.findOne({ userId: auth.userId });

    // Create default preferences if none exist
    if (!preferences) {
      const defaultPreferences: NotificationPreferences = {
        userId: auth.userId,
        emailNotifications: {
          sponsorshipAlerts: true,
          weeklyDigest: false
        },
        updatedAt: new Date(),
        createdAt: new Date()
      };

      await preferencesCollection.insertOne(defaultPreferences);
      preferences = defaultPreferences;
    }

    return NextResponse.json({ preferences });
  } catch (error) {
    console.error('Error fetching notification preferences:', error);
    return NextResponse.json(
      { error: 'Failed to fetch notification preferences' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  const auth = getAuth(request);
  if (!auth.userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { emailNotifications } = body;

    if (!emailNotifications || typeof emailNotifications !== 'object') {
      return NextResponse.json(
        { error: 'Invalid notification preferences format' },
        { status: 400 }
      );
    }

    const preferencesCollection = await getCollection('user_notification_preferences');

    const updatedPreferences = {
      userId: auth.userId,
      emailNotifications: {
        sponsorshipAlerts: Boolean(emailNotifications.sponsorshipAlerts),
        weeklyDigest: Boolean(emailNotifications.weeklyDigest)
      },
      updatedAt: new Date()
    };

    await preferencesCollection.updateOne(
      { userId: auth.userId },
      {
        $set: updatedPreferences,
        $setOnInsert: { createdAt: new Date() }
      },
      { upsert: true }
    );

    return NextResponse.json({
      success: true,
      preferences: updatedPreferences
    });
  } catch (error) {
    console.error('Error updating notification preferences:', error);
    return NextResponse.json(
      { error: 'Failed to update notification preferences' },
      { status: 500 }
    );
  }
}
