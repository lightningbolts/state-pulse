import fetch from 'node-fetch';
import pdf from 'pdf-parse';
import * as cheerio from 'cheerio';
import { getAllLegislation, upsertLegislationSelective } from '../services/legislationService';
import { generateOllamaSummary, fetchPdfTextFromOpenStatesUrl } from '../services/geminiSummaryUtil';
import { getCollection } from '../lib/mongodb';

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
        if (!bill.fullText || (bill.geminiSummary && bill.geminiSummary !== 'Summary not available due to insufficient information.' && bill.geminiSummary.trim().length > 40)) {
          continue;
        }
        // Always try to fetch the best PDF text for summarization
        let textToSummarize = bill.fullText;
        if (bill.stateLegislatureUrl) {
          const pdfText = await fetchPdfTextFromOpenStatesUrl(bill.stateLegislatureUrl);
          if (pdfText && pdfText.length > 100) {
            textToSummarize = pdfText;
          } else {
            console.warn(`[Ollama] No valid PDF text found for ${bill.identifier || bill.id}. Using fullText.`);
          }
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
