import { VotingRecord } from '@/types/legislation';
import { getCollection } from '@/lib/mongodb';

const COLLECTION_NAME = 'voting_records';

export async function upsertVotingRecord(record: VotingRecord) {
  const col = await getCollection(COLLECTION_NAME) as any;
  await col.updateOne(
    { identifier: record.identifier },
    { $set: record },
    { upsert: true }
  );
}

export async function findVotingRecord(identifier: string): Promise<VotingRecord | null> {
  const col = await getCollection(COLLECTION_NAME) as any;
  return col.findOne({ identifier });
}

export async function getAllVotingRecords(): Promise<VotingRecord[]> {
  const col = await getCollection(COLLECTION_NAME) as any;
  return col.find({}).toArray();
}
