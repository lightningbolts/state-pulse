import { config } from 'dotenv';
import { connectToDatabase } from '../lib/mongodb';
import { fetchFederalExecutiveOrders } from '../services/federalRegisterService';

// Load environment variables
config({ path: '../../.env' });

/**
 * Simple test script for executive orders functionality
 */
async function testExecutiveOrders() {
  console.log('Testing Executive Orders Implementation...');

  try {
    // Test database connection
    console.log('Testing MongoDB connection...');
    await connectToDatabase();
    console.log('MongoDB connection successful');

    // Test Federal Register API (just 1 day to minimize data)
    console.log('\nTesting Federal Register API...');
    await fetchFederalExecutiveOrders(1); // Just 1 day back
    console.log('Federal Register test completed');

    console.log('\nExecutive Orders test completed successfully!');
    console.log('You can now run the full script with:');
    console.log('npx tsx src/scripts/fetchExecutiveOrders.ts');

  } catch (error) {
    console.error('Test failed:', error);
    process.exit(1);
  }
}

// Run test
if (require.main === module) {
  testExecutiveOrders().catch((error) => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}
