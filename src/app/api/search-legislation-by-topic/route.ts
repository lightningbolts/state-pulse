import { NextRequest, NextResponse } from 'next/server';
import { searchLegislationByTopic } from '@/services/legislationService';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const topic = searchParams.get('topic');
    const daysBack = parseInt(searchParams.get('daysBack') || '7');

    if (!topic) {
      return NextResponse.json(
        { error: 'Topic parameter is required' },
        { status: 400 }
      );
    }

    const legislation = await searchLegislationByTopic(topic, daysBack);

    return NextResponse.json({
      legislation,
      count: legislation.length,
      topic,
      daysBack
    });
  } catch (error) {
    console.error('Error searching legislation by topic:', error);
    return NextResponse.json(
      { error: 'Failed to search legislation' },
      { status: 500 }
    );
  }
}
