import { config } from 'dotenv';
import path from 'path';
import { getCollection, connectToDatabase } from '../lib/mongodb';

config({ path: path.resolve(__dirname, '../../.env') });

async function deleteOcdBills() {
  console.log('Connecting to database...');
  await connectToDatabase();
  const legislationCollection = await getCollection('legislation');
  console.log('Deleting bills with ocd-bill/ prefix...');

  const result = await legislationCollection.deleteMany({ id: { $regex: '^ocd-bill/' } });

  console.log(`Deleted ${result.deletedCount} bills.`)

  console.log('Finished deleting bills.');
}

deleteOcdBills()
  .then(() => {
    console.log('Script finished successfully.');
    process.exit(0);
  })
  .catch(error => {
    console.error('Script failed:', error);
    process.exit(1);
  });

