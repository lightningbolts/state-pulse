
import { upsertLegislationBySourceId } from '../services/legislationService'; // Changed from addLegislation
import type { Legislation, LegislationHistoryEvent, LegislationSponsor } from '../types/legislation';
import { Timestamp } from 'firebase/firestore';
import { config } from 'dotenv';

// Load environment variables from .env file
config({ path: '../../.env' }); // Adjust path if your .env is elsewhere relative to script execution

const OPENSTATES_API_KEY = process.env.OPENSTATES_API_KEY;
const OPENSTATES_API_BASE_URL = 'https://v3.openstates.org';

// --- IMPORTANT: Populate this list with OCD-IDs and abbreviations for all 50 states ---
// You can find these via the OpenStates API: /jurisdictions endpoint
// Example: https://v3.openstates.org/jurisdictions?classification=state&apikey=YOUR_KEY
// This list is crucial for the script to function correctly for all states.
const STATE_OCD_IDS: { ocdId: string, abbr: string }[] = [
  { ocdId: 'ocd-jurisdiction/country:us/state:al/government', abbr: 'AL' },
  { ocdId: 'ocd-jurisdiction/country:us/state:ak/government', abbr: 'AK' },
  { ocdId: 'ocd-jurisdiction/country:us/state:az/government', abbr: 'AZ' },
  { ocdId: 'ocd-jurisdiction/country:us/state:ar/government', abbr: 'AR' },
  { ocdId: 'ocd-jurisdiction/country:us/state:ca/government', abbr: 'CA' },
  { ocdId: 'ocd-jurisdiction/country:us/state:co/government', abbr: 'CO' },
  { ocdId: 'ocd-jurisdiction/country:us/state:ct/government', abbr: 'CT' },
  { ocdId: 'ocd-jurisdiction/country:us/state:de/government', abbr: 'DE' },
  { ocdId: 'ocd-jurisdiction/country:us/state:fl/government', abbr: 'FL' },
  { ocdId: 'ocd-jurisdiction/country:us/state:ga/government', abbr: 'GA' },
  { ocdId: 'ocd-jurisdiction/country:us/state:hi/government', abbr: 'HI' },
  { ocdId: 'ocd-jurisdiction/country:us/state:id/government', abbr: 'ID' },
  { ocdId: 'ocd-jurisdiction/country:us/state:il/government', abbr: 'IL' },
  { ocdId: 'ocd-jurisdiction/country:us/state:in/government', abbr: 'IN' },
  { ocdId: 'ocd-jurisdiction/country:us/state:ia/government', abbr: 'IA' },
  { ocdId: 'ocd-jurisdiction/country:us/state:ks/government', abbr: 'KS' },
  { ocdId: 'ocd-jurisdiction/country:us/state:ky/government', abbr: 'KY' },
  { ocdId: 'ocd-jurisdiction/country:us/state:la/government', abbr: 'LA' },
  { ocdId: 'ocd-jurisdiction/country:us/state:me/government', abbr: 'ME' },
  { ocdId: 'ocd-jurisdiction/country:us/state:md/government', abbr: 'MD' },
  { ocdId: 'ocd-jurisdiction/country:us/state:ma/government', abbr: 'MA' },
  { ocdId: 'ocd-jurisdiction/country:us/state:mm/government', abbr: 'MI'},
  { ocdId: 'ocd-jurisdiction/country:us/state:mn/government', abbr: 'MN' },
  { ocdId: 'ocd-jurisdiction/country:us/state:ms/government', abbr: 'MS' },
  { ocdId: 'ocd-jurisdiction/country:us/state:mo/government', abbr: 'MO' },
  { ocdId: 'ocd-jurisdiction/country:us/state:mt/government', abbr: 'MT' },
  { ocdId: 'ocd-jurisdiction/country:us/state:ne/government', abbr: 'NE' },
  { ocdId: 'ocd-jurisdiction/country:us/state:nv/government', abbr: 'NV' },
  { ocdId: 'ocd-jurisdiction/country:us/state:nh/government', abbr: 'NH' },
  { ocdId: 'ocd-jurisdiction/country:us/state:nj/government', abbr: 'NJ' },
  { ocdId: 'ocd-jurisdiction/country:us/state:nm/government', abbr: 'NM' },
  { ocdId: 'ocd-jurisdiction/country:us/state:nc/government', abbr: 'NC' },
  { ocdId: 'ocd-jurisdiction/country:us/state:nd/government', abbr: 'ND' },
  { ocdId: 'ocd-jurisdiction/country:us/state:oh/government', abbr: 'OH' },
  { ocdId: 'ocd-jurisdiction/country:us/state:ok/government', abbr: 'OK'},
  { ocdId: 'ocd-jurisdiction/country:us/state:or/government', abbr: 'OR'},
  { ocdId: 'ocd-jurisdiction/country:us/state:pa/government', abbr: 'PA'},
  { ocdId: 'ocd-jurisdiction/country:us/state-ri/government', abbr: 'RI'},
  { ocdId: 'ocd-jurisdiction/country/US/state-sc/government', abbr: 'SC'},
  { ocdId: 'ocd-jurisdiction/country/US/state-sd/government', abbr: 'SD'},
  { ocdId: 'ocd-jurisdiction/country/US/state-tn/government', abbr: 'TN'},
  { ocdId: 'ocd-jurisdiction/country/US/state-tx/government', abbr: 'TX'},
  { ocdId: 'ocd-jurisdiction/country/US/state-ut/government', abbr: 'UT'},
  { ocdId: 'ocd-jurisdiction/country/US/state-vt/government', abbr: 'VT'},
  { ocdId: 'ocd-jurisdiction/country/US/state-va/government', abbr: 'VA'},
  { ocdId: 'ocd-jurisdiction/country/US/state-wa/government', abbr: 'WA'},
  { ocdId: 'ocd-jurisdiction/country/US/state-wv/government', abbr: 'WV'},
  { ocdId: 'ocd-jurisdiction/country/US/state-wi/government', abbr: 'WI'},
  { ocdId: 'ocd-jurisdiction/country/US/state-wy/government', abbr: 'WY'},
  // (Keep the full list from previous version if populated, or instruct user to populate it)
];

// Helper function to introduce delays (milliseconds)
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper to transform OpenStates bill data to our Legislation type
// This function remains largely the same, ensure sourceId is correctly populated
function transformOpenStatesBill(osBill: any, jurisdictionAbbr: string): Omit<Legislation, 'id' | 'lastActionDate' | 'introductionDate' | 'history' | 'effectiveDate' | 'versions'> & {
  sourceId: string; // Ensure sourceId is part of the return type and non-optional for the data passed to upsert
  introductionDate?: Date;
  lastActionDate?: Date;
  effectiveDate?: Date; 
  history?: Array<Omit<LegislationHistoryEvent, 'date'> & { date: Date }>;
  versions?: Array<{ date: Date; url: string; name: string }>;
} {
  const sponsors: LegislationSponsor[] = osBill.sponsorships?.map((sp: any) => ({
    name: sp.name,
    id: sp.person_id || undefined,
  })) || [];

  const history: Array<Omit<LegislationHistoryEvent, 'date'> & { date: Date }> = osBill.actions?.map((act: any) => ({
    date: new Date(act.date.split(' ')[0]), 
    action: act.description,
    actor: act.organization_id || 'Unknown', 
    details: act.classification?.join(', ') || undefined,
  })) || [];

  const versions: Array<{ date: Date; url: string; name: string }> = osBill.versions?.map((ver: any) => ({
    date: new Date(ver.date.split(' ')[0]),
    name: ver.note,
    url: ver.links?.find((link: any) => link.media_type === 'application/pdf')?.url || ver.links?.[0]?.url || '',
  })) || [];

  let summary = '';
  if (osBill.abstracts && osBill.abstracts.length > 0) {
    summary = osBill.abstracts[0].abstract;
  }

  // Crucially, ensure osBill.id is mapped to sourceId
  const legislationData = {
    title: osBill.title,
    billNumber: osBill.identifier,
    jurisdiction: jurisdictionAbbr,
    status: osBill.status?.length > 0 ? osBill.status[0] : (osBill.actions?.[osBill.actions.length -1]?.description || 'Unknown'),
    summary: summary || undefined,
    fullTextUrl: osBill.sources?.find((s:any) => s.url.includes('.html') || s.url.includes('.pdf'))?.url || osBill.sources?.[0]?.url || undefined,
    sponsors,
    introductionDate: osBill.first_action_date ? new Date(osBill.first_action_date.split(' ')[0]) : undefined,
    lastActionDate: osBill.latest_action_date ? new Date(osBill.latest_action_date.split(' ')[0]) : undefined,
    history,
    tags: osBill.subject || [],
    sourceId: osBill.id, // This is the OpenStates bill ID, used for deduplication
    chamber: osBill.from_organization?.classification || undefined,
    versions: versions.length > 0 ? versions : undefined,
  };
   // Type assertion needed if TS can't infer sourceId presence strictly from the object literal
  return legislationData as ReturnType<typeof transformOpenStatesBill>;
}

interface OpenStatesSession {
  identifier: string;
  name: string;
  start_date?: string;
  end_date?: string;
  classification: string; 
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

// UPDATED_SINCE_HOURS: Set to 24 for daily, 1 for hourly.
const UPDATED_SINCE_HOURS = 24; 

async function fetchAndStoreUpdatedBills(ocdId: string, jurisdictionAbbr: string, sessionIdentifier: string, updatedSince: string) {
  let page = 1;
  const perPage = 50; // Maximize per_page to reduce number of requests for updates
  let hasMore = true;
  let billsProcessed = 0;

  console.log(`Fetching bills updated since ${updatedSince} for ${jurisdictionAbbr} - Session: ${sessionIdentifier}`);

  while (hasMore) {
    // Added updated_since parameter
    const url = `${OPENSTATES_API_BASE_URL}/bills?jurisdiction=${ocdId}&session=${sessionIdentifier}&page=${page}&per_page=${perPage}&apikey=${OPENSTATES_API_KEY}&include=sponsorships&include=abstracts&include=versions&include=actions&sort=updated_desc&updated_since=${updatedSince}`;
    
    console.log(`Fetching page ${page} from: ${url.replace(OPENSTATES_API_KEY as string, 'REDACTED_KEY')}`);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Error fetching updated bills page ${page} for ${jurisdictionAbbr}, session ${sessionIdentifier}: ${response.status} ${await response.text()}`);
        hasMore = false; 
        break;
      }
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        for (const osBill of data.results) {
          try {
            const legislationData = transformOpenStatesBill(osBill, jurisdictionAbbr);
            await upsertLegislationBySourceId(legislationData); // Using upsert function
            console.log(`Upserted: ${legislationData.billNumber} (${jurisdictionAbbr}) - OS ID: ${legislationData.sourceId}`);
            billsProcessed++;
          } catch (transformError) {
            console.error(`Error transforming or upserting bill ${osBill.identifier} (OS ID: ${osBill.id}):`, transformError);
          }
        }
      } else {
        console.log(`No more updated bills found for ${jurisdictionAbbr}, session ${sessionIdentifier}, page ${page} (since ${updatedSince}).`);
        hasMore = false;
      }

      if (data.pagination && page < data.pagination.max_page) {
        page++;
        await delay(1500); // Slightly shorter delay for paged updates, but still respectful
      } else {
        hasMore = false;
      }

    } catch (error) {
      console.error(`Network error fetching updated bills for ${jurisdictionAbbr}, session ${sessionIdentifier}, page ${page}:`, error);
      hasMore = false; 
      break;
    }
  }
  console.log(`Finished fetching updates for ${jurisdictionAbbr}, session ${sessionIdentifier} (since ${updatedSince}). Processed ${billsProcessed} bills.`);
}

async function main() {
  if (!OPENSTATES_API_KEY) {
    console.error("Error: OPENSTATES_API_KEY environment variable is not set. Please add it to your .env file.");
    return;
  }
  if (STATE_OCD_IDS.length === 0 || (STATE_OCD_IDS[0].abbr === 'AL' && STATE_OCD_IDS.length <= 5 && STATE_OCD_IDS.length > 0 && STATE_OCD_IDS.every(s => s.ocdId.startsWith('ocd-jurisdiction/country:us/state:')))) {
      console.warn("Warning: STATE_OCD_IDS list in src/scripts/fetchOpenStatesData.ts is not fully populated with all 50 states. Please add all state OCD-IDs and abbreviations for complete data fetching.");
  }

  // Calculate the 'updated_since' timestamp (e.g., 24 hours ago for daily run)
  const now = new Date();
  const updatedSinceDate = new Date(now.getTime() - (UPDATED_SINCE_HOURS * 60 * 60 * 1000));
  // OpenStates API expects ISO 8601 format, but sometimes just YYYY-MM-DD works for updated_since.
  // For safety, let's use YYYY-MM-DD. If more precision is needed, use .toISOString().split('T')[0] or full ISO.
  // OpenStates documentation for `updated_since` specifies "A date or datetime"
  // Using YYYY-MM-DD format.
  const updatedSinceString = updatedSinceDate.toISOString().split('T')[0];
  // For more precise "updated_since" (e.g. specific time):
  // const updatedSinceString = updatedSinceDate.toISOString();


  console.log(`--- Starting fetch for legislation updated since ${updatedSinceString} ---`);

  for (const state of STATE_OCD_IDS) {
    console.log(`\n--- Processing State: ${state.abbr} (${state.ocdId}) ---`);
    const sessions = await fetchSessionsForJurisdiction(state.ocdId);
    
    if (sessions.length > 0) {
      const today = new Date();
      // Filter for sessions that are likely current or very recent.
      // A session is "current" if:
      // 1. It has no end_date and its start_date is not in the future.
      // 2. Its end_date is in the future or very recent (e.g., within the last few months for carry-over).
      // 3. Its classification is 'primary'.
      let currentSessions = sessions.filter(s => {
        const sessionStartDate = s.start_date ? new Date(s.start_date) : null;
        const sessionEndDate = s.end_date ? new Date(s.end_date) : null;

        if (!sessionStartDate || sessionStartDate > today) return false; // Skip future sessions

        // Prioritize 'primary' sessions if available
        // if (s.classification !== 'primary' && sessions.some(p => p.classification === 'primary')) return false;


        if (!sessionEndDate) return true; // Ongoing session

        // Session ends today or in the future, or ended recently (e.g., within last 90 days for buffer)
        const ninetyDaysAgo = new Date(today.getTime() - (90 * 24 * 60 * 60 * 1000));
        return sessionEndDate >= ninetyDaysAgo;
      });
      
      if (currentSessions.length === 0 && sessions.length > 0) {
          console.log(`No strictly "current" sessions found for ${state.abbr}. Using the single most recent session as a fallback if not in future.`);
          const mostRecentSession = sessions[0]; 
          const mostRecentStartDate = mostRecentSession.start_date ? new Date(mostRecentSession.start_date) : null;
          if (mostRecentStartDate && mostRecentStartDate <= today) { 
               currentSessions = [mostRecentSession];
               console.log(`Using fallback: most recent session ${mostRecentSession.name} (${mostRecentSession.identifier})`);
          } else {
            console.log(`Most recent session ${mostRecentSession.name} for ${state.abbr} appears to be in the future or invalid; skipping.`);
          }
      }
      
      console.log(`Found ${currentSessions.length} potentially current session(s) for ${state.abbr}: ${currentSessions.map(s=>`${s.name} (${s.identifier})`).join(', ')}`);

      for (const session of currentSessions) {
        await fetchAndStoreUpdatedBills(state.ocdId, state.abbr, session.identifier, updatedSinceString);
        await delay(3000); // Wait 3 seconds between sessions of the same state
      }
    } else {
      console.log(`No sessions found for ${state.abbr}. Skipping.`);
    }
     await delay(5000); // Wait 5 seconds between states
  }

  console.log("\n--- Finished processing all states for updates. ---");
  console.log("--- This script is designed for frequent updates (e.g., daily/hourly). ---");
  console.log("--- To run it automatically, use a scheduler like cron, a scheduled Cloud Function, or GitHub Actions. ---");
}

// To run this script:
// 1. Ensure .env file at project root has OPENSTATES_API_KEY="your_actual_key"
// 2. Ensure Firebase Admin SDK is set up if running outside Firebase environment, OR that client-side Firebase config is sufficient.
// 3. From your project root, run: npx tsx src/scripts/fetchOpenStatesData.ts
//    (You might need to install tsx: npm install -g tsx or npm install --save-dev tsx)
// 4. CRITICAL: Fully populate the STATE_OCD_IDS array in this script with all 50 states for comprehensive data.
// 5. SCHEDULING: For automatic daily/hourly runs, set up a cron job, a scheduled Cloud Function, or a similar task scheduler to execute this script.

main().catch(err => {
  console.error("Unhandled error in main execution:", err);
});
