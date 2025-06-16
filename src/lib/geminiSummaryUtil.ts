import { ai } from '../ai/genkit';
import fetch from 'node-fetch';
import pdf from 'pdf-parse';
import * as cheerio from 'cheerio';

export async function generateGeminiSummary(text: string): Promise<string> {
  const prompt = `Summarize the following legislation in about 100 words, focusing on the main points and specific impact. Make sure there's no fluff or filler. If there is not enough information to summarize, say so in a single sentence: 'Summary not available due to insufficient information.'\n\n${text}`;
  const response = await ai.generate({ prompt });
  let summary = response.text.trim();
  // Prevent Gemini from outputting a request for more information
  if (/I need more information|Once I have this information|to provide an accurate and concise summary/i.test(summary)) {
    summary = 'Summary not available due to insufficient information.';
  }
  // Log for debugging
  if (summary === 'Summary not available due to insufficient information.') {
    console.warn('[GeminiSummary] Insufficient info. Input text length:', text.length, '| Text preview:', text.slice(0, 200));
  }
  return summary;
}

export async function fetchPdfTextFromOpenStatesUrl(openstatesUrl: string): Promise<string | null> {
  try {
    const res = await fetch(openstatesUrl);
    if (!res.ok) throw new Error('Failed to fetch OpenStates page');
    const html = await res.text();
    const $ = cheerio.load(html);
    // Try to find PDF link as before
    const link = $("a").filter((_, el) => $(el).attr('href') && $(el).attr('href').endsWith('.pdf')).first().attr('href');
    if (link) {
      const pdfUrl = link.startsWith('http') ? link : new URL(link, openstatesUrl).href;
      console.log('[PDF Extraction] Found PDF link:', pdfUrl);
      const pdfRes = await fetch(pdfUrl);
      if (!pdfRes.ok) throw new Error('Failed to fetch PDF');
      const buffer = await pdfRes.buffer();
      const data = await pdf(buffer);
      console.log('[PDF Extraction] Extracted PDF text length:', data.text.length);
      return data.text;
    } else {
      console.warn('[PDF Extraction] No PDF link found on OpenStates page:', openstatesUrl);
      // Try to extract bill text from the page as fallback
      // OpenStates bill text is often in a <pre> or <div class="bill-text"> or similar
      let billText = '';
      // Try <pre> blocks
      billText = $('pre').text().trim();
      if (billText.length > 100) {
        console.log('[Bill Text Extraction] Found <pre> block, length:', billText.length);
        return billText;
      }
      // Try <div class="bill-text">
      billText = $('.bill-text').text().trim();
      if (billText.length > 100) {
        console.log('[Bill Text Extraction] Found .bill-text div, length:', billText.length);
        return billText;
      }
      // Try <article> or <section> blocks
      billText = $('article').text().trim();
      if (billText.length > 100) {
        console.log('[Bill Text Extraction] Found <article> block, length:', billText.length);
        return billText;
      }
      billText = $('section').text().trim();
      if (billText.length > 100) {
        console.log('[Bill Text Extraction] Found <section> block, length:', billText.length);
        return billText;
      }
      // Try all <div> blocks with a lot of text
      $('div').each((_, el) => {
        const txt = $(el).text().trim();
        if (txt.length > 1000 && !billText) {
          billText = txt;
        }
      });
      if (billText.length > 100) {
        console.log('[Bill Text Extraction] Found large <div>, length:', billText.length);
        return billText;
      }
      // Try <iframe> blocks (sometimes bill text is embedded)
      const iframeSrc = $('iframe').first().attr('src');
      if (iframeSrc) {
        console.log('[Bill Text Extraction] Found <iframe> src:', iframeSrc);
        try {
          const iframeUrl = iframeSrc.startsWith('http') ? iframeSrc : new URL(iframeSrc, openstatesUrl).href;
          const iframeRes = await fetch(iframeUrl);
          if (iframeRes.ok) {
            const iframeText = await iframeRes.text();
            if (iframeText.length > 100) {
              console.log('[Bill Text Extraction] Extracted text from <iframe>, length:', iframeText.length);
              return iframeText;
            }
          }
        } catch (e) {
          console.warn('[Bill Text Extraction] Failed to fetch or parse <iframe>:', e);
    }
  } catch (e) {
    console.error('Failed to fetch or parse PDF or bill text from OpenStates page:', e);
  }
  return null;
}

