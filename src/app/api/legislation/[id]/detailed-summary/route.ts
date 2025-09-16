import { NextRequest, NextResponse } from 'next/server';
import { getLegislationById } from '@/services/legislationService';
import { checkRateLimit } from '@/services/rateLimitService';
import { getCollection } from '@/lib/mongodb';
import { ai } from '@/ai/genkit';
import pdf from 'pdf-parse';
import * as cheerio from 'cheerio';
import type { Legislation } from '@/types/legislation';

/**
 * Returns all PDF URLs from a web page that contain the word 'bill' (case-insensitive).
 */
async function getBillPdfLinksFromPage(url: string): Promise<string[]> {
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
 * Generates a detailed summary from bill text using AI
 */
async function generateDetailedSummary(text: string): Promise<string> {
  const prompt = `Provide a comprehensive, detailed analysis of this legislation. Your response should include:

1. **Key Provisions**: What the legislation specifically does, changes, or establishes
2. **Impact Analysis**: Who this affects and how (citizens, businesses, government agencies, etc.)
3. **Implementation Details**: Timeline, funding mechanisms, enforcement procedures
4. **Direct Citations**: Quote specific sections or language from the text when relevant

Format your response using proper markdown:
- Use **bold** for emphasis and section headings
- Use bullet points (-) for lists
- Use > for important quotes from the legislation
- Keep paragraphs to 3-4 sentences for readability

Use a mix of paragraphs and bullet points where appropriate.
Use direct quotes from the source text to support your analysis. 
Go straight into the analysis.

Legislation text:
${text}`;

  const response = await ai.generate({ prompt });
  return response.text.trim();
}

/**
 * Custom function to extract PDFs with "bill" in URL and generate detailed summary
 */
async function generateDetailedSummaryFromBill(legislation: Legislation): Promise<{ longSummary: string; sourceType: string } | null> {
//   console.log('[Detailed Summary] Starting extraction for bill:', legislation.id);
//   console.log('[DEBUG] Jurisdiction:', legislation.jurisdictionName);
//   console.log('[DEBUG] Bill versions:', legislation.versions?.length || 0);
//   console.log('[DEBUG] Bill sources:', legislation.sources?.length || 0);

  // Helper function to fetch and extract PDF content
  const extractPdfContent = async (pdfUrl: string, sourceType: string): Promise<{ longSummary: string; sourceType: string } | null> => {
    try {
    //   console.log('[DEBUG] Trying PDF URL:', pdfUrl);
      const pdfRes = await fetch(pdfUrl);
      if (!pdfRes.ok) {
        // console.log('[Detailed Summary] PDF fetch failed:', pdfUrl, 'Status:', pdfRes.status);
        return null;
      }
      const buffer = await pdfRes.arrayBuffer();
      
      const data = await pdf(Buffer.from(buffer));
    //   console.log('[DEBUG] PDF text length:', data.text?.length || 0);

      if (data.text && data.text.trim().length > 500) {
        // console.log('[Detailed Summary] Using PDF:', pdfUrl);
        const longSummary = await generateDetailedSummary(data.text.trim());
        return { longSummary, sourceType };
      } else {
        // console.log('[Detailed Summary] Skipped PDF (too short):', pdfUrl, 'Length:', data.text?.length || 0);
        return null;
      }
    } catch (e) {
    //   console.log('[Detailed Summary] Error fetching/parsing PDF:', pdfUrl, e);
      return null;
    }
  };

  // 1. Special handling for US Congress bills
  if (legislation.jurisdictionName === 'United States Congress') {
    // For Congress bills, check if we have a congressUrl and try to extract PDF from the /text page
    if (legislation.congressUrl) {
      const textUrl = legislation.congressUrl + '/text';
    //   console.log('[Congress] Fetching text page:', textUrl);

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

            // Only process PDFs with "bill" in the URL
            if (pdfUrl.toLowerCase().includes('bill')) {
              const result = await extractPdfContent(pdfUrl, 'pdf-extracted');
              if (result) return result;
            }
          }
        }
      } catch (e) {
        // console.log('[Congress] Error fetching text page:', textUrl, e);
      }
    }

    // Fallback to checking sources for Congress bills
    if (legislation.sources?.length) {
      for (const source of legislation.sources) {
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

                // Only process PDFs with "bill" in the URL
                if (pdfUrl.toLowerCase().includes('bill')) {
                  const result = await extractPdfContent(pdfUrl, 'pdf-extracted');
                  if (result) return result;
                }
              }
            }
          } catch (e) {
            // console.log('[Congress] Error processing source:', source.url, e);
          }
        }
      }
    }
  }

  // 2. Try bill versions (PDFs with "bill" in URL)
  if (legislation.versions?.length) {
    const sortedVersions = legislation.versions.slice().sort((a, b) => {
      const dateA = a.date ? new Date(a.date).getTime() : 0;
      const dateB = b.date ? new Date(b.date).getTime() : 0;
      return dateB - dateA; // Most recent first
    });

    for (const version of sortedVersions) {
      // Try direct version URL if it's a PDF with "bill" in the URL
      if (version.url && version.url.endsWith('.pdf') && version.url.toLowerCase().includes('bill')) {
        // console.log('[DEBUG] Checking version URL:', version.url);
        const result = await extractPdfContent(version.url, 'pdf-extracted');
        if (result) return result;
      }

      // Try version links
      if (version.links?.length) {
        for (const linkObj of version.links) {
          const linkUrl = linkObj.url || linkObj.href || linkObj.link;
          if (linkUrl && linkUrl.endsWith('.pdf') && linkUrl.toLowerCase().includes('bill')) {
            const result = await extractPdfContent(linkUrl, 'pdf-extracted');
            if (result) return result;
          }
        }
      }
    }
  }

  // 3. Try sources for PDF content with "bill" in URL
  if (legislation.sources?.length) {
    for (const source of legislation.sources) {
      if (!source.url) continue;

    //   console.log('[DEBUG] Checking source URL:', source.url);
      try {
        const pdfLinks = await getBillPdfLinksFromPage(source.url);
        
        for (let pdfUrl of pdfLinks) {
          const result = await extractPdfContent(pdfUrl, 'pdf-extracted');
          if (result) return result;
        }
      } catch (e) {
        // console.log('[Detailed Summary] Error processing source:', source.url, e);
      }
    }
  }

//   console.log('[Detailed Summary] No suitable PDF with "bill" found for bill:', legislation.id);
  return null;
}

function getClientIdentifier(request: NextRequest): string {
  // Try to get user ID from auth headers first (if available)
  const authHeader = request.headers.get('authorization');
  if (authHeader) {
    // Extract user ID from auth header if available
    const userIdMatch = authHeader.match(/user_(.+)/);
    if (userIdMatch) return `user_${userIdMatch[1]}`;
  }

  // Fallback to IP address
  const forwarded = request.headers.get('x-forwarded-for');
  const ip = forwarded
    ? forwarded.split(',')[0]
    : request.headers.get('x-real-ip') || 'unknown';
  return `ip_${ip}`;
}

/**
 * Save the detailed summary to the database
 */
async function saveDetailedSummary(legislationId: string, detailedSummary: string): Promise<void> {
  try {
    const collection = await getCollection('legislation');
    await collection.updateOne(
      { id: legislationId },
      { 
        $set: { 
          longGeminiSummary: detailedSummary,
          longGeminiSummaryUpdatedAt: new Date()
        } 
      }
    );
  } catch (error) {
    console.error('Error saving detailed summary to database:', error);
    // Don't throw here - we still want to return the summary even if saving fails
  }
}

/**
 * Get cached detailed summary from database
 */
async function getCachedDetailedSummary(legislationId: string): Promise<string | null> {
  try {
    const collection = await getCollection('legislation');
    const result = await collection.findOne(
      { id: legislationId },
      { projection: { longGeminiSummary: 1, longGeminiSummaryUpdatedAt: 1 } }
    );

    if (!result?.longGeminiSummary) return null;

    // Check if summary is stale (older than 30 days)
    const updatedAt = result.longGeminiSummaryUpdatedAt;
    if (updatedAt) {
      const daysSinceUpdate = (Date.now() - updatedAt.getTime()) / (1000 * 60 * 60 * 24);
      if (daysSinceUpdate > 30) {
        return null; // Consider stale
      }
    }

    return result.longGeminiSummary;
  } catch (error) {
    console.error('Error fetching cached detailed summary:', error);
    return null;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);
    const forceRefresh = searchParams.get('refresh') === 'true';

    // Get legislation data first
    const legislation = await getLegislationById(id);
    if (!legislation) {
      return NextResponse.json(
        { error: 'Legislation not found' },
        { status: 404 }
      );
    }

    // Check eligibility: Congress bills with acceptable sources only
    const isCongressBill = legislation.jurisdictionName === "United States Congress";
    const hasAcceptableSource = ['pdf-extracted', 'pdf'].includes(legislation.geminiSummarySource || '');
    
    if (!isCongressBill || !hasAcceptableSource) {
      return NextResponse.json(
        { 
          error: 'Detailed summary not available',
          message: 'Detailed AI summaries are only available for Congress bills with PDF sources.'
        },
        { status: 400 }
      );
    }

    // Apply rate limiting for all requests (more restrictive for detailed summaries)
    // Use a global rate limit per client for detailed summaries to prevent abuse
    const clientId = getClientIdentifier(request);
    const rateLimitKey = `detailed_summary_global_${clientId}`;
    // console.log(`[Rate Limit] Checking rate limit for key: ${rateLimitKey}`);
    const rateLimit = await checkRateLimit(rateLimitKey);

    // console.log(`[Rate Limit] Rate limit result:`, { 
    //   allowed: rateLimit.allowed, 
    //   timeUntilReset: rateLimit.timeUntilReset,
    //   clientId: clientId
    // });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          message: `Please wait ${rateLimit.timeUntilReset} seconds before generating another detailed summary.`,
          timeUntilReset: rateLimit.timeUntilReset,
          serverTime: Date.now(), // Add server time for sync
          rateLimitKey: rateLimitKey // Add for debugging
        },
        { status: 429 }
      );
    }

    // Check for cached summary first (unless force refresh)
    if (!forceRefresh) {
      const cachedSummary = await getCachedDetailedSummary(id);
      if (cachedSummary) {
        return NextResponse.json({
          summary: cachedSummary,
          cached: true
        });
      }
    }

    // Use the custom function to extract PDFs with "bill" in URL and generate detailed summary
    // console.log(`[Detailed Summary API] Generating for bill ${id} using custom PDF extraction`);
    // console.log(`[Detailed Summary API] Bill data:`, {
    //   id: legislation.id,
    //   title: legislation.title,
    //   jurisdictionName: legislation.jurisdictionName,
    //   geminiSummarySource: legislation.geminiSummarySource,
    //   congressUrl: legislation.congressUrl,
    //   sourcesCount: legislation.sources?.length || 0,
    //   versionsCount: legislation.versions?.length || 0
    // });
    
    // Log more detailed information for debugging
    if (legislation.versions?.length) {
    //   console.log(`[Detailed Summary API] Bill versions:`, legislation.versions.map(v => ({ url: v.url, date: v.date })));
    }
    if (legislation.sources?.length) {
    //   console.log(`[Detailed Summary API] Bill sources:`, legislation.sources.map(s => ({ url: s.url })));
    }
    
    const summaryResult = await generateDetailedSummaryFromBill(legislation);
    
    if (!summaryResult || !summaryResult.longSummary || summaryResult.longSummary.length === 0) {
      return NextResponse.json(
        { 
          error: 'Insufficient content',
          message: 'This bill does not have enough content for detailed analysis or no PDFs with "bill" in URL found.',
          sourceType: summaryResult?.sourceType || 'none'
        },
        { status: 400 }
      );
    }

    // console.log(`[Detailed Summary API] Generated summary from source: ${summaryResult.sourceType}`);

    // Use the long summary from the custom function
    const detailedSummary = summaryResult.longSummary;
    
    if (!detailedSummary || detailedSummary.trim().length === 0) {
      return NextResponse.json(
        { 
          error: 'Summary generation failed',
          message: 'Failed to generate detailed summary. Please try again later.'
        },
        { status: 500 }
      );
    }

    // Save to database (async, don't wait for completion)
    saveDetailedSummary(id, detailedSummary).catch(err => 
      console.error('Failed to save detailed summary:', err)
    );

    return NextResponse.json({
      summary: detailedSummary,
      cached: false,
      source: summaryResult.sourceType
    });

  } catch (error) {
    console.error('Error generating detailed summary:', error);
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: 'Failed to generate detailed summary. Please try again later.'
      },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = await params;

    // Get cached summary only
    const cachedSummary = await getCachedDetailedSummary(id);
    
    if (cachedSummary) {
      return NextResponse.json({
        summary: cachedSummary,
        cached: true
      });
    }

    return NextResponse.json(
      { 
        error: 'No cached summary found',
        message: 'Use POST to generate a new detailed summary.'
      },
      { status: 404 }
    );

  } catch (error) {
    console.error('Error fetching detailed summary:', error);
    return NextResponse.json(
      { error: 'Failed to fetch detailed summary' },
      { status: 500 }
    );
  }
}