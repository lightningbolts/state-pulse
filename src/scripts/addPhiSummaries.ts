import fetch from 'node-fetch';
import pdf from 'pdf-parse';
import * as cheerio from 'cheerio';
import { getAllLegislation, upsertLegislationSelective } from '../services/legislationService';
import { generatePhiSummary } from '../services/geminiSummaryUtil';

async function main() {
  const batchSize = 20;
  let skip = 0;
  let hasMore = true;
  let processed = 0;

  while (hasMore) {
    const batch = await getAllLegislation({ skip, limit: batchSize });
    if (!batch.length) break;
    for (const bill of batch) {
      try {
        if (!bill.fullText || (bill.geminiSummary && bill.geminiSummary !== 'Summary not available due to insufficient information.')) {
          continue;
        }
        const summary = await generatePhiSummary(bill.fullText);
        bill.geminiSummary = summary;
        await upsertLegislationSelective(bill);
        processed++;
        console.log(`[Phi] Updated summary for ${bill.identifier || bill.id}`);
      } catch (err) {
        console.error(`[Phi] Error processing ${bill.identifier || bill.id}:`, err);
      }
    }
    skip += batch.length;
    hasMore = batch.length === batchSize;
  }
  console.log(`[Phi] Finished. Processed ${processed} bills.`);
}

main().catch(err => {
  console.error('[Phi] Unhandled error:', err);
});

