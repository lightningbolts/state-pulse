import { upsertLegislationBySourceId } from '../services/legislationService';
import type { Legislation, LegislationHistoryEvent, LegislationSponsor } from '../types/legislation';
import { config } from 'dotenv';
import { ai } from '../ai/genkit';
import fetch from 'node-fetch';
import pdf from 'pdf-parse';
import * as cheerio from 'cheerio';
import { generateGeminiSummary, fetchPdfTextFromOpenStatesUrl } from '../lib/geminiSummaryUtil';

config({ path: '../../.env' });

const OPENSTATES_API_KEY = process.env.OPENSTATES_API_KEY;
const OPENSTATES_API_BASE_URL = 'https://v3.openstates.org';

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
];

// Helper function to introduce delays (milliseconds)
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Utility to convert OpenStates IDs to display format
function displayOpenStatesId(id: string): string {
  if (id.startsWith('ocd-bill/')) {
    const rest = id.replace('ocd-bill/', '');
    const idx = rest.indexOf('-');
    if (idx !== -1) {
      return 'ocd-bill_' + rest.slice(idx + 1);
    }
    return 'ocd-bill_' + rest;
  }
  return id;
}

// Helper to transform OpenStates bill data to our Legislation type
// This function remains largely the same, ensure sourceId is correctly populated
function transformOpenStatesBill(osBill: any, jurisdictionAbbr: string): any {
  const sponsors: LegislationSponsor[] = osBill.sponsorships?.map((sp: any) => ({
    name: sp.name,
    id: sp.person_id || null,
  })) || [];

  const history: Array<Omit<LegislationHistoryEvent, 'date'> & { date: Date }> = osBill.actions?.map((act: any) => ({
    date: new Date(act.date.split(' ')[0]), 
    action: act.description,
    actor: act.organization_id || 'Unknown', 
    details: act.classification?.join(', ') || null,
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
    summary: summary || null,
    fullTextUrl: osBill.sources?.find((s:any) => s.url.includes('.html') || s.url.includes('.pdf'))?.url || osBill.sources?.[0]?.url || null,
    sponsors,
    introductionDate: osBill.first_action_date ? new Date(osBill.first_action_date.split(' ')[0]) : null,
    lastActionDate: osBill.latest_action_date ? new Date(osBill.latest_action_date.split(' ')[0]) : null,
    history,
    tags: osBill.subject || [],
    sourceId: osBill.id, // This is the OpenStates bill ID, used for deduplication
    chamber: osBill.from_organization?.classification || null,
    versions: versions.length > 0 ? versions : null,
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

// --- NEW: 30-minute update system ---
const UPDATE_INTERVAL_MINUTES = 30;

function getUpdatedSinceString(minutesAgo: number): string {
  const now = new Date();
  const updatedSinceDate = new Date(now.getTime() - (minutesAgo * 60 * 1000));
  return updatedSinceDate.toISOString(); // Use full ISO for more precise legislation
}

// Generate Gemini summary
async function generateGeminiSummary(text: string): Promise<string> {
  const prompt = `Summarize the following legislation in about 100 words, focusing on the main points and specific impact.\n\n${text}`;
  const response = await ai.generate({ prompt });
  return response.text.trim();
}

async function fetchAndStoreUpdatedBills(
  ocdId: string,
  jurisdictionAbbr: string,
  sessionIdentifier: string,
  updatedSince: string
) {
  let page = 1;
  const perPage = 50;
  let hasMore = true;
  let billsProcessed = 0;

  console.log(`Fetching bills updated since ${updatedSince} for ${jurisdictionAbbr} - Session: ${sessionIdentifier}`);

  while (hasMore) {
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
            legislationData.id = displayOpenStatesId(osBill.id);
            // --- Scrape full text and generate Gemini summary using util ---
            let fullText = '';
            if (osBill.sources && osBill.sources.length > 0) {
              const openstatesUrl = osBill.sources[0].url;
              legislationData.openstatesUrl = openstatesUrl;
              fullText = (await fetchPdfTextFromOpenStatesUrl(openstatesUrl)) || legislationData.title || '';
            } else {
              fullText = legislationData.title || '';
            }
            legislationData.fullText = fullText;
            legislationData.geminiSummary = fullText ? await generateGeminiSummary(fullText) : null;
            await upsertLegislationBySourceId(legislationData);
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
        await delay(1500);
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

async function runUpdateCycle() {
  if (!OPENSTATES_API_KEY) {
    console.error("Error: OPENSTATES_API_KEY environment variable is not set. Please add it to your .env file.");
    return;
  }
  if (STATE_OCD_IDS.length === 0 || (STATE_OCD_IDS[0].abbr === 'AL' && STATE_OCD_IDS.length <= 5 && STATE_OCD_IDS.length > 0 && STATE_OCD_IDS.every(s => s.ocdId.startsWith('ocd-jurisdiction/country:us/state:')))) {
      console.warn("Warning: STATE_OCD_IDS list in src/scripts/fetchOpenStatesData.ts is not fully populated with all 50 states. Please add all state OCD-IDs and abbreviations for complete data fetching.");
  }
  const updatedSinceString = getUpdatedSinceString(UPDATE_INTERVAL_MINUTES);
  console.log(`--- Starting fetch for legislation updated since ${updatedSinceString} ---`);
  for (const state of STATE_OCD_IDS) {
    console.log(`\n--- Processing State: ${state.abbr} (${state.ocdId}) ---`);
    const sessions = await fetchSessionsForJurisdiction(state.ocdId);
    if (sessions.length > 0) {
      const today = new Date();
      let currentSessions = sessions.filter(s => {
        const sessionStartDate = s.start_date ? new Date(s.start_date) : null;
        const sessionEndDate = s.end_date ? new Date(s.end_date) : null;
        if (!sessionStartDate || sessionStartDate > today) return false;
        if (!sessionEndDate) return true;
        const ninetyDaysAgo = new Date(today.getTime() - (90 * 24 * 60 * 60 * 1000));
        return sessionEndDate >= ninetyDaysAgo;
      });
      if (currentSessions.length === 0 && sessions.length > 0) {
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
        await delay(3000);
      }
    } else {
      console.log(`No sessions found for ${state.abbr}. Skipping.`);
    }
    await delay(5000);
  }
  console.log("\n--- Finished processing all states for legislation. ---");
  console.log("--- This script is designed for frequent legislation (e.g., every 30 minutes). ---");
}

async function main() {
  while (true) {
    await runUpdateCycle();
    console.log(`Waiting ${UPDATE_INTERVAL_MINUTES} minutes before next update cycle...`);
    await delay(UPDATE_INTERVAL_MINUTES * 60 * 1000);
  }
}

main().catch(err => {
  console.error("Unhandled error in main execution:", err);
});
