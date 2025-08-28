import { getDb } from '../lib/mongodb';
import { Legislation } from '../types/legislation';
import { BROAD_TOPIC_KEYWORDS, NARROW_TOPIC_KEYWORDS, ClassificationResult} from "../types/legislation";
import {processLegislation, classifyLegislationTopics} from "@/services/classifyLegislationService";

/**
 * Main function to classify all legislation
 */
async function main() {
  try {
    console.log('Starting legislation topic classification...\n');

    const db = await getDb();

    // Get legislation that hasn't been classified yet
    const query = {
      $or: [
        { subjects: { $exists: false } },
        { subjects: { $size: 0 } },
        { subjects: null }
      ],
      $and: [
        {
          $or: [
            { title: { $exists: true, $not: { $in: [null, ''] } } },
            { geminiSummary: { $exists: true, $not: { $in: [null, ''] } } },
            { summary: { $exists: true, $not: { $in: [null, ''] } } },
            { 'abstracts.0': { $exists: true } }
          ]
        }
      ]
    };

    const totalCount = await db.collection('legislation').countDocuments(query);
    console.log(`Found ${totalCount} legislation documents to classify\n`);

    if (totalCount === 0) {
      console.log('No legislation documents need classification.');
      return;
    }

    // Process in batches
    const batchSize = 100;
    let processed = 0;

    const cursor = db.collection('legislation').find(query).batchSize(batchSize);

    for await (const legislation of cursor) {
      await processLegislation(legislation);
      processed++;

      if (processed % 10 === 0) {
        console.log(`\nProgress: ${processed}/${totalCount} (${Math.round(processed/totalCount * 100)}%)\n`);
      }
    }

    console.log(`\nClassification complete! Processed ${processed} legislation documents.`);

  } catch (error) {
    console.error('Error in main function:', error);
    process.exit(1);
  }
}

/**
 * Run a test classification on a sample text
 */
function testClassification() {
  console.log('Testing classification system...\n');

  const sampleTitle = "An Act to provide for the regulation of artificial intelligence in healthcare systems";
  const sampleSummary = "This bill establishes new regulations for artificial intelligence systems used in healthcare, requiring safety testing, transparency in algorithmic decision-making, and patient consent for AI-assisted medical procedures.";

  console.log(`Sample Title: ${sampleTitle}`);
  console.log(`Sample Summary: ${sampleSummary}\n`);

  const result = classifyLegislationTopics(sampleTitle, sampleSummary);

  console.log('Classification Result:');
  console.log(`Broad Topics: ${result.broadTopics.join(', ')}`);
  console.log(`Narrow Topics: ${result.narrowTopics.join(', ')}`);
  console.log(`Confidence: ${result.confidence}%`);
  console.log(`Reasoning: ${result.reasoning}`);
}

// Check if script is run directly
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--test')) {
    testClassification();
  } else {
    main().catch(console.error);
  }
}
