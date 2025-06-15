import { getCollection } from '../lib/mongodb';
import { ai } from '../ai/genkit';

async function generateSummary(text: string): Promise<string> {
  // Use Gemini to generate a ~100-word summary
  const prompt = `Summarize the following legislation in about 100 words, focusing on the main points and impact.\n\n${text}`;
  const response = await ai.generate({ prompt });
  return response.text.trim();
}

async function main() {
  const collection = await getCollection('legislation');
  const batchSize = 50;
  let lastId = undefined;
  let count = 0;

  while (true) {
    // Build query for pagination
    const query = lastId ? { _id: { $gt: lastId } } : {};
    // Only fetch docs that need a summary
    const docs = await collection
      .find({ ...query, geminiSummary: { $exists: false } })
      .sort({ _id: 1 })
      .limit(batchSize)
      .toArray();
    if (docs.length === 0) break;
    for (const doc of docs) {
      const text = doc.text || doc.body || doc.title || '';
      if (!text) continue;
      try {
        const summary = await generateSummary(text);
        await collection.updateOne(
          { _id: doc._id },
          { $set: { geminiSummary: summary } }
        );
        count++;
        console.log(`Updated legislation ${doc._id}`);
      } catch (err) {
        console.error(`Failed to summarize ${doc._id}:`, err);
      }
      lastId = doc._id;
    }
  }
  console.log(`Done. Updated ${count} documents.`);
}

main().catch((err) => {
  console.error('Script failed:', err);
  process.exit(1);
});
