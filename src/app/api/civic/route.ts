import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { OpenStatesPerson, Representative } from "@/types/representative";

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
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const address = searchParams.get('address');
    const state = searchParams.get('state');
    const forceRefresh = searchParams.get('refresh') === 'true';
    const pageParam = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const showAll = searchParams.get('showAll') === 'true';

    // console.log(`[API] Request received - address: ${address}, state: ${state}, forceRefresh: ${forceRefresh}`);

    if (!address && !state) {
      return NextResponse.json(
        { error: 'Address or state parameter is required' },
        { status: 400 }
      );
    }

    // Define state mapping at function level so it's available throughout
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

    // Extract state from address if not provided separately
    let stateCode = state;
    if (!stateCode && address) {
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
    // console.log(`[API] Processing request for state: ${stateCode}`);

    // Check MongoDB connection
    let client;
    try {
      client = await connectToDatabase();
      // console.log(`[API] Database connection established`);
    } catch (dbError) {
      console.error(`[API] Database connection failed:`, dbError);
      return NextResponse.json(
        { error: 'Database connection failed. Please try again later.' },
        { status: 503 }
      );
    }

    const db = client.db('statepulse');
    const representativesCollection = db.collection<Representative>('representatives');

    // Check for cached data first - ALWAYS check cache before hitting external API
    if (!forceRefresh) {
      try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        // Create a more comprehensive regex that matches both state abbreviation and full name
        const stateFullName = Object.keys(stateMap).find(name => stateMap[name] === stateCode) || stateCode;
        // Use word boundaries to avoid partial matches (e.g., IA in California)
        const stateRegex = new RegExp(`\\b(${stateCode}|${stateFullName.replace(/\s+/g, '\\s+')}|${stateCode}\\s+State)\\b`, 'i');

        const totalCachedReps = await representativesCollection.countDocuments({
          jurisdiction: { $regex: stateRegex },
          lastUpdated: { $gte: yesterday }
        });

        // console.log(`[API] Found ${totalCachedReps} cached representatives for ${stateCode} using regex: ${stateRegex}`);

        if (totalCachedReps > 0) {
          if (showAll) {
            const skip = (pageParam - 1) * pageSize;
            const cachedReps = await representativesCollection
              .find({
                jurisdiction: { $regex: stateRegex },
                lastUpdated: { $gte: yesterday }
              })
              .skip(skip)
              .limit(pageSize)
              .toArray();

            // console.log(`[API] Returning ${cachedReps.length} cached representatives (paginated) for page ${pageParam}`);
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
            const cachedReps = await representativesCollection
              .find({
                jurisdiction: { $regex: stateRegex },
                lastUpdated: { $gte: yesterday }
              })
              .limit(10)
              .toArray();

            // console.log(`[API] Returning ${cachedReps.length} cached representatives (first 10)`);
            return NextResponse.json({
              representatives: cachedReps,
              source: 'cache'
            });
          }
        } else {
          // console.log(`[API] No cached data found for ${stateCode}`);

          // For pagination requests (showAll=true), we'll fetch fresh data and then paginate
          // This ensures pagination always works even if cache is missing
          if (showAll) {
            // console.log(`[API] Pagination request with no cached data - will fetch fresh data and then paginate`);
          } else {
            // console.log(`[API] Initial request with no cached data, will fetch from OpenStates API`);
          }
        }
      } catch (cacheError) {
        console.error(`[API] Cache check failed:`, cacheError);

        // If this is a pagination request and cache fails, return error
        if (showAll) {
          return NextResponse.json({
            error: 'Database error occurred while checking for cached data. Please try again.',
            details: 'Cache check failed for pagination request.'
          }, { status: 500 });
        }

        // Continue to fetch from API if cache fails and this is not a pagination request
      }
    } else {
      // console.log(`[API] Force refresh requested for ${stateCode}, clearing cache and fetching fresh data`);
      // Clear old representatives for this state when force refresh is requested
      await representativesCollection.deleteMany({
        jurisdiction: { $regex: new RegExp(stateCode, 'i') }
      });
    }

    // Only reach here if no cached data was found or force refresh was requested
    // console.log(`[API] Proceeding to fetch from OpenStates API for ${stateCode}`);

    // Check OpenStates API key
    const openStatesApiKey = process.env.OPENSTATES_API_KEY;
    if (!openStatesApiKey) {
      console.error('[API] OPENSTATES_API_KEY not found in environment variables');
      return NextResponse.json(
        { error: 'OpenStates API key not configured. Please contact support.' },
        { status: 503 }
      );
    }

    // console.log(`[API] Fetching representatives from OpenStates API for state: ${stateCode}`);

    // Fetch all pages of representatives from OpenStates API
    let allPeople: OpenStatesPerson[] = [];
    let currentPage = 1;
    let hasMorePages = true;
    const perPage = 50; // OpenStates API maximum is 50 per page

    while (hasMorePages) {
      // console.log(`[API] Fetching page ${currentPage} for ${stateCode}...`);

      let openStatesUrl: string;
      let response: Response;

      // First try with lowercase state abbreviation
      openStatesUrl = `https://v3.openstates.org/people?jurisdiction=${stateCode.toLowerCase()}&per_page=${perPage}&page=${currentPage}`;

      try {
        response = await fetch(openStatesUrl, {
          headers: {
            'X-API-KEY': openStatesApiKey,
            'Accept': 'application/json'
          },
          timeout: 10000 // 10 second timeout
        } as any);

        // If that fails, try with the ocd-division format
        if (!response.ok && response.status === 400) {
          // console.log(`[API] First attempt failed for page ${currentPage}, trying alternative format for ${stateCode}`);

          openStatesUrl = `https://v3.openstates.org/people?jurisdiction=ocd-division/country:us/state:${stateCode.toLowerCase()}&per_page=${perPage}&page=${currentPage}`;

          response = await fetch(openStatesUrl, {
            headers: {
              'X-API-KEY': openStatesApiKey,
              'Accept': 'application/json'
            },
            timeout: 10000
          } as any);
        }

        if (!response.ok) {
          console.error(`[API] OpenStates API error:`, response.status, response.statusText);
          const errorText = await response.text();
          console.error(`[API] Error response body:`, errorText);

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

        // console.log(`[API] Fetched ${pagePeople.length} representatives from page ${currentPage} for ${stateCode}`);

        // Add this page's results to our collection
        allPeople = allPeople.concat(pagePeople);

        // Check if we have more pages
        // OpenStates API typically returns fewer results than per_page when we've reached the end
        if (pagePeople.length < perPage) {
          hasMorePages = false;
          // console.log(`[API] Reached end of results for ${stateCode}. Total fetched: ${allPeople.length}`);
        } else {
          currentPage++;
          // Add a small delay to be respectful to the API
          await new Promise(resolve => setTimeout(resolve, 100));
        }

        // Safety check to prevent infinite loops
        if (currentPage > 10) {
          console.warn(`[API] Stopping pagination after ${currentPage - 1} pages for ${stateCode} to prevent infinite loop`);
          hasMorePages = false;
        }
      } catch (fetchError) {
        console.error(`[API] Network error fetching from OpenStates:`, fetchError);
        return NextResponse.json(
          { error: `Network error fetching representative data for ${stateCode}. Please try again later.` },
          { status: 500 }
        );
      }
    }

    // console.log(`[API] Total representatives fetched for ${stateCode}: ${allPeople.length}`);

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
      try {
        await representativesCollection.deleteMany({
          jurisdiction: { $regex: new RegExp(stateCode, 'i') }
        });

        await representativesCollection.insertMany(representatives);
        // console.log(`[API] Stored ${representatives.length} representatives for ${stateCode}`);
      } catch (storageError) {
        console.error(`[API] Failed to store representatives:`, storageError);
        // Continue without caching if storage fails
      }
    }

    // Return response
    if (showAll) {
      const total = representatives.length;
      const skip = (pageParam - 1) * pageSize;
      const paginatedReps = representatives.slice(skip, skip + pageSize);

      // console.log(`[API] Returning ${paginatedReps.length} representatives (paginated)`);
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
    } else {
      // console.log(`[API] Returning ${Math.min(representatives.length, 10)} representatives`);
      return NextResponse.json({
        representatives: representatives.slice(0, 10),
        source: 'api'
      });
    }

  } catch (error) {
    console.error('[API] Unexpected error in representatives API:', error);
    return NextResponse.json(
      {
        error: 'An unexpected error occurred while fetching representatives. Please try again later.',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}