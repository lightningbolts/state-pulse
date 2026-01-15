import { config } from 'dotenv';
import path from 'path';
import { connectToDatabase, getCollection } from '@/lib/mongodb';

config({ path: path.resolve(__dirname, '../../.env') });

const TARGET_PHRASES = [
  'code of ethics',
  'zoom',
  'general assembly',
  'bill status inquiry',
  'unicameral legislature',
  'Desert Regional Center',
  'capital improvement program',
  '89th legislature',
  'Texas Senate',
    'Iowa Senate',
    'Iowa House of Representatives',
    'Senate Journal',
    'House Journal',
    'Colorado General Assembly',
    'Minnesota House of Representatives',
    'This document outlines the legislative process in Kansas',
    'Kansas Legislature'
];

async function removeUnwantedSummaries() {
  await connectToDatabase();
  const legislationCollection = await getCollection('legislation');

  // Build regex for case-insensitive search
  const regex = new RegExp(TARGET_PHRASES.join('|'), 'i');

  // Find all matching documents
  const query = {
    $or: [
      { geminiSummary: { $regex: regex } }
    ],
  };

  // Update matching documents
  const update = {
    $set: { geminiSummary: null, summary: null },
  };

  const result = await legislationCollection.updateMany(query, update);
  console.log(`Updated ${result.modifiedCount} documents to remove unwanted summaries.`);
}

removeUnwantedSummaries()
  .then(() => {
    console.log('Script finished successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Script failed:', err);
    process.exit(1);
  });
