import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';
import { OpenStatesPerson, Representative } from "@/types/representative";
import Fuse from 'fuse.js';
import { STATE_MAP } from '@/types/geo';

// US State mapping and validation
export const validStates = Object.values(STATE_MAP);


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
      for (const [fullName, abbrev] of Object.entries(STATE_MAP)) {
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

    const representativesCollection = await getCollection('representatives');

    // If no state/address provided, fetch all representatives (with pagination, search, sorting)
    if (!stateCode) {
      // Build robust filter for all reps with support for name, state, chamber, party
      const filter: any = {};
      const andFilters: any[] = [];
      // Multi-field search (name, office, district, party) using Fuse.js for fuzzy search
      let fuseSearch = null;
      if (search) {
        // We'll apply Fuse.js after fetching the results from MongoDB
        fuseSearch = search;
      }
      // Party substring match (case-insensitive)
      if (filterParty) {
        andFilters.push({ $or: [
          { party: { $regex: filterParty, $options: 'i' } },
          { 'partyHistory.partyName': { $regex: filterParty, $options: 'i' } } // CongressPerson field
        ] });
      }
      // Chamber match (office or terms field)
      if (filterChamber && searchParams.get('showCongress') === 'true') {
        // Only include current members for each chamber (latest term, no endYear or endYear >= current year)
        const currentYear = new Date().getFullYear();
        if (filterChamber === 'Senate') {
          andFilters.push({
            jurisdiction: 'US Senate'
          });
        } else if (filterChamber === 'House of Representatives') {
          andFilters.push({
            jurisdiction: 'US House'
          });
        }
      } else if (filterChamber) {
        if (
          /senate|upper/i.test(filterChamber) ||
          filterChamber === 'Senate'
        ) {
          andFilters.push({ $or: [
            { office: { $regex: 'senator', $options: 'i' } },
            { 'terms.memberType': { $regex: 'Senator', $options: 'i' } },
            { chamber: { $regex: 'senate', $options: 'i' } }
          ] });
        } else if (
          /house|lower|assembly/i.test(filterChamber) ||
          filterChamber === 'House of Representatives'
        ) {
          andFilters.push({ $or: [
            { office: { $regex: 'representative|assembly', $options: 'i' } },
            { 'terms.memberType': { $regex: 'Representative', $options: 'i' } },
            { chamber: { $regex: 'house', $options: 'i' } }
          ] });
        }
      }
      
      if (filterState && validStates.includes(filterState.toUpperCase())) {
        const abbr = filterState.toUpperCase();
        const fullName = Object.keys(STATE_MAP).find(name => STATE_MAP[name] === abbr) || abbr;
        const stateRegex = new RegExp(`\\b(${abbr}|${fullName})\\b`, 'i');
        andFilters.push({ $or: [
          { 'jurisdiction.name': { $regex: fullName, $options: 'i' } }, 
          { jurisdiction: { $regex: stateRegex } }, 
          { state: { $regex: stateRegex } },
          { 'terms.stateCode': abbr }, 
          { 'terms.stateName': { $regex: fullName, $options: 'i' } }
        ] });
      }
      if (andFilters.length > 0) {
        filter.$and = andFilters;
      }
      // Sorting
      const validSortFields = ['name', 'party', 'office', 'district', 'jurisdiction', 'lastName', 'firstName', 'state'];
      let sortField = validSortFields.includes(sortBy) ? sortBy : 'name';
      let sortObj: Record<string, 1 | -1>;
      if (sortField === 'state') {
        sortObj = { 'jurisdiction': sortDir, 'state': sortDir };
      } else {
        sortObj = { [sortField]: sortDir };
      }
      // Pagination
      const skip = (pageParam - 1) * pageSize;
      const total = await representativesCollection.countDocuments(filter);
      let reps = await representativesCollection
        .find(filter)
        .sort(sortObj)
        .toArray();
      // Fuzzy search with Fuse.js if search is present
      if (fuseSearch) {
        const normalizeName = (name: string) => {
          if (!name) return [];
          const cleaned = name.replace(/[.,]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
          const parts = cleaned.split(' ');
          if (parts.length < 2) return [cleaned];
          const perms = [
            parts.join(' '),
            parts.slice().reverse().join(' '),
            parts.join(', '),
            parts.slice().reverse().join(', '),
            `${parts[1]} ${parts[0]}`,
            `${parts[0]} ${parts[1]}`,
            `${parts[1]}, ${parts[0]}`,
            `${parts[0]}, ${parts[1]}`
          ];
          return Array.from(new Set([...perms, ...parts]));
        };
        const getSafe = (obj: any, ...keys: string[]) => {
          for (const key of keys) {
            if (obj && typeof obj[key] === 'string') return obj[key];
          }
          return '';
        };
        const repsWithNormalized = reps.map((rep: any) => {
          const name = getSafe(rep, 'name', 'directOrderName');
          const firstName = getSafe(rep, 'firstName', 'first_name');
          const lastName = getSafe(rep, 'lastName', 'last_name');
          let normalizedNames: string[] = [];
          if (name) normalizedNames = normalizeName(name);
          if (firstName && lastName) {
            normalizedNames = normalizedNames.concat(normalizeName(`${firstName} ${lastName}`));
            normalizedNames = normalizedNames.concat(normalizeName(`${lastName} ${firstName}`));
            normalizedNames = normalizedNames.concat(normalizeName(`${firstName}, ${lastName}`));
            normalizedNames = normalizedNames.concat(normalizeName(`${lastName}, ${firstName}`));
          }
          normalizedNames = Array.from(new Set(normalizedNames));
          return { ...rep, normalizedNames };
        });
        const fuse = new Fuse(repsWithNormalized, {
          keys: [
            'name',
            'office',
            'district',
            'party',
            'lastName',
            'firstName',
            'normalizedNames'
          ],
          threshold: 0.4,
          ignoreLocation: true,
        });
        reps = fuse.search(fuseSearch).map(result => result.item);
      }
      // Pagination after fuzzy search
      const paginatedReps = reps.slice(skip, skip + pageSize);
      // Normalize results for frontend compatibility
      const normalizedReps = paginatedReps.map((rep: any) => {
        // CongressPerson normalization
        if ('terms' in rep && Array.isArray(rep.terms)) {
          const latestTerm = rep.terms[rep.terms.length - 1] || {};
          // Always set a valid id field
          let id = rep.id || '';
          // Fallback: try to build a composite id if missing or invalid
          // Don't regenerate valid Congressional bioguide IDs (pattern: letter + 6 digits)
          const isBioguideId = /^[A-Z]\d{6}$/.test(id);
          if (!id || (!isBioguideId && id.length < 8)) {
            id = [
              (rep as any).firstName || (rep as any).first_name || '',
              (rep as any).lastName || (rep as any).last_name || '',
              (rep as any).state || '',
              latestTerm.chamber || '',
              latestTerm.startYear || ''
            ].filter(Boolean).join('-');
          }
          return {
            ...rep,
            id,
            office: latestTerm.memberType || '',
            district: '',
            photo: rep.depiction?.imageUrl || '',
            party: (rep.partyHistory && rep.partyHistory[0] && rep.partyHistory[0].partyName) ? rep.partyHistory[0].partyName : ('party' in rep ? rep.party : ''),
            jurisdiction: 'state' in rep ? rep.state : (latestTerm.stateName || ''),
            name: rep.directOrderName || ('name' in rep ? rep.name : '') || ('firstName' in rep ? rep.firstName : '') + ' ' + ('lastName' in rep ? rep.lastName : ''),
          };
        }
        // Representative normalization (already matches frontend)
        // Defensive: always set id
        let id = rep.id || '';
        const firstName = (rep as any).firstName || (rep as any).first_name || '';
        const lastName = (rep as any).lastName || (rep as any).last_name || '';
        const stateVal = (rep as any).state || '';
        // Don't regenerate valid Congressional bioguide IDs (pattern: letter + 6 digits)
        const isBioguideId = /^[A-Z]\d{6}$/.test(id);
        if ((!id || (!isBioguideId && id.length < 8)) && firstName && lastName) {
          id = [firstName, lastName, stateVal].join('-');
        }
        return {
          ...rep,
          id,
        };
      });
      return NextResponse.json({
        representatives: normalizedReps,
        source: 'cache',
        pagination: {
          page: pageParam,
          pageSize,
          total: fuseSearch ? reps.length : total,
          totalPages: Math.ceil((fuseSearch ? reps.length : total) / pageSize),
          hasNext: skip + pageSize < (fuseSearch ? reps.length : total),
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
        const stateFullName = Object.keys(STATE_MAP).find(name => STATE_MAP[name] === stateCode) || stateCode;
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
            // Normalize results for frontend compatibility
            const normalizedCachedReps = cachedReps.map((rep: any) => {
              if ('terms' in rep && Array.isArray(rep.terms)) {
                const latestTerm = rep.terms[rep.terms.length - 1] || {};
                return {
                  ...rep,
                  office: latestTerm.memberType || '',
                  district: '',
                  photo: rep.depiction?.imageUrl || '',
                  party: (rep.partyHistory && rep.partyHistory[0] && rep.partyHistory[0].partyName) ? rep.partyHistory[0].partyName : ('party' in rep ? rep.party : ''),
                  jurisdiction: 'state' in rep ? rep.state : (latestTerm.stateName || ''),
                  name: rep.directOrderName || ('name' in rep ? rep.name : '') || ('firstName' in rep ? rep.firstName : '') + ' ' + ('lastName' in rep ? rep.lastName : ''),
                };
              }
              return rep;
            });
            return NextResponse.json({
              representatives: normalizedCachedReps,
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
          const representatives = allPeople
            .map(person => {
              let role = person.current_role;
              if (!role && Array.isArray(person.roles)) {
                const found = person.roles.find((r: any) => r.type === 'member' && !r.end_date);
                if (found) {
                  role = {
                    ...found,
                    district: typeof found.district === 'number' ? found.district : (typeof found.district === 'string' && !isNaN(Number(found.district)) ? Number(found.district) : undefined)
                  };
                }
              }
              if (!role || person.death_date) {
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
            .filter(x => x !== null);
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
            let aVal: string;
            let bVal: string;
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
                // Always treat jurisdiction as a string
                aVal = (typeof a.jurisdiction === 'string')
                  ? a.jurisdiction
                  : (a.jurisdiction && typeof a.jurisdiction === 'object' && 'name' in (a.jurisdiction as any)
                      ? ((a.jurisdiction as any).name as string)
                      : '');
                bVal = (typeof b.jurisdiction === 'string')
                  ? b.jurisdiction
                  : (b.jurisdiction && typeof b.jurisdiction === 'object' && 'name' in (b.jurisdiction as any)
                      ? ((b.jurisdiction as any).name as string)
                      : '');
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
    const representatives = allPeople
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
      const fuse = new Fuse(filteredReps, {
        keys: [
          'name',
          'office',
          'district',
          'party'
        ],
        threshold: 0.4,
        ignoreLocation: true,
      });
      filteredReps = fuse.search(search).map(result => result.item);
    }
    // Sorting
    const validSortFields = ['name', 'party', 'office', 'district', 'jurisdiction'];
    const sortField = validSortFields.includes(sortBy) ? sortBy : 'name';
    // Type-safe sort mapping
    filteredReps = filteredReps.sort((a, b) => {
      let aVal: string;
      let bVal: string;
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
