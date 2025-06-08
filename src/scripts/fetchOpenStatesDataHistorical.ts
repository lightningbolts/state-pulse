
import { upsertLegislationBySourceId } from '../services/legislationService';
import type { Legislation, LegislationHistoryEvent, LegislationSponsor } from '../types/legislation';
import { Timestamp } from 'firebase/firestore';
import { config } from 'dotenv';

// Load environment variables from .env file at the project root
config(); 

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
  // TODO: ADD ALL 50 STATES HERE.
  // Example: { ocdId: 'ocd-jurisdiction/country:us/state:tx/government', abbr: 'TX' },
  // Example: { ocdId: 'ocd-jurisdiction/country:us/state:ny/government', abbr: 'NY' },
];

// Helper function to introduce delays (milliseconds)
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper to transform OpenStates bill data to our Legislation type
function transformOpenStatesBill(osBill: any, jurisdictionAbbr: string): Omit<Legislation, 'id' | 'lastActionDate' | 'introductionDate' | 'history' | 'effectiveDate' | 'versions'> & {
  sourceId: string;
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
    sourceId: osBill.id, 
    chamber: osBill.from_organization?.classification || undefined,
    versions: versions.length > 0 ? versions : undefined,
  };
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

async function fetchAndStoreBillsForSession(ocdId: string, jurisdictionAbbr: string, sessionIdentifier: string, sessionName: string) {
  let page = 1;
  const perPage = 50; // Maximize per_page to reduce number of requests
  let hasMore = true;
  let billsProcessedInSession = 0;

  console.log(`Fetching bills for ${jurisdictionAbbr} - Session: ${sessionName} (${sessionIdentifier})`);

  while (hasMore) {
    const url = `${OPENSTATES_API_BASE_URL}/bills?jurisdiction=${ocdId}&session=${sessionIdentifier}&page=${page}&per_page=${perPage}&apikey=${OPENSTATES_API_KEY}&include=sponsorships&include=abstracts&include=versions&include=actions&sort=updated_desc`;
    
    console.log(`Fetching page ${page} from: ${url.replace(OPENSTATES_API_KEY as string, 'REDACTED_KEY')}`);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Error fetching bills page ${page} for ${jurisdictionAbbr}, session ${sessionIdentifier}: ${response.status} ${await response.text()}`);
        hasMore = false; 
        break;
      }
      const data = await response.json();
      
      if (data.results && data.results.length > 0) {
        for (const osBill of data.results) {
          try {
            const legislationData = transformOpenStatesBill(osBill, jurisdictionAbbr);
            await upsertLegislationBySourceId(legislationData);
            console.log(`Upserted: ${legislationData.billNumber} (${jurisdictionAbbr}) from session ${sessionName} - OS ID: ${legislationData.sourceId}`);
            billsProcessedInSession++;
          } catch (transformError) {
            console.error(`Error transforming or upserting bill ${osBill.identifier} (OS ID: ${osBill.id}):`, transformError);
          }
        }
      } else {
        console.log(`No more bills found for ${jurisdictionAbbr}, session ${sessionIdentifier}, page ${page}.`);
        hasMore = false;
      }

      if (data.pagination && page < data.pagination.max_page) {
        page++;
        await delay(1500); // Be respectful with API rate limits
      } else {
        hasMore = false;
      }

    } catch (error) {
      console.error(`Network error fetching bills for ${jurisdictionAbbr}, session ${sessionIdentifier}, page ${page}:`, error);
      hasMore = false; 
      break;
    }
  }
  console.log(`Finished fetching bills for ${jurisdictionAbbr}, session ${sessionName}. Processed ${billsProcessedInSession} bills.`);
}

async function main() {
  console.log("--- Starting historical data import for the last five years ---");
  if (!OPENSTATES_API_KEY) {
    console.error("Error: OPENSTATES_API_KEY environment variable is not set. Please add it to your .env file.");
    return;
  }
  if (STATE_OCD_IDS.length === 0 || (STATE_OCD_IDS[0].abbr === 'AL' && STATE_OCD_IDS.length <= 5 && STATE_OCD_IDS.every(s => s.ocdId.startsWith('ocd-jurisdiction/country:us/state:')))) {
      console.warn("Warning: STATE_OCD_IDS list in src/scripts/fetchOpenStatesDataHistorical.ts is not fully populated. Please add all state OCD-IDs and abbreviations for complete data fetching.");
      // return; // Optionally stop if not fully populated
  }

  const today = new Date();
  const fiveYearsAgo = new Date(today.getFullYear() - 5, today.getMonth(), today.getDate());
  console.log(`Fetching data for sessions active since ${fiveYearsAgo.toISOString().split('T')[0]}`);

  for (const state of STATE_OCD_IDS) {
    console.log(`\n--- Processing State for Historical Data: ${state.abbr} (${state.ocdId}) ---`);
    const sessions = await fetchSessionsForJurisdiction(state.ocdId);
    
    if (sessions.length > 0) {
      const relevantSessions = sessions.filter(s => {
        const sessionStartDate = s.start_date ? new Date(s.start_date) : null;
        const sessionEndDate = s.end_date ? new Date(s.end_date) : null;

        if (sessionStartDate && sessionStartDate > today) return false; // Skip future sessions

        // If session has an end date, it must have ended after fiveYearsAgo
        if (sessionEndDate) {
          return sessionEndDate >= fiveYearsAgo;
        }
        // If no end date (ongoing or very old with no end_date recorded),
        // check if it started within the last five years (or was ongoing into this period)
        if (sessionStartDate) {
          return sessionStartDate < today && sessionStartDate >= fiveYearsAgo;
        }
        // Fallback for sessions with no start or end date (less common for recent data)
        // or if very old sessions might still be marked as 'primary' without dates.
        // This might need refinement based on OpenStates data quality for older sessions.
        // For now, if no dates, we might skip or take a more conservative approach.
        // Let's prioritize sessions with start dates for clarity.
        return false; 
      });

      if (relevantSessions.length === 0 && sessions.length > 0) {
          console.log(`No sessions found strictly within the last 5 years for ${state.abbr}. Attempting to use the most recent session if not in future.`);
          const mostRecentSession = sessions[0];
          const mostRecentStartDate = mostRecentSession.start_date ? new Date(mostRecentSession.start_date) : null;
          if (mostRecentStartDate && mostRecentStartDate <= today) {
              console.log(`Using fallback: most recent session ${mostRecentSession.name} (${mostRecentSession.identifier}) for historical import.`);
              await fetchAndStoreBillsForSession(state.ocdId, state.abbr, mostRecentSession.identifier, mostRecentSession.name);
          } else {
              console.log(`Most recent session ${mostRecentSession.name} for ${state.abbr} seems to be in the future or has no valid start date; skipping.`);
          }
      } else if (relevantSessions.length > 0) {
          console.log(`Found ${relevantSessions.length} session(s) for ${state.abbr} within the last five years: ${relevantSessions.map(s=>`${s.name} (${s.identifier})`).join(', ')}`);
          for (const session of relevantSessions) {
            await fetchAndStoreBillsForSession(state.ocdId, state.abbr, session.identifier, session.name);
            await delay(3000); // Wait 3 seconds between sessions of the same state
          }
      } else {
          console.log(`No relevant sessions found for ${state.abbr}.`);
      }
    } else {
      console.log(`No sessions found for ${state.abbr}. Skipping.`);
    }
     await delay(5000); // Wait 5 seconds between states
  }

  console.log("\n--- Finished historical data import. ---");
  console.log("--- This script is for bulk importing legislation from the last five years. ---");
  console.log("--- For regular updates of current legislation, use the `fetchOpenStatesData.ts` script with a scheduler. ---");
}

// To run this script:
// 1. Ensure .env file at project root has OPENSTATES_API_KEY="your_actual_key"
// 2. CRITICAL: Fully populate the STATE_OCD_IDS array in this script with all 50 states.
// 3. From your project root, run: npx tsx src/scripts/fetchOpenStatesDataHistorical.ts
//    (You might need to install tsx: npm install -g tsx or npm install --save-dev tsx)

main().catch(err => {
  console.error("Unhandled error in main execution of historical data fetch:", err);
});


    