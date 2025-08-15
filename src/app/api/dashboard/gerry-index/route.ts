import { NextRequest, NextResponse } from 'next/server';
import { area } from '@turf/area';
import { length } from '@turf/length';
import { polygonToLine } from '@turf/polygon-to-line';
import { convex } from '@turf/convex';
import { bbox } from '@turf/bbox';
import { booleanContains } from '@turf/boolean-contains';
import { buffer } from '@turf/buffer';

/**
 * Enhanced Polsby-Popper calculation that accounts for geographic constraints
 * Includes adjustments for coastlines, state borders, and natural boundaries
 */

interface CompactnessResult {
  polsbyPopper: number;
  convexHullRatio: number;
  boundaryContext: {
    hasCoastline: boolean;
    hasBorder: boolean;
    naturalBoundaryPercentage: number;
  };
  adjustedScore: number;
}

/**
 * Calculate basic Polsby-Popper compactness score
 * Formula: PP(D) = 4π * Area(D) / Perimeter(D)²
 */
function calculatePolsbyPopperScore(polygon: any): number {
  try {
    const polygonArea = area(polygon);
    const perimeter = polygonToLine(polygon);
    
    let totalPerimeter = 0;
    if (perimeter.type === 'FeatureCollection') {
      for (const feature of perimeter.features) {
        totalPerimeter += length(feature, { units: 'meters' });
      }
    } else {
      totalPerimeter = length(perimeter, { units: 'meters' });
    }
    
    if (totalPerimeter === 0) return 0;
    const score = (4 * Math.PI * polygonArea) / Math.pow(totalPerimeter, 2);
    return Math.min(Math.max(score, 0), 1);
  } catch (error) {
    console.error('Error calculating Polsby-Popper score:', error);
    return 0;
  }
}

/**
 * Calculate convex hull ratio (district area / convex hull area)
 * More tolerant of irregular shapes caused by natural boundaries
 */
function calculateConvexHullRatio(polygon: any): number {
  try {
    const polygonArea = area(polygon);
    const hull = convex(polygon);
    
    if (!hull) return 0;
    const hullArea = area(hull);
    
    if (hullArea === 0) return 0;
    return polygonArea / hullArea;
  } catch (error) {
    console.error('Error calculating convex hull ratio:', error);
    return 0;
  }
}

/**
 * Detect if district likely has coastline or natural boundaries
 * Uses heuristics based on shape characteristics and geographic context
 */
function analyzeGeographicContext(polygon: any, allDistricts: any[]): any {
  try {
    const districtBbox = bbox(polygon);
    const [minX, minY, maxX, maxY] = districtBbox;
    
    // Heuristics for coastline detection:
    // 1. Very elongated districts near water
    // 2. Districts with highly irregular perimeters
    // 3. Districts at the edge of the dataset (likely coastal states)
    
    const width = maxX - minX;
    const height = maxY - minY;
    const aspectRatio = Math.max(width, height) / Math.min(width, height);
    
    // Check if district is at dataset boundary (likely coastal)
    const globalBbox = bbox({
      type: 'FeatureCollection',
      features: allDistricts
    });
    
    const [globalMinX, globalMinY, globalMaxX, globalMaxY] = globalBbox;
    const tolerance = 0.01; // Degree tolerance for edge detection
    
    const isAtBoundary = (
      Math.abs(minX - globalMinX) < tolerance ||
      Math.abs(maxX - globalMaxX) < tolerance ||
      Math.abs(minY - globalMinY) < tolerance ||
      Math.abs(maxY - globalMaxY) < tolerance
    );
    
    // Calculate perimeter complexity (indicator of natural boundaries)
    const perimeter = polygonToLine(polygon);
    let totalPerimeter = 0;
    if (perimeter.type === 'FeatureCollection') {
      for (const feature of perimeter.features) {
        totalPerimeter += length(feature, { units: 'meters' });
      }
    } else {
      totalPerimeter = length(perimeter, { units: 'meters' });
    }
    
    const polygonArea = area(polygon);
    const perimeterToAreaRatio = totalPerimeter / Math.sqrt(polygonArea);
    
    // Estimate natural boundary percentage
    let naturalBoundaryPercentage = 0;
    if (isAtBoundary) naturalBoundaryPercentage += 0.3;
    if (aspectRatio > 3) naturalBoundaryPercentage += 0.2;
    if (perimeterToAreaRatio > 0.1) naturalBoundaryPercentage += 0.2;
    
    return {
      hasCoastline: isAtBoundary && (aspectRatio > 2 || perimeterToAreaRatio > 0.08),
      hasBorder: isAtBoundary,
      naturalBoundaryPercentage: Math.min(naturalBoundaryPercentage, 1.0),
      aspectRatio,
      perimeterToAreaRatio,
      isAtBoundary
    };
  } catch (error) {
    console.error('Error analyzing geographic context:', error);
    return {
      hasCoastline: false,
      hasBorder: false,
      naturalBoundaryPercentage: 0,
      aspectRatio: 1,
      perimeterToAreaRatio: 0,
      isAtBoundary: false
    };
  }
}

/**
 * Calculate enhanced compactness score with geographic adjustments
 */
function calculateEnhancedCompactness(polygon: any, allDistricts: any[]): CompactnessResult {
  const polsbyPopper = calculatePolsbyPopperScore(polygon);
  const convexHullRatio = calculateConvexHullRatio(polygon);
  const context = analyzeGeographicContext(polygon, allDistricts);
  
  // Adjust score based on geographic constraints
  let adjustedScore = polsbyPopper;
  
  // Apply adjustments for natural boundaries
  if (context.hasCoastline) {
    // Coastal districts get a bonus to account for irregular coastlines
    adjustedScore = adjustedScore + (0.1 * (1 - adjustedScore));
  }
  
  if (context.hasBorder && !context.hasCoastline) {
    // Border districts (non-coastal) get a smaller adjustment
    adjustedScore = adjustedScore + (0.05 * (1 - adjustedScore));
  }
  
  // Use convex hull ratio as additional factor for very irregular shapes
  if (convexHullRatio > 0 && convexHullRatio < 0.5) {
    // Very irregular shape might indicate natural boundaries
    const irregularityBonus = 0.05 * context.naturalBoundaryPercentage;
    adjustedScore = adjustedScore + (irregularityBonus * (1 - adjustedScore));
  }
  
  // Ensure adjusted score doesn't exceed 1
  adjustedScore = Math.min(adjustedScore, 1.0);
  
  return {
    polsbyPopper,
    convexHullRatio,
    boundaryContext: {
      hasCoastline: context.hasCoastline,
      hasBorder: context.hasBorder,
      naturalBoundaryPercentage: context.naturalBoundaryPercentage
    },
    adjustedScore
  };
}
/**
 * Calculate gerrymandering index for districts with geographic context
 * GET /api/dashboard/gerry-index?type=congressional-districts|state-upper-districts|state-lower-districts
 * 
 * Query parameters:
 * - type: District type (required)
 * - enhanced: Use enhanced calculation with geographic adjustments (default: true)
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const districtType = searchParams.get('type');
    const useEnhanced = searchParams.get('enhanced') !== 'false'; // Default to true
    
    if (!districtType) {
      return NextResponse.json({ 
        error: 'District type parameter is required' 
      }, { status: 400 });
    }
    
    // Map district type to GeoJSON file path
    const districtFiles: Record<string, string> = {
      'congressional-districts': '/districts/congressional-districts.geojson',
      'state-upper-districts': '/districts/state-upper-districts.geojson',
      'state-lower-districts': '/districts/state-lower-districts.geojson',
    };
    
    const filePath = districtFiles[districtType];
    if (!filePath) {
      return NextResponse.json({ 
        error: 'Invalid district type' 
      }, { status: 400 });
    }
    
    // Load the GeoJSON file from public directory
    // Handle both local development and production environments
    let geoJsonData;
    const isVercel = process.env.VERCEL === '1' || process.env.VERCEL_ENV;
    
    if (isVercel) {
      // Skip filesystem attempt in Vercel - go straight to HTTP fetch
      console.log('Vercel environment detected, using HTTP fetch for GeoJSON');
      try {
        const protocol = request.headers.get('x-forwarded-proto') || 'https';
        const host = request.headers.get('host') || 'localhost:3000';
        const baseUrl = `${protocol}://${host}`;
        
        const fileUrl = `${baseUrl}${filePath}`;
        console.log('Fetching GeoJSON from:', fileUrl);
        
        const response = await fetch(fileUrl, {
          headers: {
            'Accept': 'application/json',
            'User-Agent': 'StatePulse-API/1.0'
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const fileContent = await response.text();
        geoJsonData = JSON.parse(fileContent);
        console.log('Successfully fetched GeoJSON via HTTP');
      } catch (httpError) {
        console.error('HTTP fetch failed:', httpError);
        return NextResponse.json({ 
          error: 'District data file not found in Vercel deployment.',
          details: {
            attemptedPath: filePath,
            environment: 'vercel',
            host: request.headers.get('host'),
            error: httpError instanceof Error ? httpError.message : String(httpError)
          }
        }, { status: 404 });
      }
    } else {
      // Local development or other environments - try filesystem first, then HTTP fallback
      try {
        const fs = await import('fs/promises');
        const path = await import('path');
        const fullPath = path.join(process.cwd(), 'public', filePath);
        
        const fileContent = await fs.readFile(fullPath, 'utf-8');
        geoJsonData = JSON.parse(fileContent);
      } catch (fileError) {
        console.error('File system access failed, trying HTTP fetch:', fileError);
        
        try {
          const protocol = request.headers.get('x-forwarded-proto') || 
                          (request.url.includes('localhost') ? 'http' : 'https');
          const host = request.headers.get('host') || 'localhost:3000';
          const baseUrl = `${protocol}://${host}`;
          
          const fileUrl = `${baseUrl}${filePath}`;
          console.log('Attempting to fetch GeoJSON from:', fileUrl);
          
          const response = await fetch(fileUrl, {
            headers: {
              'Accept': 'application/json',
              'User-Agent': 'StatePulse-API/1.0'
            }
          });
          
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          
          const fileContent = await response.text();
          geoJsonData = JSON.parse(fileContent);
          console.log('Successfully fetched GeoJSON via HTTP');
        } catch (httpError) {
          console.error('HTTP fetch also failed:', httpError);
          return NextResponse.json({ 
            error: 'District data file not found. GeoJSON files may not be properly deployed.',
            details: {
              attemptedPath: filePath,
              environment: process.env.NODE_ENV,
              host: request.headers.get('host'),
              fsError: fileError instanceof Error ? fileError.message : String(fileError),
              httpError: httpError instanceof Error ? httpError.message : String(httpError)
            }
          }, { status: 404 });
        }
      }
    }
    
    // Calculate compactness scores for each district
    const gerryIndex: Record<string, number> = {};
    const detailedResults: Record<string, CompactnessResult> = {};
    const allFeatures = geoJsonData.features || [];
    
    if (allFeatures.length > 0) {
      for (const feature of allFeatures) {
        if (feature.geometry?.type === 'Polygon' || feature.geometry?.type === 'MultiPolygon') {
          // Get district identifier
          const districtId = feature.properties?.GEOID || 
                           feature.properties?.ID || 
                           feature.properties?.DISTRICT || 
                           feature.properties?.CD ||
                           feature.properties?.NAME ||
                           feature.id ||
                           Math.random().toString(36).substr(2, 9);
          
          if (useEnhanced) {
            const result = calculateEnhancedCompactness(feature, allFeatures);
            gerryIndex[districtId] = result.adjustedScore;
            detailedResults[districtId] = result;
          } else {
            const score = calculatePolsbyPopperScore(feature);
            gerryIndex[districtId] = score;
          }
        }
      }
    }
    
    // Calculate statistics
    const scores = Object.values(gerryIndex);
    const statistics = {
      totalDistricts: scores.length,
      averageScore: scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0,
      minScore: scores.length > 0 ? Math.min(...scores) : 0,
      maxScore: scores.length > 0 ? Math.max(...scores) : 0,
      standardDeviation: scores.length > 1 ? Math.sqrt(scores.map(x => Math.pow(x - (scores.reduce((a, b) => a + b, 0) / scores.length), 2)).reduce((a, b) => a + b, 0) / scores.length) : 0
    };
    
    const response: any = {
      success: true,
      districtType,
      enhanced: useEnhanced,
      scores: gerryIndex,
      statistics
    };
    
    // Include detailed results if enhanced calculation was used
    if (useEnhanced) {
      response.detailed = detailedResults;
      
      // Add geographic context summary
      const contexts = Object.values(detailedResults);
      response.geographicSummary = {
        coastalDistricts: contexts.filter(c => c.boundaryContext.hasCoastline).length,
        borderDistricts: contexts.filter(c => c.boundaryContext.hasBorder).length,
        averageNaturalBoundary: contexts.length > 0 ? contexts.reduce((sum, c) => sum + c.boundaryContext.naturalBoundaryPercentage, 0) / contexts.length : 0
      };
    }
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Gerrymandering index calculation error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}