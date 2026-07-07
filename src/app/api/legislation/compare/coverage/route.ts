import { NextResponse } from 'next/server';
import { getEmbeddingCoverage } from '@/services/stateLegislationComparisonService';

export async function GET() {
  try {
    const coverage = await getEmbeddingCoverage();
    return NextResponse.json(coverage, { status: 200 });
  } catch (error) {
    console.error('Error fetching embedding coverage:', error);
    return NextResponse.json(
      { message: 'Error fetching embedding coverage', error: (error as Error).message },
      { status: 500 },
    );
  }
}
