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
  generateGeminiSummary, summarizeLegislationRichestSource
} from '../services/aiSummaryUtil';

config({ path: '../../.env' });

// Gemini 2.0 Flash rate limiting: 10 RPM, 1,000,000 TPM, 200 RPD
class GeminiRateLimiter {
  private requestsPerMinute: number[] = [];
  private requestsPerDay: number[] = [];
  private tokensPerMinute: number[] = [];
  private readonly MAX_RPM = 25;
  private readonly MAX_TPM = 2000000;
  private readonly MAX_RPD = 2000;

  async waitForRateLimit(estimatedTokens: number = 2000): Promise<void> {
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
const CONGRESS_API_KEY = process.env.US_CONGRESS_API_KEY; // Add Congress.gov API key
const OPENSTATES_API_BASE_URL = 'https://v3.openstates.org';
const CONGRESS_API_BASE_URL = 'https://api.congress.gov/v3';

const STATE_OCD_IDS: { ocdId: string, abbr: string }[] = [
  // --- ACTIVE SESSIONS (Currently in session as of July 2025) ---
  // { ocdId: 'ocd-jurisdiction/country:us/state:ak/government', abbr: 'AK' }, // Alaska
  // { ocdId: 'ocd-jurisdiction/country:us/state:ca/government', abbr: 'CA' }, // California
  // { ocdId: 'ocd-jurisdiction/country:us/state:de/government', abbr: 'DE' }, // Delaware
  // { ocdId: 'ocd-jurisdiction/country:us/district:dc/government', abbr: 'DC' }, // District of Columbia
  // { ocdId: 'ocd-jurisdiction/country:us/state:ga/government', abbr: 'GA' }, // Georgia
  // { ocdId: 'ocd-jurisdiction/country:us/state:hi/government', abbr: 'HI' }, // Hawaii
  { ocdId: 'ocd-jurisdiction/country:us/state:il/government', abbr: 'IL' }, // Illinois
  { ocdId: 'ocd-jurisdiction/country:us/state:ia/government', abbr: 'IA' }, // Iowa
  { ocdId: 'ocd-jurisdiction/country:us/state:ks/government', abbr: 'KS' }, // Kansas
  { ocdId: 'ocd-jurisdiction/country:us/state:me/government', abbr: 'ME' }, // Maine
  { ocdId: 'ocd-jurisdiction/country:us/state:ma/government', abbr: 'MA' }, // Massachusetts
  { ocdId: 'ocd-jurisdiction/country:us/state:mi/government', abbr: 'MI' }, // Michigan
  { ocdId: 'ocd-jurisdiction/country:us/state:mn/government', abbr: 'MN' }, // Minnesota
  { ocdId: 'ocd-jurisdiction/country:us/state:ne/government', abbr: 'NE' }, // Nebraska
  { ocdId: 'ocd-jurisdiction/country:us/state:nh/government', abbr: 'NH' }, // New Hampshire
  { ocdId: 'ocd-jurisdiction/country:us/state:nj/government', abbr: 'NJ' }, // New Jersey
  { ocdId: 'ocd-jurisdiction/country:us/state:ny/government', abbr: 'NY' }, // New York
  { ocdId: 'ocd-jurisdiction/country:us/state:nc/government', abbr: 'NC' }, // North Carolina
  { ocdId: 'ocd-jurisdiction/country:us/state:oh/government', abbr: 'OH' }, // Ohio
  { ocdId: 'ocd-jurisdiction/country:us/state:ok/government', abbr: 'OK' }, // Oklahoma
  { ocdId: 'ocd-jurisdiction/country:us/state:pa/government', abbr: 'PA' }, // Pennsylvania
  { ocdId: 'ocd-jurisdiction/country:us/state:sc/government', abbr: 'SC' }, // South Carolina
  { ocdId: 'ocd-jurisdiction/country:us/state:tn/government', abbr: 'TN' }, // Tennessee
  { ocdId: 'ocd-jurisdiction/country:us/state:vt/government', abbr: 'VT' }, // Vermont
  { ocdId: 'ocd-jurisdiction/country:us/state:va/government', abbr: 'VA' }, // Virginia
  { ocdId: 'ocd-jurisdiction/country:us/state:wa/government', abbr: 'WA' }, // Washington
  { ocdId: 'ocd-jurisdiction/country:us/state:wi/government', abbr: 'WI' }, // Wisconsin
  // United States Congress
  // { ocdId: 'ocd-jurisdiction/country:us/legislature', abbr: 'us' },

  // --- INACTIVE SESSIONS (Not currently in session - commented out) ---
  // { ocdId: 'ocd-jurisdiction/country:us/state:al/government', abbr: 'AL' }, // Alabama
  // { ocdId: 'ocd-jurisdiction/country:us/state:az/government', abbr: 'AZ' }, // Arizona
  // { ocdId: 'ocd-jurisdiction/country:us/state:ar/government', abbr: 'AR' }, // Arkansas
  // { ocdId: 'ocd-jurisdiction/country:us/state:co/government', abbr: 'CO' }, // Colorado
  // { ocdId: 'ocd-jurisdiction/country:us/state:ct/government', abbr: 'CT' }, // Connecticut
  // { ocdId: 'ocd-jurisdiction/country:us/state:fl/government', abbr: 'FL' }, // Florida
  // { ocdId: 'ocd-jurisdiction/country:us/state:id/government', abbr: 'ID' }, // Idaho
  // { ocdId: 'ocd-jurisdiction/country:us/state:in/government', abbr: 'IN' }, // Indiana
  // { ocdId: 'ocd-jurisdiction/country:us/state:ky/government', abbr: 'KY' }, // Kentucky
  // { ocdId: 'ocd-jurisdiction/country:us/state:la/government', abbr: 'LA' }, // Louisiana
  // { ocdId: 'ocd-jurisdiction/country:us/state:md/government', abbr: 'MD' }, // Maryland
  // { ocdId: 'ocd-jurisdiction/country:us/state:ms/government', abbr: 'MS' }, // Mississippi
  // { ocdId: 'ocd-jurisdiction/country:us/state:mo/government', abbr: 'MO' }, // Missouri
  // { ocdId: 'ocd-jurisdiction/country:us/state:mt/government', abbr: 'MT' }, // Montana
  // { ocdId: 'ocd-jurisdiction/country:us/state:nv/government', abbr: 'NV' }, // Nevada
  // { ocdId: 'ocd-jurisdiction/country:us/state:nm/government', abbr: 'NM' }, // New Mexico
  // { ocdId: 'ocd-jurisdiction/country:us/state:nd/government', abbr: 'ND' }, // North Dakota
  // { ocdId: 'ocd-jurisdiction/country:us/state:or/government', abbr: 'OR' }, // Oregon
  // { ocdId: 'ocd-jurisdiction/country:us/state:ri/government', abbr: 'RI' }, // Rhode Island
  // { ocdId: 'ocd-jurisdiction/country:us/state:sd/government', abbr: 'SD' }, // South Dakota
  // { ocdId: 'ocd-jurisdiction/country:us/state:tx/government', abbr: 'TX' }, // Texas
  // { ocdId: 'ocd-jurisdiction/country:us/state:ut/government', abbr: 'UT' }, // Utah
  // { ocdId: 'ocd-jurisdiction/country:us/state:wv/government', abbr: 'WV' }, // West Virginia
  // { ocdId: 'ocd-jurisdiction/country:us/state:wy/government', abbr: 'WY' }, // Wyoming
];

// Helper function to introduce delays (milliseconds)
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Checkpoint system for resuming interrupted runs
interface Checkpoint {
  lastProcessedState: string;
  lastProcessedSession: string;
  lastProcessedPage: number;
  timestamp: string;
  updatedSince: string;
}

function saveCheckpoint(stateAbbr: string, sessionIdentifier: string, page: number, updatedSince: string) {
  const checkpoint: Checkpoint = {
    lastProcessedState: stateAbbr,
    lastProcessedSession: sessionIdentifier,
    lastProcessedPage: page,
    timestamp: new Date().toISOString(),
    updatedSince: updatedSince
  };

  try {
    const fs = require('fs');
    fs.writeFileSync('./checkpoint.json', JSON.stringify(checkpoint, null, 2));
    console.log(`Saved checkpoint: ${stateAbbr} - ${sessionIdentifier} - Page ${page}`);
  } catch (error) {
    console.warn('Failed to save checkpoint:', error);
  }
}

function loadCheckpoint(): Checkpoint | null {
  try {
    const fs = require('fs');
    if (fs.existsSync('./checkpoint.json')) {
      const checkpoint = JSON.parse(fs.readFileSync('./checkpoint.json', 'utf8'));
      console.log(`Found checkpoint: ${checkpoint.lastProcessedState} - ${checkpoint.lastProcessedSession} - Page ${checkpoint.lastProcessedPage}`);
      return checkpoint;
    }
  } catch (error) {
    console.warn('Failed to load checkpoint:', error);
  }
  return null;
}

function clearCheckpoint() {
  try {
    const fs = require('fs');
    if (fs.existsSync('./checkpoint.json')) {
      fs.unlinkSync('./checkpoint.json');
      console.log('Cleared checkpoint');
    }
  } catch (error) {
    console.warn('Failed to clear checkpoint:', error);
  }
}

// --- Congress.gov cutoff persistence helpers ---
const CONGRESS_CUTOFF_PATH = './congress-cutoff.json';

function getDefaultCongressCutoffDate(): string {
  // Always return ISO string for 24 hours before now
  const now = new Date();
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  return oneDayAgo.toISOString().split('.')[0];
}

function saveCongressCutoffDate(dateStr: string) {
  const fs = require('fs');
  fs.writeFileSync(CONGRESS_CUTOFF_PATH, JSON.stringify({ cutoff: dateStr }, null, 2));
  console.log(`Saved Congress cutoff date: ${dateStr}`);
}

function loadCongressCutoffDate(): string | null {
  const fs = require('fs');
  if (fs.existsSync(CONGRESS_CUTOFF_PATH)) {
    try {
      const data = JSON.parse(fs.readFileSync(CONGRESS_CUTOFF_PATH, 'utf8'));
      if (data.cutoff) return data.cutoff;
    } catch (e) {
      console.warn('Could not parse Congress cutoff file:', e);
    }
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

// Transforms an OpenStates bill to a MongoDB-compatible document
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

  // Calculate lastActionAt from the most recent action in history
  const lastActionAt = history.length > 0
    ? history.reduce((latest, action) => {
        return action.date > latest ? action.date : latest;
      }, history[0].date)
    : null;

  // Calculate firstActionAt from the earliest action in history
  const firstActionAt = history.length > 0
    ? history.reduce((earliest, action) => {
        return action.date < earliest ? action.date : earliest;
      }, history[0].date)
    : null;

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
    firstActionAt: firstActionAt || toMongoDate(osBill.first_action_date),
    latestActionAt: lastActionAt || toMongoDate(osBill.latest_action_date),
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
const UPDATE_INTERVAL_HOURS = 24;

function getUpdatedSinceString(hoursAgo: number): string {
  const now = new Date();
  const updatedSinceDate = new Date(now.getTime() - (hoursAgo * 60 * 60 * 1000));
  return updatedSinceDate.toISOString().split('.')[0];
}

async function fetchAndStoreUpdatedBills(
  ocdId: string,
  jurisdictionAbbr: string,
  sessionIdentifier: string,
  updatedSince: string,
  startPage: number = 1
) {
  let page = startPage;
  const perPage = 20;
  let hasMore = true;
  let billsProcessed = 0;

  console.log(`Fetching bills updated since ${updatedSince} for ${jurisdictionAbbr} - Session: ${sessionIdentifier} - Starting from page ${startPage}`);

  // If resuming from a high page number, first verify the page exists
  if (startPage > 1) {
    console.log(`Verifying that page ${startPage} still exists for ${jurisdictionAbbr}...`);
    const testUrl = `${OPENSTATES_API_BASE_URL}/bills?jurisdiction=${ocdId}&session=${sessionIdentifier}&page=1&per_page=20&apikey=${OPENSTATES_API_KEY}&sort=updated_desc&updated_since=${updatedSince}`;

    try {
      const testResponse = await fetch(testUrl);
      if (testResponse.ok) {
        const testData = await testResponse.json();
        const maxPage = testData.pagination?.max_page || testData.pagination?.total_pages || 1;
        const totalItems = testData.pagination?.total_items || 0;

        console.log(`Current pagination: max_page=${maxPage}, total_items=${totalItems}, requested_start_page=${startPage}`);

        if (startPage > maxPage) {
          console.log(`Checkpoint page ${startPage} is beyond current max page ${maxPage}. Data may have changed since last run.`);
          console.log(`Falling back to start from page 1 to avoid missing any data.`);
          page = 1;
        }
      }
    } catch (error) {
      console.warn(`Could not verify pagination, proceeding with page ${startPage}:`, error);
    }
  }

  while (hasMore) {
    // Save checkpoint before processing each page
    saveCheckpoint(jurisdictionAbbr, sessionIdentifier, page, updatedSince);

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
        if (response.status === 404) {
          const errorText = await response.text();
          console.log(`Page ${page} not found for ${jurisdictionAbbr}, session ${sessionIdentifier}: ${errorText}`);

          // If this is the first page and it's 404, there might be no data
          if (page === 1) {
            console.log(`No data available for ${jurisdictionAbbr} session ${sessionIdentifier} with current filters.`);
            hasMore = false;
            break;
          }

          // If we're on a higher page, we've reached the end
          console.log(`Reached end of available pages for ${jurisdictionAbbr} at page ${page}.`);
          hasMore = false;
          break;
        } else {
          console.error(`Error fetching updated bills page ${page} for ${jurisdictionAbbr}, session ${sessionIdentifier}: ${response.status} ${await response.text()}`);
          hasMore = false;
          break;
        }
      }

      const data = await response.json() as {
        pagination?: { page?: number; max_page?: number; total_pages?: number; total_items?: number };
        results?: any[];
      };

      // Log pagination info for debugging
      if (data.pagination) {
        const currentPage = data.pagination.page || page;
        const maxPage = data.pagination.max_page || data.pagination.total_pages;
        const totalItems = data.pagination.total_items || 0;
        console.log(`Pagination info for ${jurisdictionAbbr}: page ${currentPage}/${maxPage}, total items: ${totalItems}`);
      }

      if (data.results && data.results.length > 0) {
        console.log(`Processing ${data.results.length} bills from page ${page} for ${jurisdictionAbbr}`);

        for (const osBill of data.results) {
          try {
            const legislationToStore = transformOpenStatesBillToMongoDB(osBill);
            // Only summarize if geminiSummary is missing or less than 100 chars
            if (!legislationToStore.geminiSummary || legislationToStore.geminiSummary.length < 100) {
              const { summary, sourceType } = await summarizeLegislationRichestSource(legislationToStore);
              legislationToStore.geminiSummary = summary;
              legislationToStore.geminiSummarySource = sourceType;
            }
            // Calculate word count for Gemini summary
            const geminiSummaryWordCount = legislationToStore.geminiSummary ? legislationToStore.geminiSummary.split(/\s+/).filter(Boolean).length : 0;
            // Always upsert the legislation - we want to keep all bills with summaries
            await upsertLegislationSelective(legislationToStore);
            console.log(`Upserted: ${legislationToStore.identifier} (${legislationToStore.jurisdictionName}) - OS ID: ${osBill.id} - Summary: ${geminiSummaryWordCount} words`);
            billsProcessed++;
          } catch (transformError) {
            console.error(`Error transforming or upserting bill ${osBill.identifier} (OS ID: ${osBill.id}):`, transformError);
          }
        }
      } else {
        console.log(`No bills found on page ${page} for ${jurisdictionAbbr}, session ${sessionIdentifier} (since ${updatedSince}).`);
        hasMore = false;
      }

      // Check pagination more robustly
      if (data.pagination) {
        const currentPage = data.pagination.page || page;
        const maxPage = data.pagination.max_page || data.pagination.total_pages;

        if (maxPage && currentPage < maxPage && data.results && data.results.length > 0) {
          page++;
          await delay(1500);
        } else {
          hasMore = false;
        }
      } else if (data.results && data.results.length === perPage) {
        // If no pagination info but we got a full page, try next page
        page++;
        await delay(1500);
      } else {
        // No pagination info and partial results, or no results
        hasMore = false;
      }
    } catch (error) {
      console.error(`Network error fetching updated bills for ${jurisdictionAbbr}, session ${sessionIdentifier}, page ${page}:`, error);
      hasMore = false;
      break;
    }
  }

  console.log(`Finished fetching updates for ${jurisdictionAbbr}, session ${sessionIdentifier} (since ${updatedSince}). Processed ${billsProcessed} bills.`);

  // Clear checkpoint for this session since we completed it
  if (billsProcessed > 0 || page > 1) {
    console.log(`Completed processing ${jurisdictionAbbr} session ${sessionIdentifier}`);
  }
}

async function runUpdateCycle(enableOpenStates: boolean = true, enableCongress: boolean = true) {
  if (!enableOpenStates && !enableCongress) {
    console.error("Error: At least one API source must be enabled. Use --openstates and/or --congress flags.");
    return;
  }

  if (enableOpenStates && !OPENSTATES_API_KEY) {
    console.error("Error: OPENSTATES_API_KEY environment variable is not set but OpenStates is enabled. Please add it to your .env file or disable OpenStates with --no-openstates.");
    return;
  }

  if (enableCongress && !CONGRESS_API_KEY) {
    console.error("Error: CONGRESS_API_KEY environment variable is not set but Congress API is enabled. Please add it to your .env file or disable Congress API with --no-congress.");
    return;
  }

  const updatedSinceString = getUpdatedSinceString(UPDATE_INTERVAL_HOURS);
  console.log(`--- Starting fetch for legislation updated since ${updatedSinceString} ---`);
  console.log(`--- OpenStates API: ${enableOpenStates ? 'ENABLED' : 'DISABLED'} ---`);
  console.log(`--- Congress API: ${enableCongress ? 'ENABLED' : 'DISABLED'} ---`);

  const path = require('path');
  const fs = require('fs');
  let congressUpdatedSince = getDefaultCongressCutoffDate();
  if (enableCongress) {
    // Try to load last cutoff date
    const cutoffPath = path.resolve(CONGRESS_CUTOFF_PATH);
    const loadedCutoff = loadCongressCutoffDate();
    if (loadedCutoff) {
      congressUpdatedSince = loadedCutoff;
      console.log(`[Congress Cutoff] Loaded from file: ${cutoffPath}`);
      console.log(`[Congress Cutoff] Value: ${congressUpdatedSince}`);
      // Warn if cutoff is very old (e.g., more than 7 days ago)
      const cutoffDate = new Date(congressUpdatedSince);
      const now = new Date();
      const ageDays = (now.getTime() - cutoffDate.getTime()) / (1000 * 60 * 60 * 24);
      if (ageDays > 7) {
        console.warn(`[Congress Cutoff] WARNING: Cutoff date is very old (${ageDays.toFixed(1)} days ago). This may cause the script to fetch all bills!`);
      }
    } else {
      console.log(`[Congress Cutoff] No cutoff file found at: ${cutoffPath}`);
      console.log(`[Congress Cutoff] Using default (24h ago): ${congressUpdatedSince}`);
    }
  }

  // Fetch from Congress.gov API for US federal legislation if enabled
  if (enableCongress) {
    console.log(`\n--- Processing US Congress via Congress.gov API ---`);
    await fetchCongressBills(congressUpdatedSince);
    await delay(5000);
  } else {
    console.log(`\n--- Skipping US Congress (Congress API disabled) ---`);
  }

  // Process state legislatures via OpenStates API if enabled
  if (enableOpenStates) {
    const stateJurisdictions = STATE_OCD_IDS.filter(state => state.abbr !== 'us');

    for (const state of stateJurisdictions) {
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
          // Check for existing checkpoint
          const checkpoint = loadCheckpoint();
          let startPage = 1;
          let sessionUpdatedSince = updatedSinceString;

          if (checkpoint && checkpoint.lastProcessedState === state.abbr && checkpoint.lastProcessedSession === session.identifier) {
            // Resume from checkpoint
            console.log(`Resuming from checkpoint: ${checkpoint.lastProcessedState} - ${checkpoint.lastProcessedSession} - Page ${checkpoint.lastProcessedPage}`);
            startPage = checkpoint.lastProcessedPage;
            sessionUpdatedSince = checkpoint.updatedSince;
          } else {
            // No checkpoint or different session, start from beginning
            console.log(`Starting fresh for ${state.abbr} - ${session.identifier}`);
            startPage = 1;
            sessionUpdatedSince = updatedSinceString;
          }

          await fetchAndStoreUpdatedBills(state.ocdId, state.abbr, session.identifier, sessionUpdatedSince, startPage);
          await delay(3000);
        }
      } else {
        console.log(`No sessions found for ${state.abbr}. Skipping.`);
      }
      await delay(10000);
    }
  } else {
    console.log(`\n--- Skipping state legislatures (OpenStates API disabled) ---`);
  }

  console.log("\n--- Finished processing selected jurisdictions for legislation. ---");
  if (enableOpenStates && enableCongress) {
    console.log("--- Used both Congress.gov API for federal data and OpenStates API for state data. ---");
  } else if (enableCongress) {
    console.log("--- Used Congress.gov API for federal data only. ---");
  } else if (enableOpenStates) {
    console.log("--- Used OpenStates API for state data only. ---");
  }
}

// Parse command line arguments
function parseArguments(): { enableOpenStates: boolean; enableCongress: boolean; runOnce: boolean } {
  const args = process.argv.slice(2);
  let enableOpenStates = true;
  let enableCongress = true;
  let runOnce = false;

  for (const arg of args) {
    switch (arg) {
      case '--openstates-only':
        enableOpenStates = true;
        enableCongress = false;
        break;
      case '--congress-only':
        enableOpenStates = false;
        enableCongress = true;
        break;
      case '--no-openstates':
        enableOpenStates = false;
        break;
      case '--no-congress':
        enableCongress = false;
        break;
      case '--openstates':
        enableOpenStates = true;
        break;
      case '--congress':
        enableCongress = true;
        break;
      case '--once':
        runOnce = true;
        break;
      case '--help':
      case '-h':
        console.log(`
Usage: node fetchOpenStatesData.js [options]

Options:
  --openstates-only    Fetch only from OpenStates API (state legislatures)
  --congress-only      Fetch only from Congress.gov API (federal legislation)
  --no-openstates      Disable OpenStates API (default: enabled)
  --no-congress        Disable Congress.gov API (default: enabled)
  --openstates         Enable OpenStates API (default: enabled)
  --congress           Enable Congress.gov API (default: enabled)
  --once               Run once instead of continuous loop
  --help, -h           Show this help message

Examples:
  node fetchOpenStatesData.js                    # Both APIs enabled (default)
  node fetchOpenStatesData.js --congress-only    # Only federal legislation
  node fetchOpenStatesData.js --openstates-only  # Only state legislatures
  node fetchOpenStatesData.js --no-congress      # States only
  node fetchOpenStatesData.js --once             # Run once then exit
        `);
        process.exit(0);
        break;
      default:
        if (arg.startsWith('--')) {
          console.warn(`Warning: Unknown argument ${arg}. Use --help for usage information.`);
        }
        break;
    }
  }

  return { enableOpenStates, enableCongress, runOnce };
}

async function main() {
  const { enableOpenStates, enableCongress, runOnce } = parseArguments();

  if (runOnce) {
    console.log("Running in single-execution mode (--once flag detected)");
    await runUpdateCycle(enableOpenStates, enableCongress);
    console.log("Single execution completed. Exiting.");
    return;
  }

  // Continuous loop mode
  while (true) {
    await runUpdateCycle(enableOpenStates, enableCongress);
    console.log(`Waiting ${UPDATE_INTERVAL_HOURS} hours before next update cycle...`);
    await delay(UPDATE_INTERVAL_HOURS * 60 * 60 * 1000);
  }
}

main().catch(err => {
  console.error("Unhandled error in main execution:", err);
});

/**
 * Transforms a Congress.gov bill to a MongoDB-compatible document
 */
export function transformCongressBillToMongoDB(congressBill: any): any {
  const now = new Date();

  // Process sponsors
  const sponsors: Array<{
    name: string;
    id: string | null;
    entityType: string;
    primary: boolean;
    classification: string;
    personId: string | null;
    organizationId: string | null;
  }> = [];
  if (congressBill.sponsors && congressBill.sponsors.length > 0) {
    congressBill.sponsors.forEach((sponsor: any) => {
      sponsors.push({
        name: sponsor.fullName || `${sponsor.firstName || ''} ${sponsor.lastName || ''}`.trim(),
        id: sponsor.bioguideId || null,
        entityType: 'person',
        primary: true,
        classification: 'sponsor',
        personId: sponsor.bioguideId || null,
        organizationId: null,
      });
    });
  }

  // Process cosponsors
  if (congressBill.cosponsors && congressBill.cosponsors.length > 0) {
    congressBill.cosponsors.forEach((cosponsor: any) => {
      sponsors.push({
        name: cosponsor.fullName || `${cosponsor.firstName || ''} ${cosponsor.lastName || ''}`.trim(),
        id: cosponsor.bioguideId || null,
        entityType: 'person',
        primary: false,
        classification: 'cosponsor',
        personId: cosponsor.bioguideId || null,
        organizationId: null,
      });
    });
  }

  // Process bill action history
  const history = (congressBill.actions?.actions || [])
    .map((action: any) => {
      const eventDate = toMongoDate(action.actionDate);
      if (!eventDate) return null;
      return {
        date: eventDate,
        action: action.text,
        actor: action.sourceSystem?.name || 'Congress',
        classification: action.type ? [action.type] : [],
        order: action.actionCode || 0,
      };
    })
    .filter((h: any): h is NonNullable<typeof h> => h !== null);

  // Process bill versions/texts
  const versions = (congressBill.textVersions?.textVersions || [])
    .map((version: any) => {
      const versionDate = toMongoDate(version.date);
      if (!versionDate) return null;
      return {
        note: version.type,
        date: versionDate,
        classification: version.type || null,
        links: version.formats ? version.formats.map((format: any) => ({
          url: format.url,
          media_type: format.type || null,
        })) : [],
      };
    })
    .filter((v: any): v is NonNullable<typeof v> => v !== null);

  // Process sources - use Congress.gov URLs
  const sources = [{
    url: `https://www.congress.gov/bill/${congressBill.congress}th-congress/${congressBill.originChamber.toLowerCase()}-bill/${congressBill.number}`,
    note: 'Congress.gov',
  }];

  // Process summary
  const summary = congressBill.summaries?.summaries?.[0]?.text ||
                 congressBill.title || null;

  const chamber = congressBill.originChamber === 'House' ? 'lower' :
                 congressBill.originChamber === 'Senate' ? 'upper' :
                 congressBill.originChamber?.toLowerCase();

  return {
    id: `congress-bill-${congressBill.congress}-${congressBill.type.toLowerCase()}-${congressBill.number}`,
    identifier: `${congressBill.type} ${congressBill.number}`,
    title: congressBill.title,
    session: `${congressBill.congress}th Congress`,
    jurisdictionId: 'ocd-jurisdiction/country:us/legislature',
    jurisdictionName: 'United States Congress',
    chamber: chamber,
    classification: [congressBill.type?.toLowerCase() || 'bill'],
    subjects: congressBill.policyArea ? [congressBill.policyArea.name] : [],
    statusText: congressBill.latestAction?.text || null,
    sponsors,
    history,
    versions: versions || [],
    sources: sources || [],
    abstracts: summary ? [{ abstract: summary, note: 'Congress.gov summary' }] : [],
    openstatesUrl: null,
    congressUrl: sources[0].url,
    firstActionAt: toMongoDate(congressBill.introducedDate),
    latestActionAt: toMongoDate(congressBill.latestAction?.actionDate),
    latestActionDescription: congressBill.latestAction?.text || null,
    latestPassageAt: null, // Would need to parse from actions
    createdAt: toMongoDate(congressBill.introducedDate) || now,
    updatedAt: toMongoDate(congressBill.updateDate) || now,
    summary: summary,
    extras: {
      congress: congressBill.congress,
      billType: congressBill.type,
      billNumber: congressBill.number,
      constitutionalAuthorityStatementText: congressBill.constitutionalAuthorityStatementText,
    },
  };
}

/**
 * Fetch bills from Congress.gov API
 */
async function fetchCongressBills(updatedSince: string) {
  if (!CONGRESS_API_KEY) {
    console.error("Error: CONGRESS_API_KEY environment variable is not set. Skipping Congress data.");
    return;
  }

  let offset = 0;
  const limit = 20;
  let hasMore = true;
  let billsProcessed = 0;

  console.log(`Fetching Congress bills updated since ${updatedSince}`);

  while (hasMore) {
    // Get current Congress number (119th Congress for 2025-2026)
    const currentCongress = 119;
    const url = `${CONGRESS_API_BASE_URL}/bill/${currentCongress}?api_key=${CONGRESS_API_KEY}&format=json&offset=${offset}&limit=${limit}&sort=updateDate+desc`;

    console.log(`Fetching Congress bills offset ${offset} from: ${url.replace(CONGRESS_API_KEY as string, 'REDACTED_KEY')}`);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Error fetching Congress bills offset ${offset}: ${response.status} ${await response.text()}`);
        hasMore = false;
        break;
      }

      const data: any = await response.json();

      if (data.bills && data.bills.length > 0) {
        for (const bill of data.bills) {
          try {
            // Check if bill was updated since our cutoff
            const billUpdateDate = new Date(bill.updateDate);
            const cutoffDate = new Date(updatedSince);

            if (billUpdateDate < cutoffDate) {
              console.log(`Reached bills older than cutoff date. Stopping.`);
              hasMore = false;
              break;
            }

            // Fetch detailed bill information
            const detailUrl = `${CONGRESS_API_BASE_URL}/bill/${currentCongress}/${bill.type.toLowerCase()}/${bill.number}?api_key=${CONGRESS_API_KEY}&format=json`;
            const detailResponse = await fetch(detailUrl);

            if (!detailResponse.ok) {
              console.error(`Error fetching bill details for ${bill.type} ${bill.number}: ${detailResponse.status}`);
              continue;
            }

            const detailData: any = await detailResponse.json();
            const congressBill = detailData.bill;

            // Also fetch actions, text versions, and summaries
            const [actionsResponse, textResponse, summariesResponse] = await Promise.all([
              fetch(`${CONGRESS_API_BASE_URL}/bill/${currentCongress}/${bill.type.toLowerCase()}/${bill.number}/actions?api_key=${CONGRESS_API_KEY}&format=json`),
              fetch(`${CONGRESS_API_BASE_URL}/bill/${currentCongress}/${bill.type.toLowerCase()}/${bill.number}/text?api_key=${CONGRESS_API_KEY}&format=json`),
              fetch(`${CONGRESS_API_BASE_URL}/bill/${currentCongress}/${bill.type.toLowerCase()}/${bill.number}/summaries?api_key=${CONGRESS_API_KEY}&format=json`)
            ]);

            if (actionsResponse.ok) {
              const actionsData: any = await actionsResponse.json();
              congressBill.actions = actionsData;
            }

            if (textResponse.ok) {
              const textData: any = await textResponse.json();
              congressBill.textVersions = textData;
            }

            if (summariesResponse.ok) {
              const summariesData: any = await summariesResponse.json();
              congressBill.summaries = summariesData;
            }

            const legislationToStore = transformCongressBillToMongoDB(congressBill);
            // Only summarize if geminiSummary is missing or less than 100 chars
            if (!legislationToStore.geminiSummary || legislationToStore.geminiSummary.length < 100) {
              const { summary, sourceType } = await summarizeLegislationRichestSource(legislationToStore);
              legislationToStore.geminiSummary = summary;
              legislationToStore.geminiSummarySource = sourceType;
            }
            // Upsert the legislation
            await upsertLegislationSelective(legislationToStore);
            console.log(`Upserted: ${legislationToStore.identifier} (Congress)`);
            billsProcessed++;
            // Rate limiting for Congress API
            await delay(100); // Congress API allows higher rates but be respectful

          } catch (transformError) {
            console.error(`Error transforming or upserting Congress bill ${bill.type} ${bill.number}:`, transformError);
          }
        }

        if (hasMore) {
          offset += limit;
        }
      } else {
        hasMore = false;
      }
    } catch (error) {
      console.error(`Network error fetching Congress bills:`, error);
      hasMore = false;
    }
  }

  console.log(`Finished fetching Congress bills. Processed ${billsProcessed} bills.`);
}
