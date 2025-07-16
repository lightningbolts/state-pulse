import { connectToDatabase } from '@/lib/mongodb';

async function checkJurisdictions() {
  try {
    const { db } = await connectToDatabase();

    // Get all unique jurisdiction names
    const jurisdictions = await db.collection('legislation').distinct('jurisdictionName');

    console.log('All jurisdiction names in database:');
    jurisdictions.forEach((name, index) => {
      console.log(`${index + 1}. "${name}"`);
    });

    // Check for anything that might be US Congress
    const possibleCongress = jurisdictions.filter(name =>
      name && (
        name.toLowerCase().includes('united') ||
        name.toLowerCase().includes('congress') ||
        name.toLowerCase().includes('federal') ||
        name.toLowerCase().includes('us') ||
        name.toLowerCase() === 'usa'
      )
    );

    console.log('\nPossible US Congress jurisdictions:');
    possibleCongress.forEach((name, index) => {
      console.log(`${index + 1}. "${name}"`);
    });

    // Get counts for each possible Congress jurisdiction
    for (const jurisdiction of possibleCongress) {
      const count = await db.collection('legislation').countDocuments({
        jurisdictionName: jurisdiction
      });
      console.log(`"${jurisdiction}": ${count} documents`);
    }

  } catch (error) {
    console.error('Error checking jurisdictions:', error);
  }
}

checkJurisdictions();
