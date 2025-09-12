import { NextRequest, NextResponse } from 'next/server';
import { searchLegislationByTopic } from '@/services/legislationService';

/**
 * @deprecated This endpoint is deprecated. Use /api/legislation with search parameter instead.
 * 
 * Migration:
 * OLD: GET /api/search-legislation-by-topic?topic=environmental+protection
 * NEW: GET /api/legislation?search=environmental+protection&sortBy=latestActionAt&sortDir=desc
 * 
 * The new endpoint provides the same functionality with better performance and consistency.
 */
export async function GET(req: NextRequest) {
  // DEPRECATION WARNING: This endpoint is deprecated. Use /api/legislation?search=topic instead
  console.warn('DEPRECATED: /api/search-legislation-by-topic is deprecated. Use /api/legislation?search=topic instead');
  
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

    // Parse additional filtering parameters similar to main legislation endpoint
    const otherFilters: Record<string, any> = {};
    
    // Parse pagination parameters
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit') || '100', 10) : 100;
    const skip = searchParams.get('skip') ? parseInt(searchParams.get('skip') || '0', 10) : 0;

    // Parse sorting parameters
    const sortField = searchParams.get('sortBy');
    const sortDirection = searchParams.get('sortDir');

    let sort: Record<string, 1 | -1>;
    if (sortField) {
      sort = { [sortField]: sortDirection === 'asc' ? 1 : -1 };
    } else {
      sort = { latestActionAt: -1, updatedAt: -1 };
    }

    // Handle Congress vs State filtering
    const showCongressParam = searchParams.get('showCongress');
    const stateParamForCongress = searchParams.get('state');
    const stateAbbrParamForCongress = searchParams.get('stateAbbr');
    const isCongress = (
      showCongressParam === 'true' ||
      (stateParamForCongress && stateParamForCongress.toLowerCase() === 'united states congress') ||
      (stateAbbrParamForCongress && stateAbbrParamForCongress.toUpperCase() === 'US')
    );

    if (isCongress) {
      otherFilters.jurisdictionName = 'United States Congress';
    } else if (searchParams.get('jurisdictionName')) {
      otherFilters.jurisdictionName = searchParams.get('jurisdictionName');
    }

    // Additional filters
    if (searchParams.get('session')) {
      otherFilters.session = searchParams.get('session');
    }
    if (searchParams.get('chamber')) {
      otherFilters.chamber = searchParams.get('chamber');
    }
    if (searchParams.get('classification')) {
      otherFilters.classification = searchParams.get('classification');
    }
    if (searchParams.get('subject')) {
      otherFilters.subjects = searchParams.get('subject');
    }

    const legislation = await searchLegislationByTopic(topic, {
      daysBack,
      limit,
      skip,
      sort,
      filters: otherFilters,
      showCongress: showCongressParam === 'true'
    });

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
