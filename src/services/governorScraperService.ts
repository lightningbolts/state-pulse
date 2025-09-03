import * as cheerio from 'cheerio';
import fetch from 'node-fetch';
import pdf from 'pdf-parse';
import { GovernorScrapedOrder, ExecutiveOrder } from '@/types/executiveOrder';
import { upsertExecutiveOrder } from '@/services/executiveOrderService';
import { getCurrentGovernorName } from './governorInfoService';

// Governor links for all 50 states executive orders pages
// Note: Governor names will be fetched automatically, fallback names provided
const GOVERNOR_LINKS = {
  Alabama: {
    url: 'https://governor.alabama.gov/newsroom/category/executive-orders/',
    governor: 'Kay Ivey', // Fallback - will be updated automatically
    selectors: {
      container: '.executive-order-item',
      title: 'h3 a',
      date: '.date',
      summary: '.summary'
    }
  },
  Alaska: {
    url: 'https://gov.alaska.gov/administrative-orders/',
    governor: 'Mike Dunleavy',
    selectors: {
      container: '.executive-order',
      title: '.title a',
      date: '.date',
      summary: '.excerpt'
    }
  },
  Arizona: {
    url: 'https://azgovernor.gov/executive-orders',
    governor: 'Katie Hobbs',
    selectors: {
      container: '.view-executive-orders .views-row',
      title: '.views-field-title a',
      date: '.views-field-field-date',
      summary: '.views-field-body'
    }
  },
  Arkansas: {
    url: 'https://governor.arkansas.gov/newsroom/?_post_type=executive_orders',
    governor: 'Sarah Huckabee Sanders',
    selectors: {
      container: '.executive-order-item',
      title: 'h3 a',
      date: '.date',
      summary: '.summary'
    }
  },
  California: {
    url: 'https://www.gov.ca.gov/category/executive-orders/',
    governor: 'Gavin Newsom',
    selectors: {
      container: '.wp-block-group, article, .post',
      title: 'h3 a, h2 a, .title a, a[href*="executive-order"]',
      date: '.date, .entry-date, .post-date, time',
      summary: '.summary, .excerpt, .entry-summary, p'
    }
  },
  Colorado: {
    url: 'https://governorsoffice.colorado.gov/governor/executive-orders',
    governor: 'Jared Polis',
    selectors: {
      container: '.view-executive-orders .views-row',
      title: '.views-field-title a',
      date: '.views-field-field-date',
      summary: '.views-field-body'
    }
  },
  Connecticut: {
    url: 'https://portal.ct.gov/governor/governors-actions/executive-orders?language=en_US',
    governor: 'Ned Lamont',
    selectors: {
      container: '.executive-order-item',
      title: 'h3 a',
      date: '.date',
      summary: '.summary'
    }
  },
  Delaware: {
    url: 'https://governor.delaware.gov/executive-orders/',
    governor: 'Matt Meyer',
    selectors: {
      container: '.executive-order',
      title: '.title a',
      date: '.date',
      summary: '.excerpt'
    }
  },
  Florida: {
    url: 'https://www.flgov.com/eog/news/executive-orders',
    governor: 'Ron DeSantis',
    selectors: {
      container: '.executive-order-item',
      title: 'h3 a',
      date: '.date',
      summary: '.summary'
    }
  },
  Georgia: {
    url: 'https://gov.georgia.gov/executive-action/executive-orders',
    governor: 'Brian Kemp',
    selectors: {
      container: '.view-executive-orders .views-row',
      title: '.views-field-title a',
      date: '.views-field-field-date',
      summary: '.views-field-body'
    }
  },
  Hawaii: {
    url: 'https://governor.hawaii.gov/executive-orders/',
    governor: 'Josh Green',
    selectors: {
      container: '.executive-order-item',
      title: 'h3 a',
      date: '.date',
      summary: '.summary'
    }
  },
  Idaho: {
    url: 'https://gov.idaho.gov/executive-orders/',
    governor: 'Brad Little',
    selectors: {
      container: '.executive-order',
      title: '.title a',
      date: '.date',
      summary: '.excerpt'
    }
  },
  Illinois: {
    url: 'https://www.illinois.gov/government/executive-orders.html',
    governor: 'J.B. Pritzker',
    selectors: {
      container: '.executive-order-item',
      title: 'h3 a',
      date: '.date',
      summary: '.summary'
    }
  },
  Indiana: {
    url: 'https://www.in.gov/gov/newsroom/executive-orders/',
    governor: 'Mike Braun',
    selectors: {
      container: '.executive-order',
      title: '.title a',
      date: '.date',
      summary: '.excerpt'
    }
  },
  Iowa: {
    url: 'https://www.legis.iowa.gov/publications/otherResources/executiveOrders',
    governor: 'Kim Reynolds',
    selectors: {
      container: '.view-executive-orders .views-row',
      title: '.views-field-title a',
      date: '.views-field-field-date',
      summary: '.views-field-body'
    }
  },
  Kansas: {
    url: 'https://www.governor.ks.gov/newsroom/executive-orders',
    governor: 'Laura Kelly',
    selectors: {
      container: '.executive-order-item',
      title: 'h3 a',
      date: '.date',
      summary: '.summary'
    }
  },
  Kentucky: {
    url: 'https://gov.ky.gov/executive-orders',
    governor: 'Andy Beshear',
    selectors: {
      container: '.view-executive-orders .views-row',
      title: '.views-field-title a',
      date: '.views-field-field-date',
      summary: '.views-field-body'
    }
  },
  Louisiana: {
    url: 'https://gov.louisiana.gov/index.cfm/newsroom/category/11',
    governor: 'Jeff Landry',
    selectors: {
      container: '.executive-order-item',
      title: 'h3 a',
      date: '.date',
      summary: '.summary'
    }
  },
  Maine: {
    url: 'https://www.maine.gov/governor/mills/official_documents',
    governor: 'Janet Mills',
    selectors: {
      container: '.executive-order',
      title: '.title a',
      date: '.date',
      summary: '.excerpt'
    }
  },
  Maryland: {
    url: 'https://governor.maryland.gov/news/pages/executive-orders.aspx',
    governor: 'Wes Moore',
    selectors: {
      container: '.executive-order-item',
      title: 'h3 a',
      date: '.date',
      summary: '.summary'
    }
  },
  Massachusetts: {
    url: 'https://www.mass.gov/massachusetts-executive-orders',
    governor: 'Maura Healey',
    selectors: {
      container: '.ma__page-overview__content',
      title: '.ma__comp-heading a',
      date: '.ma__decorative-link__date',
      summary: '.ma__rich-text'
    }
  },
  Michigan: {
    url: 'https://www.legislature.mi.gov/Laws/ExecutiveOrders',
    governor: 'Gretchen Whitmer',
    selectors: {
      container: '.view-executive-orders .views-row',
      title: '.views-field-title a',
      date: '.views-field-field-date',
      summary: '.views-field-body'
    }
  },
  Minnesota: {
    url: 'https://mn.gov/governor/newsroom/executive-orders/',
    governor: 'Tim Walz',
    selectors: {
      container: '.executive-order-item',
      title: 'h3 a',
      date: '.date',
      summary: '.summary'
    }
  },
  Mississippi: {
    url: 'https://www.sos.ms.gov/communications-publications/executive-orders',
    governor: 'Tate Reeves',
    selectors: {
      container: '.executive-order',
      title: '.title a',
      date: '.date',
      summary: '.excerpt'
    }
  },
  Missouri: {
    url: 'https://governor.mo.gov/actions/executive-orders',
    governor: 'Mike Kehoe',
    selectors: {
      container: '.view-executive-orders .views-row',
      title: '.views-field-title a',
      date: '.views-field-field-date',
      summary: '.views-field-body'
    }
  },
  Montana: {
    url: 'https://gov.mt.gov/Documents/GovernorsOffice/executiveorders/',
    governor: 'Greg Gianforte',
    selectors: {
      container: '.executive-order-item',
      title: 'h3 a',
      date: '.date',
      summary: '.summary'
    }
  },
  Nebraska: {
    url: 'https://govdocs.nebraska.gov/docs/pilot/pubs/eoindex.html',
    governor: 'Jim Pillen',
    selectors: {
      container: '.executive-order',
      title: '.title a',
      date: '.date',
      summary: '.excerpt'
    }
  },
  Nevada: {
    url: 'https://gov.nv.gov/Newsroom/ExecOrders/Executive-Orders/',
    governor: 'Joe Lombardo',
    selectors: {
      container: '.executive-order-item',
      title: 'h3 a',
      date: '.date',
      summary: '.summary'
    }
  },
  'New Hampshire': {
    url: 'https://www.governor.nh.gov/news/executive-orders',
    governor: 'Kelly Ayotte',
    selectors: {
      container: '.executive-order',
      title: '.title a',
      date: '.date',
      summary: '.excerpt'
    }
  },
  'New Jersey': {
    url: 'https://www.nj.gov/infobank/eo/056murphy/approved/eo_archive.html',
    governor: 'Phil Murphy',
    selectors: {
      container: '.executive-order-item',
      title: 'h3 a',
      date: '.date',
      summary: '.summary'
    }
  },
  'New Mexico': {
    url: 'https://www.governor.state.nm.us/about-the-governor/executive-orders/',
    governor: 'Michelle Lujan Grisham',
    selectors: {
      container: '.executive-order',
      title: '.title a',
      date: '.date',
      summary: '.excerpt'
    }
  },
  'New York': {
    url: 'https://www.governor.ny.gov/executiveorders',
    governor: 'Kathy Hochul',
    selectors: {
      container: '.view-executive-orders .views-row',
      title: '.views-field-title a',
      date: '.views-field-field-date .field-content',
      summary: '.views-field-body'
    }
  },
  'North Carolina': {
    url: 'https://governor.nc.gov/news/executive-orders',
    governor: 'Josh Stein',
    selectors: {
      container: '.view-executive-orders .views-row',
      title: '.views-field-title a',
      date: '.views-field-field-date',
      summary: '.views-field-body'
    }
  },
  'North Dakota': {
    url: 'https://www.governor.nd.gov/executive-orders',
    governor: 'Kelly Armstrong',
    selectors: {
      container: '.executive-order-item',
      title: 'h3 a',
      date: '.date',
      summary: '.summary'
    }
  },
  Ohio: {
    url: 'https://governor.ohio.gov/media/executive-orders',
    governor: 'Mike DeWine',
    selectors: {
      container: '.view-executive-orders .views-row',
      title: '.views-field-title a',
      date: '.views-field-field-date',
      summary: '.views-field-body'
    }
  },
  Oklahoma: {
    url: 'https://www.sos.ok.gov/gov/execorders.aspx',
    governor: 'Kevin Stitt',
    selectors: {
      container: '.executive-order-item',
      title: 'h3 a',
      date: '.date',
      summary: '.summary'
    }
  },
  Oregon: {
    url: 'https://www.oregon.gov/gov/pages/executive-orders.aspx',
    governor: 'Tina Kotek',
    selectors: {
      container: '.executive-order',
      title: '.title a',
      date: '.date',
      summary: '.excerpt'
    }
  },
  'Pennsylvania': {
    url: 'https://www.pa.gov/agencies/oa/policies/view-policies#sortCriteria=%40copapwptitle%20ascending%2C%40title%20ascending%2C%40copapwpeducatorname%20ascending&f-copapwpcategory=Executive%20Order',
    governor: 'Josh Shapiro',
    selectors: {
      container: '.executive-order-item',
      title: 'h3 a',
      date: '.date',
      summary: '.summary'
    }
  },
  'Rhode Island': {
    url: 'https://governor.ri.gov/executive-orders',
    governor: 'Daniel McKee',
    selectors: {
      container: '.executive-order',
      title: '.title a',
      date: '.date',
      summary: '.excerpt'
    }
  },
  'South Carolina': {
    url: 'https://governor.sc.gov/executive-branch/executive-orders',
    governor: 'Henry McMaster',
    selectors: {
      container: '.view-executive-orders .views-row',
      title: '.views-field-title a',
      date: '.views-field-field-date',
      summary: '.views-field-body'
    }
  },
  'South Dakota': {
    url: 'https://sdsos.gov/general-information/executive-actions/executive-orders/search/Default.aspx',
    governor: 'Larry Rhoden',
    selectors: {
      container: '.executive-order-item',
      title: 'h3 a',
      date: '.date',
      summary: '.summary'
    }
  },
  Tennessee: {
    url: 'https://sos.tn.gov/publications/services/executive-orders-governor-bill-lee',
    governor: 'Bill Lee',
    selectors: {
      container: '.executive-order',
      title: '.title a',
      date: '.date',
      summary: '.excerpt'
    }
  },
  Texas: {
    url: 'https://lrl.texas.gov/legeLeaders/governors/searchproc.cfm?govdoctypeID=5&governorID=45',
    governor: 'Greg Abbott',
    selectors: {
      container: '.news-item',
      title: '.news-title a',
      date: '.news-date',
      summary: '.news-summary'
    }
  },
  Utah: {
    url: 'https://governor.utah.gov/executive-orders/',
    governor: 'Spencer Cox',
    selectors: {
      container: '.executive-order-item',
      title: 'h3 a',
      date: '.date',
      summary: '.summary'
    }
  },
  Vermont: {
    url: 'https://governor.vermont.gov/document-types/executive-orders',
    governor: 'Phil Scott',
    selectors: {
      container: '.view-executive-orders .views-row',
      title: '.views-field-title a',
      date: '.views-field-field-date',
      summary: '.views-field-body'
    }
  },
  Virginia: {
    url: 'https://www.governor.virginia.gov/executive-actions/',
    governor: 'Glenn Youngkin',
    selectors: {
      container: '.executive-order-item',
      title: 'h3 a',
      date: '.date',
      summary: '.summary'
    }
  },
  Washington: {
    url: 'https://governor.wa.gov/office-governor/office/official-actions/executive-orders',
    governor: 'Bob Ferguson',
    selectors: {
      container: '.view-executive-orders .views-row',
      title: '.views-field-title a',
      date: '.views-field-field-date',
      summary: '.views-field-body'
    }
  },
  'West Virginia': {
    url: 'https://governor.wv.gov/executive-orders',
    governor: 'Patrick Morrisey',
    selectors: {
      container: '.executive-order',
      title: '.title a',
      date: '.date',
      summary: '.excerpt'
    }
  },
  Wisconsin: {
    url: 'https://evers.wi.gov/pages/newsroom/executive-orders.aspx',
    governor: 'Tony Evers',
    selectors: {
      container: '.executive-order-item',
      title: 'h3 a',
      date: '.date',
      summary: '.summary'
    }
  },
  Wyoming: {
    url: 'https://governor.wyo.gov/state-government/executive-orders',
    governor: 'Mark Gordon',
    selectors: {
      container: '.executive-order',
      title: '.title a',
      date: '.date',
      summary: '.excerpt'
    }
  }
} as const;

type StateConfig = {
  url: string;
  governor: string;
  selectors: {
    container: string;
    title: string;
    date: string;
    summary: string;
  };
};

/**
 * Extract text from PDF URL
 */
async function extractPdfText(pdfUrl: string): Promise<string | null> {
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
 * Generate unique ID for executive order
 */
function generateId(state: string, order: GovernorScrapedOrder): string {
  const stateCode = state.toLowerCase().replace(/\s+/g, '-');
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

/**
 * Convert scraped order to ExecutiveOrder format
 */
function convertToExecutiveOrder(state: string, governor: string, order: GovernorScrapedOrder): ExecutiveOrder {
  const id = generateId(state, order);

  return {
    id,
    state,
    governor_or_president: governor,
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
 * Extract topics from title and summary text
 */
function extractTopics(title: string, summary: string = ''): string[] {
  const text = `${title} ${summary}`.toLowerCase();
  const topics: string[] = [];

  const topicKeywords = {
    'climate': ['climate', 'carbon', 'emissions', 'renewable', 'clean energy', 'environmental'],
    'emergency': ['emergency', 'disaster', 'wildfire', 'drought', 'flood', 'hurricane', 'storm'],
    'health': ['health', 'medical', 'covid', 'pandemic', 'healthcare', 'medicaid', 'medicare'],
    'economy': ['economy', 'economic', 'business', 'jobs', 'unemployment', 'minimum wage', 'trade'],
    'housing': ['housing', 'homelessness', 'affordable housing', 'rent', 'mortgage'],
    'transportation': ['transportation', 'transit', 'highway', 'traffic', 'infrastructure'],
    'education': ['education', 'school', 'university', 'student', 'teacher', 'curriculum'],
    'immigration': ['immigration', 'border', 'refugee', 'asylum'],
    'criminal-justice': ['criminal justice', 'police', 'prison', 'crime', 'law enforcement'],
    'energy': ['energy', 'oil', 'gas', 'pipeline', 'nuclear', 'solar', 'wind'],
    'agriculture': ['agriculture', 'farming', 'rural', 'crop', 'livestock'],
    'budget': ['budget', 'spending', 'fiscal', 'tax', 'revenue'],
    'regulatory': ['regulatory', 'regulation', 'deregulation', 'compliance']
  };

  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      topics.push(topic);
    }
  }

  return topics;
}

/**
 * Extract governor name from webpage content
 */
function extractGovernorName(html: string, fallbackName: string): string {
  const $ = cheerio.load(html);

  const selectors = [
    '.governor-name',
    '.current-governor',
    'h1:contains("Governor")',
    '.site-title',
    '.page-title',
    'title'
  ];

  for (const selector of selectors) {
    const element = $(selector);
    if (element.length > 0) {
      const text = element.text().trim();
      const nameMatch = text.match(/Governor\s+([A-Z][a-z]+\s+[A-Z][a-z]+)/i);
      if (nameMatch) {
        return nameMatch[1];
      }
    }
  }

  return fallbackName;
}

/**
 * Scrape executive orders for a specific state
 */
async function scrapeStateExecutiveOrders(state: string, config: StateConfig): Promise<GovernorScrapedOrder[]> {
  console.log(`Scraping ${state} executive orders...`);

  try {
    const response = await fetch(config.url);
    const html = await response.text();
    const $ = cheerio.load(html);

    // Try to extract governor name dynamically
    const governorName = extractGovernorName(html, config.governor);

    const orders: GovernorScrapedOrder[] = [];

    // Split container selectors and try each one
    const containerSelectors = config.selectors.container.split(',').map(s => s.trim());
    let elementsFound = false;

    for (const containerSelector of containerSelectors) {
      const elements = $(containerSelector);
      console.log(`Trying selector "${containerSelector}": found ${elements.length} elements`);

      if (elements.length > 0) {
        elementsFound = true;

        elements.each((_, element) => {
          try {
            const $el = $(element);

            // Try to find title link with various selectors
            const titleSelectors = config.selectors.title.split(',').map(s => s.trim());
            let title = '';
            let url = '';

            for (const titleSel of titleSelectors) {
              const titleLink = $el.find(titleSel).first();
              if (titleLink.length > 0) {
                const linkHref = titleLink.attr('href');
                if (linkHref && (linkHref.includes('executive-order') || linkHref.includes('executive_order') || titleLink.text().trim().length > 0)) {
                  title = titleLink.text().trim();
                  url = linkHref;
                  break;
                }
              }
            }

            if (!title || !url) return;

            // Try to find date with various selectors
            const dateSelectors = config.selectors.date.split(',').map(s => s.trim());
            let dateText = '';

            for (const dateSel of dateSelectors) {
              const dateEl = $el.find(dateSel);
              if (dateEl.length > 0) {
                dateText = dateEl.text().trim() || dateEl.attr('datetime') || '';
                if (dateText) break;
              }
            }

            // If no date found in element, try to extract from URL
            if (!dateText) {
              const urlDateMatch = url.match(/(\d{4})\/(\d{2})\/(\d{2})/);
              if (urlDateMatch) {
                dateText = `${urlDateMatch[2]}/${urlDateMatch[3]}/${urlDateMatch[1]}`;
              }
            }

            if (!dateText) {
              console.log(`No date found for: ${title}`);
              return;
            }

            const date = new Date(dateText);
            if (isNaN(date.getTime())) {
              console.log(`Invalid date "${dateText}" for: ${title}`);
              return;
            }

            // Try to find summary
            const summarySelectors = config.selectors.summary.split(',').map(s => s.trim());
            let summary = '';

            for (const sumSel of summarySelectors) {
              const sumEl = $el.find(sumSel).first();
              if (sumEl.length > 0) {
                summary = sumEl.text().trim();
                if (summary.length > 20) break;
              }
            }

            // Extract EO number from title
            let number: string | null = null;

            // State-specific number patterns
            if (state === 'California') {
              const numberMatch = title.match(/(N-\d+-\d+)/i);
              number = numberMatch ? numberMatch[1] : null;
            } else if (state === 'Texas') {
              const numberMatch = title.match(/GA-\d+/i);
              number = numberMatch ? numberMatch[0] : null;
            } else if (state === 'New York') {
              const numberMatch = title.match(/No\.\s*(\d+(?:\.\d+)?)/i);
              number = numberMatch ? numberMatch[1] : null;
            } else {
              // Generic pattern for most states
              const patterns = [
                /Executive Order (\d+)/i,
                /EO (\d+)/i,
                /No\.\s*(\d+)/i,
                /#(\d+)/i,
                /(\d{4}-\d+)/i
              ];

              for (const pattern of patterns) {
                const match = title.match(pattern);
                if (match) {
                  number = match[1];
                  break;
                }
              }
            }

            orders.push({
              title,
              url: url.startsWith('http') ? url : new URL(url, config.url).href,
              date_signed: date,
              number: number || undefined,
              summary: summary.length > 0 ? summary : undefined,
              topics: extractTopics(title, summary)
            });
          } catch (error) {
            console.error(`Error parsing ${state} EO element:`, error);
          }
        });

        if (orders.length > 0) break; // Stop trying other selectors if we found orders
      }
    }

    if (!elementsFound) {
      console.log(`No elements found with any selector for ${state}. Website structure may have changed.`);
      console.log('Page HTML preview:', html.substring(0, 1000));
    }

    console.log(`Found ${orders.length} ${state} executive orders`);
    return orders;
  } catch (error) {
    console.error(`Error scraping ${state} executive orders:`, error);
    return [];
  }
}

/**
 * Get list of available states
 */
export function getAvailableStates(): string[] {
  return Object.keys(GOVERNOR_LINKS);
}

/**
 * Scrape executive orders for specific states with automatic governor detection
 */
export async function scrapeStatesExecutiveOrders(states: string[] = []): Promise<void> {
  console.log('Starting governor executive order scraping with automatic governor detection...');

  const statesToScrape = states.length > 0 ? states : getAvailableStates();
  let totalProcessed = 0;
  let totalErrors = 0;

  for (const state of statesToScrape) {
    const config = GOVERNOR_LINKS[state as keyof typeof GOVERNOR_LINKS];
    if (!config) {
      console.warn(`No configuration found for state: ${state}`);
      continue;
    }

    try {
      console.log(`Scraping ${state} executive orders...`);

      // Automatically fetch current governor name
      console.log(`Fetching current governor for ${state}...`);
      const currentGovernor = await getCurrentGovernorName(state, config.governor);
      console.log(`Current governor for ${state}: ${currentGovernor}`);

      const orders = await scrapeStateExecutiveOrders(state, config);

      for (const order of orders) {
        try {
          // Use the automatically fetched governor name instead of hardcoded fallback
          const executiveOrder = convertToExecutiveOrder(state, currentGovernor, order);

          await upsertExecutiveOrder(executiveOrder);
          totalProcessed++;

          // Add small delay to avoid overwhelming servers
          await new Promise(resolve => setTimeout(resolve, 500));
        } catch (orderError) {
          console.error(`Error processing order ${order.title}:`, orderError);
          totalErrors++;
        }
      }
    } catch (stateError) {
      console.error(`Error scraping ${state}:`, stateError);
      totalErrors++;
    }
  }

  console.log(`Governor scraping completed: ${totalProcessed} processed, ${totalErrors} errors`);
}
