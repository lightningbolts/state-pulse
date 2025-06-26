import { upsertLegislation } from '@/services/legislationService';
import { config } from 'dotenv';
import { ai } from '../ai/genkit';
import fetch from 'node-fetch';
import pdf from 'pdf-parse';
import * as cheerio from 'cheerio';
import { generateGeminiSummary, fetchPdfTextFromOpenStatesUrl, extractBestTextForSummary } from '../services/aiSummaryUtil';
import { getCollection } from '../lib/mongodb';

config();

const OPENSTATES_API_KEY = process.env.OPENSTATES_API_KEY;
const OPENSTATES_API_BASE_URL = 'https://v3.openstates.org';

// Define type for API response
interface OpenStatesApiBillListResponse {
  results?: any[];
  pagination?: {
    page: number;
    max_page: number;
    per_page: number;
    total_items: number;
  };
}

// State IDs for fetching data
const STATE_OCD_IDS: { ocdId: string; abbr: string }[] = [
  { ocdId: 'ocd-jurisdiction/country:us/state:al/government', abbr: 'AL' },
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
  // { ocdId: 'ocd-jurisdiction/country:us/state:ia/government', abbr: 'IA' },
  // { ocdId: 'ocd-jurisdiction/country:us/state:ks/government', abbr: 'KS' },
  // { ocdId: 'ocd-jurisdiction/country:us/state:ky/government', abbr: 'KY' },
  // { ocdId: 'ocd-jurisdiction/country:us/state:la/government', abbr: 'LA' },
  // { ocdId: 'ocd-jurisdiction/country:us/state:me/government', abbr: 'ME' },
  // { ocdId: 'ocd-jurisdiction/country:us/state:md/government', abbr: 'MD' },
  // { ocdId: 'ocd-jurisdiction/country:us/state:ma/government', abbr: 'MA' },
  // { ocdId: 'ocd-jurisdiction/country:us/state:mm/government', abbr: 'MI'},
  // { ocdId: 'ocd-jurisdiction/country:us/state:mn/government', abbr: 'MN' },
  // { ocdId: 'ocd-jurisdiction/country:us/state:ms/government', abbr: 'MS' },
  // { ocdId: 'ocd-jurisdiction/country:us/state:mo/government', abbr: 'MO' },
  // { ocdId: 'ocd-jurisdiction/country:us/state:mt/government', abbr: 'MT' },
  // { ocdId: 'ocd-jurisdiction/country:us/state:ne/government', abbr: 'NE' },
  // { ocdId: 'ocd-jurisdiction/country:us/state:nv/government', abbr: 'NV' },
  // { ocdId: 'ocd-jurisdiction/country:us/state:nh/government', abbr: 'NH' },
  // { ocdId: 'ocd-jurisdiction/country:us/state:nj/government', abbr: 'NJ' },
  // { ocdId: 'ocd-jurisdiction/country:us/state:nm/government', abbr: 'NM' },
  // { ocdId: 'ocd-jurisdiction/country:us/state:nc/government', abbr: 'NC' },
  // { ocdId: 'ocd-jurisdiction/country:us/state:nd/government', abbr: 'ND' },
  // { ocdId: 'ocd-jurisdiction/country:us/state:oh/government', abbr: 'OH' },
  // { ocdId: 'ocd-jurisdiction/country:us/state:ok/government', abbr: 'OK'},
  // { ocdId: 'ocd-jurisdiction/country:us/state:or/government', abbr: 'OR'},
  // { ocdId: 'ocd-jurisdiction/country:us/state:pa/government', abbr: 'PA'},
  // { ocdId: 'ocd-jurisdiction/country:us/state:ri/government', abbr: 'RI'},
  // { ocdId: 'ocd-jurisdiction/country:us/state:sc/government', abbr: 'SC'},
  // { ocdId: 'ocd-jurisdiction/country:us/state:sd/government', abbr: 'SD'},
  // { ocdId: 'ocd-jurisdiction/country:us/state:tn/government', abbr: 'TN'},
  // { ocdId: 'ocd-jurisdiction/country:us/state:tx/government', abbr: 'TX'},
  // { ocdId: 'ocd-jurisdiction/country:us/state:ut/government', abbr: 'UT'},
  // { ocdId: 'ocd-jurisdiction/country:us/state:vt/government', abbr: 'VT'},
  // { ocdId: 'ocd-jurisdiction/country:us/state:va/government', abbr: 'VA'},
  // { ocdId: 'ocd-jurisdiction/country:us/state:wa/government', abbr: 'WA'},
  // { ocdId: 'ocd-jurisdiction/country:us/state:wv/government', abbr: 'WV'},
  // { ocdId: 'ocd-jurisdiction/country:us/state:wi/government', abbr: 'WI'},
  // { ocdId: 'ocd-jurisdiction/country:us/state:wy/government', abbr: 'WY'}
];

function delay(ms: number): Promise<void> {
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

/**
 * Fetches legislative session data for a jurisdiction
 */
async function fetchSessionsForJurisdiction(
  ocdId: string
): Promise<any[]> {
  const url = `${OPENSTATES_API_BASE_URL}/jurisdictions/${ocdId}?apikey=${OPENSTATES_API_KEY}&include=legislative_sessions`;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      console.error(
        `Error fetching sessions for ${ocdId}: ${response.status} ${response.statusText}`
      );
      const errorBody = await response.text();
      console.error('Error body:', errorBody);
      return [];
    }
    const data = (await response.json()) as {
      legislative_sessions?: any[];
    };
    return data.legislative_sessions || [];
  } catch (error) {
    console.error(`Exception fetching sessions for ${ocdId}:`, error);
    return [];
  }
}

/**
 * Fetches and stores bills for a specific session page
 */
async function fetchAndStoreBillsForSessionPage(
  ocdId: string,
  jurisdictionAbbr: string,
  sessionIdentifier: string,
  sessionName: string,
  page: number,
  perPage: number
): Promise<OpenStatesApiBillListResponse['pagination'] | null> {
  const includes = [
    'sponsorships',
    'abstracts',
    'versions',
    'actions',
    'sources',
  ];
  const includeParams = includes.map(inc => `include=${inc}`).join('&');
  const url = `${OPENSTATES_API_BASE_URL}/bills?jurisdiction=${ocdId}&session=${sessionIdentifier}&page=${page}&per_page=${perPage}&apikey=${OPENSTATES_API_KEY}&${includeParams}&sort=updated_desc`;

  console.log(
    `Fetching bills for ${jurisdictionAbbr} - Session: ${sessionName} (${sessionIdentifier}) - Page ${page}`
  );

  try {
    const response = await fetch(url);
    if (response.status === 429) {
      console.error(
        `Rate limit hit (429) for ${jurisdictionAbbr}, session ${sessionIdentifier}, page ${page}. Waiting 30 seconds before retrying...`
      );
      await delay(30000); // Wait 30 seconds
      return await fetchAndStoreBillsForSessionPage(
        ocdId,
        jurisdictionAbbr,
        sessionIdentifier,
        sessionName,
        page,
        perPage
      );
    }
    if (!response.ok) {
      console.error(
        `Error fetching bills (page ${page}) for ${jurisdictionAbbr}, session ${sessionIdentifier}: ${response.status} ${response.statusText}`
      );
      const errorBody = await response.text();
      console.error('Error body:', errorBody);
      return null;
    }

    const billData = (await response.json()) as OpenStatesApiBillListResponse;
    const bills = billData.results || [];

    if (bills.length === 0) {
      console.log(
        `No bills found on page ${page} for ${jurisdictionAbbr}, session ${sessionIdentifier}.`
      );
      return billData.pagination;
    }

    for (const osBill of bills) {
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
        legislationToStore.geminiSummary = fullText ? await generateGeminiSummary(fullText) : null;
        await upsertLegislation(legislationToStore);
      } catch (error) {
        console.error(
          `Error transforming or upserting bill ${osBill.identifier} (OS ID: ${osBill.id}):`,
          error
        );
      }
    }
    await delay(6000); // Wait 6 seconds to respect rate limit
    return billData.pagination;
  } catch (error) {
    console.error(
      `Exception fetching bills (page ${page}) for ${jurisdictionAbbr}, session ${sessionIdentifier}:`,
      error
    );
    return null;
  }
}

/**
 * Updates Gemini summaries for documents with insufficient or missing summaries
 */
async function updateInsufficientGeminiSummaries() {
  const collection = await getCollection('legislation');
  const batchSize = 50;
  let lastId = undefined;
  let count = 0;
  let insufficientCount = 0;

  async function generateSummary(text: string): Promise<string> {
    const { ai } = await import('../ai/genkit');
    const prompt = `Summarize the following legislation in about 100 words, focusing on the main points and specific impact. Remove fluff and filler. If there is not enough information to summarize, say so in a single sentence: 'Summary not available due to insufficient information.'\n\n${text}`;
    const response = await ai.generate({ prompt });
    return response.text.trim();
  }

  while (true) {
    const query = lastId ? { _id: { $gt: lastId } } : {};
    // Only process docs with insufficient summary
    const docs = await collection
      .find({
        ...query,
        $or: [
          { geminiSummary: { $regex: 'Summary not available due to insufficient information.' } },
          { $expr: { $lt: [{ $size: { $split: ['$geminiSummary', ' '] } }, 65] } }
        ]
      })
      .sort({ _id: 1 })
      .limit(batchSize)
      .toArray();
    if (docs.length === 0) break;
    for (const doc of docs) {
      const { text, debug } = extractBestTextForSummary(doc);
      if (!text || text.length < 50) {
        console.warn(`[GeminiSummary] Skipping doc ${doc._id} due to insufficient extracted text. Debug:`, debug);
        lastId = doc._id;
        continue;
      }
      try {
        const summary = await generateGeminiSummary(text);
        await collection.updateOne(
          { _id: doc._id },
          { $set: { geminiSummary: summary, geminiSummaryDebug: debug } }
        );
        count++;
        if (summary.includes('Summary not available')) insufficientCount++;
        console.log(`Updated legislation ${doc._id} | Debug:`, debug);
      } catch (err) {
        console.error(`Failed to summarize ${doc._id}:`, err, debug);
      }
      lastId = doc._id;
    }
  }
  console.log(`\n--- Gemini summary update complete. Updated: ${count}, Insufficient: ${insufficientCount} ---`);
}

