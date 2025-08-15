/**
 * Performance Monitoring for Gerrymandering Analysis
 * 
 * Tracks:
 * - API response times
 * - Cache hit rates
 * - Memory usage
 * - Processing statistics
 */

interface PerformanceMetric {
  timestamp: number;
  endpoint: string;
  duration: number;
  cacheHit: boolean;
  districtCount: number;
  enhanced: boolean;
  memoryUsage?: {
    used: number;
    total: number;
  };
}

interface PerformanceStats {
  totalRequests: number;
  averageResponseTime: number;
  cacheHitRate: number;
  slowestEndpoint: string;
  fastestEndpoint: string;
  averageDistrictsProcessed: number;
  recentMetrics: PerformanceMetric[];
}

class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics: number = 1000; // Keep last 1000 requests
  
  /**
   * Record a performance metric
   */
  record(metric: Omit<PerformanceMetric, 'timestamp'>): void {
    const fullMetric: PerformanceMetric = {
      ...metric,
      timestamp: Date.now(),
      memoryUsage: this.getMemoryUsage()
    };
    
    this.metrics.push(fullMetric);
    
    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
    
    // Log slow requests
    if (metric.duration > 5000) {
      console.warn(`Slow request detected: ${metric.endpoint} took ${metric.duration}ms`);
    }
  }
  
  /**
   * Get current memory usage
   */
  private getMemoryUsage(): { used: number; total: number } | undefined {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      return {
        used: usage.heapUsed,
        total: usage.heapTotal
      };
    }
    return undefined;
  }
  
  /**
   * Get performance statistics
   */
  getStats(timeWindowMs?: number): PerformanceStats {
    let relevantMetrics = this.metrics;
    
    if (timeWindowMs) {
      const cutoff = Date.now() - timeWindowMs;
      relevantMetrics = this.metrics.filter(m => m.timestamp > cutoff);
    }
    
    if (relevantMetrics.length === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        cacheHitRate: 0,
        slowestEndpoint: '',
        fastestEndpoint: '',
        averageDistrictsProcessed: 0,
        recentMetrics: []
      };
    }
    
    const totalRequests = relevantMetrics.length;
    const averageResponseTime = relevantMetrics.reduce((sum, m) => sum + m.duration, 0) / totalRequests;
    const cacheHits = relevantMetrics.filter(m => m.cacheHit).length;
    const cacheHitRate = cacheHits / totalRequests;
    
    const sortedByDuration = [...relevantMetrics].sort((a, b) => a.duration - b.duration);
    const slowestEndpoint = sortedByDuration[sortedByDuration.length - 1]?.endpoint || '';
    const fastestEndpoint = sortedByDuration[0]?.endpoint || '';
    
    const averageDistrictsProcessed = relevantMetrics.reduce((sum, m) => sum + m.districtCount, 0) / totalRequests;
    
    return {
      totalRequests,
      averageResponseTime,
      cacheHitRate,
      slowestEndpoint,
      fastestEndpoint,
      averageDistrictsProcessed,
      recentMetrics: relevantMetrics.slice(-10) // Last 10 requests
    };
  }
  
  /**
   * Get performance summary for dashboard
   */
  getSummary(): any {
    const last24h = this.getStats(24 * 60 * 60 * 1000);
    const lastHour = this.getStats(60 * 60 * 1000);
    
    return {
      last24Hours: {
        requests: last24h.totalRequests,
        avgResponseTime: Math.round(last24h.averageResponseTime),
        cacheHitRate: Math.round(last24h.cacheHitRate * 100),
        avgDistricts: Math.round(last24h.averageDistrictsProcessed)
      },
      lastHour: {
        requests: lastHour.totalRequests,
        avgResponseTime: Math.round(lastHour.averageResponseTime),
        cacheHitRate: Math.round(lastHour.cacheHitRate * 100),
        avgDistricts: Math.round(lastHour.averageDistrictsProcessed)
      },
      status: this.getHealthStatus()
    };
  }
  
  /**
   * Get health status based on performance metrics
   */
  private getHealthStatus(): 'healthy' | 'warning' | 'critical' {
    const recent = this.getStats(5 * 60 * 1000); // Last 5 minutes
    
    if (recent.totalRequests === 0) return 'healthy';
    
    // Critical if average response time > 10 seconds or cache hit rate < 20%
    if (recent.averageResponseTime > 10000 || recent.cacheHitRate < 0.2) {
      return 'critical';
    }
    
    // Warning if average response time > 5 seconds or cache hit rate < 50%
    if (recent.averageResponseTime > 5000 || recent.cacheHitRate < 0.5) {
      return 'warning';
    }
    
    return 'healthy';
  }
  
  /**
   * Create performance middleware for timing requests
   */
  createTimer(endpoint: string) {
    const startTime = Date.now();
    
    return {
      end: (options: {
        cacheHit: boolean;
        districtCount: number;
        enhanced: boolean;
      }) => {
        const duration = Date.now() - startTime;
        this.record({
          endpoint,
          duration,
          ...options
        });
      }
    };
  }
  
  /**
   * Export metrics for external monitoring (e.g., DataDog, New Relic)
   */
  exportMetrics(): PerformanceMetric[] {
    return [...this.metrics];
  }
  
  /**
   * Clear old metrics
   */
  clearMetrics(olderThanMs?: number): void {
    if (olderThanMs) {
      const cutoff = Date.now() - olderThanMs;
      this.metrics = this.metrics.filter(m => m.timestamp > cutoff);
    } else {
      this.metrics = [];
    }
  }
}

// Global performance monitor instance
const performanceMonitor = new PerformanceMonitor();

export default performanceMonitor;
