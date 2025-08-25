/**
 * Rate limiting service for voting predictions
 */

interface RateLimitEntry {
  lastRequestTime: number;
  requestCount: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();

const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in milliseconds
const MAX_REQUESTS = 1; // 1 request per minute

/**
 * Check if a user/IP can make a prediction request
 */
export function checkRateLimit(identifier: string): { allowed: boolean; timeUntilReset?: number } {
  const now = Date.now();
  const entry = rateLimitStore.get(identifier);

  if (!entry) {
    // First request
    rateLimitStore.set(identifier, {
      lastRequestTime: now,
      requestCount: 1
    });
    return { allowed: true };
  }

  const timeSinceLastRequest = now - entry.lastRequestTime;

  if (timeSinceLastRequest >= RATE_LIMIT_WINDOW) {
    // Reset the window
    rateLimitStore.set(identifier, {
      lastRequestTime: now,
      requestCount: 1
    });
    return { allowed: true };
  }

  if (entry.requestCount >= MAX_REQUESTS) {
    const timeUntilReset = RATE_LIMIT_WINDOW - timeSinceLastRequest;
    return {
      allowed: false,
      timeUntilReset: Math.ceil(timeUntilReset / 1000) // Return seconds
    };
  }

  // Update the entry
  entry.requestCount += 1;
  entry.lastRequestTime = now;
  rateLimitStore.set(identifier, entry);

  return { allowed: true };
}

/**
 * Clean up old entries to prevent memory leaks
 * Should be called periodically
 */
export function cleanupRateLimitStore(): void {
  const now = Date.now();
  const cutoff = now - (RATE_LIMIT_WINDOW * 2); // Keep entries for 2x the window

  for (const [identifier, entry] of rateLimitStore.entries()) {
    if (entry.lastRequestTime < cutoff) {
      rateLimitStore.delete(identifier);
    }
  }
}

// Clean up old entries every 5 minutes
setInterval(cleanupRateLimitStore, 5 * 60 * 1000);
