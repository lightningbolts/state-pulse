import { IncomingHttpHeaders } from 'http';
import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { syncUserToMongoDB } from '@/lib/clerkMongoIntegration';

// Webhook secret from Clerk Dashboard (Settings > Webhooks > Your Webhook > Signing Secret)
const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

/**
 * Handler for Clerk webhooks to sync user data with MongoDB
 */
export async function POST(req: NextRequest) {
    if (!webhookSecret) {
        console.error('Missing CLERK_WEBHOOK_SECRET');
        return new NextResponse('Missing webhook secret', { status: 400 });
    }

    // Get the headers and body
    const headers = Object.fromEntries(req.headers.entries());
    const payload = await req.json();

    let evt;

    // Verify the webhook signature
    try {
        const wh = new Webhook(webhookSecret);
        evt = wh.verify(JSON.stringify(payload), headers as IncomingHttpHeaders);
    } catch (err) {
        console.error('Webhook verification failed:', err);
        return new NextResponse('Webhook verification failed', { status: 400 });
    }

    const eventType = evt.type;

    // Handle user creation and update events
    if (eventType === 'user.created' || eventType === 'user.updated') {
        try {
            await syncUserToMongoDB(evt.data);
            return NextResponse.json({ success: true });
        } catch (error) {
            console.error('Error syncing user to MongoDB:', error);
            return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
        }
    }

    // For other events, just acknowledge receipt
    return NextResponse.json({ success: true });
}

export const runtime = 'nodejs';
