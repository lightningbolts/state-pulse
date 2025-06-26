import { config } from 'dotenv';
import fs from 'fs/promises';
import path from 'path';
import { getCollection, connectToDatabase } from '../lib/mongodb';
import { Legislation } from '../types/legislation';
import { generateOllamaSummary } from '../services/aiSummaryUtil';
import fetch from 'node-fetch';

config({ path: path.resolve(__dirname, '../../.env') });

const DATA_DIR = path.join(__dirname, '../data');
console.log('DATA_DIR:', DATA_DIR);

/**
 * Processes all JSON files in a directory and its subdirectories and upserts them into MongoDB.
 * Supports starting at a specific file if startAtFile is provided.
 */
async function processDirectory(directory: string, legislationCollection: any, startAtFile?: string, state?: { skipping: boolean }) {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  console.log('Directory entries for', directory, ':', entries.map(e => e.name));
  for (const entry of entries) {
    const fullPath = path.join(directory, entry.name);
    console.log('Processing entry:', fullPath, 'isDirectory:', entry.isDirectory(), 'isFile:', entry.isFile());
    if (entry.isDirectory()) {
      await processDirectory(fullPath, legislationCollection, startAtFile, state);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith('.json')) {
      // If skipping, check if this is the start file
      if (state && state.skipping) {
        // Compare relative path from DATA_DIR for flexibility
        const relPath = path.relative(DATA_DIR, fullPath);
        if (relPath === startAtFile || entry.name === startAtFile) {
          state.skipping = false;
        } else {
          continue;
        }
      }
      console.log(`Processing file: ${fullPath}`);
      try {
        const fileContent = await fs.readFile(fullPath, 'utf-8');
        const bills: any[] = JSON.parse(fileContent);
        if (Array.isArray(bills) && bills.length > 0) {
          console.log(`Found ${bills.length} bills in ${entry.name}`);
          let processed = 0;
          const batchSize = 100;
          for (let i = 0; i < bills.length; i += batchSize) {
            const batch = bills.slice(i, i + batchSize);
            const operations = batch
              .filter(bill => {
                if (!bill.id) {
                  console.warn(`Skipping bill with missing id at index ${i}`);
                  return false;
                }

                const session = bill.legislative_session || bill.session;
                const jurisdiction = bill.jurisdiction_name || bill.jurisdiction?.name;

                if (jurisdiction === 'Washington' && session === '2025-2026') {
                  return false;
                }

                // Only process legislation from one year ago (2024) to now
                const currentYear = new Date().getFullYear();
                const minYear = currentYear - 1;
                let billYear: number | null = null;
                if (session) {
                  const yearMatch = String(session).match(/\d{4}/);
                  if (yearMatch) {
                    billYear = parseInt(yearMatch[0], 10);
                  }
                }
                // Fallback to checking action dates if session year is not available
                if (!billYear && Array.isArray(bill.actions) && bill.actions.length > 0) {
                  for (const action of bill.actions) {
                    if (action.date) {
                      const year = new Date(action.date).getFullYear();
                      if (!billYear || year > billYear) billYear = year;
                    }
                  }
                }
                if (!billYear) return false;
                return billYear >= minYear && billYear <= currentYear;
              })
              .map(async (bill, idx) => {
                if (i % 10 === 0) {
                  console.log(`Processing bill ${i + idx + 1} / ${bills.length} (id: ${bill.id})`);
                }
                const historyWithDates = (bill.actions || []).map((action: any) => ({
                  date: action.date ? new Date(action.date) : null,
                  action: action.description || '',
                  actor: action.organization__name || '',
                  classification: action.classification || [],
                  order: action.order,
                }));

                const sponsors = (bill.sponsors || []).map((s: any) => ({
                  name: s.name,
                  id: s.id || null,
                  entityType: s.entity_type || null,
                  primary: typeof s.primary === 'boolean' ? s.primary : null,
                  classification: s.classification || null,
                  personId: s.person_id || null,
                  organizationId: s.organization_id || null,
                }));

                const versions = (bill.versions || []).map((v: any) => ({
                  note: v.note || '',
                  date: v.date ? new Date(v.date) : null,
                  classification: v.classification || null,
                  links: (v.links || []).map((l: any) => ({
                    url: l.url,
                    media_type: l.media_type || null,
                  })),
                }));

                const documents = (bill.documents || []).map((d: any) => ({
                  note: d.note || '',
                  date: d.date ? new Date(d.date) : null,
                  links: (d.links || []).map((l: any) => ({
                    url: l.url,
                    media_type: l.media_type || null,
                  })),
                }));

                const sources = (bill.sources || []).map((s: any) => ({
                  url: s.url,
                  note: s.note || null,
                }));

                const abstracts = (bill.abstracts || []).map((a: any) => ({
                  abstract: a.abstract || '',
                  note: a.note || null,
                }));

                // AI summary logic
                let geminiSummary = bill.geminiSummary || null;
                let generatedNewSummary = false;
                if (!geminiSummary || geminiSummary.length < 100) {
                  let textToSummarize = bill.raw_text || null;
                  if (!textToSummarize && bill.raw_text_url) {
                    try {
                      const resp = await fetch(bill.raw_text_url);
                      if (resp.ok) {
                        textToSummarize = await resp.text();
                      }
                    } catch (e) {
                      console.warn(`Failed to fetch raw_text_url for bill ${bill.id}`);
                    }
                  }
                  if (textToSummarize) {
                    // console.log(`[DEBUG] Bill ${bill.id} textToSummarize length:`, textToSummarize.length);
                    // console.log(`[DEBUG] Bill ${bill.id} textToSummarize preview:`, textToSummarize.slice(0, 200));
                    try {
                      geminiSummary = await generateOllamaSummary(textToSummarize, "mistral");
                      generatedNewSummary = true;
                    } catch (e) {
                      console.warn(`Failed to generate summary for bill ${bill.id}`);
                    }
                  }
                }
                if (generatedNewSummary) {
                  console.log(`[SUMMARY] New summary generated for bill ${bill.id}`);
                }

                const legislation: Partial<Legislation> = {
                  id: bill.id.replace('/', '_'),
                  identifier: bill.identifier,
                  title: bill.title,
                  session: bill.legislative_session || bill.session,
                  jurisdictionName: bill.jurisdiction_name || bill.jurisdiction?.name,
                  chamber: bill.chamber || bill.from_organization?.classification,
                  classification: bill.classification,
                  subjects: bill.subjects || bill.subject,
                  sponsors,
                  history: historyWithDates,
                  versions,
                  documents,
                  sources,
                  abstracts,
                  geminiSummary,
                  openstatesUrl: bill.openstates_url,
                  firstActionAt: bill.first_action_date ? new Date(bill.first_action_date) : null,
                  latestActionAt: bill.latest_action_date ? new Date(bill.latest_action_date) : null,
                  latestActionDescription: bill.latest_action_description,
                  latestPassageAt: bill.latest_passage_date ? new Date(bill.latest_passage_date) : null,
                  createdAt: bill.created_at ? new Date(bill.created_at) : undefined,
                  updatedAt: bill.updated_at ? new Date(bill.updated_at) : undefined,
                  summary: bill.summary || null,
                  extras: bill.extras || null,
                };

                // eslint-disable-next-line @typescript-eslint/no-unused-vars
                const { id, ...updateData } = legislation;

                const updateOperation: any = { $set: updateData };

                return {
                  updateOne: {
                    filter: { id: legislation.id },
                    update: updateOperation,
                    upsert: true,
                  },
                };
              });
            const resolvedOperations = await Promise.all(operations);
            if (resolvedOperations.length > 0) {
              try {
                await legislationCollection.bulkWrite(resolvedOperations);
                console.log(`Upserted ${resolvedOperations.length} bills from ${entry.name} (batch ${i / batchSize + 1})`);
              } catch (err) {
                console.error(`Error in bulkWrite for batch starting at index ${i}:`, err);
              }
            }
            processed += batch.length;
          }
          console.log(`Finished processing ${processed} bills from ${entry.name}`);
        } else if (bills && typeof bills === 'object' && !Array.isArray(bills)) {
          const bill = bills as any;
          if (bill.id) {
            const historyWithDates = (bill.actions || []).map((action: any) => ({
              date: action.date ? new Date(action.date) : null,
              action: action.description || '',
              actor: action.organization__name || '',
              classification: action.classification || [],
              order: action.order,
            }));

            const sponsors = (bill.sponsors || []).map((s: any) => ({
              name: s.name,
              id: s.id || null,
              entityType: s.entity_type || null,
              primary: typeof s.primary === 'boolean' ? s.primary : null,
              classification: s.classification || null,
              personId: s.person_id || null,
              organizationId: s.organization_id || null,
            }));

            const versions = (bill.versions || []).map((v: any) => ({
              note: v.note || '',
              date: v.date ? new Date(v.date) : null,
              classification: v.classification || null,
              links: (v.links || []).map((l: any) => ({
                url: l.url,
                media_type: l.media_type || null,
              })),
            }));

            const documents = (bill.documents || []).map((d: any) => ({
              note: d.note || '',
              date: d.date ? new Date(d.date) : null,
              links: (d.links || []).map((l: any) => ({
                url: l.url,
                media_type: l.media_type || null,
              })),
            }));

            const sources = (bill.sources || []).map((s: any) => ({
              url: s.url,
              note: s.note || null,
            }));

            const abstracts = (bill.abstracts || []).map((a: any) => ({
              abstract: a.abstract || '',
              note: a.note || null,
            }));

            const legislation: Partial<Legislation> = {
              id: bill.id.replace('/', '_'),
              identifier: bill.identifier,
              title: bill.title,
              session: bill.legislative_session || bill.session,
              jurisdictionName: bill.jurisdiction_name || bill.jurisdiction?.name,
              chamber: bill.chamber || bill.from_organization?.classification,
              classification: bill.classification,
              subjects: bill.subjects || bill.subject,
              sponsors,
              history: historyWithDates,
              versions,
              documents,
              sources,
              abstracts,
              openstatesUrl: bill.openstates_url,
              firstActionAt: bill.first_action_date ? new Date(bill.first_action_date) : null,
              latestActionAt: bill.latest_action_date ? new Date(bill.latest_action_date) : null,
              latestActionDescription: bill.latest_action_description,
              latestPassageAt: bill.latest_passage_date ? new Date(bill.latest_passage_date) : null,
              createdAt: bill.created_at ? new Date(bill.created_at) : undefined,
              updatedAt: bill.updated_at ? new Date(bill.updated_at) : undefined,
              geminiSummary: bill.geminiSummary || null,
              summary: bill.summary || null,
              extras: bill.extras || null,
            };

            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id, ...updateData } = legislation;

            const updateOperation: any = { $set: updateData };
            if (bill.actions && bill.actions.length > 0) {
              const historyWithDates = bill.actions.map((action: any) => ({
                ...action,
                date: new Date(action.date),
              }));
              updateOperation.$addToSet = { history: { $each: historyWithDates } };
            }

            await legislationCollection.updateOne(
                { id: legislation.id },
                updateOperation,
                { upsert: true }
            );
            console.log(`Upserted 1 bill from ${entry.name}`);
          }
        }
      } catch (e) {
        console.error(`Error processing file ${fullPath}:`, e);
      }
    }
  }
}

async function processHistoricalData() {
  console.log('Connecting to database...');
  await connectToDatabase();
  const legislationCollection = await getCollection('legislation');
  console.log('Starting to process historical data from local JSON files...');
  // Support CLI arg for start file
  const startAtFile = process.argv[2];
  const state = { skipping: !!startAtFile };
  await processDirectory(DATA_DIR, legislationCollection, startAtFile, state);
  console.log('Finished processing all historical data.');
}

processHistoricalData()
    .then(() => {
      console.log('Script finished successfully.');
      process.exit(0);
    })
    .catch(error => {
      console.error('Script failed:', error);
      process.exit(1);
    });