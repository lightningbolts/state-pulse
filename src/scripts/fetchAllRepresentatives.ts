declare global {
  // eslint-disable-next-line no-var
  var openStatesRate: {
    count: number;
    dayCount: number;
    lastMinute: number;
    lastDay: number;
  } | undefined;
}
import { MongoClient } from 'mongodb';
import { Representative, CongressPerson } from '../types/representative';
import * as dotenv from 'dotenv';
dotenv.config({ path: require('path').resolve(__dirname, '../../.env') });
import fetch from 'node-fetch';

const CONGRESS_API_KEY = process.env.US_CONGRESS_API_KEY || '';

async function fetchCongressMembers(chamber: 'house' | 'senate'): Promise<CongressPerson[]> {
  // Use correct endpoint for current members in the 119th Congress
  let url = `https://api.congress.gov/v3/member/congress/119?api_key=${CONGRESS_API_KEY}`;
  let allMembers: any[] = [];
  while (url) {
    const res = await fetch(url, {
      headers: {
        'Accept': 'application/json'
      }
    });
    if (!res.ok) {
      console.error(`Failed to fetch Congress members: ${res.status} ${res.statusText}`);
      break;
    }
    const data = await res.json() as any;
    const members = (data.members || []);
    allMembers = allMembers.concat(members);
    let nextUrl = data.pagination?.next || null;
    if (nextUrl) {
      // If nextUrl is relative, prepend base
      if (nextUrl.startsWith('/')) {
        nextUrl = `https://api.congress.gov${nextUrl}`;
      }
      // Ensure api_key is present
      if (!nextUrl.includes('api_key=')) {
        const sep = nextUrl.includes('?') ? '&' : '?';
        nextUrl = `${nextUrl}${sep}api_key=${CONGRESS_API_KEY}`;
      }
    }
    url = nextUrl;
  }
  // Filter by chamber using terms.item[].chamber
  const chamberLabel = chamber === 'house' ? 'House of Representatives' : 'Senate';
  const filteredMembers = allMembers.filter((m: any) =>
    Array.isArray(m.terms?.item) && m.terms.item.some((term: any) => term.chamber === chamberLabel)
  );
  // Normalize to CongressPerson type using correct field mapping
  return filteredMembers.map((m: any) => {
    // Find the most recent term for this chamber
    let lastTerm = null;
    if (Array.isArray(m.terms?.item)) {
      lastTerm = m.terms.item.filter((term: any) => term.chamber === chamberLabel).slice(-1)[0];
    }
    // Name normalization: prefer directOrderName, else name, else constructed
    let name = m.directOrderName || m.name || (m.firstName && m.lastName ? `${m.firstName} ${m.lastName}` : null);
    // Party
    let party = m.partyName || (lastTerm && lastTerm.partyName) || null;
    // State
    let state = m.state || (lastTerm && (lastTerm.stateName || lastTerm.stateCode)) || null;
    // District
    let district = m.district || (lastTerm && lastTerm.district) || null;
    // Chamber
    let normalizedChamber = chamberLabel;
    // Image
    let image = m.depiction?.imageUrl || null;
    // Website: check all possible locations
    let website = m.officialUrl || m.url || (lastTerm && lastTerm.url) || (m.contactInfo && m.contactInfo.url) || null;
    // Address and phone: check all possible locations
    let address = null;
    let phone = null;
    if (m.addressInformation) {
      address = m.addressInformation.officeAddress || address;
      phone = m.addressInformation.phoneNumber || phone;
    }
    if (lastTerm) {
      address = lastTerm.officeAddress || address;
      phone = lastTerm.phoneNumber || phone;
    }
    if (m.contactInfo) {
      address = m.contactInfo.address || address;
      phone = m.contactInfo.phone || phone;
    }
    // Leadership
    let leadership = Array.isArray(m.leadership?.item) ? m.leadership.item : [];
    // Sponsored/Cosponsored
    let sponsoredLegislation = m.sponsoredLegislation || null;
    let cosponsoredLegislation = m.cosponsoredLegislation || null;
    // Terms
    let terms = m.terms || null;
    // Dates
    let updateDate = m.updateDate || null;
    let lastUpdated = m.lastUpdated ? new Date(m.lastUpdated) : undefined;
    // Return minimal, robust CongressPerson object
    return {
      id: m.bioguideId || m.memberId || m.id || null,
      name,
      party,
      state,
      district,
      chamber: normalizedChamber,
      image,
      website,
      address,
      phone,
      leadership,
      sponsoredLegislation,
      cosponsoredLegislation,
      terms,
      updateDate,
      lastUpdated,
    };
  });
}

const MONGODB_URI = process.env.MONGODB_URI || '';
const DB_NAME = process.env.MONGODB_DB_NAME || 'statepulse';
const COLLECTION_NAME = 'representatives';
const OPENSTATES_API_KEY = process.env.OPENSTATES_API_KEY || '';


const STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA',
  'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD',
  'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ',
  'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC',
  'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY', 'DC'
];

const JURISDICTIONS = [...STATES]; // Only states for OpenStates

async function fetchRepresentativesForState(state: string): Promise<Representative[]> {
  // Rate limit tracking
  if (!globalThis.openStatesRate) {
    globalThis.openStatesRate = { count: 0, dayCount: 0, lastMinute: Date.now(), lastDay: Date.now() };
  }
  const rate = globalThis.openStatesRate as {
    count: number;
    dayCount: number;
    lastMinute: number;
    lastDay: number;
  };
  // Helper to sleep
  function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  let allPeople: Representative[] = [];
  let currentPage = 1;
  let hasMorePages = true;
  const perPage = 50;

  while (hasMorePages) {
    // Check rate limits
    const now = Date.now();
    // Reset minute and daily counters if needed
    if (now - rate.lastMinute > 60 * 1000) {
      rate.count = 0;
      rate.lastMinute = now;
    }
    if (now - rate.lastDay > 24 * 60 * 60 * 1000) {
      rate.dayCount = 0;
      rate.lastDay = now;
    }
    if (rate.count >= 10) {
      const wait = rate.lastMinute + 60 * 1000 - now;
      console.log(`OpenStates API per-minute rate limit reached. Waiting ${Math.ceil(wait/1000)} seconds...`);
      await sleep(wait);
      rate.count = 0;
      rate.lastMinute = Date.now();
    }
    if (rate.dayCount >= 250) {
      console.log('OpenStates API daily rate limit reached. Stopping fetch.');
      break;
    }
    // Always wait 6.1 seconds between requests to stay under 10/min
    if (rate.count > 0) {
      await sleep(6100);
    }
    rate.count++;
    rate.dayCount++;
    const url = `https://v3.openstates.org/people?jurisdiction=${state.toLowerCase()}&per_page=${perPage}&page=${currentPage}`;
    const res = await fetch(url, {
      headers: {
        'X-API-KEY': OPENSTATES_API_KEY,
        'Accept': 'application/json'
      }
    });
    if (!res.ok) {
      console.error(`Failed to fetch for ${state} page ${currentPage}: ${res.status} ${res.statusText}`);
      break;
    }
    const data = await res.json() as any;
    const pagePeople: Representative[] = (data.results || []).map((rep: any) => {
      if (rep.id && typeof rep.id === 'string') {
        rep.id = rep.id.replace('/', '_');
      }
      return rep;
    });
    allPeople = allPeople.concat(pagePeople);
    if (pagePeople.length < perPage) {
      hasMorePages = false;
    } else {
      currentPage++;
    }
    if (currentPage > 10) hasMorePages = false;
  }
  return allPeople;
}

async function main() {
  if (!MONGODB_URI) throw new Error('Missing MONGODB_URI');
  if (!OPENSTATES_API_KEY) throw new Error('Missing OPENSTATES_API_KEY');

  const client = new MongoClient(MONGODB_URI);
  await client.connect();
  const db = client.db(DB_NAME);
  const collection = db.collection(COLLECTION_NAME);

  // Fetch state reps from OpenStates
  // for (const jurisdiction of JURISDICTIONS) {
  //   console.log(`Fetching representatives for ${jurisdiction}...`);
  //   const reps = await fetchRepresentativesForState(jurisdiction);
  //   if (reps.length > 0) {
  //     await collection.deleteMany({
  //       jurisdiction: { $regex: new RegExp(jurisdiction, 'i') }
  //     });
  //     await collection.insertMany(reps);
  //     console.log(`Stored ${reps.length} representatives for ${jurisdiction}`);
  //   } else {
  //     console.log(`No representatives found for ${jurisdiction}`);
  //   }
  // }

  // Fetch US House and Senate reps from ProPublica
  for (const chamber of ['house', 'senate'] as const) {
    console.log(`Fetching US Congress ${chamber} members...`);
    let reps = await fetchCongressMembers(chamber);
    // Add jurisdiction field for compatibility
    const jurisdictionLabel = chamber === 'house' ? 'US House' : 'US Senate';
    reps = reps.map(rep => ({ ...rep, jurisdiction: jurisdictionLabel }));
    if (reps.length > 0) {
      await collection.deleteMany({ jurisdiction: jurisdictionLabel });
      await collection.insertMany(reps);
      console.log(`Stored ${reps.length} US Congress ${chamber} members.`);
    } else {
      console.log(`No US Congress ${chamber} members found.`);
    }
  }
  await client.close();
  console.log('Done fetching all representatives.');
}

main().catch(err => {
  console.error('Error in fetchAllRepresentatives:', err);
  process.exit(1);
});
