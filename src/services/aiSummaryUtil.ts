import { ai } from '../ai/genkit';
import fetch from 'node-fetch';
import pdf from 'pdf-parse';
import * as cheerio from 'cheerio';

export async function generateGeminiSummary(text: string): Promise<string> {
  // Use Gemini to generate a ~100-word summary
  const prompt = `Summarize the following legislation in about 100 words, focusing on the main points and specific impact. Remove fluff and filler. If there is not enough information to summarize, say so in a single sentence: 'Summary not available due to insufficient information.'\n\n${text}`;
  const response = await ai.generate({ prompt });
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
