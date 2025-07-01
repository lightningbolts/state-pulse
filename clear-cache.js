const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'your-mongodb-uri-here';

async function clearRepresentativesCache() {
  const client = new MongoClient(MONGODB_URI);

  try {
    await client.connect();
    console.log('Connected to MongoDB');

    const db = client.db('statepulse');
    const representativesCollection = db.collection('representatives');

    // Clear Washington state representatives cache
    const result = await representativesCollection.deleteMany({
      jurisdiction: { $regex: /Washington|WA/i }
    });

    console.log(`Deleted ${result.deletedCount} cached representatives for Washington state`);

    // Optional: Clear all cached representatives if you want to refresh everything
    // const allResult = await representativesCollection.deleteMany({});
    // console.log(`Deleted ${allResult.deletedCount} total cached representatives`);

  } catch (error) {
    console.error('Error clearing cache:', error);
  } finally {
    await client.close();
  }
}

clearRepresentativesCache();
