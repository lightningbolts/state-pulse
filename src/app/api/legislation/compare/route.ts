import { NextRequest, NextResponse } from 'next/server';
import { getComparisonCandidates } from '@/services/stateLegislationComparisonService';

const CACHE_TTL = 5 * 60 * 1000;
const cache = new Map<string, { data: unknown; timestamp: number }>();

const RATE_LIMIT_WINDOW = 60 * 1000;
const RATE_LIMIT_MAX = 10;
const rateLimits = new Map<string, { count: number; resetAt: number }>();

function getClientId(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'anonymous'
  );
}

function checkRateLimit(clientId: string): boolean {
  const now = Date.now();
  const entry = rateLimits.get(clientId);

  if (!entry || now >= entry.resetAt) {
    rateLimits.set(clientId, { count: 1, resetAt: now + RATE_LIMIT_WINDOW });
    return true;
  }

  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count += 1;
  return true;
}

export async function GET(request: NextRequest) {
  try {
    const clientId = getClientId(request);
    if (!checkRateLimit(clientId)) {
      return NextResponse.json(
        { message: 'Rate limit exceeded. Try again in a minute.' },
        { status: 429 },
      );
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const enactedOnly = searchParams.get('enactedOnly') === 'true';
    const showCongress = searchParams.get('showCongress') === 'true';

    if (!q.trim()) {
      return NextResponse.json(
        { message: 'Query parameter "q" is required.' },
        { status: 400 },
      );
    }

    const cacheKey = `${q}|${enactedOnly}|${showCongress}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data, { status: 200 });
    }

    const result = await getComparisonCandidates(q, { enactedOnly, showCongress });
    cache.set(cacheKey, { data: result, timestamp: Date.now() });

    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Error in legislation compare API:', error);
    return NextResponse.json(
      { message: 'Error fetching comparison candidates', error: (error as Error).message },
      { status: 500 },
    );
  }
}
