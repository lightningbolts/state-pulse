// src/testMongoConnection.ts
import dotenv from 'dotenv';
dotenv.config();

import { MongoClient } from 'mongodb';
import {getCollection} from "@/lib/mongodb";

// Test MongoDB connection
async function testConnection() {
  const uri = process.env.MONGODB_URI; // Make sure MONGODB_URI is in your .env file or environment

  if (!uri) {
    console.error('MONGODB_URI is not set. Please set it in your .env file or environment variables.');
    process.exit(1);
  }

  console.log(`Attempting to connect to MongoDB at ${uri}...`);
  const client = new MongoClient(uri);

  try {
    // Connect the client to the server
    await client.connect();
    console.log('Successfully connected to MongoDB server.');

    // You can also try to ping the database
    await client.db("admin").command({ ping: 1 });
    console.log("Ping successful.");

    // Example: List databases (optional, requires appropriate permissions)
    // const databasesList = await client.db().admin().listDatabases();
    // console.log("Databases:");
    // databasesList.databases.forEach(db => console.log(` - ${db.name}`));

  } catch (error) {
    console.error('Failed to connect to MongoDB or ping failed:', error);
  } finally {
    // Ensures that the client will close when you finish/error
    await client.close();
    console.log('MongoDB connection closed.');
  }
}

// Test legislation collection
async function testLegislationCollection() {
    try {
        const collection = await getCollection('legislation');
        const count = await collection.countDocuments();
        console.log(`Connected! Legislation collection has ${count} documents.`);
        // Optionally, fetch one document
        const oneDoc = await collection.findOne();
        if (oneDoc) {
            console.log('Sample document:', oneDoc);
        } else {
            console.log('No documents found in legislation collection.');
        }
    } catch (error) {
        console.error('Failed to connect to legislation collection:', error);
    }
}

// Uncomment to run the test
testLegislationCollection().then(r => console.log('Test completed.')).catch(err => console.error('Test failed:', err));

testConnection().then(() => console.log('Test completed.')).catch(err => console.error('Test failed:', err));