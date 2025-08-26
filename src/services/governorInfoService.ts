import * as cheerio from 'cheerio';
import fetch from 'node-fetch';

// State information for fetching current governors
const STATE_GOVERNOR_SOURCES = {
  Alabama: {
    url: 'https://governor.alabama.gov/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  Alaska: {
    url: 'https://gov.alaska.gov/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  Arizona: {
    url: 'https://azgovernor.gov/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  Arkansas: {
    url: 'https://governor.arkansas.gov/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  California: {
    url: 'https://www.gov.ca.gov/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  Colorado: {
    url: 'https://www.colorado.gov/governor/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  Connecticut: {
    url: 'https://portal.ct.gov/office-of-the-governor/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  Delaware: {
    url: 'https://governor.delaware.gov/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  Florida: {
    url: 'https://www.flgov.com/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  Georgia: {
    url: 'https://gov.georgia.gov/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  Hawaii: {
    url: 'https://gov.hawaii.gov/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  Idaho: {
    url: 'https://gov.idaho.gov/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  Illinois: {
    url: 'https://www2.illinois.gov/gov/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  Indiana: {
    url: 'https://www.in.gov/gov/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  Iowa: {
    url: 'https://gov.iowa.gov/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  Kansas: {
    url: 'https://governor.kansas.gov/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  Kentucky: {
    url: 'https://gov.ky.gov/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  Louisiana: {
    url: 'https://gov.louisiana.gov/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  Maine: {
    url: 'https://www.maine.gov/governor/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  Maryland: {
    url: 'https://governor.maryland.gov/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  Massachusetts: {
    url: 'https://www.mass.gov/governor/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  Michigan: {
    url: 'https://www.michigan.gov/whitmer/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  Minnesota: {
    url: 'https://mn.gov/governor/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  Mississippi: {
    url: 'https://www.ms.gov/governor/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  Missouri: {
    url: 'https://governor.mo.gov/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  Montana: {
    url: 'https://gov.mt.gov/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  Nebraska: {
    url: 'https://governor.nebraska.gov/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  Nevada: {
    url: 'https://gov.nv.gov/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  'New Hampshire': {
    url: 'https://www.nh.gov/governor/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  'New Jersey': {
    url: 'https://www.nj.gov/governor/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  'New Mexico': {
    url: 'https://www.governor.state.nm.us/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  'New York': {
    url: 'https://www.governor.ny.gov/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  'North Carolina': {
    url: 'https://governor.nc.gov/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  'North Dakota': {
    url: 'https://www.governor.nd.gov/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  Ohio: {
    url: 'https://governor.ohio.gov/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  Oklahoma: {
    url: 'https://www.gov.ok.gov/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  Oregon: {
    url: 'https://www.oregon.gov/governor/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  Pennsylvania: {
    url: 'https://www.governor.pa.gov/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  'Rhode Island': {
    url: 'https://www.ri.gov/governor/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  'South Carolina': {
    url: 'https://governor.sc.gov/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  'South Dakota': {
    url: 'https://gov.sd.gov/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  Tennessee: {
    url: 'https://www.tn.gov/governor/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  Texas: {
    url: 'https://gov.texas.gov/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  Utah: {
    url: 'https://gov.utah.gov/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  Vermont: {
    url: 'https://governor.vermont.gov/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  Virginia: {
    url: 'https://www.governor.virginia.gov/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  Washington: {
    url: 'https://www.governor.wa.gov/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  'West Virginia': {
    url: 'https://governor.wv.gov/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  Wisconsin: {
    url: 'https://evers.wi.gov/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  },
  Wyoming: {
    url: 'https://gov.wyoming.gov/',
    selectors: ['h1', '.governor-name', 'title', '.site-title']
  }
} as const;

interface GovernorInfo {
  name: string;
  state: string;
  lastUpdated: Date;
  source: 'scraped' | 'wikipedia' | 'fallback';
}

/**
 * Extract governor name from webpage content
 */
function extractGovernorNameFromPage(html: string, selectors: string[]): string | null {
  const $ = cheerio.load(html);

  const patterns = [
    /Governor\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]*\.?)?\s+[A-Z][a-z]+)/i,
    /Gov\.\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]*\.?)?\s+[A-Z][a-z]+)/i,
    /^([A-Z][a-z]+(?:\s+[A-Z][a-z]*\.?)?\s+[A-Z][a-z]+),?\s+Governor/i,
    /Office of Governor\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]*\.?)?\s+[A-Z][a-z]+)/i
  ];

  for (const selector of selectors) {
    try {
      const elements = $(selector);

      elements.each((_, element) => {
        const text = $(element).text().trim();

        for (const pattern of patterns) {
          const match = text.match(pattern);
          if (match) {
            const name = match[1].trim();
            // Validate it looks like a real name (2-3 parts, reasonable length)
            if (name.length >= 5 && name.length <= 50 && name.split(' ').length >= 2) {
              return name;
            }
          }
        }
      });
    } catch (error) {
      console.warn(`Error processing selector ${selector}:`, error);
    }
  }

  return null;
}

/**
 * Fetch current governor from Wikipedia as backup
 */
async function fetchGovernorFromWikipedia(state: string): Promise<string | null> {
  try {
    // Try multiple Wikipedia approaches
    const approaches = [
      // Approach 1: Search for "List of governors of [State]"
      `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=true&explaintext=true&titles=List%20of%20governors%20of%20${encodeURIComponent(state)}&origin=*`,
      // Approach 2: Search for current governor by name if we know common patterns
      `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=true&explaintext=true&titles=Governor%20of%20${encodeURIComponent(state)}&origin=*`,
      // Approach 3: Use Wikipedia search API to find current governor
      `https://en.wikipedia.org/w/api.php?action=opensearch&search=current%20governor%20${encodeURIComponent(state)}&limit=3&namespace=0&format=json&origin=*`
    ];

    for (let i = 0; i < approaches.length; i++) {
      const searchUrl = approaches[i];
      // console.log(`Wikipedia approach ${i + 1} for ${state}...`);

      const response = await fetch(searchUrl);
      const data = await response.json();

      if (i === 2) { // OpenSearch API
        const searchResults = data[1]; // Array of titles
        if (searchResults && searchResults.length > 0) {
          // Try to get the first promising result
          for (const title of searchResults) {
            if (title.toLowerCase().includes('governor') && !title.toLowerCase().includes('list')) {
              // Get the page content for this title
              const pageUrl = `https://en.wikipedia.org/w/api.php?action=query&format=json&prop=extracts&exintro=true&explaintext=true&titles=${encodeURIComponent(title)}&origin=*`;
              const pageResponse = await fetch(pageUrl);
              const pageData = await pageResponse.json();

              const pages = pageData.query?.pages;
              if (pages) {
                const pageId = Object.keys(pages)[0];
                const extract = pages[pageId]?.extract;
                if (extract) {
                  const name = extractGovernorNameFromText(extract, state);
                  if (name) return name;
                }
              }
            }
          }
        }
        continue;
      }

      const pages = data.query?.pages;
      if (!pages) continue;

      const pageId = Object.keys(pages)[0];
      const extract = pages[pageId]?.extract;

      if (!extract) continue;

      // console.log(`Wikipedia extract for ${state} (approach ${i + 1}):`, extract.substring(0, 300));

      const name = extractGovernorNameFromText(extract, state);
      if (name) {
        console.log(`Wikipedia extracted name for ${state}: ${name}`);
        return name;
      }
    }

    return null;
  } catch (error) {
    console.warn(`Error fetching from Wikipedia for ${state}:`, error);
    return null;
  }
}

/**
 * Extract governor name from text using improved patterns
 */
function extractGovernorNameFromText(text: string, state: string): string | null {
  // Improved patterns that work better with Wikipedia content
  const patterns = [
    // Match "The current governor is John Smith" or "The incumbent governor is John Smith"
    /(?:current|incumbent|present)\s+governor\s+(?:is|of\s+\w+\s+is)\s+([A-Z][a-z]+(?:\s+[A-Z]\.?\s*)?[A-Z][a-z]+)/i,

    // Match "John Smith is the current governor" or "John Smith is the 45th governor"
    /([A-Z][a-z]+(?:\s+[A-Z]\.?\s*)?[A-Z][a-z]+)\s+is\s+the\s+(?:current|incumbent|\d+(?:st|nd|rd|th)?)\s+governor/i,

    // Match "John Smith (Democrat/Republican) is the governor" - but extract just the name
    /([A-Z][a-z]+(?:\s+[A-Z]\.?\s*)?[A-Z][a-z]+)\s+\([^)]*\)\s+(?:is|serves as|became)\s+(?:the\s+)?governor/i,

    // Match "Governor John Smith" at the beginning of sentences
    /(?:^|\.\s+)Governor\s+([A-Z][a-z]+(?:\s+[A-Z]\.?\s*)?[A-Z][a-z]+)/i,

    // Match "John Smith, who became governor" or "John Smith, the governor"
    /([A-Z][a-z]+(?:\s+[A-Z]\.?\s*)?[A-Z][a-z]+),\s+(?:who\s+(?:became|is)|the\s+current)\s+governor/i,

    // For "List of governors" pages - match "John Smith (2019–present)" or similar
    /([A-Z][a-z]+(?:\s+[A-Z]\.?\s*)?[A-Z][a-z]+)\s+\(\d{4}[–—-](?:present|ongoing|\d{4})\)/i,

    // Match patterns like "Since 2019, John Smith has served as governor"
    /Since\s+\d{4},?\s+([A-Z][a-z]+(?:\s+[A-Z]\.?\s*)?[A-Z][a-z]+)\s+has\s+served\s+as\s+governor/i,

    // Match "John Smith assumed office" or "John Smith took office"
    /([A-Z][a-z]+(?:\s+[A-Z]\.?\s*)?[A-Z][a-z]+)\s+(?:assumed|took)\s+office\s+(?:as\s+governor|in)/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) {
      const name = match[1].trim();

      // Validate the extracted name
      if (name.length >= 5 && name.length <= 50 && name.split(' ').length >= 2) {
        // Make sure we didn't accidentally capture part of the state name or political affiliation
        const lowercaseName = name.toLowerCase();
        const stateWords = state.toLowerCase().split(' ');

        // Check if the name contains state name parts
        if (stateWords.some(word => lowercaseName.includes(word) && word.length > 2)) {
          continue;
        }

        // Check for political party words that shouldn't be in names
        const politicalWords = ['democrat', 'republican', 'independent', 'party', 'governor'];
        if (politicalWords.some(word => lowercaseName.includes(word))) {
          continue;
        }

        // Check for common titles that shouldn't be in names
        if (lowercaseName.includes('lieutenant') || lowercaseName.includes('former') || lowercaseName.includes('acting')) {
          continue;
        }

        return name;
      }
    }
  }

  return null;
}

/**
 * Scrape current governor for a specific state
 */
async function scrapeCurrentGovernor(state: string): Promise<GovernorInfo | null> {
  const config = STATE_GOVERNOR_SOURCES[state as keyof typeof STATE_GOVERNOR_SOURCES];
  if (!config) {
    console.warn(`No configuration found for state: ${state}`);
    return null;
  }

  console.log(`Fetching current governor for ${state}...`);

  try {
    // Try scraping from official website first
    const response = await fetch(config.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (response.ok) {
      const html = await response.text();
      const governorName = extractGovernorNameFromPage(html, config.selectors);

      if (governorName) {
        return {
          name: governorName,
          state,
          lastUpdated: new Date(),
          source: 'scraped'
        };
      }
    }

    // Fallback to Wikipedia
    console.log(`Could not scrape ${state} governor from official site, trying Wikipedia...`);
    const wikipediaName = await fetchGovernorFromWikipedia(state);

    if (wikipediaName) {
      return {
        name: wikipediaName,
        state,
        lastUpdated: new Date(),
        source: 'wikipedia'
      };
    }

    console.warn(`Could not find current governor for ${state}`);
    return null;

  } catch (error) {
    console.error(`Error scraping governor for ${state}:`, error);

    // Try Wikipedia as last resort
    const wikipediaName = await fetchGovernorFromWikipedia(state);
    if (wikipediaName) {
      return {
        name: wikipediaName,
        state,
        lastUpdated: new Date(),
        source: 'wikipedia'
      };
    }

    return null;
  }
}

/**
 * Fetch current governors for all states
 */
export async function fetchCurrentGovernors(states: string[] = []): Promise<Record<string, GovernorInfo>> {
  const statesToFetch = states.length > 0 ? states : Object.keys(STATE_GOVERNOR_SOURCES);
  const governors: Record<string, GovernorInfo> = {};

  console.log(`Fetching current governors for ${statesToFetch.length} states...`);

  for (const state of statesToFetch) {
    try {
      const governorInfo = await scrapeCurrentGovernor(state);
      if (governorInfo) {
        governors[state] = governorInfo;
        console.log(`[SUCCESS] ${state}: ${governorInfo.name} (${governorInfo.source})`);
      } else {
        console.log(`[FAILED] ${state}: Could not determine current governor`);
      }

      // Add delay between requests to be respectful
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`Error fetching governor for ${state}:`, error);
    }
  }

  console.log(`Successfully fetched ${Object.keys(governors).length}/${statesToFetch.length} governors`);
  return governors;
}

/**
 * Update a single governor
 */
export async function fetchSingleGovernor(state: string): Promise<GovernorInfo | null> {
  return await scrapeCurrentGovernor(state);
}

/**
 * Get governor info with caching (you can extend this with actual caching later)
 */
export async function getCurrentGovernorName(state: string, fallback: string): Promise<string> {
  try {
    const governorInfo = await scrapeCurrentGovernor(state);
    return governorInfo?.name || fallback;
  } catch (error) {
    console.warn(`Error fetching current governor for ${state}, using fallback:`, error);
    return fallback;
  }
}
