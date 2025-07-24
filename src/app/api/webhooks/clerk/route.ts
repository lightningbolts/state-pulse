import { IncomingHttpHeaders } from 'http';
import { NextRequest, NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { syncUserToMongoDB } from '@/lib/clerkMongoIntegration';
import { sendEmail } from '@/lib/email';
import { renderBrandedEmail } from '@/lib/emailTemplate';

// Webhook secret from Clerk Dashboard (Settings > Webhooks > Your Webhook > Signing Secret)
const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

/**
 * Handler for Clerk webhooks to sync user data with MongoDB and send welcome email
 */
export async function POST(req: NextRequest) {
    if (!webhookSecret) {
        console.error('Missing CLERK_WEBHOOK_SECRET');
        return new NextResponse('Missing webhook secret', { status: 400 });
    }

    // Get raw body for svix verification
    const rawBody = await req.arrayBuffer();
    const bodyBuffer = Buffer.from(rawBody);

    // Get headers for svix verification
    const svixHeaders = {
        'svix-id': req.headers.get('svix-id') || '',
        'svix-timestamp': req.headers.get('svix-timestamp') || '',
        'svix-signature': req.headers.get('svix-signature') || '',
    };

    let evt: any;
    try {
        const wh = new Webhook(webhookSecret);
        evt = wh.verify(bodyBuffer, svixHeaders);
    } catch (err) {
        console.error('Webhook verification failed:', err);
        return new NextResponse('Webhook verification failed', { status: 400 });
    }

    // Cast evt to expected Clerk event type
    const eventType = (evt as any).type;

    // Handle user creation and update events
    if (eventType === 'user.created' || eventType === 'user.updated') {
        try {
            await syncUserToMongoDB((evt as any).data);
            // Send welcome email only for user.created
            if (eventType === 'user.created') {
                const email = (evt as any).data?.email_addresses?.[0]?.email_address;
                const firstName = (evt as any).data?.first_name || '';
                if (email) {
                    try {
                        const html = renderBrandedEmail({
                            heading: 'Welcome to StatePulse!',
                            message: `Hi ${firstName || 'there'},<br>Welcome to StatePulse! You can now track legislation and receive updates on the issues you care about.`,
                            ctaUrl: 'https://statepulse.me/dashboard',
                            ctaText: 'Go to Dashboard',
                        });
                        await sendEmail({
                            to: email,
                            subject: 'Welcome to StatePulse!',
                            html,
                        });
                    } catch (e) {
                        console.error('Failed to send welcome email:', e);
                    }
                }
            }
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
