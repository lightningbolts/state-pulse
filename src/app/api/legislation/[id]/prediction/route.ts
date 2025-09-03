import { NextRequest, NextResponse } from 'next/server';
import { getLegislationById } from '@/services/legislationService';
import { getVotingPrediction } from '@/services/votingPredictionService';
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
  const ip = forwarded
    ? forwarded.split(',')[0]
    : request.headers.get('x-real-ip') || 'unknown';
  return `ip_${ip}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';

    // Apply rate limiting only for force refresh requests
    if (forceRefresh) {
      const clientId = getClientIdentifier(request);
      const rateLimitKey = `prediction_${id}_${clientId}`;
      const rateLimit = checkRateLimit(rateLimitKey);

      if (!rateLimit.allowed) {
        return NextResponse.json(
          {
            error: 'Rate limit exceeded',
            message: `Please wait ${rateLimit.timeUntilReset} seconds before generating another prediction for this bill.`,
            timeUntilReset: rateLimit.timeUntilReset,
          },
          { status: 429 }
        );
      }
    }

    // Get legislation data
    const legislation = await getLegislationById(id);
    if (!legislation) {
      return NextResponse.json(
        { error: 'Legislation not found' },
        { status: 404 }
      );
    }

    // Extract political context from query params
    const politicalContext = {
      controllingParty: searchParams.get('controllingParty') || undefined,
      partisanBalance: searchParams.get('partisanBalance') || undefined,
      recentElections: searchParams.get('recentElections') || undefined,
    };

    // Get or generate prediction
    const prediction = await getVotingPrediction(
      legislation,
      politicalContext,
      forceRefresh
    );

    return NextResponse.json(prediction);
  } catch (error) {
    console.error('Error generating voting prediction:', error);
    return NextResponse.json(
      { error: 'Failed to generate voting prediction' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;

    // Apply rate limiting for POST requests (always force refresh)
    const clientId = getClientIdentifier(request);
    const rateLimitKey = `prediction_${id}_${clientId}`;
    const rateLimit = checkRateLimit(rateLimitKey);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Please wait ${rateLimit.timeUntilReset} seconds before generating another prediction for this bill.`,
          timeUntilReset: rateLimit.timeUntilReset,
        },
        { status: 429 }
      );
    }

    const body = await request.json();

    // Get legislation data
    const legislation = await getLegislationById(id);
    if (!legislation) {
      return NextResponse.json(
        { error: 'Legislation not found' },
        { status: 404 }
      );
    }

    // Generate new prediction with provided political context
    const prediction = await getVotingPrediction(
      legislation,
      body.politicalContext,
      true // Force refresh
    );

    return NextResponse.json(prediction);
  } catch (error) {
    console.error('Error generating voting prediction:', error);
    return NextResponse.json(
      { error: 'Failed to generate voting prediction' },
      { status: 500 }
    );
  }
}
