import { createHash } from 'crypto';
import {
  MongoClient,
  type AnyBulkWriteOperation,
  type Filter,
  type FindCursor,
} from 'mongodb';
import dotenv from 'dotenv';
import type { Legislation } from '@/types/legislation';

dotenv.config({ path: require('path').resolve(__dirname, '../../.env') });

const MONGO_URI = process.env.MONGODB_URI || process.env.MONGO_URI || 'mongodb://localhost:27017';
const DB_NAME = process.env.MONGODB_DB_NAME || 'statepulse-data';
const DEFAULT_BATCH_SIZE = 200;
const EMBED_CHUNK_SIZE = 64;
const EMBEDDING_MODEL = 'Xenova/all-MiniLM-L6-v2';

type EmbedPipeline = (
  text: string | string[],
  options: { pooling: 'mean'; normalize: boolean },
) => Promise<{ data: Float32Array; dims: number[] }>;

function buildEmbeddingText(bill: Legislation): string {
  return [bill.title, bill.geminiSummary, bill.subjects?.join(' ')]
    .filter(Boolean)
    .join(' ')
    .slice(0, 512);
}

function hashText(text: string): string {
  return createHash('md5').update(text).digest('hex');
}

function vectorsFromOutput(out: { data: Float32Array; dims: number[] }, count: number): number[][] {
  const dim = out.dims[out.dims.length - 1];
  const flat = out.data;
  const vectors: number[][] = [];

  for (let i = 0; i < count; i++) {
    const start = i * dim;
    vectors.push(
      Array.from(flat.subarray(start, start + dim)).map((v) => Math.round(v * 1e5) / 1e5),
    );
  }

  return vectors;
}

function parseArgValue(prefix: string): number | undefined {
  const arg = process.argv.find((a) => a.startsWith(prefix));
  if (!arg) return undefined;
  const value = parseInt(arg.split('=')[1], 10);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

function parseSinceArg(): Date | undefined {
  const arg = process.argv.find((a) => a.startsWith('--since='));
  if (!arg) return undefined;
  const value = new Date(arg.split('=')[1]);
  return Number.isNaN(value.getTime()) ? undefined : value;
}

function parseShardArg(): { shardIndex: number; shardCount: number } | undefined {
  const arg = process.argv.find((a) => a.startsWith('--shard='));
  if (!arg) return undefined;
  const [indexRaw, countRaw] = arg.split('=')[1].split('/');
  const shardIndex = parseInt(indexRaw, 10);
  const shardCount = parseInt(countRaw, 10);
  if (
    !Number.isFinite(shardIndex) ||
    !Number.isFinite(shardCount) ||
    shardCount < 2 ||
    shardIndex < 0 ||
    shardIndex >= shardCount
  ) {
    throw new Error('Invalid --shard value. Use --shard=0/4 (index/count).');
  }
  return { shardIndex, shardCount };
}

function missingEmbeddingFilter(): Filter<Legislation> {
  return { $or: [{ embedding: { $exists: false } }, { embedding: null }, { embedding: [] }] };
}

function buildQuery(options: {
  force: boolean;
  withSummaryOnly: boolean;
  since?: Date;
  jurisdictions?: string[];
}): Filter<Legislation> {
  const conditions: Filter<Legislation>[] = [];

  if (!options.force) {
    conditions.push(missingEmbeddingFilter());
  }

  if (options.withSummaryOnly) {
    conditions.push({ geminiSummary: { $exists: true, $nin: [null, ''] } });
  }

  if (options.since) {
    conditions.push({ latestActionAt: { $gte: options.since } });
  }

  if (options.jurisdictions?.length) {
    conditions.push({ jurisdictionName: { $in: options.jurisdictions } });
  }

  if (conditions.length === 0) return {};
  if (conditions.length === 1) return conditions[0];
  return { $and: conditions };
}

async function embedChunk(
  embed: EmbedPipeline,
  items: { bill: Legislation; text: string; textHash: string }[],
): Promise<AnyBulkWriteOperation<Legislation>[]> {
  if (items.length === 0) return [];

  const texts = items.map((item) => item.text);
  const out = await embed(texts, { pooling: 'mean', normalize: true });
  const vectors = vectorsFromOutput(out, items.length);

  return items.map((item, index) => ({
    updateOne: {
      filter: { id: item.bill.id },
      update: {
        $set: {
          embedding: vectors[index],
          embeddingModel: EMBEDDING_MODEL,
          embeddingTextHash: item.textHash,
        },
      },
    },
  }));
}

async function processBatch(
  embed: EmbedPipeline,
  bills: Legislation[],
  force: boolean,
): Promise<{ operations: AnyBulkWriteOperation<Legislation>[]; skipped: number }> {
  const toEmbed: { bill: Legislation; text: string; textHash: string }[] = [];
  let skipped = 0;

  for (const bill of bills) {
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

    toEmbed.push({ bill, text, textHash });
  }

  const operations: AnyBulkWriteOperation<Legislation>[] = [];
  for (let i = 0; i < toEmbed.length; i += EMBED_CHUNK_SIZE) {
    const chunk = toEmbed.slice(i, i + EMBED_CHUNK_SIZE);
    operations.push(...(await embedChunk(embed, chunk)));
  }

  return { operations, skipped };
}

async function readBatch(
  cursor: FindCursor<Legislation>,
  batchSize: number,
): Promise<Legislation[]> {
  const batch: Legislation[] = [];
  for (let i = 0; i < batchSize && (await cursor.hasNext()); i++) {
    const doc = await cursor.next();
    if (doc) batch.push(doc);
  }
  return batch;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
}

async function resolveShardJurisdictions(
  collection: ReturnType<MongoClient['db']>['collection'],
  baseQuery: Filter<Legislation>,
  shardIndex: number,
  shardCount: number,
): Promise<string[]> {
  const jurisdictions = await collection.distinct('jurisdictionName', baseQuery);
  return jurisdictions
    .filter((name): name is string => typeof name === 'string' && name.length > 0)
    .sort((a, b) => a.localeCompare(b))
    .filter((_, index) => index % shardCount === shardIndex);
}

async function main() {
  const fast = process.argv.includes('--fast');
  const limit = parseArgValue('--limit=');
  const batchSize = parseArgValue('--batch-size=') ?? DEFAULT_BATCH_SIZE;
  const force = process.argv.includes('--force');
  const withSummaryOnly = fast || process.argv.includes('--with-summary-only');
  const since = fast ? new Date('2023-01-01') : parseSinceArg();
  const shard = parseShardArg();

  console.log(`Connecting to MongoDB: ${MONGO_URI}`);
  const client = new MongoClient(MONGO_URI);
  const startedAt = Date.now();

  try {
    await client.connect();
    const collection = client.db(DB_NAME).collection<Legislation>('legislation');

    const baseQuery = buildQuery({ force, withSummaryOnly, since });
    let query = baseQuery;

    if (shard) {
      const jurisdictions = await resolveShardJurisdictions(
        collection,
        baseQuery,
        shard.shardIndex,
        shard.shardCount,
      );
      query = buildQuery({ force, withSummaryOnly, since, jurisdictions });
      console.log(
        `Shard ${shard.shardIndex + 1}/${shard.shardCount}: ${jurisdictions.length} jurisdictions`,
      );
    }

    const { pipeline } = await import('@huggingface/transformers');
    const embed = (await pipeline('feature-extraction', EMBEDDING_MODEL)) as EmbedPipeline;
    console.log(`Loaded embedding model: ${EMBEDDING_MODEL}`);
    console.log(`Batch size: ${batchSize}, embed chunk: ${EMBED_CHUNK_SIZE}`);
    if (withSummaryOnly) console.log('Filter: bills with geminiSummary only');
    if (since) console.log(`Filter: latestActionAt >= ${since.toISOString().slice(0, 10)}`);
    if (fast) {
      console.log(
        'Fast mode: recent bills with AI summaries (~94k vs ~393k). Use no flags for full backfill.',
      );
    }

    const total = await collection.countDocuments(query);
    const processLimit = limit ?? total;
    console.log(`Bills to process: ${processLimit} of ${total}`);

    const cursor = collection.find(query).sort({ latestActionAt: -1 }).batchSize(batchSize);
    const limitedCursor = limit ? cursor.limit(limit) : cursor;

    let processed = 0;
    let skipped = 0;
    let pendingWrite: Promise<void> = Promise.resolve();
    let batch = await readBatch(limitedCursor, batchSize);

    while (batch.length > 0) {
      const nextBatchPromise = readBatch(limitedCursor, batchSize);
      const { operations, skipped: batchSkipped } = await processBatch(embed, batch, force);
      skipped += batchSkipped;

      await pendingWrite;
      if (operations.length > 0) {
        processed += operations.length;
        pendingWrite = collection
          .bulkWrite(operations, { ordered: false })
          .then(() => undefined);
      } else {
        pendingWrite = Promise.resolve();
      }

      if (processed > 0 && processed % 200 < batchSize) {
        const elapsedSec = (Date.now() - startedAt) / 1000;
        const rate = processed / elapsedSec;
        const remaining = processLimit - processed;
        const etaSec = rate > 0 ? remaining / rate : 0;
        console.log(
          `Embedded ${processed}/${processLimit} (${skipped} skipped) — ${rate.toFixed(1)}/s, ETA ${formatDuration(etaSec)}`,
        );
      }

      batch = await nextBatchPromise;
    }

    await pendingWrite;

    const elapsedSec = (Date.now() - startedAt) / 1000;
    const rate = processed > 0 ? processed / elapsedSec : 0;
    console.log(
      `Done. Embedded ${processed} bills, skipped ${skipped} in ${formatDuration(elapsedSec)} (${rate.toFixed(1)}/s).`,
    );
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
