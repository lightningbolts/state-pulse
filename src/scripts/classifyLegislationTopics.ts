import { getDb } from '../lib/mongodb';
import { Legislation } from '../types/legislation';
import { BROAD_TOPIC_KEYWORDS, NARROW_TOPIC_KEYWORDS, ClassificationResult} from "../types/legislation";
import {processLegislation, classifyLegislationTopics} from "@/services/classifyLegislationService";

/**
 * Progress tracking for resumable operations
 */
interface ClassificationProgress {
  lastProcessedId?: string;
  totalProcessed: number;
  startTime: string;
  lastUpdate: string;
}

const PROGRESS_FILE = './classification-progress.json';

function saveProgress(progress: ClassificationProgress) {
  const fs = require('fs');
  try {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
  } catch (error) {
    console.warn('Failed to save progress:', error);
  }
}

function loadProgress(): ClassificationProgress | null {
  const fs = require('fs');
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      return JSON.parse(fs.readFileSync(PROGRESS_FILE, 'utf8'));
    }
  } catch (error) {
    console.warn('Failed to load progress:', error);
  }
  return null;
}

function clearProgress() {
  const fs = require('fs');
  try {
    if (fs.existsSync(PROGRESS_FILE)) {
      fs.unlinkSync(PROGRESS_FILE);
    }
  } catch (error) {
    console.warn('Failed to clear progress:', error);
  }
}

/**
 * Optimized bulk classification and database update
 */
async function classifyAndUpdateBulk(documents: any[], db: any): Promise<number> {
  const bulkOperations = [];
  let classifiedCount = 0;

  for (const doc of documents) {
    try {
      const title = doc.title || '';
      const summary = doc.geminiSummary || doc.summary;
      const abstract = doc.abstracts && doc.abstracts.length > 0
        ? doc.abstracts[0].abstract || doc.abstracts[0].note
        : undefined;

      if (!title && !summary && !abstract) {
        continue;
      }

      const classification = classifyLegislationTopics(title, summary, abstract);

      if (classification.broadTopics.length === 0 && classification.narrowTopics.length === 0) {
        continue;
      }

      const allTopics = [...classification.broadTopics, ...classification.narrowTopics];

      bulkOperations.push({
        updateOne: {
          filter: { _id: doc._id },
          update: {
            $set: {
              subjects: allTopics,
              topicClassification: {
                broadTopics: classification.broadTopics,
                narrowTopics: classification.narrowTopics,
                confidence: classification.confidence,
                reasoning: classification.reasoning,
                classifiedAt: new Date()
              }
            }
          }
        }
      });

      classifiedCount++;
    } catch (error) {
      console.warn(`Failed to classify document ${doc._id}:`, error.message);
    }
  }

  if (bulkOperations.length > 0) {
    try {
      const result = await db.collection('legislation').bulkWrite(bulkOperations, {
        ordered: false,
        writeConcern: { w: 1, j: false } 
      });
      console.log(`  Bulk update completed: ${result.modifiedCount} documents updated`);
    } catch (error) {
      console.error('  Bulk update failed:', error.message);
    }
  }

  return classifiedCount;
}

/**
 * Optimized streaming processor with memory management
 */
async function processDocumentsStream(db: any, query: any, batchSize: number, concurrencyLimit: number) {
  let totalProcessed = 0;
  let lastProcessedId = null;
  const startTime = new Date().toISOString();

  const existingProgress = loadProgress();
  if (existingProgress) {
    totalProcessed = existingProgress.totalProcessed;
    lastProcessedId = existingProgress.lastProcessedId;
    console.log(`Resuming from progress: ${totalProcessed} documents processed, last ID: ${lastProcessedId}`);

    if (lastProcessedId) {
      query._id = { $gt: lastProcessedId };
    }
  }

  const cursor = db.collection('legislation')
    .find(query)
    .sort({ _id: 1 })
    .batchSize(batchSize);

  let currentBatch = [];
  let batchStartTime = Date.now();

  console.log('Starting streaming classification with bulk updates...');

  try {
    for await (const doc of cursor) {
      currentBatch.push(doc);
      lastProcessedId = doc._id;

      if (currentBatch.length >= batchSize) {
        const batchProcessed = await classifyAndUpdateBulk(currentBatch, db);
        totalProcessed += batchProcessed;

        const batchTime = Date.now() - batchStartTime;
        const docsPerSecond = (currentBatch.length / batchTime * 1000).toFixed(1);

        console.log(`Processed batch: ${currentBatch.length} docs, ${batchProcessed} classified (${docsPerSecond} docs/sec)`);

        saveProgress({
          lastProcessedId: lastProcessedId,
          totalProcessed,
          startTime,
          lastUpdate: new Date().toISOString()
        });

        currentBatch = [];
        batchStartTime = Date.now();

        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    if (currentBatch.length > 0) {
      const batchProcessed = await classifyAndUpdateBulk(currentBatch, db);
      totalProcessed += batchProcessed;
      console.log(`Final batch: ${currentBatch.length} docs, ${batchProcessed} classified`);
    }

  } catch (error) {
    console.error('Error during streaming processing:', error);
    saveProgress({
      lastProcessedId,
      totalProcessed,
      startTime,
      lastUpdate: new Date().toISOString()
    });
    throw error;
  }

  return totalProcessed;
}

/**
 * Get optimized statistics about documents to classify
 */
async function getClassificationStats(db: any) {
  console.log('Analyzing documents for classification...');

  const unclassifiedQuery = {
    $or: [
      { subjects: { $exists: false } },
      { subjects: { $size: 0 } },
      { subjects: null },
      { topicClassification: { $exists: false } }
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

  const unclassifiedCount = await db.collection('legislation').countDocuments(unclassifiedQuery);

  const totalCount = await db.collection('legislation').countDocuments({});

  const classifiedCount = await db.collection('legislation').countDocuments({
    topicClassification: { $exists: true }
  });

  console.log(`\nClassification Statistics:`);
  console.log(`  Total documents: ${totalCount.toLocaleString()}`);
  console.log(`  Already classified: ${classifiedCount.toLocaleString()}`);
  console.log(`  Need classification: ${unclassifiedCount.toLocaleString()}`);
  console.log(`  Classification rate: ${((classifiedCount / totalCount) * 100).toFixed(1)}%\n`);

  return { unclassifiedCount, totalCount, classifiedCount };
}

/**
 * Main optimized classification function
 */
async function main() {
  try {
    console.log('Starting OPTIMIZED legislation topic classification...\n');

    const db = await getDb();

    const stats = await getClassificationStats(db);

    if (stats.unclassifiedCount === 0) {
      console.log('All documents are already classified!');
      clearProgress();
      return;
    }

    const query = {
      // $or: [
      //   { subjects: { $exists: false } },
      //   { subjects: { $size: 0 } },
      //   { subjects: null },
      //   { topicClassification: { $exists: false } }
      // ],
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

    const batchSize = 500; 
    const concurrencyLimit = 10;

    console.log(`Processing ${stats.unclassifiedCount.toLocaleString()} documents in batches of ${batchSize}...`);

    const startTime = Date.now();
    const processedCount = await processDocumentsStream(db, query, batchSize, concurrencyLimit);
    const endTime = Date.now();

    const totalTimeSeconds = (endTime - startTime) / 1000;
    const docsPerSecond = processedCount / totalTimeSeconds;

    console.log(`\nClassification complete!`);
    console.log(`  Documents processed: ${processedCount.toLocaleString()}`);
    console.log(`  Total time: ${Math.round(totalTimeSeconds)} seconds`);
    console.log(`  Average speed: ${docsPerSecond.toFixed(1)} documents/second`);

    clearProgress();

  } catch (error) {
    console.error('Error in main function:', error);
    console.log('\nProgress has been saved. You can resume by running the script again.');
    process.exit(1);
  }
}

/**
 * Process documents in parallel with a concurrency limit
 */
async function processInParallel(items: any[], processFn: (item: any) => Promise<void>, concurrencyLimit: number) {
  const results = [];
  const running = new Set();

  for (const item of items) {
    const promise = (async () => {
      try {
        return await processFn(item);
      } catch (error) {
        console.error(`Error processing item: ${error}`);
        return null;
      }
    })();

    results.push(promise);
    running.add(promise);

    promise.finally(() => {
      running.delete(promise);
    });

    if (running.size >= concurrencyLimit) {
      await Promise.race(Array.from(running));
    }
  }

  return Promise.all(results);
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

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args.includes('--test')) {
    testClassification();
  } else {
    main().catch(console.error);
  }
}
