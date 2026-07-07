import { parseStringPromise } from 'xml2js';
import pLimit from 'p-limit';
import {
  buildCongressBillId,
  isCongressBillId,
  legislationTypeVariants,
  normalizeLegislationType,
  parseCongressBillId,
} from '@/lib/congressBillId';
import { getCollection } from '@/lib/mongodb';
import { upsertVotingRecord } from '@/services/votingRecordService';
import type { MemberVote, VotingRecord } from '@/types/legislation';

const CONGRESS_API_BASE = 'https://api.congress.gov/v3';
const API_KEY = process.env.US_CONGRESS_API_KEY || '';

interface RecordedVoteRef {
  chamber: 'House' | 'Senate';
  congress: number;
  sessionNumber: number;
  rollNumber: number;
  date: string;
  voteQuestion?: string;
  result?: string;
}

export interface BillVotingInfo {
  votingRecords: VotingRecord[];
  recordsByChamber: Record<string, VotingRecord[]>;
  chambers: string[];
}

function getCongressApiKey(): string {
  if (!API_KEY) {
    throw new Error('US_CONGRESS_API_KEY is not configured');
  }
  return API_KEY;
}

async function congressFetch<T>(path: string): Promise<T> {
  const separator = path.includes('?') ? '&' : '?';
  const response = await fetch(
    `${CONGRESS_API_BASE}${path}${separator}api_key=${getCongressApiKey()}`,
    { next: { revalidate: 3600 } }
  );

  if (!response.ok) {
    throw new Error(`Congress.gov API error ${response.status} for ${path}`);
  }

  return response.json() as Promise<T>;
}

function isValidBillId(billId?: string | null): billId is string {
  return !!billId && !billId.includes('undefined');
}

function buildBillLookupFilter(billId: string): Record<string, unknown> {
  const parsed = parseCongressBillId(billId);
  if (!parsed) {
    return { bill_id: billId };
  }

  return {
    $and: [
      {
        $or: [
          { bill_id: buildCongressBillId(parsed.congress, parsed.type, parsed.number) },
          {
            congress: parsed.congress,
            legislationNumber: parsed.number,
            legislationType: { $in: legislationTypeVariants(parsed.type) },
          },
        ],
      },
      { bill_id: { $not: /undefined/ } },
      { legislationNumber: { $nin: [null, '', undefined] } },
      { legislationType: { $nin: [null, '', undefined] } },
    ],
  };
}

async function fetchBillRecordedVotes(
  congress: number,
  type: string,
  number: string
): Promise<RecordedVoteRef[]> {
  const votesByKey = new Map<string, RecordedVoteRef>();
  let offset = 0;
  const limit = 250;
  let hasMore = true;

  while (hasMore) {
    const data = await congressFetch<{
      actions?: Array<{
        text?: string;
        recordedVotes?: Array<{
          chamber?: string;
          congress?: number;
          sessionNumber?: number;
          rollNumber?: number;
          date?: string;
        }>;
      }>;
      pagination?: { next?: string };
    }>(`/bill/${congress}/${type}/${number}/actions?limit=${limit}&offset=${offset}`);

    for (const action of data.actions || []) {
      for (const vote of action.recordedVotes || []) {
        if (!vote.chamber || !vote.rollNumber || !vote.sessionNumber) continue;

        const chamber = vote.chamber === 'Senate' ? 'Senate' : 'House';
        const key = `${chamber}-${vote.rollNumber}`;
        if (!votesByKey.has(key)) {
          votesByKey.set(key, {
            chamber,
            congress: vote.congress || congress,
            sessionNumber: vote.sessionNumber,
            rollNumber: vote.rollNumber,
            date: vote.date || '',
            voteQuestion: action.text,
          });
        }
      }
    }

    hasMore = !!data.pagination?.next;
    offset += limit;
    if ((data.actions || []).length === 0) {
      hasMore = false;
    }
  }

  return Array.from(votesByKey.values()).sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
}

async function fetchHouseVotingRecord(
  vote: RecordedVoteRef,
  billId: string,
  legislationType: string,
  legislationNumber: string
): Promise<VotingRecord | null> {
  const [voteData, memberData] = await Promise.all([
    congressFetch<{ houseRollCallVote?: any }>(
      `/house-vote/${vote.congress}/${vote.sessionNumber}/${vote.rollNumber}`
    ),
    congressFetch<{ houseRollCallVoteMemberVotes?: { results?: any[] } }>(
      `/house-vote/${vote.congress}/${vote.sessionNumber}/${vote.rollNumber}/members?limit=250`
    ),
  ]);

  const houseVote = voteData.houseRollCallVote;
  if (!houseVote) return null;

  const memberVotes: MemberVote[] = (memberData.houseRollCallVoteMemberVotes?.results || []).map(
    (item) => ({
      bioguideId: item.bioguideID || '',
      firstName: item.firstName || '',
      lastName: item.lastName || '',
      voteCast: item.voteCast || '',
      voteParty: item.voteParty || '',
      voteState: item.voteState || '',
    })
  );

  const resolvedType = normalizeLegislationType(houseVote.legislationType || legislationType);
  const resolvedNumber = String(houseVote.legislationNumber || legislationNumber);
  const resolvedBillId = isValidBillId(buildCongressBillId(vote.congress, resolvedType, resolvedNumber))
    ? buildCongressBillId(vote.congress, resolvedType, resolvedNumber)
    : billId;

  return {
    identifier: String(houseVote.identifier || `house-${vote.congress}-${vote.rollNumber}`),
    rollCallNumber: vote.rollNumber,
    legislationType: resolvedType.toUpperCase(),
    legislationNumber: resolvedNumber,
    bill_id: resolvedBillId,
    voteQuestion: houseVote.voteQuestion || vote.voteQuestion || '',
    result: houseVote.result || vote.result || '',
    date: houseVote.startDate || vote.date,
    memberVotes,
    congress: vote.congress,
    session: vote.sessionNumber,
    chamber: 'US House',
  };
}

async function fetchSenateVotingRecord(
  vote: RecordedVoteRef,
  billId: string,
  legislationType: string,
  legislationNumber: string
): Promise<VotingRecord | null> {
  const paddedRoll = String(vote.rollNumber).padStart(5, '0');
  const url = `https://www.senate.gov/legislative/LIS/roll_call_votes/vote${vote.congress}${vote.sessionNumber}/vote_${vote.congress}_${vote.sessionNumber}_${paddedRoll}.xml`;

  const response = await fetch(url, {
    headers: { 'User-Agent': 'StatePulse/1.0 (https://www.statepulse.me)' },
    next: { revalidate: 3600 },
  });

  if (!response.ok) {
    throw new Error(`Senate vote XML error ${response.status} for roll ${vote.rollNumber}`);
  }

  const xml = await response.text();
  const parsed = await parseStringPromise(xml, { explicitArray: false, trim: true });
  const rollCall = parsed.roll_call_vote;
  if (!rollCall) return null;

  const membersRaw = rollCall.members?.member;
  const members = Array.isArray(membersRaw) ? membersRaw : membersRaw ? [membersRaw] : [];

  const memberVotes: MemberVote[] = members.map((member: any) => ({
    bioguideId: '',
    firstName: member.first_name || '',
    lastName: member.last_name || '',
    voteCast: member.vote_cast || '',
    voteParty: member.party || '',
    voteState: member.state || '',
  }));

  const voteQuestion = rollCall.vote_question_text || vote.voteQuestion || '';
  const result = rollCall.vote_result_text || vote.result || '';

  let resolvedType = legislationType;
  let resolvedNumber = legislationNumber;
  const measureMatch = String(rollCall.vote_document_text || voteQuestion).match(
    /\b([HS]\.?\s?(?:J\.?\s?)?(?:Con\.?\s?)?Res\.?|HR|S)\s*\.?\s*(\d+)\b/i
  );
  if (measureMatch) {
    resolvedType = normalizeLegislationType(measureMatch[1]);
    resolvedNumber = measureMatch[2];
  }

  return {
    identifier: `senate-${vote.congress}-${vote.rollNumber}`,
    rollCallNumber: vote.rollNumber,
    legislationType: resolvedType.toUpperCase(),
    legislationNumber: resolvedNumber,
    bill_id: buildCongressBillId(vote.congress, resolvedType, resolvedNumber) || billId,
    voteQuestion,
    result,
    date: vote.date || new Date().toISOString(),
    memberVotes,
    congress: vote.congress,
    session: vote.sessionNumber,
    chamber: 'US Senate',
  };
}

async function syncCongressBillVotingRecords(billId: string): Promise<VotingRecord[]> {
  const parsed = parseCongressBillId(billId);
  if (!parsed || !API_KEY) return [];

  const recordedVotes = await fetchBillRecordedVotes(parsed.congress, parsed.type, parsed.number);
  if (recordedVotes.length === 0) return [];

  const limit = pLimit(3);
  const upserted: VotingRecord[] = [];

  await Promise.all(
    recordedVotes.map((vote) =>
      limit(async () => {
        try {
          const record =
            vote.chamber === 'House'
              ? await fetchHouseVotingRecord(
                  vote,
                  billId,
                  parsed.type,
                  parsed.number
                )
              : await fetchSenateVotingRecord(
                  vote,
                  billId,
                  parsed.type,
                  parsed.number
                );

          if (!record || record.memberVotes.length === 0) return;

          if (!isValidBillId(record.bill_id)) {
            record.bill_id = billId;
          }

          await upsertVotingRecord(record);
          upserted.push(record);
        } catch (error) {
          console.error(
            `Failed to sync ${vote.chamber} roll call ${vote.rollNumber} for ${billId}:`,
            error
          );
        }
      })
    )
  );

  return upserted;
}

async function findVotingRecordsForBill(billId: string): Promise<VotingRecord[]> {
  const collection = await getCollection('voting_records');
  const records = await collection
    .find(buildBillLookupFilter(billId))
    .sort({ date: -1 })
    .toArray();

  return records.map((doc) => {
    const { _id, ...record } = doc;
    return record as VotingRecord;
  });
}

function formatBillVotingInfo(records: VotingRecord[]): BillVotingInfo | null {
  if (!records.length) return null;

  const mostRecentVotes: Record<string, VotingRecord> = {};
  for (const record of records) {
    const chamber = record.chamber || 'Unknown';
    if (!mostRecentVotes[chamber]) {
      mostRecentVotes[chamber] = record;
    }
  }

  const latestVotingRecords = Object.values(mostRecentVotes).map((record) => ({
    ...record,
    memberVotes: record.memberVotes.map((vote) => ({
      ...vote,
      chamber: record.chamber,
    })),
  }));

  const recordsByChamber = latestVotingRecords.reduce<Record<string, VotingRecord[]>>(
    (acc, record) => {
      const chamber = record.chamber || 'Unknown';
      acc[chamber] = [record];
      return acc;
    },
    {}
  );

  return {
    votingRecords: latestVotingRecords,
    recordsByChamber,
    chambers: Object.keys(recordsByChamber),
  };
}

export async function getCongressBillVotingInfo(billId: string): Promise<BillVotingInfo | null> {
  if (!isCongressBillId(billId)) {
    return null;
  }

  let records = await findVotingRecordsForBill(billId);

  if (records.length === 0 && API_KEY) {
    await syncCongressBillVotingRecords(billId);
    records = await findVotingRecordsForBill(billId);
  }

  return formatBillVotingInfo(records);
}
