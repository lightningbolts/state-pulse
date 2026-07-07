import { getCollection } from '@/lib/mongodb';
import type { VoteCoverageRecord } from '@/types/voteRecord';

const COLLECTION = 'vote_coverage';

async function ensureIndex(
  col: { createIndex: (keys: Record<string, number>, options?: Record<string, unknown>) => Promise<string> },
  keys: Record<string, number>,
  options: Record<string, unknown> = {}
): Promise<void> {
  try {
    await col.createIndex(keys, options);
  } catch (error: unknown) {
    const mongoError = error as { code?: number; codeName?: string };
    if (mongoError.code === 85 || mongoError.codeName === 'IndexOptionsConflict') {
      return;
    }
    if (mongoError.code === 86 || mongoError.codeName === 'IndexKeySpecsConflict') {
      return;
    }
    throw error;
  }
}

export async function updateVoteCoverage(record: VoteCoverageRecord): Promise<void> {
  const col = await getCollection(COLLECTION) as any;
  await col.updateOne(
    { state: record.state },
    { $set: record },
    { upsert: true }
  );
}

export async function getVoteCoverage(
  state?: string
): Promise<VoteCoverageRecord[]> {
  const col = await getCollection(COLLECTION) as any;
  if (state) {
    const doc = await col.findOne({ state: state.toUpperCase() });
    return doc ? [doc] : [];
  }
  return col.find({}).toArray();
}

export interface HealthCheckResult {
  healthy: boolean;
  message: string;
}

export async function checkScrapeHealth(
  state: string,
  ingestedCount: number
): Promise<HealthCheckResult> {
  const col = await getCollection(COLLECTION) as any;
  const prior = await col.findOne({ state: state.toUpperCase() });
  const priorCount = prior?.lastVoteCount ?? 0;

  if (priorCount > 0 && ingestedCount === 0) {
    return {
      healthy: false,
      message: `Zero votes ingested for ${state} (previously ${priorCount})`,
    };
  }

  return { healthy: true, message: 'OK' };
}

export async function createVoteCoverageIndexes(): Promise<void> {
  const col = await getCollection(COLLECTION) as any;
  await ensureIndex(col, { state: 1 }, { unique: true, name: 'vote_coverage_state_idx' });
  await ensureIndex(col, { jurisdiction: 1 }, { name: 'vote_coverage_jurisdiction_idx' });
}

export async function createVotingRecordIndexes(): Promise<void> {
  const col = await getCollection('voting_records') as any;
  await ensureIndex(
    col,
    { bill_id: 1, date: -1 },
    { name: 'bill_id_date_idx', background: true }
  );
  await ensureIndex(
    col,
    { jurisdiction: 1, session: 1, organizationType: 1 },
    { name: 'jurisdiction_session_org_idx', background: true }
  );
  await ensureIndex(
    col,
    { identifier: 1 },
    { unique: true, name: 'identifier_unique_idx', background: true }
  );
}
