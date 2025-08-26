import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import pdf from 'pdf-parse';
import { GovernorScraper, GovernorScrapedOrder, ExecutiveOrder } from '../types/executiveOrder';
import { upsertExecutiveOrder } from '../services/executiveOrderService';

/**
 * Base class for governor scrapers with common utilities
 */
export abstract class BaseGovernorScraper implements GovernorScraper {
  abstract state: string;
  abstract governorName: string;

  abstract scrape(): Promise<GovernorScrapedOrder[]>;

  /**
   * Extract text from PDF URL
   */
  protected async extractPdfText(pdfUrl: string): Promise<string | null> {
    try {
      console.log(`Extracting PDF text: ${pdfUrl}`);
      const response = await fetch(pdfUrl);
      if (!response.ok) return null;

      const buffer = await response.arrayBuffer();
      const data = await pdf(Buffer.from(buffer));
      return data.text;
    } catch (error) {
      console.error(`PDF extraction failed for ${pdfUrl}:`, error);
      return null;
    }
  }

  /**
   * Convert scraped order to ExecutiveOrder format
   */
  protected convertToExecutiveOrder(order: GovernorScrapedOrder): ExecutiveOrder {
    const id = this.generateId(order);

    return {
      id,
      state: this.state,
      governor_or_president: this.governorName,
      title: order.title,
      number: order.number || null,
      date_signed: order.date_signed,
      full_text_url: order.url,
      summary: order.summary || null,
      topics: order.topics || [],
      createdAt: new Date(),
      source_type: 'governor_website'
    };
  }

  /**
   * Generate unique ID for executive order
   */
  private generateId(order: GovernorScrapedOrder): string {
    const stateCode = this.state.toLowerCase().replace(/\s+/g, '-');
    const dateStr = order.date_signed.toISOString().split('T')[0];

    if (order.number) {
      return `${stateCode}-eo-${order.number.toLowerCase().replace(/\s+/g, '-')}`;
    } else {
      // Use date and first few words of title as fallback
      const titleSlug = order.title
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(' ')
        .slice(0, 3)
        .join('-');
      return `${stateCode}-eo-${dateStr}-${titleSlug}`;
    }
  }
}

/**
 * California Governor Executive Orders Scraper
 */
export class CaliforniaGovernorScraper extends BaseGovernorScraper {
  state = 'California';
  governorName = 'Gavin Newsom';

  async scrape(): Promise<GovernorScrapedOrder[]> {
    console.log('Scraping California executive orders...');

    try {
      const response = await fetch('https://www.gov.ca.gov/executive-orders/');
      const html = await response.text();
      const $ = cheerio.load(html);

      const orders: GovernorScrapedOrder[] = [];

      // Updated selectors for California's current website structure
      // Try multiple possible selectors since website structure may have changed
      const selectors = [
        '.executive-order-item',
        '.wp-block-group',
        '.entry-content .wp-block-group',
        'article',
        '.post',
        '.content-item'
      ];

      let elementsFound = false;

      for (const selector of selectors) {
        const elements = $(selector);
        console.log(`Trying selector "${selector}": found ${elements.length} elements`);

        if (elements.length > 0) {
          elementsFound = true;

          elements.each((_, element) => {
            try {
              const $el = $(element);

              // Try to find title link with various selectors
              const titleSelectors = ['h3 a', 'h2 a', '.title a', 'a[href*="executive-order"]', 'a'];
              let title = '';
              let url = '';

              for (const titleSel of titleSelectors) {
                const titleLink = $el.find(titleSel).first();
                if (titleLink.length > 0 && titleLink.attr('href')?.includes('executive-order')) {
                  title = titleLink.text().trim();
                  url = titleLink.attr('href') || '';
                  break;
                }
              }

              if (!title || !url) return;

              // Try to find date with various selectors
              const dateSelectors = ['.date', '.entry-date', '.post-date', 'time'];
              let dateText = '';

              for (const dateSel of dateSelectors) {
                const dateEl = $el.find(dateSel);
                if (dateEl.length > 0) {
                  dateText = dateEl.text().trim() || dateEl.attr('datetime') || '';
                  if (dateText) break;
                }
              }

              // If no date found in element, try to extract from URL or title
              if (!dateText) {
                const urlDateMatch = url.match(/(\d{4})\/(\d{2})\/(\d{2})/);
                if (urlDateMatch) {
                  dateText = `${urlDateMatch[2]}/${urlDateMatch[3]}/${urlDateMatch[1]}`;
                }
              }

              if (!dateText) {
                console.log(`No date found for: ${title}`);
                return; // Skip if no date
              }

              const date = new Date(dateText);
              if (isNaN(date.getTime())) {
                console.log(`Invalid date "${dateText}" for: ${title}`);
                return;
              }

              // Try to find summary
              const summarySelectors = ['.summary', '.excerpt', '.entry-summary', 'p'];
              let summary = '';

              for (const sumSel of summarySelectors) {
                const sumEl = $el.find(sumSel).first();
                if (sumEl.length > 0) {
                  summary = sumEl.text().trim();
                  if (summary.length > 20) break; // Only use if substantial content
                }
              }

              // Extract EO number from title (e.g., "N-19-25" or "Executive Order N-19-25")
              const numberMatch = title.match(/(N-\d+-\d+)/i);
              const number = numberMatch ? numberMatch[1] : null;

              orders.push({
                title,
                url: url.startsWith('http') ? url : `https://www.gov.ca.gov${url}`,
                date_signed: date,
                number,
                summary: summary.length > 0 ? summary : undefined,
                topics: this.extractTopics(title, summary)
              });
            } catch (error) {
              console.error('Error parsing California EO element:', error);
            }
          });

          if (orders.length > 0) break; // Stop trying other selectors if we found orders
        }
      }

      if (!elementsFound) {
        console.log('No elements found with any selector. Website structure may have changed.');
        console.log('Page HTML preview:', html.substring(0, 1000));
      }

      console.log(`Found ${orders.length} California executive orders`);
      return orders;
    } catch (error) {
      console.error('Error scraping California executive orders:', error);
      return [];
    }
  }

  private extractTopics(title: string, summary: string): string[] {
    const text = `${title} ${summary}`.toLowerCase();
    const topics: string[] = [];

    // Define keyword mappings
    const topicKeywords = {
      'climate': ['climate', 'carbon', 'emissions', 'renewable', 'clean energy'],
      'emergency': ['emergency', 'disaster', 'wildfire', 'drought', 'flood'],
      'health': ['health', 'medical', 'covid', 'pandemic', 'healthcare'],
      'economy': ['economy', 'economic', 'business', 'jobs', 'unemployment'],
      'housing': ['housing', 'homelessness', 'affordable housing'],
      'transportation': ['transportation', 'transit', 'highway', 'traffic'],
      'education': ['education', 'school', 'university', 'student']
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
 * Texas Governor Executive Orders Scraper
 */
export class TexasGovernorScraper extends BaseGovernorScraper {
  state = 'Texas';
  governorName = 'Greg Abbott';

  async scrape(): Promise<GovernorScrapedOrder[]> {
    console.log('Scraping Texas executive orders...');

    try {
      const response = await fetch('https://gov.texas.gov/news/category/executive-order');
      const html = await response.text();
      const $ = cheerio.load(html);

      const orders: GovernorScrapedOrder[] = [];

      // Texas lists executive orders in news format
      $('.news-item').each((_, element) => {
        try {
          const $el = $(element);

          const title = $el.find('.news-title a').text().trim();
          const url = $el.find('.news-title a').attr('href');
          const dateText = $el.find('.news-date').text().trim();

          if (!title || !url) return;

          // Parse date
          const date = new Date(dateText);
          if (isNaN(date.getTime())) return;

          // Extract EO number (e.g., "GA-45" or "Executive Order GA-45")
          const numberMatch = title.match(/GA-\d+/i);
          const number = numberMatch ? numberMatch[0] : null;

          orders.push({
            title,
            url: url.startsWith('http') ? url : `https://gov.texas.gov${url}`,
            date_signed: date,
            number,
            topics: this.extractTopics(title)
          });
        } catch (error) {
          console.error('Error parsing Texas EO:', error);
        }
      });

      console.log(`Found ${orders.length} Texas executive orders`);
      return orders;
    } catch (error) {
      console.error('Error scraping Texas executive orders:', error);
      return [];
    }
  }

  private extractTopics(title: string): string[] {
    const text = title.toLowerCase();
    const topics: string[] = [];

    const topicKeywords = {
      'border': ['border', 'immigration', 'security'],
      'economy': ['economy', 'economic', 'business', 'regulatory'],
      'emergency': ['emergency', 'disaster', 'hurricane', 'winter storm'],
      'energy': ['energy', 'oil', 'gas', 'pipeline'],
      'health': ['health', 'covid', 'pandemic', 'medical']
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
 * New York Governor Executive Orders Scraper
 */
export class NewYorkGovernorScraper extends BaseGovernorScraper {
  state = 'New York';
  governorName = 'Kathy Hochul';

  async scrape(): Promise<GovernorScrapedOrder[]> {
    console.log('Scraping New York executive orders...');

    try {
      const response = await fetch('https://www.governor.ny.gov/executive-orders');
      const html = await response.text();
      const $ = cheerio.load(html);

      const orders: GovernorScrapedOrder[] = [];

      // New York's format
      $('.view-executive-orders .views-row').each((_, element) => {
        try {
          const $el = $(element);

          const title = $el.find('.views-field-title a').text().trim();
          const url = $el.find('.views-field-title a').attr('href');
          const dateText = $el.find('.views-field-field-date .field-content').text().trim();

          if (!title || !url) return;

          // Parse date
          const date = new Date(dateText);
          if (isNaN(date.getTime())) return;

          // Extract EO number (e.g., "No. 1.1" or "Executive Order No. 1.1")
          const numberMatch = title.match(/No\.\s*(\d+(?:\.\d+)?)/i);
          const number = numberMatch ? numberMatch[1] : null;

          orders.push({
            title,
            url: url.startsWith('http') ? url : `https://www.governor.ny.gov${url}`,
            date_signed: date,
            number,
            topics: this.extractTopics(title)
          });
        } catch (error) {
          console.error('Error parsing New York EO:', error);
        }
      });

      console.log(`Found ${orders.length} New York executive orders`);
      return orders;
    } catch (error) {
      console.error('Error scraping New York executive orders:', error);
      return [];
    }
  }

  private extractTopics(title: string): string[] {
    const text = title.toLowerCase();
    const topics: string[] = [];

    const topicKeywords = {
      'climate': ['climate', 'clean energy', 'renewable', 'emissions'],
      'transportation': ['transportation', 'mta', 'subway', 'transit'],
      'health': ['health', 'covid', 'pandemic', 'medicaid'],
      'economy': ['economy', 'economic', 'minimum wage', 'business'],
      'housing': ['housing', 'rent', 'affordable housing'],
      'emergency': ['emergency', 'disaster', 'storm', 'flooding']
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
 * Factory function to get all available scrapers
 */
export function getGovernorScrapers(): BaseGovernorScraper[] {
  return [
    new CaliforniaGovernorScraper(),
    new TexasGovernorScraper(),
    new NewYorkGovernorScraper()
  ];
}

/**
 * Main function to scrape all governor executive orders
 */
export async function scrapeGovernorExecutiveOrders(): Promise<void> {
  console.log('Starting governor executive order scraping...');

  const scrapers = getGovernorScrapers();
  let totalProcessed = 0;
  let totalErrors = 0;

  for (const scraper of scrapers) {
    try {
      console.log(`Scraping ${scraper.state} executive orders...`);
      const orders = await scraper.scrape();

      for (const order of orders) {
        try {
          const executiveOrder = scraper.convertToExecutiveOrder(order);

          // Extract full text if PDF URL is available
          if (order.url.endsWith('.pdf')) {
            executiveOrder.full_text = await scraper.extractPdfText(order.url);
          }

          await upsertExecutiveOrder(executiveOrder);
          totalProcessed++;

          // Small delay between requests
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (error) {
          console.error(`Error processing ${scraper.state} EO:`, error);
          totalErrors++;
        }
      }
    } catch (error) {
      console.error(`Error scraping ${scraper.state}:`, error);
      totalErrors++;
    }
  }

  console.log(`Governor scraping completed: ${totalProcessed} processed, ${totalErrors} errors`);
}
