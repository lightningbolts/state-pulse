import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const query = searchParams.get('q');
    const limit = searchParams.get('limit') || '5';

    if (!query) {
      return NextResponse.json(
        { error: 'Query parameter is required' },
        { status: 400 }
      );
    }

    // Use Nominatim for address suggestions
    const searchUrl = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=us&limit=${limit}&addressdetails=1`;

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'StatePulse/1.0 (contact@statepulse.app)', // Required by Nominatim
      }
    });

    if (!response.ok) {
      console.error('Address search API error:', response.status, response.statusText);
      return NextResponse.json(
        { error: 'Unable to search addresses' },
        { status: 500 }
      );
    }

    const data = await response.json();

    // Transform the results into a more usable format
    const suggestions = data.map((item: any) => ({
      id: item.place_id,
      display_name: item.display_name,
      address: {
        house_number: item.address?.house_number,
        road: item.address?.road,
        city: item.address?.city || item.address?.town || item.address?.village,
        state: item.address?.state,
        postcode: item.address?.postcode,
        country: item.address?.country
      },
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      importance: item.importance || 0,
      type: item.type,
      class: item.class
    }));

    // Sort by importance (relevance) and filter US addresses
    const filteredSuggestions = suggestions
      .filter((item: any) => item.address.country === 'United States')
      .sort((a: any, b: any) => b.importance - a.importance)
      .slice(0, parseInt(limit));

    return NextResponse.json({
      suggestions: filteredSuggestions,
      count: filteredSuggestions.length
    });

  } catch (error) {
    console.error('Error in address search API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
