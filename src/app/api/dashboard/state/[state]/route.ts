import { NextRequest, NextResponse } from 'next/server';
import { STATE_NAMES } from '@/types/geo';
import { unstable_cache } from 'next/cache';
import { fetchJurisdictionDashboard } from '@/lib/dashboardDetailService';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ state: string }> }
) {
  try {
    const resolvedParams = await params;
    const stateParam = resolvedParams.state.toUpperCase();
    const stateName = STATE_NAMES[stateParam];
    if (!stateName || stateParam === 'US') {
      return NextResponse.json(
        { success: false, error: 'Invalid state parameter' },
        { status: 400 }
      );
    }

    const cachedFetch = unstable_cache(
      () => fetchJurisdictionDashboard({
        jurisdictionName: stateName,
        state: stateParam,
      }),
      ['dashboard-state-detail-v3', stateParam],
      { revalidate: 600 },
    );
    const data = await cachedFetch();

    return NextResponse.json({
      success: true,
      data,
    });

  } catch (error) {
    console.error('Error fetching state details:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch state details' },
      { status: 500 }
    );
  }
}
