const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'your-mongodb-uri-here';

async function clearRepresentativesCache() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db('statepulse');
    const representativesCollection = db.collection('representatives');

    // Clear Louisiana state representatives cache
    const laResult = await representativesCollection.deleteMany({
      jurisdiction: { $regex: /Louisiana|LA/i }
    });

    console.log(`Deleted ${laResult.deletedCount} cached representatives for Louisiana state`);

    // Clear Alabama state representatives cache
    const alResult = await representativesCollection.deleteMany({
      jurisdiction: { $regex: /Alabama|AL/i }
    });

    console.log(`Deleted ${alResult.deletedCount} cached representatives for Alabama state`);

    // Clear all cached representatives to ensure clean state
    const allResult = await representativesCollection.deleteMany({});
    console.log(`Deleted ${allResult.deletedCount} total cached representatives`);

  } catch (error) {
    console.error('Error clearing cache:', error);
  } finally {
    await client.close();
  }
}

clearRepresentativesCache();
