import { upsertLegislation } from '@/services/legislationService';
import { config } from 'dotenv';

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
  { ocdId: 'ocd-jurisdiction/country/US/state-wy/government', abbr: 'WY'}
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
    id: osBill.id,
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
 * Main function to fetch and process bill data
 */
async function main() {
  if (!OPENSTATES_API_KEY) {
    console.error('OPENSTATES_API_KEY is not set in the environment variables.');
    process.exit(1);
  }

  console.log('--- Starting historical data import for the last five years ---');
  const fiveYearsAgo = new Date();
  fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
  const fiveYearsAgoDateString = fiveYearsAgo.toISOString().split('T')[0];
  console.log(`Fetching data for sessions active since ${fiveYearsAgoDateString}`);

  for (const state of STATE_OCD_IDS) {
    console.log(`\n--- Processing State: ${state.abbr} (${state.ocdId}) ---`);
    const sessions = await fetchSessionsForJurisdiction(state.ocdId);
    await delay(500);

    const relevantSessions = sessions.filter(s => {
      const sessionEndDateStr = s.end_date;
      const sessionIdentifierStr = s.identifier;
      const sessionYearMatch = sessionIdentifierStr.match(/\b(20[1-9][0-9])\b/);
      const sessionYear = sessionYearMatch ? parseInt(sessionYearMatch[1], 10) : 0;
      return (
        !sessionEndDateStr ||
        sessionEndDateStr >= fiveYearsAgoDateString ||
        sessionYear >= fiveYearsAgo.getFullYear() - 1
      );
    });

    if (relevantSessions.length > 0) {
      console.log(
        `Found ${relevantSessions.length} relevant session(s) for ${state.abbr}: ${relevantSessions
          .map(s => `${s.name} (${s.identifier})`)
          .join(', ')}`
      );
      for (const session of relevantSessions) {
        const sessionIdentifier = session.identifier;
        const sessionName = session.name;

        let currentPage = 1;
        const perPage = 20;
        let hasMorePages = true;

        while (hasMorePages) {
          const pagination = await fetchAndStoreBillsForSessionPage(
            state.ocdId,
            state.abbr,
            sessionIdentifier,
            sessionName,
            currentPage,
            perPage
          );

          if (pagination && pagination.page < pagination.max_page) {
            currentPage++;
            await delay(1000);
          } else {
            hasMorePages = false;
          }
        }
        await delay(2000);
      }
    } else {
      console.log(
        `No relevant recent sessions found for ${state.abbr} since ${fiveYearsAgoDateString}.`
      );
    }
  }
  console.log('\n--- Historical data import process finished ---');
}

main().catch(err => {
  console.error('Unhandled error in main execution:', err);
  process.exit(1);
});

/**
 * Test function for legislation collection
 */
export async function testLegislationCollectionScript(): Promise<void> {
  try {
    const { getCollection } = await import('../lib/mongodb');
    const collection = await getCollection('legislation');
    const count = await collection.countDocuments();
    console.log(`[Script] Legislation collection has ${count} documents.`);
    const oneDoc = await collection.findOne();
    if (oneDoc) {
      console.log('[Script] Sample document:', oneDoc);
    } else {
      console.log('[Script] No documents found in legislation collection.');
    }
  } catch (error) {
    console.error('[Script] Failed to connect to legislation collection:', error);
  }
}
