import { generateGeminiSummary } from './aiSummaryUtil';
import {
  getExecutiveOrdersNeedingSummary,
  updateExecutiveOrderSummary
} from './executiveOrderService';

/**
 * Rate limiter for Gemini API (same pattern as existing legislation summarization)
 */
class GeminiRateLimiter {
  private requestsPerMinute: number[] = [];
  private requestsPerDay: number[] = [];
  private tokensPerMinute: number[] = [];
  private readonly MAX_RPM = 25;
  private readonly MAX_TPM = 2000000;
  private readonly MAX_RPD = 2000;

  async waitForRateLimit(estimatedTokens: number = 2000): Promise<void> {
    const now = Date.now();

    // Clean old entries
    this.requestsPerMinute = this.requestsPerMinute.filter(time => now - time < 60000);
    this.requestsPerDay = this.requestsPerDay.filter(time => now - time < 86400000);
    this.tokensPerMinute = this.tokensPerMinute.filter(time => now - time < 60000);

    // Check daily limit
    if (this.requestsPerDay.length >= this.MAX_RPD) {
      const oldestRequest = Math.min(...this.requestsPerDay);
      const waitTime = 86400000 - (now - oldestRequest);
      console.log(`Daily request limit reached. Waiting ${Math.ceil(waitTime / 1000 / 60)} minutes...`);
      await this.sleep(waitTime);
      return this.waitForRateLimit(estimatedTokens);
    }

    // Check requests per minute
    if (this.requestsPerMinute.length >= this.MAX_RPM) {
      const oldestRequest = Math.min(...this.requestsPerMinute);
      const waitTime = 60000 - (now - oldestRequest) + 1000;
      console.log(`RPM limit reached. Waiting ${Math.ceil(waitTime / 1000)} seconds...`);
      await this.sleep(waitTime);
      return this.waitForRateLimit(estimatedTokens);
    }

    // Check tokens per minute
    const currentTokens = this.tokensPerMinute.length * 1000;
    if (currentTokens + estimatedTokens > this.MAX_TPM) {
      const oldestToken = Math.min(...this.tokensPerMinute);
      const waitTime = 60000 - (now - oldestToken) + 1000;
      console.log(`TPM limit approaching. Waiting ${Math.ceil(waitTime / 1000)} seconds...`);
      await this.sleep(waitTime);
      return this.waitForRateLimit(estimatedTokens);
    }

    // Record this request
    this.requestsPerMinute.push(now);
    this.requestsPerDay.push(now);
    this.tokensPerMinute.push(now);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStats() {
    const now = Date.now();
    const activeRequestsPerMinute = this.requestsPerMinute.filter(time => now - time < 60000).length;
    const activeRequestsPerDay = this.requestsPerDay.filter(time => now - time < 86400000).length;
    const activeTokensPerMinute = this.tokensPerMinute.filter(time => now - time < 60000).length;

    return {
      rpm: `${activeRequestsPerMinute}/${this.MAX_RPM}`,
      rpd: `${activeRequestsPerDay}/${this.MAX_RPD}`,
      tpm: `~${activeTokensPerMinute * 1000}/${this.MAX_TPM}`
    };
  }
}

const geminiRateLimiter = new GeminiRateLimiter();

/**
 * Generate AI summary for executive order with rate limiting
 */
export async function generateExecutiveOrderSummary(text: string): Promise<string> {
  const estimatedTokens = Math.ceil(text.length / 4) + 100;

  await geminiRateLimiter.waitForRateLimit(estimatedTokens);
  const stats = geminiRateLimiter.getStats();
  console.log(`Calling Gemini API for EO summary. Current usage - RPM: ${stats.rpm}, RPD: ${stats.rpd}, TPM: ${stats.tpm}`);

  const prompt = `Summarize this executive order in 100 words, focusing on the main policy changes, who it affects, and specific actions required. Remove fluff and legal boilerplate. If insufficient information, state: 'Summary not available due to insufficient information.'\n\n${text}`;

  return await generateGeminiSummary(text);
}

/**
 * Extract topics/keywords from executive order text
 */
export function extractExecutiveOrderTopics(title: string, summary: string, fullText?: string): string[] {
  const text = `${title} ${summary} ${fullText || ''}`.toLowerCase();
  const topics: string[] = [];

  // Define comprehensive topic keywords for executive orders
  const topicKeywords = {
    'climate': ['climate', 'carbon', 'emissions', 'renewable', 'clean energy', 'environmental', 'green', 'sustainability'],
    'emergency': ['emergency', 'disaster', 'wildfire', 'drought', 'flood', 'hurricane', 'storm', 'crisis'],
    'health': ['health', 'medical', 'covid', 'pandemic', 'healthcare', 'medicaid', 'medicare', 'public health'],
    'economy': ['economy', 'economic', 'business', 'jobs', 'unemployment', 'minimum wage', 'trade', 'commerce'],
    'housing': ['housing', 'homelessness', 'affordable housing', 'rent', 'mortgage', 'zoning'],
    'transportation': ['transportation', 'transit', 'highway', 'traffic', 'infrastructure', 'bridge', 'road'],
    'education': ['education', 'school', 'university', 'student', 'teacher', 'curriculum', 'college'],
    'immigration': ['immigration', 'border', 'refugee', 'asylum', 'visa', 'citizenship'],
    'criminal-justice': ['criminal justice', 'police', 'prison', 'sentencing', 'bail', 'reform'],
    'technology': ['technology', 'digital', 'internet', 'cybersecurity', 'data', 'artificial intelligence', 'ai'],
    'agriculture': ['agriculture', 'farming', 'rural', 'crop', 'livestock', 'food security'],
    'energy': ['energy', 'oil', 'gas', 'pipeline', 'nuclear', 'solar', 'wind'],
    'defense': ['defense', 'military', 'national security', 'veterans', 'homeland security'],
    'civil-rights': ['civil rights', 'discrimination', 'equality', 'voting', 'lgbtq', 'disability'],
    'budget': ['budget', 'spending', 'fiscal', 'tax', 'revenue', 'appropriation'],
    'regulatory': ['regulatory', 'regulation', 'deregulation', 'compliance', 'oversight'],
    'international': ['international', 'foreign', 'treaty', 'diplomacy', 'sanctions', 'trade war']
  };

  // Check for topic matches
  for (const [topic, keywords] of Object.entries(topicKeywords)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      topics.push(topic);
    }
  }

  // Look for specific state-related topics
  const stateSpecificKeywords = {
    'wildfire': ['wildfire', 'fire emergency', 'cal fire'],
    'drought': ['drought', 'water shortage', 'water conservation'],
    'border-security': ['border security', 'border wall', 'immigration enforcement'],
    'covid': ['covid', 'coronavirus', 'pandemic', 'lockdown', 'mask mandate'],
    'gun-control': ['gun', 'firearm', 'second amendment', 'gun violence']
  };

  for (const [topic, keywords] of Object.entries(stateSpecificKeywords)) {
    if (keywords.some(keyword => text.includes(keyword))) {
      topics.push(topic);
    }
  }

  return [...new Set(topics)]; // Remove duplicates
}

/**
 * Process executive orders that need AI summarization
 */
export async function processExecutiveOrderSummarization(limit: number = 10): Promise<void> {
  console.log('Starting executive order AI summarization...');

  const orders = await getExecutiveOrdersNeedingSummary(limit);
  console.log(`Found ${orders.length} executive orders needing summarization`);

  let processed = 0;
  let errors = 0;

  for (const order of orders) {
    try {
      console.log(`Processing summary for: ${order.id} - ${order.title}`);

      // Check if existing summary is adequate (10 or more words)
      const existingSummary = order.geminiSummary;
      if (existingSummary) {
        const wordCount = existingSummary.trim().split(/\s+/).length;
        if (wordCount >= 10) {
          console.log(`Skipping ${order.id} - existing summary has ${wordCount} words (>= 10)`);
          continue;
        }
        console.log(`Existing summary has only ${wordCount} words, proceeding with AI summarization`);
      }

      // Get text to summarize (prefer full text, fallback to existing summary)
      const textToSummarize = order.full_text || order.summary || order.title;

      if (!textToSummarize || textToSummarize.length < 50) {
        console.log(`Skipping ${order.id} - insufficient text for summarization`);
        continue;
      }

      // Generate AI summary
      const geminiSummary = await generateExecutiveOrderSummary(textToSummarize);

      // Extract topics
      const topics = extractExecutiveOrderTopics(
        order.title,
        geminiSummary,
        order.full_text || undefined
      );

      // Update the order with summary and topics
      await updateExecutiveOrderSummary(order.id, geminiSummary, topics);

      processed++;
      console.log(`✓ Summarized: ${order.id}`);

    } catch (error) {
      console.error(`Error processing ${order.id}:`, error);
      errors++;
    }
  }

  console.log(`Executive order summarization completed: ${processed} processed, ${errors} errors`);
}
