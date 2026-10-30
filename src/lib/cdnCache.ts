import { NextResponse } from 'next/server';

export const CDN_CACHE = {
  homepage: 5 * 60,
  dashboard: 10 * 60,
  long: 60 * 60,
  static: 24 * 60 * 60,
} as const;

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

/**
 * Cache public, non-user-specific responses at Vercel's CDN while forcing browsers
 * to revalidate. This avoids repeated Function invocations without persisting
 * stale responses in a user's browser cache.
 */
export function cdnCacheHeaders(maxAgeSeconds: number, swr?: number): Record<string, string> {
  const staleWhileRevalidate = swr ?? Math.max(maxAgeSeconds * 6, 60 * 60);
  return {
    'Cache-Control': 'public, max-age=0, must-revalidate',
    'Vercel-CDN-Cache-Control': `public, max-age=${maxAgeSeconds}, stale-while-revalidate=${staleWhileRevalidate}`,
  };
}

export function withCdnCache(response: NextResponse, maxAgeSeconds: number, swr?: number): NextResponse {
  // Never pin errors at the CDN.
  if (maxAgeSeconds > 0 && response.status === 200) {
    for (const [key, value] of Object.entries(cdnCacheHeaders(maxAgeSeconds, swr))) {
      response.headers.set(key, value);
    }
  }
  return response;
}

export function jsonWithCdnCache<T>(
  body: T,
  maxAgeSeconds: number = CDN_CACHE.dashboard,
  init?: ResponseInit & { swr?: number },
) {
  const { swr, ...responseInit } = init ?? {};
  return withCdnCache(NextResponse.json(body, responseInit), maxAgeSeconds, swr);
}
