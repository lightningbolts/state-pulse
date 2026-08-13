import { NextRequest, NextResponse } from 'next/server';
import {
  fetchRandomExamplesFromDb,
  getCachedHomepageExamples,
} from '@/lib/homepageExamplesService';
import { CACHE, jsonWithCdnCache } from '@/lib/cdnCache';

export async function GET(request: NextRequest) {
  try {
    const fresh = request.nextUrl.searchParams.get('fresh') === '1';
    const data = fresh ? await fetchRandomExamplesFromDb() : await getCachedHomepageExamples();

    return jsonWithCdnCache(
      { success: true, data },
      fresh ? 0 : CACHE.medium,
    );
  } catch (error) {
    console.error('Error fetching random examples:', error);
    return NextResponse.json(
      {
        success: false,
        message: 'Error fetching random examples',
        error: (error as Error).message,
        data: {
          legislation: null,
          representative: null,
        },
      },
      { status: 500 },
    );
  }
}
