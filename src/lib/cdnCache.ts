import { NextResponse } from 'next/server';

export const CDN_CACHE = {
  homepage: 5 * 60,
  dashboard: 10 * 60,
  long: 60 * 60,
  static: 24 * 60 * 60,
} as const;

/**
 * Cache public, non-user-specific JSON at Vercel's CDN while forcing browsers
 * to revalidate. This avoids repeated Function invocations without persisting
 * stale responses in a user's browser cache.
 */
export function jsonWithCdnCache<T>(
  body: T,
  maxAgeSeconds: number = CDN_CACHE.dashboard,
  init?: ResponseInit,
) {
  const response = NextResponse.json(body, init);
  const staleWhileRevalidate = Math.max(maxAgeSeconds * 6, 60 * 60);

  response.headers.set('Cache-Control', 'public, max-age=0, must-revalidate');
  response.headers.set(
    'Vercel-CDN-Cache-Control',
    `public, max-age=${maxAgeSeconds}, stale-while-revalidate=${staleWhileRevalidate}`,
  );

  return response;
}
