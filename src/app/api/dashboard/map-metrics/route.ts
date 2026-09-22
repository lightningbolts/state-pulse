import { NextRequest, NextResponse } from 'next/server';
import { CDN_CACHE, jsonWithCdnCache } from '@/lib/cdnCache';
import {
  getMapSupplementalMetric,
  type MapSupplementalMetric,
} from '@/lib/mapDataService';

const VALID_METRICS = new Set<MapSupplementalMetric>(['trends', 'bipartisan', 'lifecycle']);

export async function GET(request: NextRequest) {
  const metric = request.nextUrl.searchParams.get('metric') as MapSupplementalMetric | null;

  if (!metric || !VALID_METRICS.has(metric)) {
    return NextResponse.json(
      { success: false, error: 'metric must be "trends", "bipartisan", or "lifecycle"' },
      { status: 400 },
    );
  }

  try {
    const data = await getMapSupplementalMetric(metric);
    return jsonWithCdnCache(
      {
        success: true,
        metric,
        data,
      },
      CDN_CACHE.dashboard,
    );
  } catch (error) {
    console.error('[Map Metrics API] Failed to fetch supplemental map metric:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch supplemental map metric',
      },
      { status: 500 },
    );
  }
}
