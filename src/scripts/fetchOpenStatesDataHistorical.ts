import { upsertLegislationBySourceId } from '@/services/legislationService';
  import {
    OpenStatesBill,
    OpenStatesAction,
    OpenStatesSponsor,
    OpenStatesVersion,
    OpenStatesLegislativeSession,
    OpenStatesAbstract,
    OpenStatesBillSource,
    OpenStatesOrganization,
  } from '@/types/legislation'; // Adjusted imports
  import { Timestamp } from 'firebase/firestore';
  import { config } from 'dotenv';

  // Load environment variables from .env file at the project root
  config();

  const OPENSTATES_API_KEY = process.env.OPENSTATES_API_KEY;
  const OPENSTATES_API_BASE_URL = 'https://v3.openstates.org';

  // --- IMPORTANT: Populate this list with OCD-IDs and abbreviations for all 50 states ---
  const STATE_OCD_IDS: { ocdId: string, abbr: string }[] = [
    // { ocdId: 'ocd-jurisdiction/country:us/state:al/government', abbr: 'AL' },
    // { ocdId: 'ocd-jurisdiction/country:us/state:ak/government', abbr: 'AK' },
    // { ocdId: 'ocd-jurisdiction/country:us/state:az/government', abbr: 'AZ' },
    // { ocdId: 'ocd-jurisdiction/country:us/state:ar/government', abbr: 'AR' },
    // { ocdId: 'ocd-jurisdiction/country:us/state:ca/government', abbr: 'CA' },
    { ocdId : 'ocd-jurisdiction/country:us/state:co/government', abbr: 'WA' }, // Note: OCD ID is CO, abbr is WA in example
    // ... (ensure all 50 states are listed for full functionality)
  ];

  // Helper function to introduce delays (milliseconds)
  function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // --- Firestore-specific data structures ---
  interface FirestoreLegislationSponsor {
    id?: string | null;
    name: string;
    entityType?: 'person' | 'organization' | string | null;
    primary?: boolean | null;
    classification?: string | null;
  }

  interface FirestoreLegislationHistoryEvent {
    date: Timestamp;
    action: string;
    actor: string; // Organization name or ID
    details?: string | null; // e.g., classifications
  }

  interface FirestoreLegislationVersion {
    date: Timestamp;
    name: string; // Note of the version
    url: string;
  }

  interface FirestoreLegislation {
    sourceId: string; // OpenStatesBill.id
    title: string;
    billNumber: string;
    jurisdiction: string; // State abbreviation
    status: string;
    summary?: string | null;
    fullTextUrl?: string | null;
    sponsors: FirestoreLegislationSponsor[];
    introductionDate?: Timestamp | null;
    lastActionDate?: Timestamp | null;
    effectiveDate?: Timestamp | null; // Ensure this is handled if needed
    history?: FirestoreLegislationHistoryEvent[];
    tags?: string[];
    chamber?: string | null;
    versions?: FirestoreLegislationVersion[];
    createdAt: Timestamp;
    updatedAt: Timestamp;
  }
  // --- End Firestore-specific data structures ---

  // --- Robust Timestamp Conversion Helper ---
  function toFirestoreTimestamp(dateInput: Date | Timestamp | string | null | undefined): Timestamp | null {
    if (dateInput === null || typeof dateInput === 'undefined') {
      return null;
    }
    if (dateInput instanceof Timestamp) {
      return dateInput; // Already a Firestore Timestamp
    }
    if (dateInput instanceof Date) {
      // Check if the Date object is valid before converting
      return isNaN(dateInput.getTime()) ? null : Timestamp.fromDate(dateInput);
    }
    if (typeof dateInput === 'string') {
      if (dateInput.trim() === "") {
        return null;
      }
      // Attempt to parse the string, taking only the date part if time is included with a space
      const date = new Date(dateInput.split(' ')[0]);
      return isNaN(date.getTime()) ? null : Timestamp.fromDate(date);
    }
    // console.warn(`toFirestoreTimestamp: Unhandled date type - ${typeof dateInput}`, dateInput); // Optional for debugging
    return null; // Fallback for unhandled types
  }

  // Updated safeParseTimestamp to use the robust helper
  const safeParseTimestamp = (dateString: string | undefined | null): Timestamp | null => {
    return toFirestoreTimestamp(dateString);
  };


  // Helper to transform OpenStates bill data to our FirestoreLegislation type
  export function transformOpenStatesBill(osBill: OpenStatesBill, jurisdictionAbbr: string): FirestoreLegislation {
    const sponsors: FirestoreLegislationSponsor[] = (osBill.sponsorships || []).map((sp: OpenStatesSponsor) => ({
      name: sp.name || '',
      id: sp.person_id || sp.organization_id || null, // Prioritize person/org specific IDs
      entityType: sp.entity_type || null,
      primary: typeof sp.primary === 'boolean' ? sp.primary : null,
      classification: sp.classification || null,
    }));

    const historyItems: FirestoreLegislationHistoryEvent[] = (osBill.actions || [])
    .map((act: OpenStatesAction) => {
      const eventTimestamp = safeParseTimestamp(act.date); // Uses updated safeParseTimestamp
      if (!eventTimestamp) {
        // console.warn(`Invalid or missing date in history for bill ${osBill.identifier}: ${act.date}. Item skipped.`);
        return null;
      }
      const detailsText = act.classification?.join(', ');
      return {
        date: eventTimestamp,
        action: act.description || '',
        actor: act.organization?.name || 'Unknown',
        details: detailsText && detailsText.trim() !== '' ? detailsText : undefined,
      } as FirestoreLegislationHistoryEvent;
    })
    .filter((h): h is FirestoreLegislationHistoryEvent => h !== null);

    const versionItems: FirestoreLegislationVersion[] = (osBill.versions || [])
      .map((ver: OpenStatesVersion) => {
        const versionTimestamp = safeParseTimestamp(ver.date); // Uses updated safeParseTimestamp
        if (!versionTimestamp) {
          // if (ver.date && ver.date.trim() !== "") {
          //     console.warn(`Invalid date in versions for bill ${osBill.identifier}: ${ver.date}. Item skipped.`);
          // }
          return null;
        }
        return {
          date: versionTimestamp,
          name: ver.note || '',
          url: ver.links?.find(link => link.media_type === 'application/pdf')?.url || ver.links?.[0]?.url || '',
        };
      })
      .filter((v): v is FirestoreLegislationVersion => v !== null);

    let summaryText: string | null = null;
    if (osBill.abstracts && osBill.abstracts.length > 0 && osBill.abstracts[0].abstract) {
      summaryText = osBill.abstracts[0].abstract.trim() || null;
      if (summaryText === '') summaryText = null;
    }

    let processedTags: string[] = [];
    if (Array.isArray(osBill.subject)) {
      processedTags = osBill.subject.filter((tag: any): tag is string => typeof tag === 'string' && tag.trim().length > 0);
    } else if (typeof osBill.subject === 'string' && osBill.subject.trim().length > 0) {
      processedTags = [osBill.subject.trim()];
    }

    let status = 'Unknown';
    if (osBill.status) {
      if (Array.isArray(osBill.status) && osBill.status.length > 0 && typeof osBill.status[0] === 'string') {
          status = osBill.status[0];
      } else if (typeof osBill.status === 'string') {
          status = osBill.status;
      }
    }
    if (status === 'Unknown' && osBill.latest_action_description) {
      status = osBill.latest_action_description;
    }
    if (status === 'Unknown' && osBill.actions && osBill.actions.length > 0) {
      status = osBill.actions[0]?.description || 'Unknown';
    }


    const now = Timestamp.now(); // This is already a Firestore Timestamp

    const legislationData: FirestoreLegislation = {
      sourceId: osBill.id,
      title: osBill.title || '',
      billNumber: osBill.identifier || '',
      jurisdiction: jurisdictionAbbr,
      status: status,
      summary: summaryText,
      fullTextUrl: osBill.sources?.find(s => s.url?.includes('.html') || s.url?.includes('.pdf'))?.url || osBill.sources?.[0]?.url || null,
      sponsors: sponsors,
      introductionDate: safeParseTimestamp(osBill.first_action_date), // Uses updated safeParseTimestamp
      lastActionDate: safeParseTimestamp(osBill.latest_action_date),   // Uses updated safeParseTimestamp
      // effectiveDate: safeParseTimestamp(osBill.effective_date_field_if_it_exists_on_OpenStatesBill), // Example
      history: historyItems.length > 0 ? historyItems : undefined,
      tags: processedTags.length > 0 ? processedTags : undefined,
      chamber: osBill.from_organization?.classification || null,
      versions: versionItems.length > 0 ? versionItems : undefined,
      createdAt: now, // Already a Timestamp
      updatedAt: now, // Already a Timestamp
    };

    // Remove top-level undefined properties
    Object.keys(legislationData).forEach(keyStr => {
      const key = keyStr as keyof FirestoreLegislation;
      if (legislationData[key] === undefined) {
        delete legislationData[key];
      }
    });

    return legislationData;
  }

  async function fetchSessionsForJurisdiction(ocdId: string): Promise<OpenStatesLegislativeSession[]> {
    const url = `${OPENSTATES_API_BASE_URL}/jurisdictions/${ocdId}?apikey=${OPENSTATES_API_KEY}&include=legislative_sessions`;
    // console.log(`Fetching sessions from: ${url.replace(OPENSTATES_API_KEY!, 'REDACTED_KEY')}`);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Error fetching sessions for ${ocdId}: ${response.status} ${response.statusText}`);
        const errorBody = await response.text();
        console.error("Error body:", errorBody);
        return [];
      }
      const data = await response.json();
      return data.legislative_sessions || [];
    } catch (error) {
      console.error(`Exception fetching sessions for ${ocdId}:`, error);
      return [];
    }
  }

  async function fetchAndStoreBillsForSession(ocdId: string, jurisdictionAbbr: string, sessionIdentifier: string, sessionName: string) {
    console.log(`Fetching bills for ${jurisdictionAbbr} - Session: ${sessionName} (${sessionIdentifier})`);
    let page = 1;
    const perPage = 20;
    let hasMore = true;

    while (hasMore) {
      const url = `${OPENSTATES_API_BASE_URL}/bills?jurisdiction=${ocdId}&session=${sessionIdentifier}&page=${page}&per_page=${perPage}&apikey=${OPENSTATES_API_KEY}&include=sponsorships&include=abstracts&include=versions&include=actions&sort=updated_desc`;
      console.log(`Fetching page ${page} from: ${url.replace(OPENSTATES_API_KEY!, 'REDACTED_KEY')}`);

      try {
        const response = await fetch(url);
        if (!response.ok) {
          console.error(`Error fetching bills (page ${page}) for ${jurisdictionAbbr}, session ${sessionIdentifier}: ${response.status} ${response.statusText}`);
          const errorBody = await response.text();
          console.error("Error body:", errorBody);
          hasMore = false;
          continue;
        }
        const billData = await response.json();
        const bills: OpenStatesBill[] = billData.results || [];

        if (bills.length === 0) {
          hasMore = false;
          continue;
        }

        for (const osBill of bills) {
          try {
            const legislationToStore = transformOpenStatesBill(osBill, jurisdictionAbbr);
            await upsertLegislationBySourceId(legislationToStore as any);
            // console.log(`Successfully upserted bill ${osBill.identifier} (OS ID: ${osBill.id})`);
          } catch (error) {
            console.error(`Error transforming or upserting bill ${osBill.identifier} (OS ID: ${osBill.id}):`, error);
          }
        }

        if (billData.pagination && billData.pagination.page < billData.pagination.max_page) {
          page++;
          await delay(1000); // Rate limiting
        } else {
          hasMore = false;
        }
      } catch (error) {
        console.error(`Exception fetching bills (page ${page}) for ${jurisdictionAbbr}, session ${sessionIdentifier}:`, error);
        hasMore = false;
      }
    }
  }

  async function main() {
    if (!OPENSTATES_API_KEY) {
      console.error("OPENSTATES_API_KEY is not set in the environment variables.");
      return;
    }

    console.log("--- Starting historical data import for the last five years ---");
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    const fiveYearsAgoDateString = fiveYearsAgo.toISOString().split('T')[0];
    console.log(`Fetching data for sessions active since ${fiveYearsAgoDateString}`);


    for (const state of STATE_OCD_IDS) {
      console.log(`\n--- Processing State for Historical Data: ${state.abbr} (${state.ocdId}) ---`);
      const sessions = await fetchSessionsForJurisdiction(state.ocdId);
      await delay(500);

      const relevantSessions = sessions.filter(s => {
        const sessionEndDate = s.end_date || s.identifier;
        const sessionYearMatch = s.identifier.match(/\b(20[1-9][0-9])\b/);
        const sessionYear = sessionYearMatch ? parseInt(sessionYearMatch[1], 10) : 0;

        return !s.end_date || s.end_date >= fiveYearsAgoDateString || sessionYear >= fiveYearsAgo.getFullYear() -1;
      });

      if (relevantSessions.length > 0) {
        console.log(`Found ${relevantSessions.length} session(s) for ${state.abbr} within the last five years: ${relevantSessions.map(s => `${s.name} (${s.identifier})`).join(', ')}`);
        for (const session of relevantSessions) {
          await fetchAndStoreBillsForSession(state.ocdId, state.abbr, session.identifier, session.name);
          await delay(2000); // Rate limiting
        }
      } else {
        console.log(`No relevant recent sessions found for ${state.abbr} since ${fiveYearsAgoDateString}.`);
      }
    }
    console.log("\n--- Historical data import process finished ---");
  }

  main().catch(err => {
    console.error("Unhandled error in main execution:", err);
    process.exit(1);
  });