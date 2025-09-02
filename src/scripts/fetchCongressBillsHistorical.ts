import { transformCongressBillToMongoDB } from './utils/transformCongressBillToMongoDB';
import { getLegislationById, upsertLegislation } from '../services/legislationService';
import { config } from 'dotenv';
import fetch from 'node-fetch';
import { getCollection } from '../lib/mongodb';
import {enactedPatterns} from "@/types/legislation";

config({ path: '../../.env' });

const CONGRESS_API_KEY = process.env.US_CONGRESS_API_KEY;
const CONGRESS_API_BASE_URL = 'https://api.congress.gov/v3';

// Historical Congress sessions to fetch (adjust as needed)
const HISTORICAL_CONGRESS_SESSIONS = [
  119
];

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


function detectEnactedDate(history: any[]): Date | null {
    if (!history || history.length === 0) return null;

    // Sort history by date in descending order to find the most recent enacted action
    const sortedHistory = [...history].sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        return dateB - dateA;
    });

    // Check if any action in the history matches the enacted patterns
    for (const action of sortedHistory) {
        const actionText = (action.action || '').trim();
        if (!actionText) continue;

        for (const pattern of enactedPatterns) {
            if (pattern.test(actionText)) {
                // Return the date of the enacted action
                return action.date ? new Date(action.date) : null;
            }
        }
    }

    return null;
}

// Helper function to introduce delays (milliseconds)
function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Selective update function that only updates sponsors and history
async function updateBillSponsorsAndHistory(billId: string, sponsors: any[], history: any[], enactedAt: Date | null): Promise<void> {
  try {
    const legislationCollection = await getCollection('legislation');

    const updateFields: any = {
      sponsors,
      history,
      enactedAt,
      updatedAt: new Date()
    };

    // Also update related fields that depend on history
    if (history.length > 0) {
      const lastActionAt = history.reduce((latest: any, action: any) => {
        return action.date > latest ? action.date : latest;
      }, history[0].date);

      const firstActionAt = history.reduce((earliest: any, action: any) => {
        return action.date < earliest ? action.date : earliest;
      }, history[0].date);

      updateFields.latestActionAt = lastActionAt;
      updateFields.firstActionAt = firstActionAt;

      // Get the latest action description
      const sortedHistory = [...history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      if (sortedHistory.length > 0) {
        updateFields.latestActionDescription = sortedHistory[0].action;
        updateFields.statusText = sortedHistory[0].action;
      }
    }

    await legislationCollection.updateOne(
      { id: billId },
      { $set: updateFields }
    );

    console.log(`Updated sponsors and history for existing bill: ${billId}`);
  } catch (error) {
    console.error(`Error updating sponsors and history for bill ${billId}:`, error);
    throw error;
  }
}

// Process sponsors from Congress API data
function processCongressSponsors(congressBill: any): any[] {
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

  return sponsors;
}

// Process history from Congress API data
function processCongressHistory(congressBill: any): any[] {
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

  return history;
}

/**
 * Fetch historical bills from a specific Congress session
 */
async function fetchHistoricalCongressBills(congressNumber: number) {
  if (!CONGRESS_API_KEY) {
    console.error("Error: CONGRESS_API_KEY environment variable is not set. Skipping Congress data.");
    return;
  }

  let offset = 0;
  const limit = 20;
  let hasMore = true;
  let billsProcessed = 0;

  console.log(`\n--- Fetching historical bills from ${congressNumber}th Congress ---`);

  while (hasMore) {
    const url = `${CONGRESS_API_BASE_URL}/bill/${congressNumber}?api_key=${CONGRESS_API_KEY}&format=json&offset=${offset}&limit=${limit}`;

    console.log(`Fetching Congress ${congressNumber} bills offset ${offset} from: ${url.replace(CONGRESS_API_KEY as string, 'REDACTED_KEY')}`);

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
            const billId = `congress-bill-${congressNumber}-${bill.type.toLowerCase()}-${bill.number}`;

            // Check if bill already exists
            const existingLegislation = await getLegislationById(billId);

            // Fetch detailed bill information including actions
            const detailUrl = `${CONGRESS_API_BASE_URL}/bill/${congressNumber}/${bill.type.toLowerCase()}/${bill.number}?api_key=${CONGRESS_API_KEY}&format=json`;
            const detailResponse = await fetch(detailUrl);

            if (!detailResponse.ok) {
              console.error(`Error fetching bill details for ${bill.type} ${bill.number}: ${detailResponse.status}`);
              continue;
            }

            const detailData: any = await detailResponse.json();
            const congressBill = detailData.bill;

            // Fetch actions (required for sponsors and history)
            const actionsResponse = await fetch(`${CONGRESS_API_BASE_URL}/bill/${congressNumber}/${bill.type.toLowerCase()}/${bill.number}/actions?api_key=${CONGRESS_API_KEY}&format=json`);

            if (actionsResponse.ok) {
              const actionsData: any = await actionsResponse.json();
              congressBill.actions = actionsData;
            }

            // Process sponsors and history
            const sponsors = processCongressSponsors(congressBill);
            const history = processCongressHistory(congressBill);
            const enactedAt = detectEnactedDate(history);

            if (existingLegislation) {
              // Bill exists - only update sponsors and history
              await updateBillSponsorsAndHistory(billId, sponsors, history, enactedAt);
              console.log(`Updated existing bill: ${bill.type} ${bill.number} (${congressNumber}th Congress)`);
            } else {
              // Bill doesn't exist - insert complete bill
              console.log(`Bill ${bill.type} ${bill.number} doesn't exist. Inserting complete bill...`);

              // Fetch additional data for complete insertion
              const [textResponse, summariesResponse] = await Promise.all([
                fetch(`${CONGRESS_API_BASE_URL}/bill/${congressNumber}/${bill.type.toLowerCase()}/${bill.number}/text?api_key=${CONGRESS_API_KEY}&format=json`),
                fetch(`${CONGRESS_API_BASE_URL}/bill/${congressNumber}/${bill.type.toLowerCase()}/${bill.number}/summaries?api_key=${CONGRESS_API_KEY}&format=json`)
              ]);

              if (textResponse.ok) {
                const textData: any = await textResponse.json();
                congressBill.textVersions = textData;
              }

              if (summariesResponse.ok) {
                const summariesData: any = await summariesResponse.json();
                congressBill.summaries = summariesData;
              }

              const legislationToStore = transformCongressBillToMongoDB(congressBill);

              if (legislationToStore.id) {
                await upsertLegislation(legislationToStore);
                console.log(`Inserted new bill: ${bill.type} ${bill.number} (${congressNumber}th Congress)`);
              } else {
                console.warn(`Skipping bill with missing ID: ${bill.type} ${bill.number}`);
              }
            }

            billsProcessed++;

            // Rate limiting for Congress API
            await delay(150); // Be respectful to the API

          } catch (transformError) {
            console.error(`Error processing Congress bill ${bill.type} ${bill.number}:`, transformError);
          }
        }

        if (hasMore) {
          offset += limit;
        }
      } else {
        hasMore = false;
      }
    } catch (error) {
      console.error(`Network error fetching Congress bills for session ${congressNumber}:`, error);
      hasMore = false;
    }
  }

  console.log(`Finished fetching bills from ${congressNumber}th Congress. Processed ${billsProcessed} bills.`);
}

// Parse command line arguments
function parseArguments(): {
  specificCongress?: number;
  startCongress?: number;
  endCongress?: number;
  runOnce?: boolean;
} {
  const args = process.argv.slice(2);
  let specificCongress: number | undefined;
  let startCongress: number | undefined;
  let endCongress: number | undefined;
  let runOnce: boolean = true;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--congress':
        if (i + 1 < args.length) {
          specificCongress = parseInt(args[i + 1]);
          i++;
        }
        break;
      case '--start':
        if (i + 1 < args.length) {
          startCongress = parseInt(args[i + 1]);
          i++;
        }
        break;
      case '--end':
        if (i + 1 < args.length) {
          endCongress = parseInt(args[i + 1]);
          i++;
        }
        break;
      case '--help':
      case '-h':
        console.log(`
Usage: node fetchCongressBillsHistorical.js [options]

Options:
  --congress N         Fetch bills from specific Congress session (e.g., --congress 118)
  --start N           Start from specific Congress session (e.g., --start 110)
  --end N             End at specific Congress session (e.g., --end 118)
  --help, -h          Show this help message

Examples:
  node fetchCongressBillsHistorical.js                    # Fetch from predefined historical sessions
  node fetchCongressBillsHistorical.js --congress 118     # Fetch only from 118th Congress
  node fetchCongressBillsHistorical.js --start 115 --end 118  # Fetch from 115th to 118th Congress

Notes:
  - For existing bills, only sponsors and history fields will be updated
  - New bills will be inserted completely
  - The script includes rate limiting to be respectful to the Congress.gov API
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

  return { specificCongress, startCongress, endCongress, runOnce };
}

async function main() {
  const { specificCongress, startCongress, endCongress } = parseArguments();

  let congressSessions: number[] = [];

  if (specificCongress) {
    congressSessions = [specificCongress];
    console.log(`Fetching bills from ${specificCongress}th Congress only`);
  } else if (startCongress && endCongress) {
    for (let congress = startCongress; congress <= endCongress; congress++) {
      congressSessions.push(congress);
    }
    console.log(`Fetching bills from ${startCongress}th to ${endCongress}th Congress`);
  } else if (startCongress) {
    for (let congress = startCongress; congress <= 119; congress++) {
      congressSessions.push(congress);
    }
    console.log(`Fetching bills from ${startCongress}th Congress to current (119th)`);
  } else {
    congressSessions = HISTORICAL_CONGRESS_SESSIONS;
    console.log(`Fetching bills from predefined historical Congress sessions: ${congressSessions.join(', ')}`);
  }

  console.log(`--- Starting historical Congress bills fetch ---`);
  console.log(`--- Will process ${congressSessions.length} Congress sessions ---`);

  for (const congressNumber of congressSessions) {
    await fetchHistoricalCongressBills(congressNumber);

    // Add delay between different Congress sessions
    await delay(2000);
  }

  console.log("\n--- Finished processing all historical Congress sessions ---");
  console.log("--- For existing bills: updated sponsors and history only ---");
  console.log("--- For new bills: inserted complete records ---");

  process.exit(0);
}

main().catch(err => {
  console.error("Unhandled error in main execution:", err);
  process.exit(1);
});

