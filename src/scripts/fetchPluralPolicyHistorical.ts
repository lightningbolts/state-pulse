import { upsertLegislation } from '../services/legislationService';
import { config } from 'dotenv';
import fetch from 'node-fetch';
import * as cheerio from 'cheerio';
import { generateGeminiSummary } from '../services/geminiSummaryUtil';

config({ path: '../../.env' });

const PLURAL_POLICY_BASE_URL = 'https://open.pluralpolicy.com/data/session-json/';

/**
 * Fetches the list of JSON file URLs from the PluralPolicy data page.
 */
async function getJsonFileUrls(): Promise<string[]> {
  console.log('Fetching list of historical data files from PluralPolicy...');
  try {
    const response = await fetch(PLURAL_POLICY_BASE_URL);
    if (!response.ok) {
      console.error(`Failed to fetch file list: ${response.statusText}`);
      return [];
    }
    const html = await response.text();
    const $ = cheerio.load(html);
    const urls: string[] = [];
    $('a').each((i, element) => {
      const href = $(element).attr('href');
      if (href && href.endsWith('.json')) {
        urls.push(PLURAL_POLICY_BASE_URL + href);
      }
    });
    console.log(`Found ${urls.length} data files.`);
    return urls;
  } catch (error) {
    console.error('Error fetching file list:', error);
    return [];
  }
}

/**
 * Transforms a bill from the PluralPolicy format to our database format.
 * NOTE: This function is based on an assumed data structure for PluralPolicy data.
 * You may need to adjust field names based on the actual structure of the JSON files.
 */
function transformPluralPolicyBill(bill: any, session: any): any {
  const {
    bill_id,
    title,
    sponsors,
    actions,
    versions,
    sources,
    subjects,
    chamber,
    status,
    summary,
    full_text,
  } = bill;

  const {
      jurisdiction_id,
      jurisdiction: jurisdictionName,
      name: sessionName
  } = session;

  const transformedSponsors = (sponsors || []).map((s: any) => ({
    name: s.name,
    id: s.id,
    entityType: s.entity_type,
    primary: s.primary,
  }));

  const transformedHistory = (actions || []).map((a: any) => ({
    date: new Date(a.date),
    action: a.description,
    actor: a.actor,
    classification: a.classification,
  }));

  const transformedVersions = (versions || []).map((v: any) => ({
      note: v.note,
      date: new Date(v.date),
      url: v.links && v.links.length > 0 ? v.links[0].url : null
  }));

  const id = `${jurisdiction_id}_${sessionName}_${bill_id}`.replace(/[^a-zA-Z0-9_]/g, '_');
  const now = new Date();

  return {
    id,
    identifier: bill_id,
    title,
    session: sessionName,
    jurisdictionId: jurisdiction_id,
    jurisdictionName: jurisdictionName,
    chamber,
    classification: bill.classification || [],
    subjects: subjects || [],
    statusText: status,
    sponsors: transformedSponsors,
    history: transformedHistory,
    versions: transformedVersions,
    sources: sources || [],
    abstracts: summary ? [{ abstract: summary, note: 'From PluralPolicy' }] : [],
    openstatesUrl: null, // Not available in PluralPolicy data
    firstActionAt: transformedHistory.length > 0 ? transformedHistory[0].date : null,
    latestActionAt: transformedHistory.length > 0 ? transformedHistory[transformedHistory.length - 1].date : null,
    latestActionDescription: transformedHistory.length > 0 ? transformedHistory[transformedHistory.length - 1].action : null,
    latestPassageAt: null, // Not available in PluralPolicy data
    createdAt: now,
    updatedAt: now,
    summary: summary,
    fullText: full_text,
    extras: {}, // Not available in PluralPolicy data
  };
}

/**
 * Fetches, transforms, and stores historical legislation data from PluralPolicy.
 */
async function importHistoricalData() {
  const fileUrls = await getJsonFileUrls();

  for (const url of fileUrls) {
    console.log(`\nProcessing file: ${url}`);
    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.error(`Failed to download ${url}: ${response.statusText}`);
        continue;
      }
      const data: any = await response.json();

      // Assuming the JSON structure is { session: {...}, bills: [...] }
      const bills = data.bills || [];
      const session = data.session || {};

      if (bills.length === 0) {
        console.log('No bills found in this file.');
        continue;
      }

      console.log(`Found ${bills.length} bills for session: ${session.name}`);

      for (const bill of bills) {
        try {
          const legislationData = transformPluralPolicyBill(bill, session);

          const textForSummary = legislationData.fullText || legislationData.summary || legislationData.title;
          if (textForSummary) {
              legislationData.geminiSummary = "AI Summary is currently not available.";
          }

          await upsertLegislation(legislationData);
          console.log(`  - Upserted bill: ${legislationData.identifier}`);
        } catch (e) {
          console.error(`  - Error processing bill ${bill.bill_id}:`, e);
        }
      }
    } catch (error) {
      console.error(`Error processing file ${url}:`, error);
    }
  }
  console.log('\nHistorical data import from PluralPolicy is complete.');
}

importHistoricalData().catch(console.error);
