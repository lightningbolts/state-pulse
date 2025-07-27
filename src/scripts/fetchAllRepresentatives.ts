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
import dotenv from 'dotenv';
dotenv.config({ path: require('path').resolve(__dirname, '../../.env') });
import fetch from 'node-fetch';

const CONGRESS_API_KEY = process.env.US_CONGRESS_API_KEY || '';

async function fetchCongressMembers(chamber: 'house' | 'senate'): Promise<CongressPerson[]> {
  // Use current congress number (e.g., 119th as of 2025)
  const congress = 119;
  const url = `https://api.congress.gov/v3/member/congress/${congress}`;
  const res = await fetch(url, {
    headers: {
      'X-Api-Key': CONGRESS_API_KEY,
      'Accept': 'application/json'
    }
  });
  if (!res.ok) {
    console.error(`Failed to fetch Congress ${chamber}: ${res.status} ${res.statusText}`);
    return [];
  }
  const data = await res.json() as any;
  // Congress.gov returns members in data.members array
  const members = (data.members || []).filter((m: any) => m.chamber && m.chamber.toLowerCase() === chamber);
  // Normalize to CongressPerson type
  return members.map((m: any) => ({
    id: m.bioguideId || m.memberId,
    birthYear: m.birthYear,
    cosponsoredLegislation: m.cosponsoredLegislation,
    depiction: m.depiction,
    directOrderName: m.directOrderName,
    firstName: m.firstName,
    honorificName: m.honorificName,
    invertedOrderName: m.invertedOrderName,
    lastName: m.lastName,
    leadership: m.leadership,
    partyHistory: m.partyHistory,
    sponsoredLegislation: m.sponsoredLegislation,
    state: m.state,
    terms: m.terms,
    updateDate: m.updateDate,
    lastUpdated: m.lastUpdated ? new Date(m.lastUpdated) : undefined
  }));
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
  for (const jurisdiction of JURISDICTIONS) {
    console.log(`Fetching representatives for ${jurisdiction}...`);
    const reps = await fetchRepresentativesForState(jurisdiction);
    if (reps.length > 0) {
      await collection.deleteMany({
        jurisdiction: { $regex: new RegExp(jurisdiction, 'i') }
      });
      await collection.insertMany(reps);
      console.log(`Stored ${reps.length} representatives for ${jurisdiction}`);
    } else {
      console.log(`No representatives found for ${jurisdiction}`);
    }
  }

  // Fetch US House and Senate reps from ProPublica
  for (const chamber of ['house', 'senate'] as const) {
    console.log(`Fetching US Congress ${chamber} members...`);
    const reps = await fetchCongressMembers(chamber);
    if (reps.length > 0) {
      await collection.deleteMany({ jurisdiction: chamber === 'house' ? 'US House' : 'US Senate' });
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
