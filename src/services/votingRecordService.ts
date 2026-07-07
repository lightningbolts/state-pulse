import { getCollection } from '@/lib/mongodb';
import type { CanonicalVoteRecord, VoteCoverageRecord } from '@/types/voteRecord';
import { voteOptionToDisplay } from '@/types/voteRecord';
import type { MemberVote, VotingRecord } from '@/types/legislation';

const COVERAGE_COLLECTION = 'vote_coverage';

export interface StateVotingRecord extends VotingRecord {
  id?: string;
  jurisdiction?: string;
  organization?: string;
  organizationType?: 'chamber' | 'committee';
  pendingBillLink?: string;
  counts?: { option: string; value: number }[];
  sources?: { url: string; note?: string }[];
  provenance?: {
    adapter: string;
    scrapedAt: string;
    rawHash?: string;
  };
  motionClassification?: string[];
}

function splitName(fullName: string): { firstName: string; lastName: string } {
  if (fullName.includes(',')) {
    const [last, first] = fullName.split(',').map((s) => s.trim());
    return { firstName: first?.split(/\s/)[0] ?? '', lastName: last ?? '' };
  }
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: '', lastName: parts[0] };
  return { firstName: parts[0], lastName: parts[parts.length - 1] };
}

function chamberToDisplay(chamber: string, organization?: string): string {
  if (organization && organization !== 'House' && organization !== 'Senate') {
    return organization;
  }
  switch (chamber) {
    case 'upper':
      return 'Senate';
    case 'lower':
      return 'House';
    case 'unicameral':
      return organization ?? 'Legislature';
    default:
      return organization ?? chamber;
  }
}

export function canonicalToStorageRecord(
  record: CanonicalVoteRecord
): StateVotingRecord {
  const [legType, legNum] = parseBillIdentifier(record.billIdentifier);

  const memberVotes: MemberVote[] = record.memberVotes.map((mv) => {
    const { firstName, lastName } = splitName(mv.name);
    return {
      bioguideId: mv.personId ?? mv.externalId ?? '',
      personId: mv.personId,
      firstName,
      lastName,
      name: mv.name,
      voteCast: voteOptionToDisplay(mv.option),
      voteParty: mv.party ?? '',
      voteState: '',
    } as MemberVote & { personId?: string; name?: string };
  });

  return {
    identifier: record.identifier,
    id: record.id,
    bill_id: record.bill_id,
    pendingBillLink: record.pendingBillLink,
    jurisdiction: record.jurisdiction,
    rollCallNumber: record.rollCallNumber
      ? parseInt(record.rollCallNumber, 10) || 0
      : 0,
    legislationType: legType,
    legislationNumber: legNum,
    voteQuestion: record.motionText,
    result: record.result === 'pass' ? 'Passed' : record.result === 'fail' ? 'Failed' : 'Unknown',
    date: record.date,
    memberVotes,
    congress: 0,
    session: parseInt(record.session, 10) || 0,
    chamber: chamberToDisplay(record.chamber, record.organization) as VotingRecord['chamber'] | string,
    organization: record.organization,
    organizationType: record.organizationType,
    counts: record.counts,
    sources: record.sources,
    provenance: record.provenance,
    motionClassification: record.motionClassification,
  } as StateVotingRecord;
}

function parseBillIdentifier(identifier?: string): [string, string] {
  if (!identifier) return ['', ''];
  const match = identifier.match(/^([A-Za-z.]+)\s*(\d+)/);
  if (match) return [match[1].toUpperCase(), match[2]];
  return ['', identifier];
}

export async function upsertStateVotingRecord(record: StateVotingRecord) {
  const col = await getCollection('voting_records') as any;
  await col.updateOne(
    { identifier: record.identifier },
    { $set: record },
    { upsert: true }
  );
}

export async function upsertVotingRecord(record: VotingRecord) {
  const col = await getCollection('voting_records') as any;
  await col.updateOne(
    { identifier: record.identifier },
    { $set: record },
    { upsert: true }
  );
}

export async function findVotingRecord(identifier: string): Promise<VotingRecord | null> {
  const col = await getCollection('voting_records') as any;
  return col.findOne({ identifier });
}

export async function getAllVotingRecords(): Promise<VotingRecord[]> {
  const col = await getCollection('voting_records') as any;
  return col.find({}).toArray();
}

export async function findVotingRecordsByBillId(billId: string) {
  const col = await getCollection('voting_records') as any;
  return col.find({ bill_id: billId }).sort({ date: -1 }).toArray();
}
