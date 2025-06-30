import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

let cachedClient: MongoClient | null = null;

async function connectToDatabase() {
  if (cachedClient) {
    return cachedClient;
  }

  const client = new MongoClient(MONGODB_URI!);
  await client.connect();
  cachedClient = client;
  return client;
}

// Interface for OpenStates person data
interface OpenStatesPerson {
  id: string;
  name: string;
  party: string;
  current_role?: {
    title: string;
    org_classification: string;
    district?: {
      name: string;
      division_id: string;
    };
  };
  contact_details?: Array<{
    type: string;
    value: string;
  }>;
  links?: Array<{
    url: string;
    note?: string;
  }>;
  image?: string;
  given_name?: string;
  family_name?: string;
  jurisdiction?: {
    name: string;
    classification: string;
  };
}

interface Representative {
  id: string;
  name: string;
  party: string;
  office: string;
  district?: string;
  jurisdiction: string;
  phone?: string;
  email?: string;
  website?: string;
  photo?: string;
  lat?: number;
  lon?: number;
  addresses?: Array<{
    type: string;
    line1: string;
    line2?: string;
    city: string;
    state: string;
    zip: string;
  }>;
  lastUpdated: Date;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const state = searchParams.get('state');

    if (!address && !state) {
      return NextResponse.json(
        { error: 'Address or state parameter is required' },
        { status: 400 }
      );
    }

    // Extract state from address if not provided separately
    let stateCode = state;
    if (!stateCode && address) {
      // First try to find full state names and convert to abbreviations
      const stateMap: Record<string, string> = {
        'Alabama': 'AL', 'Alaska': 'AK', 'Arizona': 'AZ', 'Arkansas': 'AR',
        'California': 'CA', 'Colorado': 'CO', 'Connecticut': 'CT', 'Delaware': 'DE',
        'Florida': 'FL', 'Georgia': 'GA', 'Hawaii': 'HI', 'Idaho': 'ID',
        'Illinois': 'IL', 'Indiana': 'IN', 'Iowa': 'IA', 'Kansas': 'KS',
        'Kentucky': 'KY', 'Louisiana': 'LA', 'Maine': 'ME', 'Maryland': 'MD',
        'Massachusetts': 'MA', 'Michigan': 'MI', 'Minnesota': 'MN', 'Mississippi': 'MS',
        'Missouri': 'MO', 'Montana': 'MT', 'Nebraska': 'NE', 'Nevada': 'NV',
        'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
        'North Carolina': 'NC', 'North Dakota': 'ND', 'Ohio': 'OH', 'Oklahoma': 'OK',
        'Oregon': 'OR', 'Pennsylvania': 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
        'South Dakota': 'SD', 'Tennessee': 'TN', 'Texas': 'TX', 'Utah': 'UT',
        'Vermont': 'VT', 'Virginia': 'VA', 'Washington': 'WA', 'West Virginia': 'WV',
        'Wisconsin': 'WI', 'Wyoming': 'WY', 'District of Columbia': 'DC'
      };

      // Check if address contains a full state name (case-insensitive)
      for (const [fullName, abbrev] of Object.entries(stateMap)) {
        if (address.toLowerCase().includes(fullName.toLowerCase())) {
          stateCode = abbrev;
          break;
        }
      }

      // If no full state name found, try to find 2-letter state code
      if (!stateCode) {
        const stateMatch = address.match(/,\s*([A-Z]{2})(?:\s|$)|(?:^|\s)([A-Z]{2})(?:\s*$)/);
        if (stateMatch) {
          stateCode = stateMatch[1] || stateMatch[2];
        }
      }
    }

    if (!stateCode) {
      return NextResponse.json(
        { error: 'Unable to determine state from address. Please include state abbreviation at the end (e.g., "123 Main St, Columbus, OH").' },
        { status: 400 }
      );
    }

    // Validate state code
    const validStates = [
      'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
      'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
      'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
      'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
      'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
      'DC'
    ];

    if (!validStates.includes(stateCode.toUpperCase())) {
      return NextResponse.json(
        { error: `Invalid state abbreviation: ${stateCode}. Please use a valid US state abbreviation.` },
        { status: 400 }
      );
    }

    stateCode = stateCode.toUpperCase();

    const client = await connectToDatabase();
    const db = client.db('statepulse');
    const representativesCollection = db.collection<Representative>('representatives');

    // Check if we have cached representatives for this state (within last 24 hours)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const cachedReps = await representativesCollection
      .find({
        jurisdiction: { $regex: new RegExp(stateCode, 'i') },
        lastUpdated: { $gte: yesterday }
      })
      .toArray();

    if (cachedReps.length > 0) {
      console.log(`Returning ${cachedReps.length} cached representatives for ${stateCode}`);
      return NextResponse.json({
        representatives: cachedReps,
        source: 'cache'
      });
    }

    // Fetch from OpenStates API
    const openStatesApiKey = process.env.OPENSTATES_API_KEY;
    if (!openStatesApiKey) {
      console.error('OPENSTATES_API_KEY not found in environment variables');
      return NextResponse.json(
        { error: 'Service temporarily unavailable' },
        { status: 503 }
      );
    }

    console.log(`Fetching representatives for state: ${stateCode}`);

    // Try different OpenStates API endpoints - the jurisdiction format might need adjustment
    let openStatesUrl: string;
    let response: Response;

    // First try with lowercase state abbreviation (fix per_page limit)
    openStatesUrl = `https://v3.openstates.org/people?jurisdiction=${stateCode.toLowerCase()}&per_page=50`;

    response = await fetch(openStatesUrl, {
      headers: {
        'X-API-KEY': openStatesApiKey,
        'Accept': 'application/json'
      }
    });

    // If that fails, try with the full state name format
    if (!response.ok && response.status === 400) {
      console.log(`First attempt failed, trying alternative format for ${stateCode}`);

      // Try with ocd-division format (also fix per_page limit)
      openStatesUrl = `https://v3.openstates.org/people?jurisdiction=ocd-division/country:us/state:${stateCode.toLowerCase()}&per_page=50`;

      response = await fetch(openStatesUrl, {
        headers: {
          'X-API-KEY': openStatesApiKey,
          'Accept': 'application/json'
        }
      });
    }

    if (!response.ok) {
      console.error('OpenStates API error:', response.status, response.statusText);
      const errorText = await response.text();
      console.error('Error response body:', errorText);

      if (response.status === 401) {
        return NextResponse.json(
          { error: 'API authentication failed. Please check your OpenStates API key.' },
          { status: 401 }
        );
      }

      if (response.status === 400) {
        return NextResponse.json(
          { error: `Invalid request for state ${stateCode}. The OpenStates API may not have data for this jurisdiction.` },
          { status: 400 }
        );
      }

      if (response.status === 404) {
        return NextResponse.json(
          { error: `No data found for state ${stateCode}. This state may not be available in OpenStates.` },
          { status: 404 }
        );
      }

      return NextResponse.json(
        { error: `Unable to fetch representative data for ${stateCode}. Please try again later.` },
        { status: 500 }
      );
    }

    const data = await response.json();
    const people: OpenStatesPerson[] = data.results || [];

    // Transform OpenStates data to our Representative format
    const representatives: Representative[] = people
      .filter(person => person.current_role) // Only include people with current roles
      .map(person => {
        const role = person.current_role!;

        // Extract contact information
        const contacts = person.contact_details || [];
        const phone = contacts.find(c => c.type === 'voice')?.value;
        const email = contacts.find(c => c.type === 'email')?.value;

        // Extract website
        const website = person.links?.find(link =>
          link.url.includes('.gov') || link.note?.toLowerCase().includes('official')
        )?.url;

        return {
          id: person.id,
          name: person.name,
          party: person.party || 'Unknown',
          office: role.title,
          district: role.district?.name,
          jurisdiction: person.jurisdiction?.name || stateCode.toUpperCase(),
          phone,
          email,
          website,
          photo: person.image,
          lastUpdated: new Date()
        };
      });

    // Store in MongoDB
    if (representatives.length > 0) {
      // Clear old representatives for this state
      await representativesCollection.deleteMany({
        jurisdiction: { $regex: new RegExp(stateCode, 'i') }
      });

      // Insert new representatives
      await representativesCollection.insertMany(representatives);
      console.log(`Stored ${representatives.length} representatives for ${stateCode}`);
    }

    return NextResponse.json({
      representatives,
      source: 'api',
      count: representatives.length
    });

  } catch (error) {
    console.error('Error in representatives API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
