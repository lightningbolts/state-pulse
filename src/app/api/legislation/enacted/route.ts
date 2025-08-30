import { NextResponse } from 'next/server';
import { getAllEnactedLegislation } from '@/services/legislationService';
import cacheService from '@/lib/cache-service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    // Parse pagination parameters
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit') || '100', 10) : 100;
    const skip = searchParams.get('skip') ? parseInt(searchParams.get('skip') || '0', 10) : 0;

    // Parse sorting parameters
    const sortField = searchParams.get('sortBy');
    const sortDirection = searchParams.get('sortDir');

    let sort: Record<string, 1 | -1> = {};
    if (sortField) {
      sort = { [sortField]: sortDirection === 'asc' ? 1 : -1 };
    } else {
      // Default sort by latest action date for enacted bills
      sort = { latestActionAt: -1 };
    }

    // Extract filter parameters
    const jurisdictionName = searchParams.get('jurisdictionName');
    const searchText = searchParams.get('search');
    const showCongressParam = searchParams.get('showCongress');

    // Handle Congress filtering
    const finalJurisdictionName = showCongressParam === 'true'
      ? 'United States Congress'
      : jurisdictionName;

    // Create cache key for this specific query
    const cacheKey = `enacted_legislation_v2:${JSON.stringify({ limit, skip, sort, searchText, jurisdictionName: finalJurisdictionName })}`;

    // Try to get from cache first
    const cachedResult = cacheService.get(cacheKey);
    if (cachedResult) {
      console.log('[ENACTED API] Returning cached result');
      return NextResponse.json(cachedResult);
    }

    console.log('[ENACTED API] Using optimized getAllEnactedLegislation service');

    const result = await getAllEnactedLegislation({
      limit,
      skip,
      sort,
      jurisdictionName: finalJurisdictionName,
      searchText
    });

    const response = {
      data: result.data,
      total: result.total,
      limit,
      skip,
      performance: {
        queryDuration: result.duration,
        cacheHit: false
      }
    };

    // Cache the result for 5 minutes (enacted status doesn't change frequently)
    cacheService.set(cacheKey, response, 5 * 60 * 1000);

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching enacted legislation:', error);
    return NextResponse.json(
      { message: 'Error fetching enacted legislation', error: (error as Error).message },
      { status: 500 }
    );
  }
}
