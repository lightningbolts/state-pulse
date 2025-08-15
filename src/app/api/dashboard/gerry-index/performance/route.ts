import { NextRequest, NextResponse } from 'next/server';
import cacheService from '@/lib/cache-service';
import performanceMonitor from '@/lib/performance-monitor';

/**
 * Performance Dashboard API
 * GET /api/dashboard/gerry-index/performance
 * 
 * Provides real-time performance metrics and cache statistics
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const detailed = searchParams.get('detailed') === 'true';
    const timeWindow = searchParams.get('timeWindow'); // e.g., "1h", "24h", "7d"
    
    // Convert time window to milliseconds
    let timeWindowMs: number | undefined;
    if (timeWindow) {
      const timeMap: Record<string, number> = {
        '1h': 60 * 60 * 1000,
        '24h': 24 * 60 * 60 * 1000,
        '7d': 7 * 24 * 60 * 60 * 1000,
        '30d': 30 * 24 * 60 * 60 * 1000
      };
      timeWindowMs = timeMap[timeWindow];
    }
    
    // Get performance statistics
    const performanceStats = performanceMonitor.getStats(timeWindowMs);
    const performanceSummary = performanceMonitor.getSummary();
    
    // Get cache statistics
    const cacheStats = cacheService.getStats();
    
    // Basic response
    const response: any = {
      timestamp: new Date().toISOString(),
      status: performanceSummary.status,
      cache: {
        hitRate: Math.round(cacheStats.hitRate * 100),
        entries: cacheStats.entries,
        sizeBytes: cacheStats.size,
        sizeMB: Math.round(cacheStats.size / (1024 * 1024) * 100) / 100
      },
      performance: {
        totalRequests: performanceStats.totalRequests,
        averageResponseTime: Math.round(performanceStats.averageResponseTime),
        cacheHitRate: Math.round(performanceStats.cacheHitRate * 100),
        averageDistrictsProcessed: Math.round(performanceStats.averageDistrictsProcessed)
      },
      health: {
        status: performanceSummary.status,
        lastHour: performanceSummary.lastHour,
        last24Hours: performanceSummary.last24Hours
      }
    };
    
    // Add detailed information if requested
    if (detailed) {
      response.detailed = {
        recentRequests: performanceStats.recentMetrics.map(metric => ({
          timestamp: new Date(metric.timestamp).toISOString(),
          endpoint: metric.endpoint,
          duration: metric.duration,
          cacheHit: metric.cacheHit,
          districtCount: metric.districtCount,
          enhanced: metric.enhanced,
          memoryUsageMB: metric.memoryUsage ? {
            used: Math.round(metric.memoryUsage.used / (1024 * 1024) * 100) / 100,
            total: Math.round(metric.memoryUsage.total / (1024 * 1024) * 100) / 100
          } : null
        })),
        cacheKeys: cacheService.getKeys(),
        performanceBreakdown: {
          slowestEndpoint: performanceStats.slowestEndpoint,
          fastestEndpoint: performanceStats.fastestEndpoint,
          distributionByType: getDistributionByType(performanceStats.recentMetrics)
        }
      };
    }
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Performance dashboard error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}

/**
 * Cache management endpoints
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const key = searchParams.get('key');
    
    switch (action) {
      case 'clear':
        cacheService.clear();
        return NextResponse.json({ 
          success: true, 
          message: 'Cache cleared successfully' 
        });
        
      case 'delete':
        if (!key) {
          return NextResponse.json({ 
            error: 'Key parameter required for delete action' 
          }, { status: 400 });
        }
        
        const deleted = cacheService.delete(key);
        return NextResponse.json({ 
          success: deleted, 
          message: deleted ? `Key '${key}' deleted` : `Key '${key}' not found` 
        });
        
      case 'cleanup':
        cacheService.cleanup();
        return NextResponse.json({ 
          success: true, 
          message: 'Cache cleanup completed' 
        });
        
      default:
        return NextResponse.json({ 
          error: 'Invalid action. Use: clear, delete, or cleanup' 
        }, { status: 400 });
    }
    
  } catch (error) {
    console.error('Cache management error:', error);
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 });
  }
}

/**
 * Analyze performance distribution by district type
 */
function getDistributionByType(metrics: any[]): Record<string, any> {
  const distribution: Record<string, {
    count: number;
    avgResponseTime: number;
    avgDistricts: number;
    cacheHitRate: number;
  }> = {};
  
  for (const metric of metrics) {
    const type = metric.endpoint.includes('congressional') ? 'congressional' :
                 metric.endpoint.includes('state-upper') ? 'state-upper' :
                 metric.endpoint.includes('state-lower') ? 'state-lower' : 'unknown';
    
    if (!distribution[type]) {
      distribution[type] = {
        count: 0,
        avgResponseTime: 0,
        avgDistricts: 0,
        cacheHitRate: 0
      };
    }
    
    distribution[type].count++;
    distribution[type].avgResponseTime += metric.duration;
    distribution[type].avgDistricts += metric.districtCount;
    distribution[type].cacheHitRate += metric.cacheHit ? 1 : 0;
  }
  
  // Calculate averages
  for (const type in distribution) {
    const data = distribution[type];
    if (data.count > 0) {
      data.avgResponseTime = Math.round(data.avgResponseTime / data.count);
      data.avgDistricts = Math.round(data.avgDistricts / data.count);
      data.cacheHitRate = Math.round((data.cacheHitRate / data.count) * 100);
    }
  }
  
  return distribution;
}
