import { ai } from '../ai/genkit';
import fetch from 'node-fetch';
import pdf from 'pdf-parse';
import * as cheerio from 'cheerio';
import { Legislation } from '../types/legislation';

export async function generateGeminiSummary(text: string): Promise<string> {
  // Use Gemini to generate a ~100-word summary
  const prompt = `Summarize the following legislation in about 100 words, focusing on the main points and specific impact. Remove fluff and filler. If there is not enough information to summarize, say so in a single sentence: 'Summary not available due to insufficient information.'\n\n${text}`;
  const response = await ai.generate({ prompt });
  return response.text.trim();
}

export async function summarizeWithAzure(text: string): Promise<string[]> {
  const endpoint = process.env.AZURE_LANGUAGE_ENDPOINT!;
  const apiKey = process.env.AZURE_LANGUAGE_KEY!;

  const response = await fetch(`${endpoint}/language/:analyze-text`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Ocp-Apim-Subscription-Key": apiKey
    },
    body: JSON.stringify({
      kind: "ExtractiveSummarization",
      parameters: { sentenceCount: 5 },
      displayName: "Legislation Summary",
      analysisInput: {
        documents: [
          {
            id: "1",
            language: "en",
            text
          }
        ]
      }
    })
  });

  const result = await response.json();

  if (response.ok) {
    return result.results.documents[0].sentences.map((s: any) => s.text);
  } else {
    console.error("Azure summarization failed", result);
    throw new Error("Azure summarization failed");
  }
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

/**
 * Summarize text using an Ollama model (local LLM)
 * @param text The text to summarize
 * @returns The summary string
 */
export async function generateOllamaSummary(text: string, model: string): Promise<string> {
  if (!text || text.trim().length === 0) return 'Summary not available due to insufficient information.';
  try {
    const prompt = `Summarize this legislative bill for a general audience in 3–5 sentences. Focus on what the bill does, who it affects, and any key impacts. If no content is available, respond: 'Summary not available due to insufficient information.'\n\n${text}`;
    // console.log('[Ollama] Prompt:', prompt.slice(0, 500));
    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: model,
        prompt: prompt,
        stream: false
      })
    });
    if (!response.ok) {
      console.error(`[Ollama] API error: ${response.status} ${response.statusText}`);
      throw new Error(`Ollama ${model} API error: ${response.status}`);
    }
    const data = await response.json();
    console.log('Valid Ollama summary generated.')
    // console.log('[Ollama] Raw response:', data);
    return data.response?.trim() || 'Summary not available due to insufficient information.';
  } catch (err) {
    console.error('Error generating ollama summary:', err);
    return 'Summary not available due to insufficient information.';
  }
}

/**
 * Generates a summary for a bill using the richest available information, in priority order:
 * 1. PDF text from bill versions
 * 2. Concatenated abstracts
 * 3. Text from first sources.url
 * 4. Bill title
 */
export async function summarizeLegislationRichestSource(bill: Legislation): Promise<{ summary: string, sourceType: string }> {
  // 1. Try most recent PDF from versions
  if (bill.versions && Array.isArray(bill.versions)) {
    // Sort versions by date (if available), descending
    const sortedVersions = bill.versions.slice().sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    });
    for (const version of sortedVersions) {
      if (version.url && version.url.endsWith('.pdf')) {
        try {
          const res = await fetch(version.url);
          if (res.ok) {
            const buffer = await res.arrayBuffer();
            const pdfText = await pdf(Buffer.from(buffer));
            if (pdfText.text && pdfText.text.trim().length > 100) {
              const summaryArr = await summarizeWithAzure(pdfText.text);
              const summary = Array.isArray(summaryArr) ? summaryArr.join(' ') : String(summaryArr);
              return { summary, sourceType: 'pdf' };
            }
          }
        } catch (e) {
          // Ignore and continue
        }
      }
    }
  }
  // 2. Try abstracts
  if (bill.abstracts && Array.isArray(bill.abstracts) && bill.abstracts.length > 0) {
    const abstractsText = bill.abstracts.map(a => a.abstract).filter(Boolean).join('\n');
    if (abstractsText.trim().length > 20) {
      const summary = await summarizeWithAzure(abstractsText);
      return { summary: String(summary), sourceType: 'abstracts' };
    }
  }
  // 3. Try all sources.url, remove duplicate info
  if (bill.sources && Array.isArray(bill.sources) && bill.sources.length > 0) {
    const seenTexts = new Set<string>();
    let combinedText = '';
    for (const source of bill.sources) {
      if (source.url) {
        try {
          const res = await fetch(source.url);
          if (res.ok) {
            const html = await res.text();
            const $ = cheerio.load(html);
            const pageText = $('body').text().trim();
            // Only add unique, non-empty text
            if (pageText.length > 100 && !seenTexts.has(pageText)) {
              seenTexts.add(pageText);
              combinedText += pageText + '\n';
            }
          }
        } catch (e) {
          // Ignore and continue
        }
      }
    }
    if (combinedText.trim().length > 100) {
      const summary = await summarizeWithAzure(combinedText);
      return { summary: String(summary), sourceType: 'sources.url' };
    }
  }
  // 4. Fallback: bill title
  const title = bill.title || 'No title available.';
  const summary = await summarizeWithAzure(title);
  return { summary: String(summary), sourceType: 'title' };
}
