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
    district?: number;
    division_id?: string;
  };
  jurisdiction?: {
    id: string;
    name: string;
    classification: string;
  };
  given_name?: string;
  family_name?: string;
  image?: string;
  email?: string;
  gender?: string;
  birth_date?: string;
  death_date?: string;
  extras?: {
    profession?: string;
  };
  created_at?: string;
  updated_at?: string;
  openstates_url?: string;
  other_identifiers?: Array<{
    identifier: string;
    scheme: string;
  }>;
  other_names?: Array<{
    name: string;
    note?: string;
  }>;
  links?: Array<{
    url: string;
    note?: string;
  }>;
  sources?: Array<{
    url: string;
    note?: string;
  }>;
  offices?: Array<{
    name: string;
    fax?: string;
    voice?: string;
    address?: string;
    classification?: string;
  }>;
}

interface Representative {
  id: string;
  name: string;
  party: string;
  office: string;
  district?: string;
  jurisdiction: string;
  email?: string;
  website?: string;
  photo?: string;
  lat?: number;
  lon?: number;
  addresses?: Array<{
    type: string;
    address: string;
    phone?: string;
    fax?: string;
  }>;
  lastUpdated: Date;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const state = searchParams.get('state');
    const forceRefresh = searchParams.get('refresh') === 'true';
    const pageParam = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const showAll = searchParams.get('showAll') === 'true'; // New parameter to get all reps

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
    // Skip cache check if forceRefresh is true
    if (!forceRefresh) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const totalCachedReps = await representativesCollection.countDocuments({
        jurisdiction: { $regex: new RegExp(stateCode, 'i') },
        lastUpdated: { $gte: yesterday }
      });

      if (totalCachedReps > 0) {
        console.log(`Found ${totalCachedReps} cached representatives for ${stateCode}`);

        if (showAll) {
          // Return paginated results
          const skip = (pageParam - 1) * pageSize;
          const cachedReps = await representativesCollection
            .find({
              jurisdiction: { $regex: new RegExp(stateCode, 'i') },
              lastUpdated: { $gte: yesterday }
            })
            .skip(skip)
            .limit(pageSize)
            .toArray();

          return NextResponse.json({
            representatives: cachedReps,
            source: 'cache',
            pagination: {
              page: pageParam,
              pageSize,
              total: totalCachedReps,
              totalPages: Math.ceil(totalCachedReps / pageSize),
              hasNext: skip + pageSize < totalCachedReps,
              hasPrev: pageParam > 1
            }
          });
        } else {
          // Return first 10 for proximity-based search
          const cachedReps = await representativesCollection
            .find({
              jurisdiction: { $regex: new RegExp(stateCode, 'i') },
              lastUpdated: { $gte: yesterday }
            })
            .limit(10)
            .toArray();

          return NextResponse.json({
            representatives: cachedReps,
            source: 'cache'
          });
        }
      }
    } else {
      console.log(`Force refresh requested for ${stateCode}, clearing cache`);
      // Clear old representatives for this state when force refresh is requested
      await representativesCollection.deleteMany({
        jurisdiction: { $regex: new RegExp(stateCode, 'i') }
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

    // Fetch all pages of representatives from OpenStates API
    let allPeople: OpenStatesPerson[] = [];
    let currentPage = 1;
    let hasMorePages = true;
    const perPage = 50; // OpenStates API maximum is 50 per page

    while (hasMorePages) {
      console.log(`Fetching page ${currentPage} for ${stateCode}...`);

      // Try different OpenStates API endpoints - the jurisdiction format might need adjustment
      let openStatesUrl: string;
      let response: Response;

      // First try with lowercase state abbreviation
      openStatesUrl = `https://v3.openstates.org/people?jurisdiction=${stateCode.toLowerCase()}&per_page=${perPage}&page=${currentPage}`;

      response = await fetch(openStatesUrl, {
        headers: {
          'X-API-KEY': openStatesApiKey,
          'Accept': 'application/json'
        }
      });

      // If that fails, try with the ocd-division format
      if (!response.ok && response.status === 400) {
        console.log(`First attempt failed for page ${currentPage}, trying alternative format for ${stateCode}`);

        // Try with ocd-division format
        openStatesUrl = `https://v3.openstates.org/people?jurisdiction=ocd-division/country:us/state:${stateCode.toLowerCase()}&per_page=${perPage}&page=${currentPage}`;

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
      const pagePeople: OpenStatesPerson[] = data.results || [];

      console.log(`Fetched ${pagePeople.length} representatives from page ${currentPage} for ${stateCode}`);

      // Add this page's results to our collection
      allPeople = allPeople.concat(pagePeople);

      // Check if we have more pages
      // OpenStates API typically returns fewer results than per_page when we've reached the end
      if (pagePeople.length < perPage) {
        hasMorePages = false;
        console.log(`Reached end of results for ${stateCode}. Total fetched: ${allPeople.length}`);
      } else {
        currentPage++;
        // Add a small delay to be respectful to the API
        await new Promise(resolve => setTimeout(resolve, 100));
      }

      // Safety check to prevent infinite loops
      if (currentPage > 10) {
        console.warn(`Stopping pagination after ${currentPage - 1} pages for ${stateCode} to prevent infinite loop`);
        hasMorePages = false;
      }
    }

    console.log(`Total representatives fetched for ${stateCode}: ${allPeople.length}`);

    // Transform OpenStates data to our Representative format
    const representatives: Representative[] = allPeople
      .filter(person => person.current_role && !person.death_date) // Only include people with current roles who are alive
      .map(person => {
        const role = person.current_role!;

        // Extract contact information from offices array - more comprehensive extraction
        let email: string | undefined;
        let website: string | undefined;
        let addresses: Array<{
          type: string;
          address: string;
          phone?: string;
          fax?: string;
        }> = [];

        // Get phone and addresses from offices array
        if (person.offices && person.offices.length > 0) {
          // Extract addresses from all offices
          addresses = person.offices
            .filter(office => office.address) // Only include offices with addresses
            .map(office => ({
              type: office.name || office.classification || 'Office',
              address: office.address!,
              phone: office.voice,
              fax: office.fax
            }));
        }

        // Get email - can be at person level or in offices
        email = person.email;
        if (!email && person.offices && person.offices.length > 0) {
          // Check if email is in office data (some APIs might store it there)
          const officeWithEmail = person.offices.find(office => (office as any).email);
          if (officeWithEmail) {
            email = (officeWithEmail as any).email;
          }
        }

        // Extract website - prioritize official government links
        if (person.links && person.links.length > 0) {
          // First try to find homepage
          const homepage = person.links.find(link =>
            link.note?.toLowerCase().includes('homepage')
          );
          if (homepage) {
            website = homepage.url;
          } else {
            // Then try .gov domains
            const govSite = person.links.find(link =>
              link.url.includes('.gov')
            );
            if (govSite) {
              website = govSite.url;
            } else {
              // Then try state legislature domains (common patterns)
              const stateLegSite = person.links.find(link =>
                link.url.includes('legislature') ||
                link.url.includes('senate') ||
                link.url.includes('house') ||
                link.url.includes('assembly') ||
                link.url.includes('capitol')
              );
              if (stateLegSite) {
                website = stateLegSite.url;
              } else {
                // Fallback to any official link that's NOT openstates
                const officialLink = person.links.find(link =>
                  link.note?.toLowerCase().includes('official') &&
                  !link.url.includes('openstates.org')
                );
                if (officialLink) {
                  website = officialLink.url;
                } else {
                  // Last resort - first link that's NOT openstates
                  const nonOpenStatesLink = person.links.find(link =>
                    !link.url.includes('openstates.org')
                  );
                  if (nonOpenStatesLink) {
                    website = nonOpenStatesLink.url;
                  }
                  // Only use openstates_url if absolutely no other links exist
                  // Don't set website to openstates_url at all - let it be undefined
                }
              }
            }
          }
        }
        // Don't use person.openstates_url as fallback - leave website undefined if no official site found

        // Create office title with proper formatting
        let officeTitle = role.title;
        if (role.org_classification === 'upper') {
          officeTitle = 'State Senator';
        } else if (role.org_classification === 'lower') {
          officeTitle = 'State Representative';
        }

        // Format district information
        let districtInfo = '';
        if (role.district) {
          districtInfo = `District ${role.district}`;
        }

        return {
          id: person.id,
          name: person.name,
          party: person.party || 'Unknown',
          office: officeTitle,
          district: districtInfo,
          jurisdiction: person.jurisdiction?.name || `${stateCode} State Legislature`,
          email,
          website,
          photo: person.image,
          addresses, // Add the extracted addresses array
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

    // Return paginated response if showAll is true
    if (showAll) {
      const total = representatives.length;
      const skip = (pageParam - 1) * pageSize;
      const paginatedReps = representatives.slice(skip, skip + pageSize);

      return NextResponse.json({
        representatives: paginatedReps,
        source: 'api',
        pagination: {
          page: pageParam,
          pageSize,
          total,
          totalPages: Math.ceil(total / pageSize),
          hasNext: skip + pageSize < total,
          hasPrev: pageParam > 1
        }
      });
    }

    // For proximity-based searches, limit to first 10 representatives
    const limitedReps = representatives.slice(0, 10);

    return NextResponse.json({
      representatives: limitedReps,
      source: 'api',
      count: limitedReps.length
    });

  } catch (error) {
    console.error('Error in representatives API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
