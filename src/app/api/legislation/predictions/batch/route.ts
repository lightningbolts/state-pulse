import { NextRequest, NextResponse } from 'next/server';
import { getLegislationsByIds } from '@/services/legislationService';
import { batchGeneratePredictions } from '@/services/votingPredictionService';
import { checkRateLimit } from '@/services/rateLimitService';

function getClientIdentifier(request: NextRequest): string {
  // Try to get user ID from auth headers first (if available)
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    // Extract user ID from auth header if available
    const userIdMatch = authHeader.match(/user_(.+)/);
    if (userIdMatch) return `user_${userIdMatch[1]}`;
  }

  // Fallback to IP address
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown';
  return `ip_${ip}`;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { legislationIds, politicalContext } = body;

    if (!legislationIds || !Array.isArray(legislationIds) || legislationIds.length === 0) {
      return NextResponse.json(
        { error: 'legislationIds array is required' },
        { status: 400 }
      );
    }

    // Limit batch size to prevent abuse
    if (legislationIds.length > 50) {
      return NextResponse.json(
        { error: 'Maximum batch size is 50 items' },
        { status: 400 }
      );
    }

    // Apply rate limiting for batch requests (more restrictive)
    const clientId = getClientIdentifier(request);
    const rateLimitKey = `batch_prediction_${clientId}`;
    const rateLimit = checkRateLimit(rateLimitKey);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Please wait ${rateLimit.timeUntilReset} seconds before generating batch predictions.`,
          timeUntilReset: rateLimit.timeUntilReset
        },
        { status: 429 }
      );
    }

    // Get legislation data for all IDs
    const legislations = await getLegislationsByIds(legislationIds);

    if (legislations.length === 0) {
      return NextResponse.json(
        { error: 'No valid legislation found for provided IDs' },
        { status: 404 }
      );
    }

    // Generate batch predictions
    const predictions = await batchGeneratePredictions(legislations, politicalContext);

    return NextResponse.json({
      success: true,
      processed: predictions.length,
      total: legislationIds.length,
      predictions
    });
  } catch (error) {
    console.error('Error in batch prediction generation:', error);
    return NextResponse.json(
      { error: 'Failed to generate batch predictions' },
      { status: 500 }
    );
  }
}
