import dotenv from 'dotenv';
dotenv.config();

import { MongoClient, ServerApiVersion } from 'mongodb';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'statepulse-data';

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable');
}

const client = new MongoClient(MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

const clientPromise = client.connect(); // ✅ Define it!

export async function getDb() {
  const client = await clientPromise;
  return client.db(MONGODB_DB_NAME);
}

export async function getCollection(collectionName: string) {
  const db = await getDb();
  return db.collection(collectionName);
}

// Connect to the database
export async function connectToDatabase() {
  try {
    const client = await clientPromise;
    const db = client.db(MONGODB_DB_NAME);
    console.log('Connected to MongoDB');
    return { client, db };
  } catch (error) {
    console.error('Failed to connect to MongoDB:', error);
    throw error;
  }
}