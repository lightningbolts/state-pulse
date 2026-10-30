import { PHASE_PRODUCTION_BUILD } from 'next/constants';

/**
 * Prerendering runs at build time, where the database may be unreachable.
 * Fall back only during the build; at runtime rethrow so ISR keeps serving
 * the last good page instead of caching an empty one.
 */
export async function buildSafe<T>(load: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await load();
  } catch (error) {
    if (process.env.NEXT_PHASE !== PHASE_PRODUCTION_BUILD) throw error;
    console.warn('Prerender data unavailable at build time; using fallback.', error);
    return fallback;
  }
}
