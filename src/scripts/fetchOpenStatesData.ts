import { upsertLegislationSelective } from '../services/legislationService';
import { config } from 'dotenv';
import { ai } from '../ai/genkit';
import fetch from 'node-fetch';
import pdf from 'pdf-parse';
import * as cheerio from 'cheerio';
import {
  generateOllamaSummary,
  fetchPdfTextFromOpenStatesUrl,
  extractBestTextForSummary,
  generateGeminiSummary
} from '../services/aiSummaryUtil';

config({ path: '../../.env' });

// Gemini 2.0 Flash rate limiting: 10 RPM, 1,000,000 TPM, 200 RPD
class GeminiRateLimiter {
  private requestsPerMinute: number[] = [];
  private requestsPerDay: number[] = [];
  private tokensPerMinute: number[] = [];
  private readonly MAX_RPM = 50;
  private readonly MAX_TPM = 2000000;
  private readonly MAX_RPD = 1000;

  async waitForRateLimit(estimatedTokens: number = 1000): Promise<void> {
    const now = Date.now();

    // Clean old entries
    this.requestsPerMinute = this.requestsPerMinute.filter(time => now - time < 60000);
    this.requestsPerDay = this.requestsPerDay.filter(time => now - time < 86400000);
    this.tokensPerMinute = this.tokensPerMinute.filter(time => now - time < 60000);

    // Check daily limit
    if (this.requestsPerDay.length >= this.MAX_RPD) {
      const oldestRequest = Math.min(...this.requestsPerDay);
      const waitTime = 86400000 - (now - oldestRequest);
      console.log(`Daily request limit reached. Waiting ${Math.ceil(waitTime / 1000 / 60)} minutes...`);
      await this.sleep(waitTime);
      return this.waitForRateLimit(estimatedTokens);
    }

    // Check requests per minute
    if (this.requestsPerMinute.length >= this.MAX_RPM) {
      const oldestRequest = Math.min(...this.requestsPerMinute);
      const waitTime = 60000 - (now - oldestRequest) + 1000; // Add 1 second buffer
      console.log(`RPM limit reached. Waiting ${Math.ceil(waitTime / 1000)} seconds...`);
      await this.sleep(waitTime);
      return this.waitForRateLimit(estimatedTokens);
    }

    // Check tokens per minute (rough estimation)
    const currentTokens = this.tokensPerMinute.length * 1000; // Rough estimate
    if (currentTokens + estimatedTokens > this.MAX_TPM) {
      const oldestToken = Math.min(...this.tokensPerMinute);
      const waitTime = 60000 - (now - oldestToken) + 1000;
      console.log(`TPM limit approaching. Waiting ${Math.ceil(waitTime / 1000)} seconds...`);
      await this.sleep(waitTime);
      return this.waitForRateLimit(estimatedTokens);
    }

    // Record this request
    this.requestsPerMinute.push(now);
    this.requestsPerDay.push(now);
    this.tokensPerMinute.push(now);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStats() {
    const now = Date.now();
    const activeRequestsPerMinute = this.requestsPerMinute.filter(time => now - time < 60000).length;
    const activeRequestsPerDay = this.requestsPerDay.filter(time => now - time < 86400000).length;
    const activeTokensPerMinute = this.tokensPerMinute.filter(time => now - time < 60000).length;

    return {
      rpm: `${activeRequestsPerMinute}/${this.MAX_RPM}`,
      rpd: `${activeRequestsPerDay}/${this.MAX_RPD}`,
      tpm: `~${activeTokensPerMinute * 1000}/${this.MAX_TPM}`
    };
  }
}

const geminiRateLimiter = new GeminiRateLimiter();

// Rate-limited wrapper for generateGeminiSummary
async function generateGeminiSummaryWithRateLimit(text: string): Promise<string> {
  // Estimate tokens (rough approximation: 4 chars per token)
  const estimatedTokens = Math.ceil(text.length / 4) + 100; // +100 for response

  await geminiRateLimiter.waitForRateLimit(estimatedTokens);
  const stats = geminiRateLimiter.getStats();
  console.log(`Calling Gemini API. Current usage - RPM: ${stats.rpm}, RPD: ${stats.rpd}, TPM: ${stats.tpm}`);

  return await generateGeminiSummary(text);
}

const OPENSTATES_API_KEY = process.env.OPENSTATES_API_KEY;
const OPENSTATES_API_BASE_URL = 'https://v3.openstates.org';

const STATE_OCD_IDS: { ocdId: string, abbr: string }[] = [
  // { ocdId: 'ocd-jurisdiction/country:us/state:al/government', abbr: 'AL' },
  // { ocdId: 'ocd-jurisdiction/country:us/state:ak/government', abbr: 'AK' },
  // { ocdId: 'ocd-jurisdiction/country:us/state:az/government', abbr: 'AZ' },
  // { ocdId: 'ocd-jurisdiction/country:us/state:ar/government', abbr: 'AR' },
  // { ocdId: 'ocd-jurisdiction/country:us/state:ca/government', abbr: 'CA' },
  // { ocdId: 'ocd-jurisdiction/country:us/state:co/government', abbr: 'CO' },
  // { ocdId: 'ocd-jurisdiction/country:us/state:ct/government', abbr: 'CT' },
  // { ocdId: 'ocd-jurisdiction/country:us/state:de/government', abbr: 'DE' },
  // { ocdId: 'ocd-jurisdiction/country:us/state:fl/government', abbr: 'FL' },
  // { ocdId: 'ocd-jurisdiction/country:us/state:ga/government', abbr: 'GA' },
  // { ocdId: 'ocd-jurisdiction/country:us/state:hi/government', abbr: 'HI' },
  // { ocdId: 'ocd-jurisdiction/country:us/state:id/government', abbr: 'ID' },
  // { ocdId: 'ocd-jurisdiction/country:us/state:il/government', abbr: 'IL' },
  // { ocdId: 'ocd-jurisdiction/country:us/state:in/government', abbr: 'IN' },
  { ocdId: 'ocd-jurisdiction/country:us/state:ia/government', abbr: 'IA' },
  { ocdId: 'ocd-jurisdiction/country:us/state:ks/government', abbr: 'KS' },
  { ocdId: 'ocd-jurisdiction/country:us/state:ky/government', abbr: 'KY' },
  { ocdId: 'ocd-jurisdiction/country:us/state:la/government', abbr: 'LA' },
  { ocdId: 'ocd-jurisdiction/country:us/state:me/government', abbr: 'ME' },
  { ocdId: 'ocd-jurisdiction/country:us/state:md/government', abbr: 'MD' },
  { ocdId: 'ocd-jurisdiction/country:us/state:ma/government', abbr: 'MA' },
  { ocdId: 'ocd-jurisdiction/country:us/state:mi/government', abbr: 'MI'},
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
  { ocdId: 'ocd-jurisdiction/country:us/state:ri/government', abbr: 'RI'},
  { ocdId: 'ocd-jurisdiction/country:us/state:sc/government', abbr: 'SC'},
  { ocdId: 'ocd-jurisdiction/country:us/state:sd/government', abbr: 'SD'},
  { ocdId: 'ocd-jurisdiction/country:us/state:tn/government', abbr: 'TN'},
  { ocdId: 'ocd-jurisdiction/country:us/state:tx/government', abbr: 'TX'},
  { ocdId: 'ocd-jurisdiction/country:us/state:ut/government', abbr: 'UT'},
  { ocdId: 'ocd-jurisdiction/country:us/state:vt/government', abbr: 'VT'},
  { ocdId: 'ocd-jurisdiction/country:us/state:va/government', abbr: 'VA'},
  { ocdId: 'ocd-jurisdiction/country:us/state:wa/government', abbr: 'WA'},
  { ocdId: 'ocd-jurisdiction/country:us/state:wv/government', abbr: 'WV'},
  { ocdId: 'ocd-jurisdiction/country:us/state:wi/government', abbr: 'WI'},
  { ocdId: 'ocd-jurisdiction/country:us/state:wy/government', abbr: 'WY'},
    // Add congress
  { ocdId: 'ocd-jurisdiction/country:us/legislature', abbr: 'us' },
];

// Helper function to introduce delays (milliseconds)
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Convert date strings or timestamp objects to JavaScript Date objects
 */
function toMongoDate(
  dateInput: Date | { seconds: number; nanoseconds: number } | string | null | undefined
): Date | null {
  if (dateInput === null || typeof dateInput === 'undefined' || dateInput === '') {
    return null;
  }

  if (dateInput instanceof Date) {
    return isNaN(dateInput.getTime()) ? null : dateInput;
  }

  if (typeof dateInput === 'object' && 'seconds' in dateInput && 'nanoseconds' in dateInput) {
    // Convert Firebase Timestamp format to Date
    return new Date(dateInput.seconds * 1000);
  }

  // Handle string dates
  if (typeof dateInput === 'string') {
    const date = new Date(dateInput.split(' ')[0]);
    return isNaN(date.getTime()) ? null : date;
  }

  return null;
}

// Utility to convert OpenStates IDs to display format
function displayOpenStatesId(id: string): string {
  // Replace the first dash with an underscore, and remove 'ocd-bill/' prefix
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

/**
 * Transforms an OpenStates bill to a MongoDB-compatible document
 */
export function transformOpenStatesBillToMongoDB(osBill: any): any {
  // Process sponsors
  const sponsors = (osBill.sponsorships || []).map((sp: any) => {
    let sponsorId: string | null = null;
    let entityType: string | null = sp.entity_type || null;
    let personId: string | null = null;
    let organizationId: string | null = null;

    if (sp.person) {
      sponsorId = sp.person.id;
      personId = sp.person.id;
      if (!entityType) entityType = 'person';
    } else if (sp.organization) {
      sponsorId = sp.organization.id;
      organizationId = sp.organization.id;
      if (!entityType) entityType = 'organization';
    }

    return {
      name: sp.name,
      id: sponsorId,
      entityType: entityType,
      primary: sp.primary || false,
      classification: sp.classification || null,
      personId: personId,
      organizationId: organizationId,
    };
  });

  // Process bill action history
  const history = (osBill.actions || [])
    .map((act: any) => {
      const eventDate = toMongoDate(act.date);
      if (!eventDate) return null;
      return {
        date: eventDate,
        action: act.description,
        actor: act.organization.name,
        classification: Array.isArray(act.classification) ? act.classification : [],
        order: act.order,
      };
    })
    .filter((h: any): h is NonNullable<typeof h> => h !== null);

  // Process bill versions
  const versions = (osBill.versions || [])
    .map((ver: any) => {
      const versionDate = toMongoDate(ver.date);
      if (!versionDate) return null;
      return {
        note: ver.note,
        date: versionDate,
        classification: ver.classification || null,
        links: (ver.links || []).map((l: any) => ({
          url: l.url,
          media_type: l.media_type || null,
        })),
      };
    })
    .filter((v: any): v is NonNullable<typeof v> => v !== null);

  // Process sources
  const sources = (osBill.sources || []).map((s: any) => ({
    url: s.url,
    note: s.note || null,
  }));

  // Process abstracts
  const abstracts = (osBill.abstracts || []).map((a: any) => ({
    abstract: a.abstract,
    note: a.note || null,
  }));

  // Get summary from first abstract if available
  const summary = abstracts.length > 0 ? abstracts[0].abstract : null;

  // Process extras
  let processedExtras: Record<string, any> | null = null;
  if (osBill.extras && Object.keys(osBill.extras).length > 0) {
    try {
      processedExtras = JSON.parse(JSON.stringify(osBill.extras));
    } catch (e) {
      console.warn(`Could not process extras for bill ${osBill.id}: ${e}`);
      processedExtras = null;
    }
  }

  const now = new Date();

  return {
    id: displayOpenStatesId(osBill.id),
    identifier: osBill.identifier,
    title: osBill.title,
    session: osBill.session,
    jurisdictionId: osBill.jurisdiction.id,
    jurisdictionName: osBill.jurisdiction.name,
    chamber:
      osBill.from_organization?.classification ||
      osBill.jurisdiction?.classification ||
      null,
    classification: Array.isArray(osBill.classification) ? osBill.classification : [],
    subjects: Array.isArray(osBill.subject) ? osBill.subject : [],
    statusText: osBill.latest_action_description || null,
    sponsors,
    history,
    versions: versions || [],
    sources: sources || [],
    abstracts: abstracts || [],
    openstatesUrl: osBill.openstates_url,
    firstActionAt: toMongoDate(osBill.first_action_date),
    latestActionAt: toMongoDate(osBill.latest_action_date),
    latestActionDescription: osBill.latest_action_description || null,
    latestPassageAt: toMongoDate(osBill.latest_passage_date),
    createdAt: toMongoDate(osBill.created_at) || now,
    updatedAt: toMongoDate(osBill.updated_at) || now,
    summary: summary,
    extras: processedExtras,
  };
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

// --- NEW: 12-hour update system ---
const UPDATE_INTERVAL_HOURS = 12;

function getUpdatedSinceString(hoursAgo: number): string {
  const now = new Date();
  const updatedSinceDate = new Date(now.getTime() - (hoursAgo * 60 * 60 * 1000));
  return updatedSinceDate.toISOString().split('.')[0];
}

async function fetchAndStoreUpdatedBills(
  ocdId: string,
  jurisdictionAbbr: string,
  sessionIdentifier: string,
  updatedSince: string
) {
  let page = 1;
  const perPage = 20;
  let hasMore = true;
  let billsProcessed = 0;

  console.log(`Fetching bills updated since ${updatedSince} for ${jurisdictionAbbr} - Session: ${sessionIdentifier}`);

  while (hasMore) {
    const includes = [
      'sponsorships',
      'abstracts',
      'versions',
      'actions',
      'sources',
    ];
    const includeParams = includes.map(inc => `include=${inc}`).join('&');
    const url = `${OPENSTATES_API_BASE_URL}/bills?jurisdiction=${ocdId}&session=${sessionIdentifier}&page=${page}&per_page=${perPage}&apikey=${OPENSTATES_API_KEY}&${includeParams}&sort=updated_desc&updated_since=${updatedSince}`;

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
            const legislationToStore = transformOpenStatesBillToMongoDB(osBill);
            // --- Scrape full text and generate Gemini summary using util ---
            let fullText = '';
            if (osBill.sources && osBill.sources.length > 0) {
              // Use the first non-PDF source as the state legislature page
              const stateSource = osBill.sources.find((s:any) => s.url && !s.url.endsWith('.pdf'));
              const stateLegUrl = stateSource ? stateSource.url : osBill.sources[0].url;
              legislationToStore.stateLegislatureUrl = stateLegUrl;
              fullText = (await fetchPdfTextFromOpenStatesUrl(stateLegUrl)) || legislationToStore.title || '';
            } else {
              fullText = legislationToStore.title || '';
            }
            legislationToStore.fullText = fullText;
            // Only generate a new summary if the existing summary is less than 20 words or is the unavailable message
            let shouldGenerateSummary = false;
            let geminiSummaryWordCount = 0;
            if (!legislationToStore.geminiSummary) {
              shouldGenerateSummary = true;
            } else {
              geminiSummaryWordCount = legislationToStore.geminiSummary.trim().split(/\s+/).length;
              if (
                geminiSummaryWordCount < 20 ||
                legislationToStore.geminiSummary === 'Summary not available due to insufficient information.'
              ) {
                shouldGenerateSummary = true;
              }
            }
            if (shouldGenerateSummary) {
              legislationToStore.geminiSummary = fullText ? await generateGeminiSummaryWithRateLimit(fullText) : null;
              geminiSummaryWordCount = legislationToStore.geminiSummary ? legislationToStore.geminiSummary.trim().split(/\s+/).length : 0;
            }

            // Always upsert the legislation - we want to keep all bills with summaries
            await upsertLegislationSelective(legislationToStore);
            console.log(`Upserted: ${legislationToStore.identifier} (${legislationToStore.jurisdictionName}) - OS ID: ${osBill.id} - Summary: ${geminiSummaryWordCount} words`);
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
  const updatedSinceString = getUpdatedSinceString(UPDATE_INTERVAL_HOURS);
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
    await delay(10000);
  }
  console.log("\n--- Finished processing all states for legislation. ---");
  console.log("--- This script is designed for frequent legislation (e.g., every 12 hours). ---");
}

async function main() {
  while (true) {
    await runUpdateCycle();
    console.log(`Waiting ${UPDATE_INTERVAL_HOURS} hours before next update cycle...`);
    await delay(UPDATE_INTERVAL_HOURS * 60 * 60 * 1000);
  }
}

main().catch(err => {
  console.error("Unhandled error in main execution:", err);
});
