import { config } from 'dotenv';
import { connectToDatabase } from '../lib/mongodb';
import { fetchFederalExecutiveOrders } from '../services/federalRegisterService';
import { scrapeGovernorExecutiveOrders } from '../services/governorScraperService';
import { processExecutiveOrderSummarization } from '../services/executiveOrderAIService';

// Load environment variables
config({ path: '../../.env' });

interface FetchOptions {
  daysBack?: number;
  includeFederal?: boolean;
  includeGovernors?: boolean;
  processSummaries?: boolean;
  summaryLimit?: number;
}

/**
 * Main function to fetch all executive orders (federal and state)
 */
export async function fetchAllExecutiveOrders(options: FetchOptions = {}) {
  const {
    daysBack = 7,
    includeFederal = true,
    includeGovernors = true,
    processSummaries = true,
    summaryLimit = 20
  } = options;

  console.log('Starting executive orders fetch pipeline...');
  console.log(`Options: Federal=${includeFederal}, Governors=${includeGovernors}, Days=${daysBack}, Summaries=${processSummaries}`);

  try {
    // Connect to database
    await connectToDatabase();
    console.log('Connected to MongoDB');

    let federalCount = 0;
    let governorCount = 0;

    // Fetch federal executive orders
    if (includeFederal) {
      console.log('\nFetching federal executive orders...');
      try {
        await fetchFederalExecutiveOrders(daysBack);
        federalCount++;
        console.log('Federal executive orders fetch completed');
      } catch (error) {
        console.error('Error fetching federal executive orders:', error);
      }
    }

    // Fetch governor executive orders
    if (includeGovernors) {
      console.log('\nScraping governor executive orders...');
      try {
        await scrapeGovernorExecutiveOrders();
        governorCount++;
        console.log('Governor executive orders scraping completed');
      } catch (error) {
        console.error('Error scraping governor executive orders:', error);
      }
    }

    // Process AI summaries
    if (processSummaries) {
      console.log('\nProcessing AI summarization...');
      try {
        await processExecutiveOrderSummarization(summaryLimit);
        console.log('AI summarization completed');
      } catch (error) {
        console.error('Error processing AI summaries:', error);
      }
    }

    console.log('\nExecutive orders pipeline completed successfully!');
    console.log(`Sources processed: Federal=${federalCount}, Governors=${governorCount}`);

  } catch (error) {
    console.error('Fatal error in executive orders pipeline:', error);
    process.exit(1);
  }
}

/**
 * CLI interface for running the script
 */
async function main() {
  const args = process.argv.slice(2);
  const options: FetchOptions = {};

  // Parse command line arguments
  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--days':
        options.daysBack = parseInt(args[i + 1]);
        i++;
        break;
      case '--no-federal':
        options.includeFederal = false;
        break;
      case '--no-governors':
        options.includeGovernors = false;
        break;
      case '--no-summaries':
        options.processSummaries = false;
        break;
      case '--summary-limit':
        options.summaryLimit = parseInt(args[i + 1]);
        i++;
        break;
      case '--help':
        console.log(`
Usage: node fetchExecutiveOrders.js [options]

Options:
  --days <number>         Number of days to look back (default: 7)
  --no-federal           Skip federal executive orders
  --no-governors         Skip governor executive orders
  --no-summaries         Skip AI summarization
  --summary-limit <num>  Limit for AI summarization (default: 20)
  --help                 Show this help message

Examples:
  node fetchExecutiveOrders.js
  node fetchExecutiveOrders.js --days 30 --no-summaries
  node fetchExecutiveOrders.js --no-federal --summary-limit 10
        `);
        process.exit(0);
    }
  }

  await fetchAllExecutiveOrders(options);
}

// Run if called directly
if (require.main === module) {
  main().catch((error) => {
    console.error('Script execution failed:', error);
    process.exit(1);
  });
}
