import { NextRequest, NextResponse } from 'next/server';
import { MongoClient } from 'mongodb';
import { OpenStatesPerson, Representative } from "@/types/representative";

// US State mapping and validation
export const stateMap: Record<string, string> = {
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

export const validStates = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
  'DC'
];

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
    // Accept all possible civics page parameters
    const address = searchParams.get('address');
    const state = searchParams.get('state');
    const stateAbbr = searchParams.get('stateAbbr');
    const forceRefresh = searchParams.get('refresh') === 'true';
    const pageParam = Math.max(1, parseInt(searchParams.get('page') || '1'));
    const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.get('pageSize') || '10'))); // Limit pageSize to 100 max
    const showAll = searchParams.get('showAll') === 'true';
    const sortBy = searchParams.get('sortBy') || 'name';
    const sortDir = (searchParams.get('sortDir') || 'asc').toLowerCase() === 'desc' ? -1 : 1;
    const search = searchParams.get('search')?.trim();
    const filterParty = searchParams.get('party')?.trim();
    const filterChamber = searchParams.get('chamber')?.trim();
    const filterState = searchParams.get('filterState')?.trim() || searchParams.get('state')?.trim() || searchParams.get('stateAbbr')?.trim();

    // console.log(`[API] Request received - address: ${address}, state: ${state}, forceRefresh: ${forceRefresh}`);

    // Accept stateAbbr as a priority, then state, then extract from address
    let stateCode = stateAbbr || state;
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

    // Always connect to DB and get collection once
    const client = await connectToDatabase();
    const db = client.db('statepulse');
    const representativesCollection = db.collection<Representative>('representatives');

    // If no state/address provided, fetch all representatives (with pagination, search, sorting)
    if (!stateCode) {
      // Build robust filter for all reps with support for name, state, chamber, party
      const filter: any = {};
      const andFilters: any[] = [];
      // Multi-field search (name, office, district, party)
      if (search) {
        const regex = { $regex: search, $options: 'i' };
        andFilters.push({ $or: [
          { name: regex },
          { office: regex },
          { district: regex },
          { party: regex }
        ] });
      }
      // Party substring match (case-insensitive)
      if (filterParty) {
        andFilters.push({ party: { $regex: filterParty, $options: 'i' } });
      }
      // Chamber match (office field, robust)
      if (filterChamber) {
        if (/senate|upper/i.test(filterChamber)) {
          andFilters.push({ office: { $regex: 'senator', $options: 'i' } });
        } else if (/house|lower|assembly/i.test(filterChamber)) {
          andFilters.push({ office: { $regex: 'representative|assembly', $options: 'i' } });
        }
      }
      // State match (jurisdiction field, robust)
      if (filterState && validStates.includes(filterState.toUpperCase())) {
        // Match jurisdiction containing state abbreviation or full name
        const stateRegex = new RegExp(`\\b(${filterState}|${Object.keys(stateMap).find(name => stateMap[name] === filterState.toUpperCase()) || filterState})\\b`, 'i');
        andFilters.push({ jurisdiction: { $regex: stateRegex } });
      }
      if (andFilters.length > 0) {
        filter.$and = andFilters;
      }
      // Sorting
      const validSortFields = ['name', 'party', 'office', 'district', 'jurisdiction'];
      const sortField = validSortFields.includes(sortBy) ? sortBy : 'name';
      const sortObj: Record<string, 1 | -1> = { [sortField]: sortDir };
      // Pagination
      const skip = (pageParam - 1) * pageSize;
      const total = await representativesCollection.countDocuments(filter);
      const reps = await representativesCollection
        .find(filter)
        .sort(sortObj)
        .skip(skip)
        .limit(pageSize)
        .toArray();
      return NextResponse.json({
        representatives: reps,
        source: 'cache',
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
    // Validate state code
    if (!validStates.includes(stateCode.toUpperCase())) {
      return NextResponse.json(
        { error: `Invalid state abbreviation: ${stateCode}. Please use a valid US state abbreviation.` },
        { status: 400 }
      );
    }
    stateCode = stateCode.toUpperCase();
    // console.log(`[API] Processing request for state: ${stateCode}`);

    // DB connection already established above

    // Check for cached data first - ALWAYS check cache before hitting external API
    if (!forceRefresh) {
      try {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        // Create a more comprehensive regex that matches both state abbreviation and full name
        const stateFullName = Object.keys(stateMap).find(name => stateMap[name] === stateCode) || stateCode;
        // Use word boundaries to avoid partial matches (e.g., IA in California)
        const stateRegex = new RegExp(`\\b(${stateCode}|${stateFullName.replace(/\s+/g, '\\s+')}|${stateCode}\\s+State)\\b`, 'i');

        // Build filter for cache query
        const cacheFilter: any = {
          jurisdiction: { $regex: stateRegex },
          lastUpdated: { $gte: yesterday }
        };
        // Multi-field search (name, office, district, party)
        if (search) {
          const regex = { $regex: search, $options: 'i' };
          cacheFilter.$or = [
            { name: regex },
            { office: regex },
            { district: regex },
            { party: regex }
          ];
        }

        const totalCachedReps = await representativesCollection.countDocuments(cacheFilter);

        // console.log(`[API] Found ${totalCachedReps} cached representatives for ${stateCode} using regex: ${stateRegex}`);

        if (totalCachedReps > 0) {
          // Build sort object
          const validSortFields = ['name', 'party', 'office', 'district', 'jurisdiction'];
          const sortField = validSortFields.includes(sortBy) ? sortBy : 'name';
          const sortObj: Record<string, 1 | -1> = { [sortField]: sortDir };

          if (showAll) {
            const skip = (pageParam - 1) * pageSize;
            const cachedReps = await representativesCollection
              .find(cacheFilter)
              .sort(sortObj)
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
              .find(cacheFilter)
              .sort(sortObj)
              .limit(10)
              .toArray();

            // console.log(`[API] Returning ${cachedReps.length} cached representatives (first 10)`);
            return NextResponse.json({
              representatives: cachedReps,
              source: 'cache'
            });
          }
        } else {
          // No cached data found for this state, so fetch from OpenStates API and cache results
          // (This logic is similar to the forceRefresh path, but triggered automatically on cache miss)
          // console.log(`[API] No cached data found for ${stateCode}, fetching from OpenStates API...`);
          // Check OpenStates API key
          const openStatesApiKey = process.env.OPENSTATES_API_KEY;
          if (!openStatesApiKey) {
            console.error('[API] OPENSTATES_API_KEY not found in environment variables');
            return NextResponse.json(
              { error: 'OpenStates API key not configured. Please contact support.' },
              { status: 503 }
            );
          }

          let allPeople: OpenStatesPerson[] = [];
          let currentPage = 1;
          let hasMorePages = true;
          const perPage = 50;
          while (hasMorePages) {
            let openStatesUrl: string;
            let response: Response;
            let data: any;
            let pagePeople: OpenStatesPerson[] = [];
            // 1. Try short jurisdiction format
            openStatesUrl = `https://v3.openstates.org/people?jurisdiction=${stateCode.toLowerCase()}&per_page=${perPage}&page=${currentPage}`;
            try {
              console.log(`[OpenStates API] Requesting: ${openStatesUrl}`);
              response = await fetch(openStatesUrl, {
                headers: {
                  'X-API-KEY': openStatesApiKey,
                  'Accept': 'application/json'
                },
                timeout: 10000
              } as any);
              let fallback = false;
              if (!response.ok && response.status === 400) {
                fallback = true;
              } else {
                data = await response.json();
                pagePeople = data.results || [];
                if (pagePeople.length === 0) {
                  fallback = true;
                }
              }
              // 2. Fallback to ocd-division if needed
              if (fallback) {
                openStatesUrl = `https://v3.openstates.org/people?jurisdiction=ocd-division/country:us/state:${stateCode.toLowerCase()}&per_page=${perPage}&page=${currentPage}`;
                console.log(`[OpenStates API] Fallback Requesting: ${openStatesUrl}`);
                response = await fetch(openStatesUrl, {
                  headers: {
                    'X-API-KEY': openStatesApiKey,
                    'Accept': 'application/json'
                  },
                  timeout: 10000
                } as any);
                if (!response.ok) {
                  console.error(`[OpenStates API] Error: ${response.status} ${response.statusText}`);
                  const errorText = await response.text();
                  console.error(`[OpenStates API] Error response body:`, errorText);
                  break;
                }
                data = await response.json();
                pagePeople = data.results || [];
              }
              if (pagePeople.length === 0) {
                console.warn(`[OpenStates API] 0 people returned for URL: ${openStatesUrl}`);
                console.warn(`[OpenStates API] Raw response:`, JSON.stringify(data));
              }
              console.log(`[OpenStates API] Fetched ${pagePeople.length} people for page ${currentPage} of ${stateCode}`);
              allPeople = allPeople.concat(pagePeople);
              if (pagePeople.length < perPage) {
                hasMorePages = false;
              } else {
                currentPage++;
                await new Promise(resolve => setTimeout(resolve, 100));
              }
              if (currentPage > 10) {
                hasMorePages = false;
              }
            } catch (fetchError) {
              break;
            }
          }
          console.log(`[OpenStates API] Total people fetched for ${stateCode}:`, allPeople.length);
          const representatives: Representative[] = allPeople
            .map(person => {
              // Use current_role if available, else synthesize from roles array
              let role = person.current_role;
              if (!role && Array.isArray(person.roles)) {
                const found = person.roles.find((r: any) => r.type === 'member' && !r.end_date);
                if (found) {
                  // Synthesize role with district as number if possible
                  role = {
                    ...found,
                    district: typeof found.district === 'number' ? found.district : (typeof found.district === 'string' && !isNaN(Number(found.district)) ? Number(found.district) : undefined)
                  };
                }
              }
              if (!role || person.death_date) {
                console.log(`[OpenStates API] Skipping person (no valid role or deceased):`, person.name, person.id);
                return null;
              }
              let email: string | undefined = person.email;
              let website: string | undefined;
              let addresses: Array<{ type: string; address: string; phone?: string; fax?: string }> = [];
              if (person.offices && person.offices.length > 0) {
                addresses = person.offices
                  .filter(office => office.address)
                  .map(office => ({
                    type: office.name || office.classification || 'Office',
                    address: office.address!,
                    phone: office.voice,
                    fax: office.fax
                  }));
              }
              if (!email && person.offices && person.offices.length > 0) {
                const officeWithEmail = person.offices.find(office => (office as any).email);
                if (officeWithEmail) {
                  email = (officeWithEmail as any).email;
                }
              }
              if (person.links && person.links.length > 0) {
                const homepage = person.links.find(link => link.note?.toLowerCase().includes('homepage'));
                if (homepage) {
                  website = homepage.url;
                } else {
                  const govSite = person.links.find(link => link.url.includes('.gov'));
                  if (govSite) {
                    website = govSite.url;
                  } else {
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
                      const officialLink = person.links.find(link =>
                        link.note?.toLowerCase().includes('official') &&
                        !link.url.includes('openstates.org')
                      );
                      if (officialLink) {
                        website = officialLink.url;
                      } else {
                        const nonOpenStatesLink = person.links.find(link =>
                          !link.url.includes('openstates.org')
                        );
                        if (nonOpenStatesLink) {
                          website = nonOpenStatesLink.url;
                        }
                      }
                    }
                  }
                }
              }
              let officeTitle = role.title;
              if (role.org_classification === 'upper') {
                officeTitle = 'State Senator';
              } else if (role.org_classification === 'lower') {
                officeTitle = 'State Representative';
              }
              let districtInfo = '';
              if (role.district !== undefined && role.district !== null) {
                districtInfo = `District ${role.district}`;
              }
              return {
                id: person.id,
                name: person.name,
                party: person.party || 'Unknown',
                office: officeTitle,
                ...(districtInfo ? { district: districtInfo } : {}),
                jurisdiction: person.jurisdiction?.name || `${stateCode} State Legislature`,
                ...(email ? { email } : {}),
                ...(website ? { website } : {}),
                ...(person.image ? { photo: person.image } : {}),
                ...(addresses.length > 0 ? { addresses } : {}),
                lastUpdated: new Date()
              };
            })
            .filter((x): x is Representative => x !== null); // Remove nulls and type narrow
          console.log(`[OpenStates API] Representatives mapped for ${stateCode}:`, representatives.length);
          if (representatives.length > 0) {
            try {
              await representativesCollection.deleteMany({
                jurisdiction: { $regex: new RegExp(stateCode, 'i') }
              });
              await representativesCollection.insertMany(representatives);
            } catch (storageError) {
              // Continue without caching if storage fails
            }
          }
          // Apply search and sorting to API-fetched data
          let filteredReps = representatives;
          if (search) {
            const regex = new RegExp(search, 'i');
            filteredReps = filteredReps.filter(rep =>
              regex.test(rep.name) ||
              (rep.office && regex.test(rep.office)) ||
              (rep.district && regex.test(rep.district)) ||
              (rep.party && regex.test(rep.party))
            );
          }
          const validSortFields = ['name', 'party', 'office', 'district', 'jurisdiction'];
          const sortField = validSortFields.includes(sortBy) ? sortBy : 'name';
          filteredReps = filteredReps.sort((a, b) => {
            let aVal = '';
            let bVal = '';
            switch (sortField) {
              case 'name':
                aVal = a.name || '';
                bVal = b.name || '';
                break;
              case 'party':
                aVal = a.party || '';
                bVal = b.party || '';
                break;
              case 'office':
                aVal = a.office || '';
                bVal = b.office || '';
                break;
              case 'district':
                aVal = a.district || '';
                bVal = b.district || '';
                break;
              case 'jurisdiction':
                aVal = a.jurisdiction || '';
                bVal = b.jurisdiction || '';
                break;
              default:
                aVal = a.name || '';
                bVal = b.name || '';
            }
            aVal = aVal.toLowerCase();
            bVal = bVal.toLowerCase();
            if (aVal < bVal) return -1 * sortDir;
            if (aVal > bVal) return 1 * sortDir;
            return 0;
          });
          if (showAll) {
            const total = filteredReps.length;
            const skip = (pageParam - 1) * pageSize;
            const paginatedReps = filteredReps.slice(skip, skip + pageSize);
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
            return NextResponse.json({
              representatives: filteredReps.slice(0, 10),
              source: 'api'
            });
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

    // Apply search and sorting to API-fetched data

    let filteredReps = representatives;
    if (search) {
      const regex = new RegExp(search, 'i');
      filteredReps = filteredReps.filter(rep =>
        regex.test(rep.name) ||
        (rep.office && regex.test(rep.office)) ||
        (rep.district && regex.test(rep.district)) ||
        (rep.party && regex.test(rep.party))
      );
    }
    // Sorting
    const validSortFields = ['name', 'party', 'office', 'district', 'jurisdiction'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'name';
    // Type-safe sort mapping
    filteredReps = filteredReps.sort((a, b) => {
      let aVal = '';
      let bVal = '';
      switch (sortField) {
        case 'name':
          aVal = a.name || '';
          bVal = b.name || '';
          break;
        case 'party':
          aVal = a.party || '';
          bVal = b.party || '';
          break;
        case 'office':
          aVal = a.office || '';
          bVal = b.office || '';
          break;
        case 'district':
          aVal = a.district || '';
          bVal = b.district || '';
          break;
        case 'jurisdiction':
          aVal = a.jurisdiction || '';
          bVal = b.jurisdiction || '';
          break;
        default:
          aVal = a.name || '';
          bVal = b.name || '';
      }
      aVal = aVal.toLowerCase();
      bVal = bVal.toLowerCase();
      if (aVal < bVal) return -1 * sortDir;
      if (aVal > bVal) return 1 * sortDir;
      return 0;
    });

    if (showAll) {
      const total = filteredReps.length;
      const skip = (pageParam - 1) * pageSize;
      const paginatedReps = filteredReps.slice(skip, skip + pageSize);
      // Defensive: always return pagination object for showAll
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
      // Defensive: always return at most 10 reps for non-showAll
      return NextResponse.json({
        representatives: filteredReps.slice(0, 10),
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
