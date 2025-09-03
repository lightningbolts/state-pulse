import { config } from 'dotenv';
import { getCollection } from '../lib/mongodb';
import { generateGeminiDetailedSummary } from '../services/aiSummaryUtil';
import { Legislation } from '../types/legislation';

config({ path: '../../.env' });

// Rate limiter for Gemini API calls
class GeminiRateLimiter {
  private requestsPerMinute: number[] = [];
  private requestsPerDay: number[] = [];
  private readonly MAX_RPM = 25;
  private readonly MAX_RPD = 2000;

  async waitForRateLimit(): Promise<void> {
    const now = Date.now();

    this.requestsPerMinute = this.requestsPerMinute.filter(time => now - time < 60000);
    this.requestsPerDay = this.requestsPerDay.filter(time => now - time < 86400000);

    if (this.requestsPerDay.length >= this.MAX_RPD) {
      const oldestRequest = Math.min(...this.requestsPerDay);
      const waitTime = 86400000 - (now - oldestRequest);
      console.log(`Daily request limit reached. Waiting ${Math.ceil(waitTime / 1000 / 60)} minutes...`);
      await this.sleep(waitTime);
      return this.waitForRateLimit();
    }

    if (this.requestsPerMinute.length >= this.MAX_RPM) {
      const oldestRequest = Math.min(...this.requestsPerMinute);
      const waitTime = 60000 - (now - oldestRequest) + 1000;
      console.log(`RPM limit reached. Waiting ${Math.ceil(waitTime / 1000)} seconds...`);
      await this.sleep(waitTime);
      return this.waitForRateLimit();
    }

    this.requestsPerMinute.push(now);
    this.requestsPerDay.push(now);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getStats() {
    const now = Date.now();
    const activeRequestsPerMinute = this.requestsPerMinute.filter(time => now - time < 60000).length;
    const activeRequestsPerDay = this.requestsPerDay.filter(time => now - time < 86400000).length;

    return {
      rpm: `${activeRequestsPerMinute}/${this.MAX_RPM}`,
      rpd: `${activeRequestsPerDay}/${this.MAX_RPD}`
    };
  }
}

const rateLimiter = new GeminiRateLimiter();

/**
 * Backfill detailed summaries for existing legislation that qualifies
 */
async function backfillDetailedSummaries() {
  console.log('Starting backfill of detailed summaries...');

  const collection = await getCollection('legislation');

  // Find bills that qualify for detailed summaries but don't have them yet
  const query = {
    $and: [
      {
        $or: [
          { geminiSummarySource: 'pdf-extracted' },
          { geminiSummarySource: 'pdf' },
          { geminiSummarySource: 'full-text' },
          { geminiSummarySource: 'ilga-pdf' },
          { geminiSummarySource: 'ilga-fulltext' }
        ]
      },
      {
        $or: [
          { longGeminiSummary: { $exists: false } },
          { longGeminiSummary: null },
          { $expr: { $lt: [{ $strLenCP: { $ifNull: ['$longGeminiSummary', ''] } }, 1000] } }
        ]
      }
    ]
  };

  const cursor = collection.find(query);
  const totalCount = await collection.countDocuments(query);

  console.log(`Found ${totalCount} bills that need detailed summaries`);

  let processed = 0;
  let successCount = 0;
  let errorCount = 0;

  for await (const doc of cursor) {
    processed++;
    // @ts-ignore
    const legislation = doc as Legislation;

    console.log(`\n[${processed}/${totalCount}] Processing ${legislation.identifier} (${legislation.jurisdictionName})`);
    console.log(`  Source: ${legislation.geminiSummarySource}`);
    console.log(`  Current longGeminiSummary length: ${legislation.longGeminiSummary?.length || 0}`);

    try {
      await rateLimiter.waitForRateLimit();
      const stats = rateLimiter.getStats();
      console.log(`  Rate limit status - RPM: ${stats.rpm}, RPD: ${stats.rpd}`);

      const { fullText, sourceType } = await extractLegislationFullText(legislation);

      if (!fullText || fullText.length < 500) {
        console.log(`  Skipping: insufficient text content (${fullText?.length || 0} chars)`);
        continue;
      }

      console.log(`  Full text extracted: ${fullText.length} characters from ${sourceType}`);

      const detailedSummary = await generateGeminiDetailedSummary(fullText);

      if (!detailedSummary || detailedSummary.length < 100) {
        console.log(`  Warning: Generated summary too short (${detailedSummary?.length || 0} chars)`);
        errorCount++;
        continue;
      }

      await collection.updateOne(
        { _id: doc._id },
        {
          $set: {
            longGeminiSummary: detailedSummary,
            updatedAt: new Date()
          }
        }
      );

      successCount++;
      console.log(`  ✓ Generated detailed summary: ${detailedSummary.length} characters`);

      await new Promise(resolve => setTimeout(resolve, 500));

    } catch (error) {
      errorCount++;
      console.error(`  ✗ Error processing ${legislation.identifier}:`, error);
    }
  }

  console.log(`\n=== Backfill Summary ===`);
  console.log(`Total processed: ${processed}`);
  console.log(`Successful: ${successCount}`);
  console.log(`Errors: ${errorCount}`);
  console.log(`Skipped: ${processed - successCount - errorCount}`);
}

backfillDetailedSummaries()
  .then(() => {
    console.log('Backfill completed successfully');
    process.exit(0);
  })
  .catch(error => {
    console.error('Backfill failed:', error);
    process.exit(1);
  });
