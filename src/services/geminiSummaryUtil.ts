import { ai } from '../ai/genkit';
import fetch from 'node-fetch';
import pdf from 'pdf-parse';
import * as cheerio from 'cheerio';

export async function generateGeminiSummary(text: string): Promise<string> {
  // Use Gemini to generate a ~100-word summary
  const prompt = `Summarize the following legislation in about 100 words, focusing on the main points and specific impact. Remove fluff and filler. If there is not enough information to summarize, say so in a single sentence: 'Summary not available due to insufficient information.'\n\n${text}`;
  const response = await ai.generate({ prompt, model: 'gemini-2.0-flash-lite' });
  return response.text.trim();
}

// Fetches the 'Bill as Passed Legislature' PDF (or equivalent) from a state legislature site and extracts its text
export async function fetchPdfFromOpenStatesUrl(legUrl: string): Promise<{ text: string | null, debug: string[] }> {
  const debug: string[] = [];
  try {
    debug.push(`Fetching legislature bill page: ${legUrl}`);
    const res = await fetch(legUrl);
    if (!res.ok) {
      debug.push(`Failed to fetch bill page. Status: ${res.status}`);
      return { text: null, debug };
    }
    const html = await res.text();
    // Try to find a PDF link with common phrases for final/official bill text
    // This covers WA and other states with similar markup
    const pdfRegexes = [
      /<a[^>]+href=["']([^"']+\.pdf[^"']*)["'][^>]*>([^<]*Passed Legislature[^<]*)<\/a>/i, // WA style
      /<a[^>]+href=["']([^"']+\.pdf[^"']*)["'][^>]*>([^<]*Enrolled[^<]*)<\/a>/i, // Many states use "Enrolled"
      /<a[^>]+href=["']([^"']+\.pdf[^"']*)["'][^>]*>([^<]*Final[^<]*)<\/a>/i, // Some use "Final"
      /<a[^>]+href=["']([^"']+\.pdf[^"']*)["'][^>]*>([^<]*Bill Text[^<]*)<\/a>/i, // Generic
      /<a[^>]+href=["']([^"']+\.pdf[^"']*)["'][^>]*>([^<]*Legislative[^<]*)<\/a>/i, // "Legislative" (for some states)
      /<a[^>]+href=["']([^"']+\.pdf[^"']*)["'][^>]*>([^<]*Bills[^<]*)<\/a>/i, // "Bills" (for some states)
      /<a[^>]+href=["']([^"']+\.pdf[^"']*)["'][^>]*>([^<]*Act[^<]*)<\/a>/i, // "Act" (for some states)
      /<a[^>]+href=["']([^"']+\.pdf[^"']*)["'][^>]*>([^<]*[^<]*)<\/a>/i // fallback: any PDF link
    ];
    let match = null;
    for (const regex of pdfRegexes) {
      match = html.match(regex);
      if (match) break;
    }
    if (!match) {
      debug.push('Could not find a final/official PDF link on the page.');
      return { text: null, debug };
    }
    let pdfUrl = match[1];
    if (!pdfUrl.startsWith('http')) {
      const base = new URL(legUrl);
      pdfUrl = new URL(pdfUrl, base).href;
    }
    debug.push(`Found PDF link: ${pdfUrl}`);
    const pdfRes = await fetch(pdfUrl);
    if (!pdfRes.ok) {
      debug.push(`Failed to fetch PDF. Status: ${pdfRes.status}`);
      return { text: null, debug };
    }
    const buffer = await pdfRes.arrayBuffer();
    debug.push('PDF fetched, parsing...');
    const data = await pdf(Buffer.from(buffer));
    debug.push('PDF parsed successfully.');
    return { text: data.text, debug };
  } catch (err) {
    debug.push('Error fetching or parsing PDF: ' + (err instanceof Error ? err.message : err));
    return { text: null, debug };
  }
}

export async function robustTextExtraction(doc: any): Promise<{text: string, debug: string[]}> {
  const debug: string[] = [];
  let text = doc.text || doc.body || doc.title || '';
  debug.push(`Initial text length: ${text.length}`);
  // Get the first non-PDF source URL (state legislature webpage) from sources
  const stateSource = doc.sources?.find((src: any) => src.url && !src.url.endsWith('.pdf'));
  if (stateSource && stateSource.url) {
    debug.push(`Using state legislature source URL: ${stateSource.url}`);
    const pdfResult = await fetchPdfFromOpenStatesUrl(stateSource.url);
    debug.push(...pdfResult.debug);
    if (pdfResult.text && pdfResult.text.length > 100) {
      debug.push('Used PDF from state legislature source page.');
      return {text: pdfResult.text, debug};
    } else {
      debug.push('No PDF or insufficient PDF text from state legislature source page.');
    }
    // Try HTML extraction
    try {
      const res = await fetch(stateSource.url);
      if (res.ok) {
        const html = await res.text();
        const $ = cheerio.load(html);
        let htmlText = $('main').text().trim() || $('body').text().trim();
        if (htmlText.length > 100) {
          debug.push('Used HTML main/body text from state legislature source page.');
          return {text: htmlText, debug};
        }
        htmlText = $('pre').text().trim();
        if (htmlText.length > 100) {
          debug.push('Used <pre> text from state legislature source page.');
          return {text: htmlText, debug};
        }
        htmlText = $('.bill-text').text().trim();
        if (htmlText.length > 100) {
          debug.push('Used .bill-text from state legislature source page.');
          return {text: htmlText, debug};
        }
      } else {
        debug.push('Failed to fetch state legislature source page for HTML extraction.');
      }
    } catch (e) {
      debug.push('Error fetching/parsing state legislature source page HTML.');
    }
  }
  // Try direct PDF from sources
  const pdfSource = doc.sources?.find((src: any) => src.url && src.url.endsWith('.pdf'));
  if (pdfSource) {
    try {
      const res = await fetch(pdfSource.url);
      if (res.ok) {
        const buffer = await res.buffer();
        const data = await pdf(buffer);
        if (data.text.length > 100) {
          debug.push('Used direct PDF from sources.');
          return {text: data.text, debug};
        }
      }
    } catch (e) {
      debug.push('Failed to fetch/parse direct PDF from sources.');
    }
  }
  // Aggressively combine all possible text fields
  let combined = '';
  if (doc.title) combined += doc.title + '\n';
  if (doc.summary) combined += doc.summary + '\n';
  if (doc.abstracts && Array.isArray(doc.abstracts)) {
    for (const abs of doc.abstracts) {
      if (abs && abs.abstract) combined += abs.abstract + '\n';
    }
  }
  if (doc.actions && Array.isArray(doc.actions)) {
    for (const act of doc.actions) {
      if (act && act.description) combined += act.description + '\n';
    }
  }
  if (doc.versions && Array.isArray(doc.versions)) {
    for (const ver of doc.versions) {
      if (ver && ver.note) combined += ver.note + '\n';
    }
  }
  // Add all string fields
  for (const key of Object.keys(doc)) {
    if (typeof doc[key] === 'string' && doc[key].length > 20) {
      combined += doc[key] + '\n';
    }
  }
  // Remove fallback phrase from combined text
  const fallbackPhrase = 'Summary not available due to insufficient information.';
  if (combined.includes(fallbackPhrase)) {
    combined = combined.split('\n').filter(line => !line.includes(fallbackPhrase)).join('\n');
    debug.push('Removed fallback phrase from combined text.');
  }
  debug.push('Aggressively combined string fields. Length: ' + combined.length);
  if (combined.length > 100) {
    debug.push('Used aggressively combined string fields.');
    debug.push('Combined preview: ' + combined.slice(0, 200));
    return {text: combined, debug};
  }
  debug.push('Fallback to title or short text.');
  debug.push('doc._id: ' + doc._id);
  return {text, debug};
}

/**
 * Extracts the best available text for summarization from a legislation object.
 * Prefers fullText, then summary, then title.
 */
export function extractBestTextForSummary(doc: any): { text: string | null, debug: string } {
  if (doc.fullText && doc.fullText.length > 50) {
    return { text: doc.fullText, debug: 'used fullText' };
  }
  if (doc.summary && doc.summary.length > 50) {
    return { text: doc.summary, debug: 'used summary' };
  }
  if (doc.title) {
    return { text: doc.title, debug: 'used title' };
  }
  return { text: null, debug: 'no usable text' };
}

// Alias for compatibility with scripts
export const fetchPdfTextFromOpenStatesUrl = async (legUrl: string): Promise<string | null> => {
  const result = await fetchPdfFromOpenStatesUrl(legUrl);
  return result.text;
};
