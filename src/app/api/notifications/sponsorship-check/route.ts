import { NextRequest, NextResponse } from 'next/server';
import { checkAndSendSponsorshipNotifications } from '@/services/sponsorshipNotificationService';

export async function POST(request: NextRequest) {
  try {
    // Check for authorization (you might want to add an API key check here)
    const authHeader = request.headers.get('authorization');
    const expectedToken = process.env.CRON_SECRET || 'your-secret-token';

    if (authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await checkAndSendSponsorshipNotifications();

    return NextResponse.json({
      success: true,
      message: 'Sponsorship notifications check completed',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in sponsorship notifications API:', error);
    return NextResponse.json(
      {
        error: 'Failed to process sponsorship notifications',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET endpoint for testing/manual trigger (remove in production)
export async function GET(request: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not allowed in production' }, { status: 403 });
  }

  try {
    await checkAndSendSponsorshipNotifications();
    return NextResponse.json({
      success: true,
      message: 'Sponsorship notifications check completed (dev mode)',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error in sponsorship notifications API:', error);
    return NextResponse.json(
      {
        error: 'Failed to process sponsorship notifications',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
