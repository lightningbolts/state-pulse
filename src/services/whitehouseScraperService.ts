import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import pdf from 'pdf-parse';
import { ExecutiveOrder } from '../types/executiveOrder';
import { upsertExecutiveOrder } from '../services/executiveOrderService';

interface WhitehouseExecutiveOrder {
  title: string;
  url: string;
  date: Date;
  number?: string;
  summary?: string;
}

export class WhitehouseScraperClient {
  private baseUrl = 'https://www.whitehouse.gov';
  private executiveOrdersPath = '/presidential-actions/executive-orders';

  /**
   * Fetch executive orders from whitehouse.gov until a cutoff date
   * @param cutoffDate - Stop fetching when orders are older than this date (default: 1 year ago)
   * @param maxPages - Safety limit to prevent infinite loops (default: 100)
   */
  async fetchExecutiveOrders(cutoffDate?: Date, maxPages: number = 100): Promise<WhitehouseExecutiveOrder[]> {
    const orders: WhitehouseExecutiveOrder[] = [];

    // Default cutoff date: 1 year ago
    const defaultCutoff = new Date();
    defaultCutoff.setFullYear(defaultCutoff.getFullYear() - 1);
    const cutoff = cutoffDate || defaultCutoff;

    console.log(`Fetching executive orders until ${cutoff.toISOString().split('T')[0]}`);

    let page = 1;
    let shouldContinue = true;

    while (shouldContinue && page <= maxPages) {
      try {
        const pageUrl = page === 1
          ? `${this.baseUrl}${this.executiveOrdersPath}/`
          : `${this.baseUrl}${this.executiveOrdersPath}/page/${page}/`;

        console.log(`Scraping page ${page}: ${pageUrl}`);

        const response = await fetch(pageUrl);
        if (!response.ok) {
          console.warn(`Failed to fetch page ${page}: ${response.status} ${response.statusText}`);
          break;
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // Find executive order items on the page
        const pageOrders = this.parseExecutiveOrdersFromPage($, pageUrl);

        if (pageOrders.length === 0) {
          console.log(`No more executive orders found on page ${page}`);
          break;
        }

        // Check if any orders on this page are older than cutoff date
        let addedFromThisPage = 0;
        for (const order of pageOrders) {
          if (order.date >= cutoff) {
            orders.push(order);
            addedFromThisPage++;
          } else {
            console.log(`Reached cutoff date with order: "${order.title}" (${order.date.toISOString().split('T')[0]})`);
            shouldContinue = false;
            break;
          }
        }

        console.log(`Found ${pageOrders.length} orders on page ${page}, added ${addedFromThisPage} (${pageOrders.length - addedFromThisPage} were too old)`);

        // If we didn't add any orders from this page due to date cutoff, stop
        if (addedFromThisPage === 0) {
          shouldContinue = false;
        }

        page++;

        // Add delay to be respectful to the server
        if (shouldContinue) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

      } catch (error) {
        console.error(`Error scraping page ${page}:`, error);
        break;
      }
    }

    if (page >= maxPages) {
      console.log(`Reached maximum page limit (${maxPages}). Consider increasing the limit if more orders are needed.`);
    }

    console.log(`Total executive orders found: ${orders.length} (fetched until ${cutoff.toISOString().split('T')[0]})`);
    return orders;
  }

  /**
   * Parse executive orders from a single page
   */
  private parseExecutiveOrdersFromPage($: cheerio.CheerioAPI, pageUrl: string): WhitehouseExecutiveOrder[] {
    const orders: WhitehouseExecutiveOrder[] = [];

    // Try multiple selectors that might contain executive orders
    const selectors = [
      '.wp-block-post',
      'article',
      '.post',
      '.entry',
      '.wp-block-group',
      '.content-item',
      '.result-item',
      '.list-item',
      '[class*="post"]',
      '[class*="entry"]'
    ];

    let elementsFound = false;

    for (const selector of selectors) {
      const elements = $(selector);

      if (elements.length > 0) {
        console.log(`Using selector "${selector}": found ${elements.length} elements`);
        elementsFound = true;

        elements.each((_, element) => {
          try {
            const $el = $(element);

            // Find title and link - try more comprehensive selectors
            const titleSelectors = [
              'h1 a',
              'h2 a',
              'h3 a',
              'h4 a',
              '.wp-block-post-title a',
              '.entry-title a',
              '.post-title a',
              'a[href*="executive-order"]',
              'a[href*="presidential-actions"]'
            ];

            let title = '';
            let url = '';

            for (const titleSel of titleSelectors) {
              const titleLink = $el.find(titleSel).first();
              if (titleLink.length > 0 && titleLink.text().trim()) {
                const linkText = titleLink.text().trim();
                const href = titleLink.attr('href');

                // Check if this is likely an executive order
                if (href && (linkText.toLowerCase().includes('executive order') ||
                           linkText.toLowerCase().includes('eo ') ||
                           href.includes('executive-order') ||
                           href.includes('presidential-actions'))) {
                  title = linkText;
                  url = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
                  break;
                }
              }
            }

            // If no title found with links, try just text content
            if (!title) {
              const textSelectors = [
                'h1', 'h2', 'h3', 'h4',
                '.wp-block-post-title',
                '.entry-title',
                '.post-title'
              ];

              for (const textSel of textSelectors) {
                const textEl = $el.find(textSel).first();
                if (textEl.length > 0) {
                  const text = textEl.text().trim();
                  if (text.toLowerCase().includes('executive order') || text.toLowerCase().includes('eo ')) {
                    title = text;
                    // Try to find a link in the parent or nearby elements
                    const nearbyLink = $el.find('a').first();
                    if (nearbyLink.length > 0) {
                      const href = nearbyLink.attr('href');
                      if (href) {
                        url = href.startsWith('http') ? href : `${this.baseUrl}${href}`;
                      }
                    }
                    break;
                  }
                }
              }
            }

            if (!title) return; // Skip if no executive order found

            // Find date - try more selectors
            const dateSelectors = [
              '.wp-block-post-date',
              '.published-date',
              '.post-date',
              '.entry-date',
              'time',
              '.date',
              '[datetime]',
              '.wp-block-post-date time'
            ];

            let dateText = '';

            for (const dateSel of dateSelectors) {
              const dateEl = $el.find(dateSel).first();
              if (dateEl.length > 0) {
                dateText = dateEl.text().trim() || dateEl.attr('datetime') || dateEl.attr('data-date') || '';
                if (dateText) break;
              }
            }

            // Try to extract date from URL if not found
            if (!dateText && url) {
              const urlDateMatch = url.match(/\/(\d{4})\/(\d{2})\/(\d{2})\//);
              if (urlDateMatch) {
                dateText = `${urlDateMatch[1]}-${urlDateMatch[2]}-${urlDateMatch[3]}`;
              }
            }

            // If still no date, try to find it in the text content
            if (!dateText) {
              const fullText = $el.text();
              const dateMatches = fullText.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}/i);
              if (dateMatches) {
                dateText = dateMatches[0];
              }
            }

            if (!dateText) {
              console.log(`No date found for: ${title.substring(0, 100)}`);
              // Use current date as fallback for recent orders
              dateText = new Date().toISOString().split('T')[0];
            }

            const date = new Date(dateText);
            if (isNaN(date.getTime())) {
              console.log(`Invalid date "${dateText}" for: ${title.substring(0, 100)}`);
              return;
            }

            // Extract executive order number
            let number: string | undefined;
            const numberPatterns = [
              /Executive Order (\d+)/i,
              /EO[\s-]*(\d+)/i,
              /No\.?\s*(\d+)/i,
              /#(\d+)/i,
              /\b(\d{5})\b/ // 5-digit numbers that might be EO numbers
            ];

            for (const pattern of numberPatterns) {
              const match = title.match(pattern);
              if (match) {
                number = match[1];
                break;
              }
            }

            // Find summary/description
            const summarySelectors = [
              '.wp-block-post-excerpt',
              '.entry-summary',
              '.post-excerpt',
              '.excerpt',
              '.description',
              'p'
            ];

            let summary = '';
            for (const sumSel of summarySelectors) {
              const sumEl = $el.find(sumSel).first();
              if (sumEl.length > 0) {
                const sumText = sumEl.text().trim();
                if (sumText.length > 50 && sumText.length < 500) {
                  summary = sumText;
                  break;
                }
              }
            }

            // Only add if we have essential information
            if (title && (url || title.toLowerCase().includes('executive order'))) {
              orders.push({
                title,
                url: url || pageUrl, // Fallback to page URL if no specific URL found
                date,
                number,
                summary: summary || undefined
              });
            }

          } catch (error) {
            console.error('Error parsing executive order element:', error);
          }
        });

        if (orders.length > 0) break; // Stop trying other selectors if we found orders
      }
    }

    if (!elementsFound) {
      console.log(`No elements found with any selector for page: ${pageUrl}`);

      // Try to find any content that mentions executive orders in the raw HTML
      const html = $.html();
      const executiveOrderMentions = html.match(/executive order/gi);
      if (executiveOrderMentions && executiveOrderMentions.length > 0) {
        console.log(`Found ${executiveOrderMentions.length} mentions of "executive order" in HTML, but couldn't parse them with selectors`);
        console.log('HTML structure may have changed. First 2000 characters:');
        console.log(html.substring(0, 2000));
      }
    }

    return orders;
  }

  /**
   * Extract full text from executive order page
   */
  async extractFullTextFromPage(url: string): Promise<string | null> {
    try {
      console.log(`Extracting full text from: ${url}`);

      const response = await fetch(url);
      if (!response.ok) return null;

      const html = await response.text();
      const $ = cheerio.load(html);

      // Try to find the main content
      const contentSelectors = [
        '.entry-content',
        '.post-content',
        '.presidential-actions-content',
        '.content-wrap',
        'main .content',
        '.page-content'
      ];

      for (const selector of contentSelectors) {
        const content = $(selector);
        if (content.length > 0) {
          // Clean up the text
          let text = content.text().trim();

          // Remove excessive whitespace
          text = text.replace(/\s+/g, ' ');

          if (text.length > 100) {
            return text;
          }
        }
      }

      return null;
    } catch (error) {
      console.error(`Error extracting full text from ${url}:`, error);
      return null;
    }
  }

  /**
   * Convert whitehouse scraped order to ExecutiveOrder format
   */
  async convertToExecutiveOrder(order: WhitehouseExecutiveOrder): Promise<ExecutiveOrder> {
    // Generate unique ID
    const dateStr = order.date.toISOString().split('T')[0];
    const titleSlug = order.title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(' ')
      .slice(0, 4)
      .join('-');

    const id = order.number
      ? `us-eo-${order.number}`
      : `us-eo-${dateStr}-${titleSlug}`;

    // Extract full text
    const fullText = await this.extractFullTextFromPage(order.url);

    // Extract topics from title and summary
    const topics = this.extractTopics(order.title, order.summary || '');

    return {
      id,
      state: 'United States',
      governor_or_president: 'Donald Trump', // Current president as of 2025
      title: order.title,
      number: order.number || null,
      date_signed: order.date,
      full_text_url: order.url,
      summary: order.summary || null,
      topics,
      full_text: fullText,
      createdAt: new Date(),
      source_type: 'whitehouse_website',
      raw_data: {
        originalUrl: order.url,
        scrapedAt: new Date().toISOString()
      }
    };
  }

  /**
   * Extract topics from title and summary text
   */
  private extractTopics(title: string, summary: string = ''): string[] {
    const text = `${title} ${summary}`.toLowerCase();
    const topics: string[] = [];

    const topicKeywords = {
      'climate': ['climate', 'carbon', 'emissions', 'renewable', 'clean energy', 'environmental', 'paris accord'],
      'emergency': ['emergency', 'disaster', 'national emergency', 'crisis', 'wildfire', 'drought', 'flood', 'hurricane'],
      'health': ['health', 'healthcare', 'medical', 'covid', 'pandemic', 'medicaid', 'medicare', 'public health'],
      'economy': ['economy', 'economic', 'business', 'jobs', 'employment', 'minimum wage', 'trade', 'inflation'],
      'immigration': ['immigration', 'border', 'refugee', 'asylum', 'citizenship', 'visa', 'deportation'],
      'defense': ['defense', 'military', 'national security', 'homeland security', 'pentagon', 'armed forces'],
      'foreign-policy': ['foreign policy', 'international', 'diplomatic', 'allies', 'sanctions', 'treaty'],
      'civil-rights': ['civil rights', 'discrimination', 'equality', 'voting rights', 'lgbtq', 'racial justice'],
      'criminal-justice': ['criminal justice', 'police', 'prison', 'crime', 'law enforcement', 'sentencing'],
      'energy': ['energy', 'oil', 'gas', 'pipeline', 'nuclear', 'solar', 'wind', 'fossil fuels'],
      'technology': ['technology', 'artificial intelligence', 'cybersecurity', 'data privacy', 'tech'],
      'education': ['education', 'school', 'university', 'student', 'teacher', 'curriculum', 'loan'],
      'budget': ['budget', 'spending', 'fiscal', 'tax', 'revenue', 'deficit', 'appropriation'],
      'regulatory': ['regulatory', 'regulation', 'deregulation', 'compliance', 'oversight'],
      'transportation': ['transportation', 'infrastructure', 'highway', 'aviation', 'railway', 'ports']
    };

    for (const [topic, keywords] of Object.entries(topicKeywords)) {
      if (keywords.some(keyword => text.includes(keyword))) {
        topics.push(topic);
      }
    }

    return topics;
  }
}

/**
 * Main function to fetch and store executive orders from whitehouse.gov
 */
export async function fetchWhitehouseExecutiveOrders(cutoffDate?: Date, maxPages: number = 100): Promise<void> {
  console.log('Starting Whitehouse.gov executive order scraping...');

  const client = new WhitehouseScraperClient();

  try {
    const orders = await client.fetchExecutiveOrders(cutoffDate, maxPages);

    let processed = 0;
    let errors = 0;

    for (const order of orders) {
      try {
        const executiveOrder = await client.convertToExecutiveOrder(order);
        await upsertExecutiveOrder(executiveOrder);
        processed++;

        console.log(`Processed: ${order.title}`);

        // Add small delay to avoid overwhelming the server
        await new Promise(resolve => setTimeout(resolve, 1500));
      } catch (error) {
        console.error(`Error processing order "${order.title}":`, error);
        errors++;
      }
    }

    console.log(`Whitehouse scraping completed: ${processed} processed, ${errors} errors`);
  } catch (error) {
    console.error('Error fetching from Whitehouse.gov:', error);
    throw error;
  }
}
