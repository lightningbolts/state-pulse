import { createHash } from 'crypto';
import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
import type { Legislation } from '@/types/legislation';

dotenv.config({ path: require('path').resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB_NAME || 'statepulse-data';
const BATCH_SIZE = 50;
const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';

function buildEmbeddingText(bill: Legislation): string {
  return [bill.title, bill.geminiSummary, bill.subjects?.join(' ')]
    .filter(Boolean)
    .join(' ')
    .slice(0, 512);
}

function hashText(text: string): string {
  return createHash('md5').update(text).digest('hex');
}

async function main() {
  const limitArg = process.argv.find((a) => a.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;
  const force = process.argv.includes('--force');

  console.log(`Connecting to MongoDB: ${MONGO_URI}`);
  const client = new MongoClient(MONGO_URI);

  try {
    await client.connect();
    const collection = client.db(DB_NAME).collection<Legislation>('legislation');

    const { pipeline } = await import('@huggingface/transformers');
    const embed = await pipeline('feature-extraction', EMBEDDING_MODEL);
    console.log(`Loaded embedding model: ${EMBEDDING_MODEL}`);

    const query = force
      ? {}
      : { $or: [{ embedding: { $exists: false } }, { embedding: null }, { embedding: [] }] };

    const total = await collection.countDocuments(query);
    const processLimit = limit ?? total;
    console.log(`Bills to process: ${processLimit} of ${total}`);

    let cursor = collection.find(query).sort({ latestActionAt: -1 });
    if (limit) {
      cursor = cursor.limit(limit);
    }
    let processed = 0;
    let skipped = 0;

    while (await cursor.hasNext()) {
      const batch: Legislation[] = [];
      for (let i = 0; i < BATCH_SIZE && (await cursor.hasNext()); i++) {
        const doc = await cursor.next();
        if (doc) batch.push(doc as Legislation);
      }

      for (const bill of batch) {
        const text = buildEmbeddingText(bill);
        if (!text.trim()) {
          skipped += 1;
          continue;
        }

        const textHash = hashText(text);
        if (!force && bill.embeddingTextHash === textHash && bill.embedding?.length) {
          skipped += 1;
          continue;
        }

        const out = await embed(text, { pooling: 'mean', normalize: true });
        const vector = Array.from(out.data as Float32Array).map(
          (v) => Math.round(v * 1e5) / 1e5,
        );

        await collection.updateOne(
          { id: bill.id },
          {
            $set: {
              embedding: vector,
              embeddingModel: EMBEDDING_MODEL,
              embeddingTextHash: textHash,
            },
          },
        );

        processed += 1;
        if (processed % 25 === 0) {
          console.log(`Embedded ${processed} bills (${skipped} skipped)`);
        }
      }
    }

    console.log(`Done. Embedded ${processed} bills, skipped ${skipped}.`);
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
