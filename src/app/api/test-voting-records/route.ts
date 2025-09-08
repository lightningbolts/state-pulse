import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Test the voting records API with a common bioguide ID
    const testBioguideId = 'P000197'; // Nancy Pelosi as an example
    
    const baseUrl = process.env.VERCEL_URL 
      ? `https://${process.env.VERCEL_URL}` 
      : 'http://localhost:3000';
    
    const response = await fetch(`${baseUrl}/api/representatives/${testBioguideId}/voting-records?limit=5`);
    
    const data = await response.json();
    
    return NextResponse.json({
      success: true,
      message: 'Voting records API test completed',
      testBioguideId,
      apiResponse: data,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Test API error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
