import { NextRequest, NextResponse } from 'next/server';
import { getBaseMapData, getMapDataForStates } from '@/lib/mapDataService';
import { CDN_CACHE, jsonWithCdnCache } from '@/lib/cdnCache';

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  try {
    const statesParam = request.nextUrl.searchParams.get('states');
    const stateStats = statesParam
      ? await getMapDataForStates(statesParam)
      : await getBaseMapData();

    return jsonWithCdnCache({
      success: true,
      data: stateStats,
      lastUpdated: new Date().toISOString(),
      processingTime: Date.now() - startTime,
    }, CDN_CACHE.dashboard);
  } catch (error) {
    console.error('[Map Data API] Error fetching map data:', error);

    if (error instanceof Error) {
      console.error('[Map Data API] Error name:', error.name);
      console.error('[Map Data API] Error message:', error.message);
    }

    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch map data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
