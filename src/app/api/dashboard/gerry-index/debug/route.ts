import { NextRequest, NextResponse } from 'next/server';

/**
 * Diagnostic endpoint to check file accessibility in production
 * GET /api/dashboard/gerry-index/debug
 */
export async function GET(request: NextRequest) {
  try {
    const results: any = {
      environment: process.env.NODE_ENV,
      isVercel: process.env.VERCEL === '1' || !!process.env.VERCEL_ENV,
      vercelEnv: process.env.VERCEL_ENV,
      host: request.headers.get('host'),
      protocol: request.headers.get('x-forwarded-proto') || 'http',
      timestamp: new Date().toISOString(),
      tests: {}
    };

    // Test 1: File system access (skip in Vercel)
    if (results.isVercel) {
      results.tests.filesystem = {
        skipped: true,
        reason: 'Vercel serverless environment - filesystem access not available'
      };
    } else {
      try {
        const fs = await import('fs/promises');
        const path = await import('path');
        const fullPath = path.join(process.cwd(), 'public', '/districts/congressional-districts.geojson');
        
        const stats = await fs.stat(fullPath);
        results.tests.filesystem = {
          success: true,
          path: fullPath,
          size: stats.size,
          modified: stats.mtime
        };
      } catch (fsError) {
        results.tests.filesystem = {
          success: false,
          error: fsError instanceof Error ? fsError.message : String(fsError)
        };
      }
    }

    // Test 2: HTTP access
    try {
      const protocol = request.headers.get('x-forwarded-proto') || 
                      (request.url.includes('localhost') ? 'http' : 'https');
      const host = request.headers.get('host') || 'localhost:3000';
      const baseUrl = `${protocol}://${host}`;
      const fileUrl = `${baseUrl}/districts/congressional-districts.geojson`;
      
      const response = await fetch(fileUrl, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'StatePulse-Diagnostic/1.0'
        }
      });
      
      if (response.ok) {
        const content = await response.text();
        const parsed = JSON.parse(content);
        results.tests.http = {
          success: true,
          url: fileUrl,
          status: response.status,
          contentLength: content.length,
          featuresCount: parsed.features?.length || 0,
          headers: {
            contentType: response.headers.get('content-type'),
            cacheControl: response.headers.get('cache-control')
          }
        };
      } else {
        results.tests.http = {
          success: false,
          url: fileUrl,
          status: response.status,
          statusText: response.statusText
        };
      }
    } catch (httpError) {
      results.tests.http = {
        success: false,
        error: httpError instanceof Error ? httpError.message : String(httpError)
      };
    }

    // Test 3: Process info
    results.process = {
      cwd: process.cwd(),
      platform: process.platform,
      nodeVersion: process.version
    };

    return NextResponse.json(results);
    
  } catch (error) {
    return NextResponse.json({ 
      error: 'Diagnostic test failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
