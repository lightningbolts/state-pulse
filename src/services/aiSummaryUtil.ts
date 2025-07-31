import { ai } from '../ai/genkit';
import fetch from 'node-fetch';
import pdf from 'pdf-parse';
import * as cheerio from 'cheerio';
import { Legislation } from '../types/legislation';

export async function generateGeminiSummary(text: string): Promise<string> {
  // Use Gemini to generate a ~100-word summary
  const prompt = `Summarize the following legislation in 100 words, focusing on the main points and specific impact. Remove fluff and filler. If there is not enough information to summarize, say so in a single sentence: 'Summary not available due to insufficient information.'\n\n${text}`;
  const response = await ai.generate({ prompt });
  return response.text.trim();
}

export async function summarizeWithAzure(text: string): Promise<string[]> {
  // NOTE: Azure extractive summarization only selects sentences from the input, it does not generate new text.
  // If you want a paraphrased summary, use an abstractive/generative model (e.g., Gemini, GPT, Ollama).
  // console.log('[Azure] Input to summarization (first 500 chars):', text.slice(0, 500));
  const endpoint = process.env.AZURE_LANGUAGE_ENDPOINT!;
  const apiKey = process.env.AZURE_LANGUAGE_KEY!;
  const apiVersion = "2024-11-15-preview";
  // Azure limit: 125,000 characters per request
  const MAX_CHARS = 125000;
  if (text.length > MAX_CHARS) {
    text = text.slice(0, MAX_CHARS);
  }
  try {
    const response = await fetch(`${endpoint}/language/analyze-text/jobs?api-version=${apiVersion}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Ocp-Apim-Subscription-Key": apiKey
        },
        body: JSON.stringify({
          displayName: "Abstractive Legislation Summarization",
          analysisInput: {
            documents: [
              {
                id: "1",
                language: "en",
                text
              }
            ]
          },
          tasks: [
            {
              kind: "AbstractiveSummarization",
              taskName: "Abstractive Summarization Task",
              parameters: { sentenceCount: 4 }
            }
          ]
        })
      }
    );
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      console.error("Azure summarization failed", error);
      throw new Error("Azure summarization failed");
    }
    // Azure returns 202 Accepted and an operation-location header for async jobs
    if (response.status === 202) {
      const operationLocation = response.headers.get("operation-location");
      if (!operationLocation) throw new Error("No operation-location header from Azure");
      // console.log(`[Azure] operation-location: ${operationLocation}`);
      // Poll for result
      let pollCount = 0;
      const maxPolls = 60; // up to 60s
      let last404 = false;
      let lastPollJson: any = null;
      while (pollCount < maxPolls) {
        await new Promise(res => setTimeout(res, 1000));
        let pollUrl = `${operationLocation}?api-version=${apiVersion}`;
        let pollRes = await fetch(pollUrl, {
          headers: {
            "Ocp-Apim-Subscription-Key": apiKey
          }
        });
        let pollJson: any = await pollRes.json();
        lastPollJson = pollJson;
        const status = pollJson.status || (pollJson.error ? pollJson.error.code : 'unknown');
        // console.log(`[Azure] Poll ${pollCount + 1}/${maxPolls} - status: ${status} - url: ${pollUrl}`);
        if (pollJson.error && pollJson.error.code === "404") {
          // Try again without api-version param
          pollUrl = operationLocation;
          pollRes = await fetch(pollUrl, {
            headers: {
              "Ocp-Apim-Subscription-Key": apiKey
            }
          });
          pollJson = await pollRes.json();
          lastPollJson = pollJson;
          last404 = true;
          const status2 = pollJson.status || (pollJson.error ? pollJson.error.code : 'unknown');
          // console.log(`[Azure] Poll ${pollCount + 1}/${maxPolls} (no api-version) - status: ${status2} - url: ${pollUrl}`);
        }
        // Log the full pollJson at debug level
        // console.debug(`[Azure] Poll ${pollCount + 1} response:`, JSON.stringify(pollJson));
        if (pollJson.status === "succeeded") {
          // Log the full response for debugging
          // console.log('[Azure] Full success response:', JSON.stringify(pollJson, null, 2));
          const task = pollJson.tasks.items[0];
          const doc = task.results.documents[0];
          // Abstractive summarization: look for summaries
          if (doc.summaries) {
            const summaries = doc.summaries.map((s: any) => s.text);
            // console.log('[Azure] Abstractive summaries returned:', summaries);
            return summaries;
          }
          // Extractive summarization: look for sentences
          if (doc.sentences) {
            const sentences = doc.sentences.map((s: any) => s.text);
            // console.log('[Azure] Extractive sentences returned:', sentences);
            return sentences;
          }
          // Fallback: log and return error
          console.error('[Azure] No summaries or sentences found in response:', JSON.stringify(doc));
          return ['Summary not available: Azure response missing summaries/sentences.'];
        } else if (pollJson.status === "failed") {
          console.error("Azure summarization job failed", pollJson);
          throw new Error("Azure summarization job failed");
        } else if (pollJson.error) {
          console.error("Azure summarization polling error:", pollJson.error);
          throw new Error("Azure summarization polling error");
        }
        pollCount++;
      }
      console.error("Azure summarization timed out. Last poll response:", JSON.stringify(lastPollJson));
      throw new Error("Azure summarization timed out");
    } else {
      // Synchronous response (should not happen for jobs endpoint)
      const result: any = await response.json();
      if (result.results && result.results.documents && result.results.documents[0].sentences) {
        return result.results.documents[0].sentences.map((s: any) => s.text);
      }
      throw new Error("Unexpected Azure summarization response");
    }
  } catch (err) {
    console.error("Azure summarization failed", err);
    // Fallback: return a single sentence indicating failure
    return ["Summary not available due to Azure summarization error."];
  }
}

/**
 * Uses Azure AI Language extractive summarization API to summarize text.
 *
 * Requires the following environment variables:
 *   AZURE_LANGUAGE_ENDPOINT: e.g. https://<your-resource-name>.cognitiveservices.azure.com
 *   AZURE_LANGUAGE_KEY: your Azure Language resource key
 *
 * The endpoint and key must be from the same Azure resource and region.
 *
 * See: https://learn.microsoft.com/en-us/azure/ai-services/language-service/summarization/how-to/text-summarization
 */
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
    const data: any = await response.json();
    // console.log('Valid Ollama summary generated.')
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
 * 2. Text from first sources.url
 * 3. Concatenated abstracts
 * 4. Bill title
 */
export async function summarizeLegislationRichestSource(bill: Legislation): Promise<{ summary: string, sourceType: string }> {
  console.log('[Bill Extraction] Starting richest source summarization for bill:', bill.id);
  console.log('[DEBUG] Bill versions:', bill.versions);
  console.log('[DEBUG] Bill sources:', bill.sources);
  console.log('[DEBUG] Bill abstracts:', bill.abstracts);
  console.log('[DEBUG] Bill title:', bill.title);

  // For Illinois, skip all sources, PDFs, and versions; use abstracts (or title)
  if (bill.jurisdictionName === 'Illinois' || bill.jurisdictionName === 'Ohio' || bill.jurisdictionName === 'Minnesota' || bill.jurisdictionName === 'Vermont' || bill.jurisdictionName === 'Arizona') {
    if (bill.abstracts && Array.isArray(bill.abstracts) && bill.abstracts.length > 0) {
      const abstractsText = bill.abstracts.map(a => a.abstract).filter(Boolean).join('\n');
      if (abstractsText.trim().length > 20) {
        const summary = await generateGeminiSummary(abstractsText.trim());
        return { summary: String(summary), sourceType: 'abstracts' };
      }
    }
    // Fallback: bill title
    const title = bill.title || 'No title available.';
    const summary = await generateGeminiSummary(title.trim());
    return { summary: String(summary), sourceType: 'title' };
  }
  // 1. Try ALL PDFs and plain-text versions in bill.versions (including links arrays)
  if (bill.versions && Array.isArray(bill.versions)) {
    const sortedVersions = bill.versions.slice().sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA;
    });
    for (const version of sortedVersions) {
      // Try top-level url if present
      if (version.url && (version.url.endsWith('.pdf') || version.url.endsWith('.txt'))) {
        console.log('[DEBUG] Checking version URL:', version.url);
        try {
          const res = await fetch(version.url);
          if (res.ok) {
            let billText = '';
            if (version.url.endsWith('.pdf')) {
              const buffer = await res.arrayBuffer();
              const pdfText = await pdf(Buffer.from(buffer));
              billText = pdfText.text;
              console.log('[DEBUG] PDF text length:', billText.length);
            } else {
              billText = await res.text();
              console.log('[DEBUG] Plain text length:', billText.length);
            }
            if (billText && billText.trim().length > 100) {
              console.log('[Bill Extraction] Using version:', version.url);
              return {
                summary: await generateGeminiSummary(billText.trim()),
                sourceType: version.url.endsWith('.pdf') ? 'pdf' : 'text'
              };
            } else {
              console.log('[Bill Extraction] Skipped version (too short):', version.url, 'Length:', billText ? billText.length : 0);
            }
          } else {
            console.log('[Bill Extraction] Fetch failed for version:', version.url, 'Status:', res.status);
          }
        } catch (e) {
          console.log('[Bill Extraction] Error fetching/parsing version:', version.url, e);
        }
      }
      // Try all links in version.links if present
      if (Array.isArray(version.links)) {
        for (const linkObj of version.links) {
          const linkUrl = linkObj.url || linkObj.href || linkObj.link;
          if (linkUrl && (linkUrl.endsWith('.pdf') || linkUrl.endsWith('.txt'))) {
            console.log('[DEBUG] Checking version link URL:', linkUrl);
            try {
              const res = await fetch(linkUrl);
              if (res.ok) {
                let billText = '';
                if (linkUrl.endsWith('.pdf')) {
                  const buffer = await res.arrayBuffer();
                  const pdfText = await pdf(Buffer.from(buffer));
                  billText = pdfText.text;
                  console.log('[DEBUG] PDF text length:', billText.length);
                } else {
                  billText = await res.text();
                  console.log('[DEBUG] Plain text length:', billText.length);
                }
                if (billText && billText.trim().length > 100) {
                  console.log('[Bill Extraction] Using version link:', linkUrl);
                  return {
                    summary: await generateGeminiSummary(billText.trim()),
                    sourceType: linkUrl.endsWith('.pdf') ? 'pdf' : 'text'
                  };
                } else {
                  console.log('[Bill Extraction] Skipped version link (too short):', linkUrl, 'Length:', billText ? billText.length : 0);
                }
              } else {
                console.log('[Bill Extraction] Fetch failed for version link:', linkUrl, 'Status:', res.status);
              }
            } catch (e) {
              console.log('[Bill Extraction] Error fetching/parsing version link:', linkUrl, e);
            }
          }
        }
      }
    }
  }

  if (bill.sources && Array.isArray(bill.sources) && bill.sources.length > 0) {
    let foundPdfInAnySource = false;
    for (const source of bill.sources) {
      if (source.url) {
        // Illinois-specific logic: fetch FullText page, fallback to PDF if no usable text
        if (bill.jurisdictionName === 'Illinois' && source.url.includes('ilga.gov/Legislation/BillStatus')) {
          const fullTextUrl = source.url.replace('/BillStatus', '/BillStatus/FullText');
          console.log('[ILGA] Fetching Illinois FullText page:', fullTextUrl);
          try {
            const res = await fetch(fullTextUrl);
            if (!res.ok) {
              console.log('[ILGA] FullText fetch failed:', fullTextUrl, 'Status:', res.status);
              // Try to find PDF link in the FullText page
            } else {
              const textHtml = await res.text();
              // Extract bill text from <pre> tags
              const match = textHtml.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
              if (match && match[1] && match[1].trim().length > 100) {
                const billText = match[1].replace(/<[^>]+>/g, '').trim();
                console.log('[ILGA] Extracted bill text length:', billText.length);
                return {
                  summary: await generateGeminiSummary(billText),
                  sourceType: 'ilga-fulltext'
                };
              } else {
                // Try to find PDF link in the FullText page
                const pdfMatch = textHtml.match(/<a[^>]+href=["']([^"']+\.pdf[^"']*)["'][^>]*>/i);
                if (pdfMatch && pdfMatch[1]) {
                  let pdfUrl = pdfMatch[1];
                  if (!pdfUrl.startsWith('http')) {
                    const base = new URL(fullTextUrl);
                    pdfUrl = new URL(pdfUrl, base).href;
                  }
                  console.log('[ILGA] Fallback: Found PDF link in FullText page:', pdfUrl);
                  try {
                    const pdfRes = await fetch(pdfUrl);
                    if (pdfRes.ok) {
                      const buffer = await pdfRes.arrayBuffer();
                      const data = await pdf(Buffer.from(buffer));
                      if (data.text && data.text.trim().length > 100) {
                        console.log('[ILGA] Fallback: Using PDF text from FullText page:', pdfUrl);
                        return {
                          summary: await generateGeminiSummary(data.text.trim()),
                          sourceType: 'ilga-pdf'
                        };
                      } else {
                        console.log('[ILGA] Fallback: PDF text too short:', pdfUrl);
                      }
                    } else {
                      console.log('[ILGA] Fallback: PDF fetch failed:', pdfUrl, 'Status:', pdfRes.status);
                    }
                  } catch (e) {
                    console.log('[ILGA] Fallback: Error fetching/parsing PDF:', pdfUrl, e);
                  }
                } else {
                  console.log('[ILGA] No usable <pre> or PDF found in FullText page:', fullTextUrl);
                }
              }
            }
          } catch (e) {
            console.log('[ILGA] Error fetching/parsing FullText page:', fullTextUrl, e);
          }
          continue; // Skip normal PDF logic for Illinois
        }
        // ...existing code for other states and Congress.gov...
        console.log('[DEBUG] Checking source URL:', source.url);
        try {
          const res = await fetch(source.url);
          if (!res.ok) {
            console.log('[Bill Extraction] Source fetch failed:', source.url, 'Status:', res.status);
            continue;
          }
          const html = await res.text();
          // Find ALL PDF links in the HTML
          let pdfLinks = Array.from(html.matchAll(/<a[^>]+href=["']([^"']+\.pdf[^"']*)["'][^>]*>/gi)).map(m => m[1]);
          // If no PDF links found and this is a congress.gov bill, try the 'Text' subpage
          if (pdfLinks.length === 0 && source.url.includes('congress.gov/bill/')) {
            // More robust regex for the Text tab (allow whitespace, case-insensitive, and possible variations)
            const textTabMatch = html.match(/<a[^>]+href=["']([^"']+\/text)["'][^>]*>\s*Text\s*<\/a>/i)
              || html.match(/<a[^>]+href=["']([^"']+\/text)["'][^>]*>\s*Bill Text\s*<\/a>/i)
              || html.match(/<a[^>]+href=["']([^"']+\/text)["'][^>]*>\s*View Text\s*<\/a>/i);
            if (textTabMatch) {
              let textTabUrl = textTabMatch[1];
              if (!textTabUrl.startsWith('http')) {
                const base = new URL(source.url);
                textTabUrl = new URL(textTabUrl, base).href;
              }
              console.log('[DEBUG] Following Congress.gov Text tab:', textTabUrl);
              try {
                const textRes = await fetch(textTabUrl);
                if (textRes.ok) {
                  const textHtml = await textRes.text();
                  console.log('[DEBUG] First 500 chars of Text tab HTML:', textHtml.slice(0, 500));
                  pdfLinks = Array.from(textHtml.matchAll(/<a[^>]+href=["']([^"']+\.pdf[^"']*)["'][^>]*>/gi)).map(m => m[1]);
                  console.log('[DEBUG] Found PDF links in Text tab:', pdfLinks);
                }
              } catch (e) {
                console.log('[Bill Extraction] Error fetching/parsing Text tab:', textTabUrl, e);
              }
            } else {
              // Log the HTML snippet around the Text tab match attempt for debugging
              const snippet = html.slice(0, 2000);
              console.log('[DEBUG] No Text tab found. First 2000 chars of HTML:', snippet);
              // Fallback: try fetching the /text subpage directly
              try {
                let textTabUrl = source.url.replace(/\/$/, '') + '/text';
                console.log('[DEBUG] Fallback: Trying direct /text subpage:', textTabUrl);
                const textRes = await fetch(textTabUrl);
                if (textRes.ok) {
                  const textHtml = await textRes.text();
                  console.log('[DEBUG] First 500 chars of direct /text HTML:', textHtml.slice(0, 500));
                  pdfLinks = Array.from(textHtml.matchAll(/<a[^>]+href=["']([^"']+\.pdf[^"']*)["'][^>]*>/gi)).map(m => m[1]);
                  console.log('[DEBUG] Found PDF links in direct /text:', pdfLinks);
                }
              } catch (e) {
                console.log('[Bill Extraction] Error fetching/parsing direct /text subpage:', e);
              }
            }
          } else {
            console.log('[DEBUG] Found PDF links:', pdfLinks);
          }
          if (pdfLinks.length === 0) {
            console.log('[Bill Extraction] No PDF links found in source:', source.url);
          }
          for (let pdfUrl of pdfLinks) {
            if (!pdfUrl.startsWith('http')) {
              const base = new URL(source.url);
              pdfUrl = new URL(pdfUrl, base).href;
            }
            console.log('[DEBUG] Trying PDF URL:', pdfUrl);
            try {
              const pdfRes = await fetch(pdfUrl);
              if (!pdfRes.ok) {
                console.log('[Bill Extraction] PDF fetch failed:', pdfUrl, 'Status:', pdfRes.status);
                continue;
              }
              const buffer = await pdfRes.arrayBuffer();
              const data = await pdf(Buffer.from(buffer));
              console.log('[DEBUG] PDF text length:', data.text ? data.text.length : 0);
              if (data.text && data.text.trim().length > 100) {
                console.log('[Bill Extraction] Using PDF from source:', pdfUrl);
                foundPdfInAnySource = true;
                return {
                  summary: await generateGeminiSummary(data.text.trim()),
                  sourceType: 'pdf-extracted'
                };
              } else {
                console.log('[Bill Extraction] Skipped PDF (too short):', pdfUrl, 'Length:', data.text ? data.text.length : 0);
              }
            } catch (e) {
              console.log('[Bill Extraction] Error fetching/parsing PDF:', pdfUrl, e);
            }
          }
        } catch (e) {
          console.log('[Bill Extraction] Error fetching/parsing source page:', source.url, e);
        }
      }
    }
    if (!foundPdfInAnySource) {
      console.log('[Bill Extraction] No PDFs found in any sources for bill:', bill.id);
    }
  }
  // 2. Try abstracts
  if (bill.abstracts && Array.isArray(bill.abstracts) && bill.abstracts.length > 0) {
    const abstractsText = bill.abstracts.map(a => a.abstract).filter(Boolean).join('\n');
    if (abstractsText.trim().length > 20) {
      const summary = await generateGeminiSummary(abstractsText.trim());
      return { summary: String(summary), sourceType: 'abstracts' };
    }
  }
  // 3. Remove HTML fallback: do not summarize navigation-heavy pages
  // 4. Fallback: bill title
  const title = bill.title || 'No title available.';
  const summary = await generateGeminiSummary(title.trim());
  return { summary: String(summary), sourceType: 'title' };
}
