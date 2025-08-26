import { config } from 'dotenv';
import { connectToDatabase } from '../lib/mongodb';

// Load environment variables
config({ path: '../../.env' });

interface ExecutiveOrderDoc {
  _id: any;
  id: string;
  state: string;
  governor_or_president: string;
  title: string;
  date_signed: Date;
  source_type: string;
}

async function fixFederalExecutiveOrders() {
  try {
    await connectToDatabase();
    console.log('Connected to MongoDB');

    const { MongoClient } = require('mongodb');
    const client = new MongoClient(process.env.MONGODB_URI);
    await client.connect();
    const db = client.db('state-pulse');
    const collection = db.collection('executiveorders');

    // Find all federal executive orders (should have state: 'United States')
    console.log('\n=== Checking Federal Executive Orders ===');

    // Check for orders that might be federal but have wrong state
    const possibleFederalWithWrongState = await collection.find({
      state: { $ne: 'United States' },
      $or: [
        { source_type: 'federal_register' },
        { source_type: 'whitehouse_website' },
        { id: { $regex: '^us-eo-' } },
        { governor_or_president: { $in: ['Joe Biden', 'Donald Trump', 'Barack Obama'] } }
      ]
    }).toArray();

    console.log(`Found ${possibleFederalWithWrongState.length} orders that appear to be federal but have wrong state:`);
    possibleFederalWithWrongState.forEach((doc: ExecutiveOrderDoc) => {
      console.log(`- ID: ${doc.id}, State: "${doc.state}", President: ${doc.governor_or_president}, Source: ${doc.source_type}`);
    });

    // Fix orders with wrong state
    if (possibleFederalWithWrongState.length > 0) {
      const result = await collection.updateMany(
        {
          state: { $ne: 'United States' },
          $or: [
            { source_type: 'federal_register' },
            { source_type: 'whitehouse_website' },
            { id: { $regex: '^us-eo-' } }
          ]
        },
        { $set: { state: 'United States' } }
      );
      console.log(`Fixed state for ${result.modifiedCount} federal executive orders`);
    }

    // Find federal orders with old president names
    console.log('\n=== Checking President Names ===');
    const ordersWithOldPresident = await collection.find({
      state: 'United States',
      governor_or_president: 'Joe Biden',
      date_signed: { $gte: new Date('2025-01-20') } // Orders after Trump's inauguration
    }).toArray();

    console.log(`Found ${ordersWithOldPresident.length} federal orders after Jan 20, 2025 still showing Joe Biden:`);
    ordersWithOldPresident.forEach((doc: ExecutiveOrderDoc) => {
      console.log(`- ID: ${doc.id}, Date: ${doc.date_signed.toISOString().split('T')[0]}, Title: ${doc.title.substring(0, 100)}...`);
    });

    // Fix president names for orders after inauguration
    if (ordersWithOldPresident.length > 0) {
      const result = await collection.updateMany(
        {
          state: 'United States',
          governor_or_president: 'Joe Biden',
          date_signed: { $gte: new Date('2025-01-20') }
        },
        { $set: { governor_or_president: 'Donald Trump' } }
      );
      console.log(`Updated president name for ${result.modifiedCount} orders`);
    }

    // Show summary of all federal orders
    console.log('\n=== Federal Executive Orders Summary ===');
    const federalOrdersCount = await collection.countDocuments({ state: 'United States' });
    console.log(`Total federal executive orders: ${federalOrdersCount}`);

    const federalOrdersByPresident = await collection.aggregate([
      { $match: { state: 'United States' } },
      { $group: { _id: '$governor_or_president', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();

    console.log('Federal orders by president:');
    federalOrdersByPresident.forEach((group: any) => {
      console.log(`- ${group._id}: ${group.count} orders`);
    });

    const federalOrdersBySource = await collection.aggregate([
      { $match: { state: 'United States' } },
      { $group: { _id: '$source_type', count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]).toArray();

    console.log('Federal orders by source:');
    federalOrdersBySource.forEach((group: any) => {
      console.log(`- ${group._id}: ${group.count} orders`);
    });

    await client.close();
    console.log('\nFederal executive orders check and fix completed!');

  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  fixFederalExecutiveOrders().catch((error) => {
    console.error('Script execution failed:', error);
    process.exit(1);
  });
}

export { fixFederalExecutiveOrders };
