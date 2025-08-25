import { NextRequest, NextResponse } from 'next/server';
import { getLegislationsByIds } from '@/services/legislationService';
import { batchGeneratePredictions } from '@/services/votingPredictionService';

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
