import { ai } from '../ai/genkit';
import fetch from 'node-fetch';
import pdf from 'pdf-parse';
import * as cheerio from 'cheerio';
import { Legislation } from '../types/legislation';

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
  const prompt = `Summarize the following legislation in 100 words, focusing on the main points and specific impact. Remove fluff and filler. If there is not enough information to summarize, say so in a single sentence: 'Summary not available due to insufficient information.'\n\n${text}`;
  const response = await ai.generate({ prompt });
  return response.text.trim();
}

/**
 * Optimized function that determines source type from text characteristics and generates appropriate summaries
 */
export async function generateOptimizedGeminiSummary(text: string, detectedSourceType: string): Promise<{ summary: string; longSummary: string | null; sourceType: string }> {
  // Determine if this is a rich source that warrants detailed summary
  const isRichSource = ['pdf-extracted', 'pdf', 'full-text', 'ilga-pdf', 'ilga-fulltext'].includes(detectedSourceType);
  
  if (!isRichSource || text.length < 500) {
    // For non-rich sources or short text, just generate regular summary
    const summary = await generateGeminiSummary(text);
    return { summary, longSummary: null, sourceType: detectedSourceType };
  }

  // For rich sources, generate both summaries in one call to save tokens and API calls
  const prompt = `Please provide TWO summaries of the following legislation:

FIRST - A brief summary in approximately 100 words, focusing on the main points and specific impact. Remove fluff and filler.

SECOND - A comprehensive, detailed analysis that includes:
- Key Provisions: What the legislation specifically does, changes, or establishes
- Impact Analysis: Who this affects and how (citizens, businesses, government agencies, etc.)  
- Implementation Details: Timeline, funding mechanisms, enforcement procedures
- Direct Citations: Quote specific sections or language from the text when relevant

Format the detailed summary using a mix of paragraphs and bullet points where appropriate. Keep paragraphs to 3-4 sentences for readability. Use single asterisks for emphasis and avoid excessive markdown formatting.

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
    return { summary, longSummary, sourceType: detectedSourceType };
  } else {
    // Fallback if parsing fails - use the whole response as summary
    console.warn('Failed to parse dual summary response, falling back to single summary');
    return { summary: cleanSummaryText(fullResponse), longSummary: null, sourceType: detectedSourceType };
  }
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
          
          // Look for PDF links using Congress.gov patterns
          const pdfMatches = html.matchAll(/<a[^>]+href=["']([^"']+\.pdf)["'][^>]*>/gi);
          for (const match of pdfMatches) {
            let pdfUrl = match[1];
            if (!pdfUrl.startsWith('http')) {
              // Convert relative URL to absolute
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

  // 2. Special handling for states that prefer abstracts only
  const abstractOnlyStates = ['Iowa', 'Nevada', 'Illinois', 'Ohio', 'Minnesota', 'Vermont', 'Arizona', 'Delaware', 'Nebraska'];
  const isAbstractOnlyState = abstractOnlyStates.includes(bill.jurisdictionName || '') || 
                             (bill.jurisdictionName === 'Texas' && bill.chamber === 'upper');
  
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

  // 3. Try bill versions (PDFs and text files)
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

  // 4. Try sources for PDF/text content with jurisdiction-specific handling
  if (bill.sources?.length) {
    for (const source of bill.sources) {
      if (!source.url) continue;

      // Illinois-specific handling
      if (bill.jurisdictionName === 'Illinois' && source.url.includes('ilga.gov/Legislation/BillStatus')) {
        const fullTextUrl = source.url.replace('/BillStatus', '/BillStatus/FullText');
        console.log('[ILGA] Fetching Illinois FullText page:', fullTextUrl);
        
        try {
          const res = await fetch(fullTextUrl);
          if (res.ok) {
            const textHtml = await res.text();
            
            // Extract bill text from <pre> tags
            const match = textHtml.match(/<pre[^>]*>([\s\S]*?)<\/pre>/i);
            if (match && match[1] && match[1].trim().length > 100) {
              const billText = match[1].replace(/<[^>]+>/g, '').trim();
              console.log('[ILGA] Extracted bill text length:', billText.length);
              return await generateOptimizedGeminiSummary(billText, 'ilga-fulltext');
            }

            // Fallback: try PDF links in the FullText page
            const pdfMatch = textHtml.match(/<a[^>]+href=["']([^"']+\.pdf[^"']*)["'][^>]*>/i);
            if (pdfMatch && pdfMatch[1]) {
              let pdfUrl = pdfMatch[1];
              if (!pdfUrl.startsWith('http')) {
                const base = new URL(fullTextUrl);
                pdfUrl = new URL(pdfUrl, base).href;
              }
              
              const result = await extractPdfContent(pdfUrl, 'ilga-pdf');
              if (result) return result;
            }
          }
        } catch (e) {
          console.log('[ILGA] Error fetching FullText page:', fullTextUrl, e);
        }
        continue; // Skip normal processing for Illinois
      }

      // General source processing
      console.log('[DEBUG] Checking source URL:', source.url);
      try {
        const res = await fetch(source.url);
        if (!res.ok) {
          console.log('[Bill Extraction] Source fetch failed:', source.url, 'Status:', res.status);
          continue;
        }

        const html = await res.text();
        const pdfLinks = Array.from(html.matchAll(/<a[^>]+href=["']([^"']+\.pdf[^"']*)["'][^>]*>/gi)).map(m => m[1]);

        for (let pdfUrl of pdfLinks) {
          if (!pdfUrl.startsWith('http')) {
            const base = new URL(source.url);
            pdfUrl = new URL(pdfUrl, base).href;
          }
          
          const result = await extractPdfContent(pdfUrl, 'pdf-extracted');
          if (result) return result;
        }
      } catch (e) {
        console.log('[Bill Extraction] Error processing source:', source.url, e);
      }
    }
  }

  console.log('[Bill Extraction] No suitable source found for bill:', bill.id);
  return { summary: '', longSummary: null, sourceType: 'none' };
}

