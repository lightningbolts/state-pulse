import { NextRequest, NextResponse } from 'next/server';
import { area } from '@turf/area';
import { length } from '@turf/length';
import { polygonToLine } from '@turf/polygon-to-line';

/**
 * Calculate Polsby-Popper compactness score for a district
 * Formula: PP(D) = 4π * Area(D) / Perimeter(D)²
 * Score ranges from 0 (highly gerrymandered) to 1 (perfectly compact)
 */
function calculatePolsbyPopperScore(polygon: any): number {
  try {
    // Calculate area in square meters
    const polygonArea = area(polygon);
    
    // Convert polygon to line to calculate perimeter
    const perimeter = polygonToLine(polygon);
    
    // Calculate total perimeter length in meters
    let totalPerimeter = 0;
    if (perimeter.type === 'FeatureCollection') {
      // Handle multiple rings (exterior + holes)
      for (const feature of perimeter.features) {
        totalPerimeter += length(feature, { units: 'meters' });
      }
    } else {
      totalPerimeter = length(perimeter, { units: 'meters' });
    }
    
    // Polsby-Popper formula: 4π * Area / Perimeter²
    if (totalPerimeter === 0) return 0;
    const score = (4 * Math.PI * polygonArea) / Math.pow(totalPerimeter, 2);
    
    // Ensure score is between 0 and 1
    return Math.min(Math.max(score, 0), 1);
  } catch (error) {
    console.error('Error calculating Polsby-Popper score:', error);
    return 0;
  }
}

/**
 * Calculate gerrymandering index for districts
 * GET /api/dashboard/gerry-index?type=congressional-districts|state-upper-districts|state-lower-districts
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const districtType = searchParams.get('type');
    
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
    const fs = await import('fs/promises');
    const path = await import('path');
    const fullPath = path.join(process.cwd(), 'public', filePath);
    
    let geoJsonData;
    try {
      const fileContent = await fs.readFile(fullPath, 'utf-8');
      geoJsonData = JSON.parse(fileContent);
    } catch (fileError) {
      console.error('Error reading GeoJSON file:', fileError);
      return NextResponse.json({ 
        error: 'District data file not found' 
      }, { status: 404 });
    }
    
    // Calculate Polsby-Popper scores for each district
    const gerryIndex: Record<string, number> = {};
    
    if (geoJsonData.features) {
      for (const feature of geoJsonData.features) {
        if (feature.geometry?.type === 'Polygon' || feature.geometry?.type === 'MultiPolygon') {
          // Get district identifier (could be GEOID, ID, or other property)
          const districtId = feature.properties?.GEOID || 
                           feature.properties?.ID || 
                           feature.properties?.DISTRICT || 
                           feature.properties?.CD ||
                           feature.properties?.NAME ||
                           feature.id ||
                           Math.random().toString(36).substr(2, 9); // fallback
          
          const score = calculatePolsbyPopperScore(feature);
          gerryIndex[districtId] = score;
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      districtType,
      scores: gerryIndex,
      totalDistricts: Object.keys(gerryIndex).length,
      averageScore: Object.keys(gerryIndex).length > 0 
        ? Object.values(gerryIndex).reduce((a, b) => a + b, 0) / Object.keys(gerryIndex).length
        : 0
    });
    
  } catch (error) {
    console.error('Gerrymandering index calculation error:', error);
    return NextResponse.json({ 
      error: 'Internal server error' 
    }, { status: 500 });
  }
}