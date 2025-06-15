import { getCollection } from '../lib/mongodb';
import { ai } from '../ai/genkit';
import fetch from 'node-fetch';
import pdf from 'pdf-parse';
import * as cheerio from 'cheerio';

async function generateSummary(text: string): Promise<string> {
  // Use Gemini to generate a ~100-word summary
  const prompt = `Summarize the following legislation in about 100 words, focusing on the main points and specific impact.\n\n${text}`;
  const response = await ai.generate({ prompt });
  return response.text.trim();
}

async function fetchPdfFromOpenStatesUrl(openstatesUrl: string): Promise<string | null> {
  try {
    const res = await fetch(openstatesUrl);
    if (!res.ok) throw new Error('Failed to fetch OpenStates page');
    const html = await res.text();
    const $ = cheerio.load(html);
    // Try to find a PDF link on the OpenStates page
    const link = $("a").filter((_, el) => $(el).attr('href') && $(el).attr('href').endsWith('.pdf')).first().attr('href');
    if (link) {
      const pdfUrl = link.startsWith('http') ? link : new URL(link, openstatesUrl).href;
      const pdfRes = await fetch(pdfUrl);
      if (!pdfRes.ok) throw new Error('Failed to fetch PDF');
      const buffer = await pdfRes.buffer();
      const data = await pdf(buffer);
      return data.text;
    }
  } catch (e) {
    console.error('Failed to fetch or parse PDF from OpenStates page:', e);
  }
  return null;
}

async function main() {
  const collection = await getCollection('legislation');
  const batchSize = 50;
  let lastId = undefined;
  let count = 0;

  while (true) {
    // Build query for pagination
    const query = lastId ? { _id: { $gt: lastId } } : {};
    // Fetch docs that ALREADY HAVE a geminiSummary
    const docs = await collection
      .find({ ...query, geminiSummary: { $exists: false } })
      .sort({ _id: 1 })
      .limit(batchSize)
      .toArray();
    if (docs.length === 0) break;
    for (const doc of docs) {
      let text = doc.text || doc.body || doc.title || '';
      // Try to get PDF from openstatesUrl
      if (doc.openstatesUrl) {
        const pdfText = await fetchPdfFromOpenStatesUrl(doc.openstatesUrl);
        if (pdfText) text = pdfText;
      } else {
        // Fallback: Try to get a direct PDF link from sources
        const pdfSource = doc.sources?.find((src: any) => src.url && src.url.endsWith('.pdf'));
        if (pdfSource) {
          try {
            const res = await fetch(pdfSource.url);
            if (res.ok) {
              const buffer = await res.buffer();
              const data = await pdf(buffer);
              text = data.text;
            }
          } catch (e) {
            console.error('Failed to fetch or parse direct PDF:', e);
          }
        }
      }
      if (!text) continue;
      try {
        const summary = await generateSummary(text);
        await collection.updateOne(
          { _id: doc._id },
          { $set: { geminiSummary: summary } }
        );
        count++;
        console.log(`Updated legislation ${doc._id}`);
      } catch (err) {
        console.error(`Failed to summarize ${doc._id}:`, err);
      }
      lastId = doc._id;
    }
  }
  console.log(`Done. Updated ${count} documents.`);
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
