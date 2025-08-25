import { NextRequest, NextResponse } from 'next/server';
import { getLegislationById } from '@/services/legislationService';
import { getVotingPrediction } from '@/services/votingPredictionService';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';

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
