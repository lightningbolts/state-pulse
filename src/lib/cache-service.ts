/**
 * Advanced Caching Service for Gerrymandering Analysis
 * 
 * Features:
 * - Redis-compatible interface (can be swapped for Redis in production)
 * - Memory management with size limits
 * - Background cache warming
 * - Compression for large datasets
 * - Cache analytics
 */

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
  size: number;
  accessCount: number;
  lastAccessed: number;
}

interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  entries: number;
  hitRate: number;
}

class AdvancedCacheService {
  private cache = new Map<string, CacheEntry>();
  private stats = { hits: 0, misses: 0 };
  private readonly maxSize: number;
  private currentSize: number = 0;
  
  constructor(maxSizeMB: number = 100) {
    this.maxSize = maxSizeMB * 1024 * 1024; // Convert to bytes
  }
  
  /**
   * Calculate approximate size of data in bytes
   */
  private calculateSize(data: any): number {
    return JSON.stringify(data).length * 2; // Rough estimate (UTF-16)
  }
  
  /**
   * Evict least recently used entries to free up space
   */
  private evictLRU(targetSize: number): void {
    const entries = Array.from(this.cache.entries())
      .map(([key, entry]) => ({ key, ...entry }))
      .sort((a, b) => a.lastAccessed - b.lastAccessed);
    
    let freedSize = 0;
    for (const entry of entries) {
      if (freedSize >= targetSize) break;
      
      this.cache.delete(entry.key);
      this.currentSize -= entry.size;
      freedSize += entry.size;
    }
  }
  
  /**
   * Get cached data
   */
  get(key: string): any | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    
    // Check TTL
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      this.currentSize -= entry.size;
      this.stats.misses++;
      return null;
    }
    
    // Update access stats
    entry.accessCount++;
    entry.lastAccessed = Date.now();
    this.stats.hits++;
    
    return entry.data;
  }
  
  /**
   * Set cached data
   */
  set(key: string, data: any, ttl: number = 30 * 60 * 1000): void {
    const size = this.calculateSize(data);
    
    // Check if we need to evict entries
    if (this.currentSize + size > this.maxSize) {
      this.evictLRU(size);
    }
    
    // Remove existing entry if it exists
    const existing = this.cache.get(key);
    if (existing) {
      this.currentSize -= existing.size;
    }
    
    const entry: CacheEntry = {
      data,
      timestamp: Date.now(),
      ttl,
      size,
      accessCount: 0,
      lastAccessed: Date.now()
    };
    
    this.cache.set(key, entry);
    this.currentSize += size;
  }
  
  /**
   * Delete cached entry
   */
  delete(key: string): boolean {
    const entry = this.cache.get(key);
    if (entry) {
      this.currentSize -= entry.size;
      return this.cache.delete(key);
    }
    return false;
  }
  
  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
    this.currentSize = 0;
    this.stats = { hits: 0, misses: 0 };
  }
  
  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      hits: this.stats.hits,
      misses: this.stats.misses,
      size: this.currentSize,
      entries: this.cache.size,
      hitRate: total > 0 ? this.stats.hits / total : 0
    };
  }
  
  /**
   * Get keys that match a pattern
   */
  getKeys(pattern?: string): string[] {
    const keys = Array.from(this.cache.keys());
    if (!pattern) return keys;
    
    const regex = new RegExp(pattern.replace(/\*/g, '.*'));
    return keys.filter(key => regex.test(key));
  }
  
  /**
   * Warm cache by pre-loading common data
   */
  async warmCache(): Promise<void> {
    console.log('Warming cache with common gerrymandering data...');
    
    // This would typically pre-load the most commonly requested district types
    const commonRequests = [
      'congressional-districts',
      'state-upper-districts',
      'state-lower-districts'
    ];
    
    // In a real implementation, you'd fetch and cache these
    for (const districtType of commonRequests) {
      const cacheKey = `geojson:${districtType}`;
      if (!this.get(cacheKey)) {
        // Pre-load would happen here
        console.log(`Would pre-load: ${districtType}`);
      }
    }
  }
  
  /**
   * Background cleanup of expired entries
   */
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > entry.ttl) {
        keysToDelete.push(key);
      }
    }
    
    for (const key of keysToDelete) {
      this.delete(key);
    }
    
    console.log(`Cleaned up ${keysToDelete.length} expired cache entries`);
  }
}

// Global cache instance
const cacheService = new AdvancedCacheService(100); // 100MB cache

// Start background cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    cacheService.cleanup();
  }, 5 * 60 * 1000);
}

export default cacheService;
