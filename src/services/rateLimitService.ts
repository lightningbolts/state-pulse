/**
 * Rate limiting service for API requests
 */

import { getCollection } from '@/lib/mongodb';

interface RateLimitEntry {
  _id?: any;
  identifier: string;
  lastRequestTime: Date;
  requestCount: number;
  expiresAt: Date;
}

// Fallback in-memory store for when DB is unavailable
const rateLimitStore = new Map<string, { lastRequestTime: number; requestCount: number }>();

// Default rate limits (voting predictions)
const DEFAULT_RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in milliseconds
const DEFAULT_MAX_REQUESTS = 1; // 1 request per minute

// Rate limits for detailed summaries (more restrictive)
const DETAILED_SUMMARY_RATE_LIMIT_WINDOW = 5 * 60 * 1000; // 5 minutes in milliseconds
const DETAILED_SUMMARY_MAX_REQUESTS = 1; // 1 request per 5 minutes

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
}

function getRateLimitConfig(identifier: string): RateLimitConfig {
  // Check if this is a detailed summary request
  if (identifier.includes('detailed_summary')) {
    return {
      windowMs: DETAILED_SUMMARY_RATE_LIMIT_WINDOW,
      maxRequests: DETAILED_SUMMARY_MAX_REQUESTS
    };
  }
  
  // Default config for predictions and other requests
  return {
    windowMs: DEFAULT_RATE_LIMIT_WINDOW,
    maxRequests: DEFAULT_MAX_REQUESTS
  };
}

/**
 * Check if a user/IP can make a request using database-backed rate limiting
 */
export async function checkRateLimit(identifier: string): Promise<{ allowed: boolean; timeUntilReset?: number }> {
  const now = new Date();
  const config = getRateLimitConfig(identifier);

  try {
    const collection = await getCollection('rateLimits');
    
    // Find existing rate limit entry
    let entry = await collection.findOne({ identifier }) as RateLimitEntry | null;

    if (!entry) {
      // First request - create new entry
      const expiresAt = new Date(now.getTime() + config.windowMs);
      await collection.insertOne({
        identifier,
        lastRequestTime: now,
        requestCount: 1,
        expiresAt
      });
      return { allowed: true };
    }

    const timeSinceLastRequest = now.getTime() - entry.lastRequestTime.getTime();

    if (timeSinceLastRequest >= config.windowMs) {
      // Reset the window
      const expiresAt = new Date(now.getTime() + config.windowMs);
      await collection.updateOne(
        { identifier },
        {
          $set: {
            lastRequestTime: now,
            requestCount: 1,
            expiresAt
          }
        }
      );
      return { allowed: true };
    }

    if (entry.requestCount >= config.maxRequests) {
      const timeUntilReset = config.windowMs - timeSinceLastRequest;
      return {
        allowed: false,
        timeUntilReset: Math.ceil(timeUntilReset / 1000) // Return seconds
      };
    }

    // Update the entry
    await collection.updateOne(
      { identifier },
      {
        $set: {
          lastRequestTime: now,
          requestCount: entry.requestCount + 1
        }
      }
    );

    return { allowed: true };

  } catch (error) {
    console.error('Database rate limit check failed, falling back to in-memory:', error);
    // Fallback to in-memory rate limiting if database is unavailable
    return checkRateLimitInMemory(identifier);
  }
}

/**
 * Fallback in-memory rate limiting when database is unavailable
 */
function checkRateLimitInMemory(identifier: string): { allowed: boolean; timeUntilReset?: number } {
  const now = Date.now();
  const config = getRateLimitConfig(identifier);
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

  if (timeSinceLastRequest >= config.windowMs) {
    // Reset the window
    rateLimitStore.set(identifier, {
      lastRequestTime: now,
      requestCount: 1
    });
    return { allowed: true };
  }

  if (entry.requestCount >= config.maxRequests) {
    const timeUntilReset = config.windowMs - timeSinceLastRequest;
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
  const cutoff = now - (DETAILED_SUMMARY_RATE_LIMIT_WINDOW * 2); // Keep entries for 2x the longest window

  for (const [identifier, entry] of rateLimitStore.entries()) {
    if (entry.lastRequestTime < cutoff) {
      rateLimitStore.delete(identifier);
    }
  }
}

/**
 * Initialize rate limit collection with TTL index for automatic cleanup
 */
export async function initializeRateLimitCollection(): Promise<void> {
  try {
    const collection = await getCollection('rateLimits');
    
    // Create TTL index for automatic cleanup of expired entries
    await collection.createIndex(
      { "expiresAt": 1 },
      { 
        expireAfterSeconds: 0,
        name: "rateLimitTTL"
      }
    );
    
    console.log('[Rate Limit] TTL index created for rateLimits collection');
  } catch (error) {
    console.error('[Rate Limit] Failed to create TTL index:', error);
  }
}

// Clean up old entries every 5 minutes for in-memory fallback
setInterval(cleanupRateLimitStore, 5 * 60 * 1000);
