import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { fetchJurisdictionDashboard } from '@/lib/dashboardDetailService';
import { CDN_CACHE, jsonWithCdnCache } from '@/lib/cdnCache';

const CONGRESS_JURISDICTION = 'United States Congress';

export async function GET() {
  try {
    const cachedFetch = unstable_cache(
      () => fetchJurisdictionDashboard({
        jurisdictionName: CONGRESS_JURISDICTION,
        jurisdiction: CONGRESS_JURISDICTION,
      }),
      ['dashboard-congress-detail-v3'],
      { revalidate: 600 },
    );
    const data = await cachedFetch();

    return jsonWithCdnCache({
      success: true,
      data,
    }, CDN_CACHE.dashboard);
  } catch (error) {
    console.error('Error fetching US Congress dashboard data:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch US Congress dashboard data',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
