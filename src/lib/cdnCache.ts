import { NextResponse } from 'next/server';

/** CDN TTLs in seconds. Tuned so public data stays fresh without extra origin hits. */
export const CACHE = {
  /** Search/list endpoints that change often */
  list: 60,
  /** Homepage, feeds, civic lookups */
  medium: 300,
  /** Dashboard aggregations */
  long: 600,
  /** Slow-changing derived data */
  hour: 3600,
  /** Boundaries, OG images, census-derived stats */
  day: 86400,
} as const;

export function cdnCacheHeaders(sMaxAge: number, swr?: number): Record<string, string> {
  const staleWhileRevalidate = swr ?? Math.max(sMaxAge * 2, 60);
  const value = `public, s-maxage=${sMaxAge}, stale-while-revalidate=${staleWhileRevalidate}`;
  return {
    'Cache-Control': value,
    'CDN-Cache-Control': value,
    // Next.js may overwrite Cache-Control on dynamic routes; Vercel honors this one.
    'Vercel-CDN-Cache-Control': value,
  };
}

export function jsonWithCdnCache(
  data: unknown,
  sMaxAge: number,
  init?: { status?: number; swr?: number },
) {
  const status = init?.status ?? 200;
  if (status !== 200 || sMaxAge <= 0) {
    return NextResponse.json(data, { status });
  }
  return NextResponse.json(data, {
    status,
    headers: cdnCacheHeaders(sMaxAge, init?.swr),
  });
}

export function withCdnCache(response: NextResponse, sMaxAge: number, swr?: number): NextResponse {
  if (sMaxAge > 0 && response.status === 200) {
    for (const [key, value] of Object.entries(cdnCacheHeaders(sMaxAge, swr))) {
      response.headers.set(key, value);
    }
  }
  return response;
}
