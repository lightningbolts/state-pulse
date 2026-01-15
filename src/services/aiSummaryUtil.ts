import {ai} from '@/ai/genkit';
import fetch from 'node-fetch';
import pdf from 'pdf-parse';
import * as cheerio from 'cheerio';
import {Legislation} from '@/types/legislation';

// Global flag to track Puppeteer availability
let puppeteerEnabled = true;
let puppeteerFailureCount = 0;
const MAX_PUPPETEER_FAILURES = 3;

/**
 * Checks if Puppeteer dependencies are available and provides installation instructions if not
 */
export async function checkPuppeteerDependencies(): Promise<{ available: boolean; instructions?: string }> {
  try {
    const puppeteer = await import('puppeteer');
    const browser = await puppeteer.default.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
    await browser.close();
    return { available: true };
  } catch (error: any) {
    const instructions = `
Puppeteer requires system dependencies that are not installed. Please install them:

For Ubuntu/Debian:
sudo apt-get update && sudo apt-get install -y \\
  gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 \\
  libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 \\
  libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 \\
  libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 \\
  libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 \\
  libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates \\
  fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils \\
  wget libgbm-dev

For CentOS/RHEL/Amazon Linux:
sudo yum install -y alsa-lib.x86_64 atk.x86_64 cups-libs.x86_64 \\
  gtk3.x86_64 ipa-gothic-fonts libXcomposite.x86_64 libXcursor.x86_64 \\
  libXdamage.x86_64 libXext.x86_64 libXi.x86_64 libXrandr.x86_64 \\
  libXScrnSaver.x86_64 libXtst.x86_64 pango.x86_64 xorg-x11-fonts-100dpi \\
  xorg-x11-fonts-75dpi xorg-x11-fonts-cyrillic xorg-x11-fonts-misc \\
  xorg-x11-fonts-Type1 xorg-x11-utils
sudo yum update nss -y

Error: ${error.message}
    `;
    return { available: false, instructions };
  }
}

/**
 * Resets Puppeteer state and re-enables it. Call this after installing system dependencies.
 */
export function resetPuppeteerState(): void {
  puppeteerEnabled = true;
  puppeteerFailureCount = 0;
  console.log('[Puppeteer] State reset - Puppeteer re-enabled');
}

/**
 * Gets current Puppeteer status
 */
export function getPuppeteerStatus(): { enabled: boolean; failureCount: number } {
  return { enabled: puppeteerEnabled, failureCount: puppeteerFailureCount };
}

/**
 * Cleans up AI-generated summary text by removing headers and fixing markdown formatting
 */
function cleanSummaryText(text: string): string {
  return text
    // Remove summary headers (case insensitive, with or without asterisks)
    .replace(/^\*{0,2}SUMMARY\s*\d*\s*-\s*BRIEF[^:]*:?\*{0,2}\s*/i, '')
    .replace(/^\*{0,2}SUMMARY\s*\d*\s*-\s*DETAILED[^:]*:?\*{0,2}\s*/i, '')
    .replace(/^\*{0,2}FIRST\s*-?\s*/i, '')
    .replace(/^\*{0,2}SECOND\s*-?\s*/i, '')
    // Fix excessive asterisks - replace multiple asterisks with single ones for emphasis
    .replace(/\*{3,}/g, '*')
    // Clean up any remaining header patterns
    .replace(/^[*\s]*\([^)]*\)\s*:?\s*/i, '')
    .trim();
}

export async function generateGeminiSummary(text: string, sourceType?: string): Promise<string> {
  // Use Gemini to generate a ~100-word summary
  if (!text || text.trim().length === 0) return 'Summary not available due to insufficient information.';
  if (text.length < 30) return 'Summary not available due to insufficient information.';
  if (sourceType === 'none') return 'Summary not available due to insufficient information.';
  const prompt = `Summarize the following legislation in 100 words, focusing on the main points and specific impact. Remove fluff and filler. If there is not enough information to summarize, say so in a single sentence: 'Summary not available due to insufficient information.'\n\n${text}`;
  const response = await ai.generate({ prompt });
  return response.text.trim();
}

/**
 * Optimized function that determines source type from text characteristics and generates appropriate summaries
 * TEMPORARILY MODIFIED: Only generates brief summaries to reduce API costs
 */
export async function generateOptimizedGeminiSummary(text: string, detectedSourceType: string): Promise<{ summary: string; longSummary: string | null; sourceType: string }> {
  // TEMPORARY: Only generate brief summaries to reduce costs
  const summary = await generateGeminiSummary(text, detectedSourceType);
  return { summary, longSummary: null, sourceType: detectedSourceType };
}

export async function generateGeminiDetailedSummary(text: string): Promise<string> {
  // @deprecated Use generateOptimizedGeminiSummary instead for better performance
  // Use Gemini to generate a detailed, longer summary with citations
  const prompt = `Provide a comprehensive, detailed analysis of this legislation. Your response should be 3-5 paragraphs long and include:

1. **Key Provisions**: What the legislation specifically does, changes, or establishes
2. **Impact Analysis**: Who this affects and how (citizens, businesses, government agencies, etc.)
3. **Implementation Details**: Timeline, funding mechanisms, enforcement procedures
4. **Direct Citations**: Quote specific sections or language from the text when relevant

Format your response using a mix of paragraphs and bullet points where appropriate. Keep paragraphs to 3-4 sentences for readability. Use direct quotes from the source text to support your analysis.

If the text is insufficient for detailed analysis, provide what analysis you can and note the limitations.

Legislation text:
${text}`;

  const response = await ai.generate({ prompt });
  return response.text.trim();
}

/**
 * Efficiently generates both short and long summaries in a single Gemini call for rich sources
 */
export async function generateGeminiDualSummary(text: string, sourceType: string): Promise<{ summary: string; longSummary: string | null }> {
  // Check if this is a rich source that warrants a detailed summary
  const isRichSource = ['pdf-extracted', 'pdf', 'full-text', 'ilga-pdf', 'ilga-fulltext'].includes(sourceType);

  if (!isRichSource || text.length < 500) {
    // For non-rich sources or short text, just generate regular summary
    const summary = await generateGeminiSummary(text);
    return { summary, longSummary: null };
  }

  // For rich sources, generate both summaries in one call
  const prompt = `Please provide TWO summaries of the following legislation:

FIRST - A brief summary in approximately 100 words, focusing on the main points and specific impact. Remove fluff and filler.

SECOND - A comprehensive, detailed analysis that includes:
- Key Provisions: What the legislation specifically does, changes, or establishes
- Impact Analysis: Who this affects and how (citizens, businesses, government agencies, etc.)  
- Implementation Details: Timeline, funding mechanisms, enforcement procedures
- Direct Citations: Quote specific sections or language from the text when relevant

Format the detailed summary using a mix of paragraphs and bullet points where appropriate. Keep paragraphs to 3-4 sentences for readability.

Please clearly separate the two summaries with "---DETAILED---" between them.

Legislation text:
${text}`;

  const response = await ai.generate({ prompt });
  const fullResponse = response.text.trim();

  // Split the response into brief and detailed summaries
  const parts = fullResponse.split('---DETAILED---');

  if (parts.length >= 2) {
    const summary = cleanSummaryText(parts[0].trim());
    const longSummary = cleanSummaryText(parts[1].trim());
    return { summary, longSummary };
  } else {
    // Fallback if parsing fails - use the whole response as summary
    console.warn('Failed to parse dual summary response, falling back to single summary');
    return { summary: cleanSummaryText(fullResponse), longSummary: null };
  }
}

// @ts-ignore
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
            // console.log('[Azure] Abstractive summaries returned:', summaries);
            return doc.summaries.map((s: any) => s.text);
          }
          // Extractive summarization: look for sentences
          if (doc.sentences) {
            // console.log('[Azure] Extractive sentences returned:', sentences);
            return doc.sentences.map((s: any) => s.text);
          }
          // Fallback: log and return error
          console.error('[Azure] No summaries or sentences found in response:', JSON.stringify(doc));
          return ['Summary not available: Azure response missing summaries/sentences.'];
        } else if (pollJson.status === "failed") {
          console.error("Azure summarization job failed", pollJson);
        } else if (pollJson.error) {
          console.error("Azure summarization polling error:", pollJson.error);
        }
        pollCount++;
      }
      console.error("Azure summarization timed out. Last poll response:", JSON.stringify(lastPollJson));
    } else {
      // Synchronous response (should not happen for jobs endpoint)
      const result: any = await response.json();
      if (result.results && result.results.documents && result.results.documents[0].sentences) {
        return result.results.documents[0].sentences.map((s: any) => s.text);
      }
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
    // Try to find a PDF link with the word "bill" in the URL (case-insensitive)
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
      if (match && match[1].toLowerCase().includes('bill')) break;
      match = null;
    }
    if (!match) {
      debug.push('Could not find a final/official PDF link on the page with the word "bill" in the URL.');
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
 * @param model
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
 * Optimized function that extracts text from the richest source and generates appropriate summaries in a single pass
 * Handles all jurisdiction types including US Congress with specialized PDF extraction
 */
export async function summarizeLegislationOptimized(bill: Legislation): Promise<{ summary: string; longSummary: string | null; sourceType: string }> {
  console.log('[Bill Extraction] Starting optimized summarization for bill:', bill.id);
  console.log('[DEBUG] Jurisdiction:', bill.jurisdictionName);
  console.log('[DEBUG] Bill versions:', bill.versions?.length || 0);
  console.log('[DEBUG] Bill sources:', bill.sources?.length || 0);
  console.log('[DEBUG] Bill abstracts:', bill.abstracts?.length || 0);

  // Helper function to fetch and extract PDF content
  const extractPdfContent = async (pdfUrl: string, sourceType: string): Promise<{ summary: string; longSummary: string | null; sourceType: string } | null> => {
    try {
      console.log('[DEBUG] Trying PDF URL:', pdfUrl);
      const pdfRes = await fetch(pdfUrl);
      if (!pdfRes.ok) {
        console.log('[Bill Extraction] PDF fetch failed:', pdfUrl, 'Status:', pdfRes.status);
        return null;
      }
      const buffer = await pdfRes.arrayBuffer();
      const data = await pdf(Buffer.from(buffer));
      console.log('[DEBUG] PDF text length:', data.text?.length || 0);

      if (data.text && data.text.trim().length > 100) {
        console.log('[Bill Extraction] Using PDF:', pdfUrl);
        return await generateOptimizedGeminiSummary(data.text.trim(), sourceType);
      } else {
        console.log('[Bill Extraction] Skipped PDF (too short):', pdfUrl, 'Length:', data.text?.length || 0);
        return null;
      }
    } catch (e) {
      console.log('[Bill Extraction] Error fetching/parsing PDF:', pdfUrl, e);
      return null;
    }
  };

  // 1. Special handling for US Congress bills
  if (bill.jurisdictionName === 'United States Congress') {
    // For Congress bills, check if we have a congressUrl and try to extract PDF from the /text page
    if (bill.congressUrl) {
      const textUrl = bill.congressUrl + '/text';
      console.log('[Congress] Fetching text page:', textUrl);

      try {
        const res = await fetch(textUrl);
        if (res.ok) {
          const html = await res.text();
          const pdfMatches = html.matchAll(/<a[^>]+href=["']([^"']+\.pdf)["'][^>]*>/gi);
          for (const match of pdfMatches) {
            let pdfUrl = match[1];
            if (!pdfUrl.startsWith('http')) {
              const base = new URL(textUrl);
              pdfUrl = new URL(pdfUrl, base).href;
            }

            const result = await extractPdfContent(pdfUrl, 'pdf-extracted');
            if (result) return result;
          }

          // Fallback: try to extract text content directly from the page
          const $ = cheerio.load(html);
          const billTextElements = $('pre, .bill-text, #bill-text, .congress-bill-text');
          if (billTextElements.length > 0) {
            const billText = billTextElements.text().trim();
            if (billText.length > 100) {
              console.log('[Congress] Using extracted HTML text, length:', billText.length);
              return await generateOptimizedGeminiSummary(billText, 'congress-text');
            }
          }
        }
      } catch (e) {
        console.log('[Congress] Error fetching text page:', textUrl, e);
      }
    }

    // Fallback to checking sources for Congress bills
    if (bill.sources?.length) {
      for (const source of bill.sources) {
        if (source.url?.includes('congress.gov')) {
          const textUrl = source.url.includes('/text') ? source.url : source.url + '/text';
          try {
            const res = await fetch(textUrl);
            if (res.ok) {
              const html = await res.text();
              const pdfMatches = html.matchAll(/<a[^>]+href=["']([^"']+\.pdf)["'][^>]*>/gi);
              for (const match of pdfMatches) {
                let pdfUrl = match[1];
                if (!pdfUrl.startsWith('http')) {
                  const base = new URL(textUrl);
                  pdfUrl = new URL(pdfUrl, base).href;
                }

                const result = await extractPdfContent(pdfUrl, 'pdf-extracted');
                if (result) return result;
              }
            }
          } catch (e) {
            console.log('[Congress] Error processing source:', source.url, e);
          }
        }
      }
    }
  }

  // 2. Special handling for California bills
  if (bill.jurisdictionName === 'California') {
    if (bill.sources?.length) {
      for (const source of bill.sources) {
        if (source.url) {
          console.log('[California] Fetching bill page:', source.url);
          try {
            const res = await fetch(source.url, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
              }
            });
            if (res.ok) {
              const html = await res.text();
              const $ = cheerio.load(html);
              
              // Extract text from the specific California bill element
              const billAllElement = $('#bill_all[align="justify"]');
              if (billAllElement.length > 0) {
                const billText = billAllElement.text().trim();
                if (billText.length > 100) {
                  console.log('[California] Using extracted HTML text, length:', billText.length);
                  return await generateOptimizedGeminiSummary(billText, 'california-text');
                }
              }
            }
          } catch (e) {
            console.log('[California] Error fetching source:', source.url, e);
          }
        }
      }
    }
  }

  // 3. Special handling for Texas bills
  if (bill.jurisdictionName === 'Texas') {
    if (bill.sources?.length) {
      for (const source of bill.sources) {
        if (source.url && source.url.includes('capitol.texas.gov')) {
          // Convert History.aspx URL to Text.aspx URL for better PDF access
          const textUrl = source.url.replace('/History.aspx', '/Text.aspx');
          console.log('[Texas] Fetching bill text page:', textUrl);
          try {
            const res = await fetch(textUrl, {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
              }
            });
            if (res.ok) {
              // Try to extract PDF links from the text page
              let pdfLinks = await getBillPdfLinksFromPage(textUrl);
              
              // If no PDFs found with regular approach, try Puppeteer for JS-rendered pages (if enabled)
              if (pdfLinks.length === 0 && puppeteerEnabled) {
                console.log('[Texas] No PDFs found with fetch, trying Puppeteer for:', textUrl);
                try {
                  pdfLinks = await getBillPdfLinksFromPagePuppeteer(textUrl);
                  // Reset failure count on success
                  puppeteerFailureCount = 0;
                } catch (puppeteerError: any) {
                  console.log('[Texas] Puppeteer failed for:', textUrl, 'Error:', puppeteerError.message);
                  
                  // Track failures and disable Puppeteer if it consistently fails
                  puppeteerFailureCount++;
                  if (puppeteerFailureCount >= MAX_PUPPETEER_FAILURES) {
                    console.warn(`[Puppeteer] Disabling Puppeteer after ${MAX_PUPPETEER_FAILURES} consecutive failures. System appears to be missing required dependencies.`);
                    puppeteerEnabled = false;
                  }
                  
                  // Continue with empty pdfLinks array - don't fail the entire process
                  pdfLinks = [];
                }
              }
              
              // Process any found PDF links
              for (let pdfUrl of pdfLinks) {
                const result = await extractPdfContent(pdfUrl, 'pdf-extracted');
                if (result) return result;
              }
            }
          } catch (e) {
            console.log('[Texas] Error fetching text page:', textUrl, e);
          }
        }
      }
    }
  }

  // 4. Special handling for states that prefer abstracts only
  const abstractOnlyStates = ['Iowa', 'Nevada', 'Illinois', 'Vermont', 'Arizona', 'Nebraska', 'Colorado', 'Kansas'];
  const isAbstractOnlyState = abstractOnlyStates.includes(bill.jurisdictionName || '')

  if (isAbstractOnlyState) {
    if (bill.abstracts?.length) {
      const abstractsText = bill.abstracts.map(a => a.abstract).filter(Boolean).join('\n');
      if (abstractsText.trim().length > 20) {
        const summary = await generateGeminiSummary(abstractsText.trim());
        return { summary, longSummary: null, sourceType: 'abstracts' };
      }
    }
    // Fallback: bill title
    const title = bill.title || 'No title available.';
    const summary = await generateGeminiSummary(title.trim());
    return { summary, longSummary: null, sourceType: 'title' };
  }

  // 5. Try bill versions (PDFs and text files)
  if (bill.versions?.length) {
    const sortedVersions = bill.versions.slice().sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA; // Most recent first
    });

    for (const version of sortedVersions) {
      // Try direct version URL
      if (version.url && (version.url.endsWith('.pdf') || version.url.endsWith('.txt'))) {
        console.log('[DEBUG] Checking version URL:', version.url);
        try {
          const res = await fetch(version.url);
          if (res.ok) {
            let billText = '';
            let sourceType = '';

            if (version.url.endsWith('.pdf')) {
              const buffer = await res.arrayBuffer();
              const pdfText = await pdf(Buffer.from(buffer));
              billText = pdfText.text;
              sourceType = 'pdf-extracted';
            } else {
              billText = await res.text();
              sourceType = 'full-text';
            }

            if (billText?.trim().length > 100) {
              console.log('[Bill Extraction] Using version:', version.url);
              return await generateOptimizedGeminiSummary(billText.trim(), sourceType);
            }
          }
        } catch (e) {
          console.log('[Bill Extraction] Error fetching version:', version.url, e);
        }
      }

      // Try version links
      if (version.links?.length) {
        for (const linkObj of version.links) {
          const linkUrl = linkObj.url || linkObj.href || linkObj.link;
          if (linkUrl && (linkUrl.endsWith('.pdf') || linkUrl.endsWith('.txt'))) {
            try {
              const res = await fetch(linkUrl);
              if (res.ok) {
                let billText = '';
                let sourceType = '';

                if (linkUrl.endsWith('.pdf')) {
                  const buffer = await res.arrayBuffer();
                  const pdfText = await pdf(Buffer.from(buffer));
                  billText = pdfText.text;
                  sourceType = 'pdf-extracted';
                } else {
                  billText = await res.text();
                  sourceType = 'full-text';
                }

                if (billText?.trim().length > 100) {
                  console.log('[Bill Extraction] Using version link:', linkUrl);
                  return await generateOptimizedGeminiSummary(billText.trim(), sourceType);
                }
              }
            } catch (e) {
              console.log('[Bill Extraction] Error fetching version link:', linkObj.url, e);
            }
          }
        }
      }
    }
  }

  // 6. Try sources for PDF/text content with jurisdiction-specific handling
  if (bill.sources?.length) {
    for (const source of bill.sources) {
      if (!source.url) continue;

      // General source processing
      console.log('[DEBUG] Checking source URL:', source.url);
      try {
        // First try regular fetch-based extraction
        let pdfLinks = await getBillPdfLinksFromPage(source.url);
        
        // If no PDFs found with regular approach, try Puppeteer for JS-rendered pages (if enabled)
        if (pdfLinks.length === 0 && puppeteerEnabled) {
          console.log('[DEBUG] No PDFs found with fetch, trying Puppeteer for:', source.url);
          try {
            pdfLinks = await getBillPdfLinksFromPagePuppeteer(source.url);
            // Reset failure count on success
            puppeteerFailureCount = 0;
          } catch (puppeteerError: any) {
            console.log('[DEBUG] Puppeteer failed for:', source.url, 'Error:', puppeteerError.message);
            
            // Track failures and disable Puppeteer if it consistently fails
            puppeteerFailureCount++;
            if (puppeteerFailureCount >= MAX_PUPPETEER_FAILURES) {
              console.warn(`[Puppeteer] Disabling Puppeteer after ${MAX_PUPPETEER_FAILURES} consecutive failures. System appears to be missing required dependencies.`);
              puppeteerEnabled = false;
            }
            
            // Continue with empty pdfLinks array - don't fail the entire process
            pdfLinks = [];
          }
        } else if (pdfLinks.length === 0 && !puppeteerEnabled) {
          console.log('[DEBUG] Skipping Puppeteer (disabled due to previous failures) for:', source.url);
        }
        
        // Process any found PDF links
        for (let pdfUrl of pdfLinks) {
          const result = await extractPdfContent(pdfUrl, 'pdf-extracted');
          if (result) return result;
        }
      } catch (e: any) {
        console.log('[Bill Extraction] Error processing source:', source.url, 'Error:', e.message);
        // Continue processing other sources instead of failing completely
      }
    }
  }

  console.log('[Bill Extraction] No suitable source found for bill:', bill.id);
  return { summary: '', longSummary: null, sourceType: 'none' };
}

/**
 * Returns all PDF URLs from a web page that contain the word 'bill' (case-insensitive).
 */
export async function getBillPdfLinksFromPage(url: string): Promise<string[]> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
    }
  });
  if (!res.ok) throw new Error(`Failed to fetch page: ${url} (status: ${res.status})`);
  const html = await res.text();
  
  // Multiple regex patterns to catch different PDF link formats
  const pdfRegexes = [
    // Standard <a href="...pdf"> links
    /<a[^>]+href=["']([^"']+\.pdf[^"']*)["'][^>]*>/gi,
    // Links that might not end in .pdf but contain PDF in path
    /<a[^>]+href=["']([^"']*pdf[^"']*)["'][^>]*>/gi,
    // Data attributes that might contain PDF URLs
    /data-[^=]*=["']([^"']*\.pdf[^"']*)["']/gi,
    // Plain text URLs in the HTML
    /https?:\/\/[^\s"'<>]+\.pdf[\w\/\-\?=&]*/gi
  ];
  
  const allPdfUrls = new Set<string>();
  
  for (const regex of pdfRegexes) {
    const matches = Array.from(html.matchAll(regex));
    for (const match of matches) {
      const url = match[1] || match[0];
      if (url && url.toLowerCase().includes('bill')) {
        allPdfUrls.add(url);
      }
    }
  }
  
  // Convert to array and make relative links absolute
  const pdfLinks = Array.from(allPdfUrls).map(link => {
    if (!link.startsWith('http')) {
      const base = new URL(url);
      return new URL(link, base).href;
    }
    return link;
  });
  
  return pdfLinks;
}

/**
 * Timeout wrapper for Puppeteer operations to prevent hanging
 */
async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, timeoutMessage: string): Promise<T> {
  let timeoutHandle: NodeJS.Timeout;
  
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(timeoutMessage));
    }, timeoutMs);
  });
  
  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutHandle!);
    return result;
  } catch (error) {
    clearTimeout(timeoutHandle!);
    throw error;
  }
}

/**
 * Uses Puppeteer to extract all bill PDF links from a page after JS rendering.
 * Returns all links that contain both 'pdf' and 'bill' in the URL (case-insensitive, deduped).
 * Includes graceful fallback handling for missing system dependencies.
 * IMPORTANT: Has a 60-second timeout to prevent hanging on problematic pages.
 */
export async function getBillPdfLinksFromPagePuppeteer(url: string): Promise<string[]> {
  try {
    // Wrap the entire Puppeteer operation in a 60-second timeout
    return await withTimeout(
      (async () => {
        const puppeteer = await import('puppeteer');
        
        // Comprehensive browser launch options for better Linux compatibility
        const launchOptions = {
          headless: true,
          args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process', // <- This is important for environments with limited resources
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor',
            '--disable-background-timer-throttling',
            '--disable-backgrounding-occluded-windows',
            '--disable-renderer-backgrounding'
          ],
          timeout: 30000, // Reduced timeout for browser launch
          handleSIGINT: false,
          handleSIGTERM: false,
          handleSIGHUP: false
        };

        console.log('[Puppeteer] Attempting to launch browser with enhanced compatibility options...');
        const browser = await puppeteer.default.launch(launchOptions);
        
        try {
          const page = await browser.newPage();
          
          // Set a user agent to avoid blocking
          await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
          
          // Navigate and wait for network to settle (with timeout)
          await page.goto(url, { 
            waitUntil: 'networkidle2',
            timeout: 25000 
          });
          
          // Wait a bit more for any lazy-loaded content
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          const pdfLinks: string[] = await page.evaluate(() => {
            const anchors = Array.from(document.querySelectorAll('a'));
            const allLinks = anchors
              .map(a => a.href)
              .filter(href => href && 
                href.toLowerCase().includes('pdf') && 
                (href.toLowerCase().includes('bill') || href.toLowerCase().includes('legislation'))
              );
            
            // Also check for any links in data attributes or other sources
            const dataLinks: string[] = [];
            document.querySelectorAll('[data-url], [data-href], [data-link]').forEach(el => {
              const attrs = ['data-url', 'data-href', 'data-link'];
              attrs.forEach(attr => {
                const value = el.getAttribute(attr);
                if (value && value.toLowerCase().includes('pdf') && value.toLowerCase().includes('bill')) {
                  dataLinks.push(value);
                }
              });
            });
            
            return [...allLinks, ...dataLinks];
          });
          
          await browser.close();
          console.log('[Puppeteer] Successfully extracted PDF links:', pdfLinks.length);
          
          // Deduplicate and filter out invalid URLs
          return Array.from(new Set(pdfLinks)).filter(link => {
            try {
              new URL(link);
              return true;
            } catch {
              return false;
            }
          });
        } catch (error) {
          await browser.close();
          throw error;
        }
      })(),
      60000, // 60 second timeout for entire operation
      '[Puppeteer] Operation timed out after 60 seconds'
    );
  } catch (error: any) {
    // Check if this is a timeout error
    if (error.message.includes('timed out')) {
      console.error('[Puppeteer] Timeout reached:', error.message);
      console.log('[Puppeteer] Falling back to regular fetch-based PDF extraction...');
      return [];
    }
    
    console.error('[Puppeteer] Browser launch failed:', error.message);
    
    // Check for specific missing library errors and provide helpful guidance
    if (error.message.includes('libatk-1.0.so.0') || 
        error.message.includes('libnss3.so') ||
        error.message.includes('libgtk') ||
        error.message.includes('shared libraries')) {
      
      console.error(`
[Puppeteer] Missing system dependencies detected. This is a common issue on Linux systems.

To fix this issue, install the required dependencies:

For Ubuntu/Debian:
sudo apt-get update && sudo apt-get install -y \\
  gconf-service libasound2 libatk1.0-0 libc6 libcairo2 libcups2 \\
  libdbus-1-3 libexpat1 libfontconfig1 libgcc1 libgconf-2-4 \\
  libgdk-pixbuf2.0-0 libglib2.0-0 libgtk-3-0 libnspr4 libpango-1.0-0 \\
  libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 \\
  libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 \\
  libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates \\
  fonts-liberation libappindicator1 libnss3 lsb-release xdg-utils \\
  wget libgbm-dev

For Ubuntu 24.04+ (with t64 libraries):
sudo apt-get update && sudo apt-get install -y \\
  libasound2t64 libatk1.0-0t64 libc6 libcairo2 libcups2t64 \\
  libdbus-1-3 libexpat1 libfontconfig1 libgcc-s1 libgdk-pixbuf2.0-0 \\
  libglib2.0-0t64 libgtk-3-0t64 libnspr4 libpango-1.0-0 \\
  libpangocairo-1.0-0 libstdc++6 libx11-6 libx11-xcb1 libxcb1 \\
  libxcomposite1 libxcursor1 libxdamage1 libxext6 libxfixes3 libxi6 \\
  libxrandr2 libxrender1 libxss1 libxtst6 ca-certificates \\
  fonts-liberation libnss3 lsb-release xdg-utils wget libgbm-dev

For CentOS/RHEL/Amazon Linux:
sudo yum install -y alsa-lib.x86_64 atk.x86_64 cups-libs.x86_64 \\
  gtk3.x86_64 ipa-gothic-fonts libXcomposite.x86_64 libXcursor.x86_64 \\
  libXdamage.x86_64 libXext.x86_64 libXi.x86_64 libXrandr.x86_64 \\
  libXScrnSaver.x86_64 libXtst.x86_64 pango.x86_64 xorg-x11-fonts-100dpi \\
  xorg-x11-fonts-75dpi xorg-x11-fonts-cyrillic xorg-x11-fonts-misc \\
  xorg-x11-fonts-Type1 xorg-x11-utils
sudo yum update nss -y

For Amazon Linux with EPEL:
sudo amazon-linux-extras install epel -y
sudo yum install -y chromium

Falling back to regular HTTP fetch for PDF extraction...
      `);
    }
    
    // Graceful fallback: return empty array so the process can continue with other extraction methods
    console.log('[Puppeteer] Falling back to regular fetch-based PDF extraction...');
    return [];
  }
}
