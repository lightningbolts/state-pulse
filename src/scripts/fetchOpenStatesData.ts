
import { addLegislation } from '../services/legislationService';
import type { Legislation, LegislationHistoryEvent, LegislationSponsor } from '../types/legislation';
import { Timestamp } from 'firebase/firestore';
import { config } from 'dotenv';

// Load environment variables from .env file
config({ path: '../../.env' }); // Adjust path if your .env is elsewhere relative to script execution

const OPENSTATES_API_KEY = process.env.OPENSTATES_API_KEY;
const OPENSTATES_API_BASE_URL = 'https://v3.openstates.org';

// --- IMPORTANT: Populate this list with OCD-IDs for all 50 states ---
// You can find these via the OpenStates API: /jurisdictions endpoint
// Example: https://v3.openstates.org/jurisdictions?classification=state&apikey=YOUR_KEY
const STATE_OCD_IDS: { ocdId: string, abbr: string }[] = [
  { ocdId: 'ocd-jurisdiction/country:us/state:al/government', abbr: 'AL' },
  { ocdId: 'ocd-jurisdiction/country:us/state:ak/government', abbr: 'AK' },
  { ocdId: 'ocd-jurisdiction/country:us/state:az/government', abbr: 'AZ' },
  { ocdId: 'ocd-jurisdiction/country:us/state:ar/government', abbr: 'AR' },
  { ocdId: 'ocd-jurisdiction/country:us/state:ca/government', abbr: 'CA' },
  // ... ADD ALL 50 STATES HERE ...
  // For example:
  // { ocdId: 'ocd-jurisdiction/country:us/state:ny/government', abbr: 'NY' },
  // { ocdId: 'ocd-jurisdiction/country:us/state:tx/government', abbr: 'TX' },
  // { ocdId: 'ocd-jurisdiction/country:us/state:fl/government', abbr: 'FL' },
];

// Helper function to introduce delays (milliseconds)
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper to transform OpenStates bill data to our Legislation type
function transformOpenStatesBill(osBill: any, jurisdictionAbbr: string): Omit<Legislation, 'id' | 'lastActionDate' | 'introductionDate' | 'history' | 'effectiveDate' | 'versions'> & {
  introductionDate?: Date;
  lastActionDate?: Date;
  effectiveDate?: Date; // OpenStates doesn't directly provide this; might need to infer or omit
  history?: Array<Omit<LegislationHistoryEvent, 'date'> & { date: Date }>;
  versions?: Array<{ date: Date; url: string; name: string }>;
} {
  const sponsors: LegislationSponsor[] = osBill.sponsorships?.map((sp: any) => ({
    name: sp.name,
    id: sp.person_id || undefined, // person_id might be null
  })) || [];

  const history: Array<Omit<LegislationHistoryEvent, 'date'> & { date: Date }> = osBill.actions?.map((act: any) => ({
    date: new Date(act.date.split(' ')[0]), // OS date can be "YYYY-MM-DD HH:MM:SS"
    action: act.description,
    actor: act.organization_id || 'Unknown', // Might need to fetch organization details for name
    details: act.classification?.join(', ') || undefined,
  })) || [];

  const versions: Array<{ date: Date; url: string; name: string }> = osBill.versions?.map((ver: any) => ({
    date: new Date(ver.date.split(' ')[0]),
    name: ver.note,
    // Assuming the first link is the primary one and is PDF
    url: ver.links?.find((link: any) => link.media_type === 'application/pdf')?.url || ver.links?.[0]?.url || '',
  })) || [];

  let summary = '';
  if (osBill.abstracts && osBill.abstracts.length > 0) {
    summary = osBill.abstracts[0].abstract;
  }

  const legislation: ReturnType<typeof transformOpenStatesBill> = {
    title: osBill.title,
    billNumber: osBill.identifier,
    jurisdiction: jurisdictionAbbr,
    status: osBill.status?.length > 0 ? osBill.status[0] : (osBill.actions?.[osBill.actions.length -1]?.description || 'Unknown'), // Simplified status; OpenStates status can be complex
    summary: summary || undefined,
    fullTextUrl: osBill.sources?.find((s:any) => s.url.includes('.html') || s.url.includes('.pdf'))?.url || osBill.sources?.[0]?.url || undefined,
    sponsors,
    introductionDate: osBill.first_action_date ? new Date(osBill.first_action_date.split(' ')[0]) : undefined,
    lastActionDate: osBill.latest_action_date ? new Date(osBill.latest_action_date.split(' ')[0]) : undefined,
    history,
    tags: osBill.subject || [],
    sourceId: osBill.id, // Crucial for deduplication: OpenStates internal ID
    chamber: osBill.from_organization?.classification || undefined,
    versions: versions.length > 0 ? versions : undefined,
  };

  return legislation;
}

interface OpenStatesSession {
  identifier: string;
  name: string;
  start_date?: string;
  end_date?: string;
  classification: string; // e.g., "primary", "special"
}

async function fetchSessionsForJurisdiction(ocdId: string): Promise<OpenStatesSession[]> {
  const url = `${OPENSTATES_API_BASE_URL}/jurisdictions/${ocdId}?apikey=${OPENSTATES_API_KEY}&include=legislative_sessions`;
  console.log(`Fetching sessions from: ${url.replace(OPENSTATES_API_KEY as string, 'REDACTED_KEY')}`);
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(`Error fetching sessions for ${ocdId}: ${response.status} ${await response.text()}`);
      return [];
    }
    const data = await response.json();
    // Sort sessions by end_date descending (most recent first), or start_date if no end_date
    return (data.legislative_sessions || []).sort((a: OpenStatesSession, b: OpenStatesSession) => {
        const dateA = a.end_date || a.start_date || '0';
        const dateB = b.end_date || b.start_date || '0';
        return new Date(dateB).getTime() - new Date(dateA).getTime();
    });
  } catch (error) {
    console.error(`Network error fetching sessions for ${ocdId}:`, error);
    return [];
  }
}


async function fetchAndStoreBills(ocdId: string, jurisdictionAbbr: string, sessionIdentifier: string) {
  let page = 1;
  const perPage = 20; // Adjust as needed, OpenStates max is usually 50 or 100
  let hasMore = true;
  let billsProcessed = 0;

  console.log(`Fetching bills for ${jurisdictionAbbr} - Session: ${sessionIdentifier}`);

  while (hasMore) {
    const url = `${OPENSTATES_API_BASE_URL}/bills?jurisdiction=${ocdId}&session=${sessionIdentifier}&page=${page}&per_page=${perPage}&apikey=${OPENSTATES_API_KEY}&include=sponsorships&include=abstracts&include=versions&include=actions&sort=updated_desc`;
    
    console.log(`Fetching page ${page} from: ${url.replace(OPENSTATES_API_KEY as string, 'REDACTED_KEY')}`);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Error fetching bills page ${page} for ${jurisdictionAbbr}, session ${sessionIdentifier}: ${response.status} ${await response.text()}`);
        hasMore = false; // Stop trying for this session on error
        break;
      }
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        for (const osBill of data.results) {
          try {
            const legislationData = transformOpenStatesBill(osBill, jurisdictionAbbr);
            // TODO: Implement check if bill (by sourceId) already exists to avoid duplicates or to update.
            // For now, we are just adding.
            await addLegislation(legislationData);
            console.log(`Added: ${legislationData.billNumber} (${jurisdictionAbbr}) - ${legislationData.title.substring(0,30)}...`);
            billsProcessed++;
          } catch (transformError) {
            console.error(`Error transforming or adding bill ${osBill.identifier} (${osBill.id}):`, transformError);
          }
        }
      } else {
        console.log(`No more bills found for ${jurisdictionAbbr}, session ${sessionIdentifier} on page ${page}.`);
        hasMore = false;
      }

      if (data.pagination && page < data.pagination.max_page) {
        page++;
        await delay(2000); // IMPORTANT: Wait 2 seconds between paged requests to respect rate limits
      } else {
        hasMore = false;
      }

    } catch (error) {
      console.error(`Network error fetching bills for ${jurisdictionAbbr}, session ${sessionIdentifier}, page ${page}:`, error);
      hasMore = false; // Stop trying for this session on network error
      break;
    }
  }
  console.log(`Finished fetching for ${jurisdictionAbbr}, session ${sessionIdentifier}. Processed ${billsProcessed} bills.`);
}

async function main() {
  if (!OPENSTATES_API_KEY) {
    console.error("Error: OPENSTATES_API_KEY environment variable is not set. Please add it to your .env file.");
    return;
  }
  if (STATE_OCD_IDS.length === 0 || STATE_OCD_IDS[0].abbr === 'AL' && STATE_OCD_IDS.length <= 5) {
      console.warn("Warning: STATE_OCD_IDS list is not fully populated. Please add all state OCD-IDs and abbreviations to src/scripts/fetchOpenStatesData.ts for complete data fetching.");
  }


  for (const state of STATE_OCD_IDS) {
    console.log(`\n--- Processing State: ${state.abbr} (${state.ocdId}) ---`);
    const sessions = await fetchSessionsForJurisdiction(state.ocdId);
    
    if (sessions.length > 0) {
      // Example: Fetch for the most recent 1-2 primary/regular sessions. Adjust as needed.
      const relevantSessions = sessions.filter(s => s.classification === 'primary' || !s.classification).slice(0, 1); 
      // You might want more sophisticated logic to pick sessions (e.g., by year).
      // For "special" sessions, you might want to include them if they are recent.
      
      if(relevantSessions.length === 0 && sessions.length > 0) {
        relevantSessions.push(sessions[0]); // Fallback to the absolute most recent if no "primary" found
      }

      console.log(`Found ${relevantSessions.length} relevant session(s) for ${state.abbr}: ${relevantSessions.map(s=>s.name).join(', ')}`);

      for (const session of relevantSessions) {
        await fetchAndStoreBills(state.ocdId, state.abbr, session.identifier);
        await delay(5000); // Wait 5 seconds between different sessions/states
      }
    } else {
      console.log(`No sessions found for ${state.abbr}. Skipping.`);
    }
     await delay(10000); // Wait 10 seconds between states
  }

  console.log("\n--- Finished processing all states. ---");
}

// To run this script:
// 1. Ensure .env file at project root has OPENSTATES_API_KEY="your_actual_key"
// 2. Ensure Firebase Admin SDK is set up if running outside Firebase environment, OR that client-side Firebase config is sufficient for 'addLegislation' (it should be for Firestore client SDK).
// 3. From your project root, run: tsx src/scripts/fetchOpenStatesData.ts
//    (You might need to install tsx: npm install -g tsx or npx tsx src/scripts/fetchOpenStatesData.ts)

main().catch(err => {
  console.error("Unhandled error in main execution:", err);
});
