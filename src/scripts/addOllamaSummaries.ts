import fetch from 'node-fetch';
import pdf from 'pdf-parse';
import * as cheerio from 'cheerio';
import * as fs from 'fs';
import * as path from 'path';
import { getAllLegislation, upsertLegislationSelective } from '../services/legislationService';
import { generateOllamaSummary, fetchPdfTextFromOpenStatesUrl } from '../services/geminiSummaryUtil';
import { getCollection } from '../lib/mongodb';

function getStateAbbrFromJuriId(jurisdictionId: string): string | null {
  const match = jurisdictionId.match(/state:([a-z]{2})/);
  return match ? match[1].toUpperCase() : null;
}

async function main() {
  const batchSize = 1000; // MongoDB's default max batch size for .find() is 1000
  let skip = 0;
  let hasMore = true;
  let processed = 0;
  // Get total count for progress tracking
  const legislationCollection = await getCollection('legislation');
  const total = await legislationCollection.countDocuments();

  while (hasMore) {
    const batch = await getAllLegislation({ skip, limit: batchSize });
    if (!batch.length) break;
    for (const [i, bill] of batch.entries()) {
      try {
        // Only update if geminiSummary is missing, is the fallback message, or is longer than 6 sentences
        const geminiSummarySentences = bill.geminiSummary ? bill.geminiSummary.split(/[.!?]+/).filter(s => s.trim().length > 0) : [];
        if (bill.geminiSummary && bill.geminiSummary !== 'Summary not available due to insufficient information.' && bill.geminiSummary.trim().length > 40 && geminiSummarySentences.length <= 6) {
          continue;
        }

        let textToSummarize = bill.fullText;

        // Try fetching full text from local JSON files
        if (!textToSummarize && bill.jurisdictionId && bill.session && bill.identifier) {
          const stateAbbr = getStateAbbrFromJuriId(bill.jurisdictionId);
          if (stateAbbr) {
            const jsonFilePath = path.join(process.cwd(), 'src', 'data', stateAbbr, bill.session, `${stateAbbr}_${bill.session}_bills.json`);
            try {
              if (fs.existsSync(jsonFilePath)) {
                const fileContent = fs.readFileSync(jsonFilePath, 'utf-8');
                const jsonData = JSON.parse(fileContent);
                // Assuming jsonData is an array of bill objects
                if (Array.isArray(jsonData)) {
                    const billData = jsonData.find(b => b.identifier === bill.identifier);
                    if (billData && billData.full_text) {
                        textToSummarize = billData.full_text;
                    }
                }
              }
            } catch (e) {
                console.error(`[Ollama] Error reading or parsing ${jsonFilePath}`, e);
            }
          }
        }

        // Use fullText if available, otherwise try to fetch PDF text
        if (!textToSummarize && bill.stateLegislatureUrl) {
          const pdfText = await fetchPdfTextFromOpenStatesUrl(bill.stateLegislatureUrl);
          if (pdfText && pdfText.length > 100) {
            textToSummarize = pdfText;
          } else {
            console.warn(`[Ollama] No valid PDF text found for ${bill.identifier || bill.id}.`);
          }
        }
        if (!textToSummarize) {
          console.warn(`[Ollama] No text available to summarize for ${bill.identifier || bill.id}.`);
          continue;
        }
        const summary = await generateOllamaSummary(textToSummarize, "mistral");
        bill.geminiSummary = summary;
        await upsertLegislationSelective(bill);
        processed++;
        const current = skip + i + 1;
        const percent = ((current / total) * 100).toFixed(2);
        console.log(`[Ollama] Updated summary for ${bill.identifier || bill.id} (${current} / ${total}, ${percent}%)`);
      } catch (err) {
        console.error(`[Ollama] Error processing ${bill.identifier || bill.id}:`, err);
      }
    }
    skip += batch.length;
    hasMore = batch.length === batchSize;
    console.log(`[Ollama] Batch progress: ${Math.min(skip, total)} / ${total} (${((Math.min(skip, total) / total) * 100).toFixed(2)}%)`);
  }
  console.log(`[Ollama] Finished. Processed ${processed} bills.`);
}

main().catch(err => {
  console.error('[Ollama] Unhandled error:', err);
});
