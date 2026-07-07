import { getCongressBillVotingInfo } from '@/services/congressVotingRecordService';
import { getCollection } from '@/lib/mongodb';
import { isCongressBillId } from '@/lib/congressBillId';
import type { VotingRecord } from '@/types/legislation';

function formatBillVotingInfo(records: VotingRecord[]) {
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

export async function getBillVotingInfo(
  billId: string,
  options: { syncIfMissing?: boolean } = {}
) {
  try {
    if (!billId) {
      return null;
    }

    if (isCongressBillId(billId)) {
      return await getCongressBillVotingInfo(billId, options);
    }

    const votingRecordsCollection = await getCollection('voting_records');
    const votingRecords = await votingRecordsCollection
      .find({ bill_id: billId })
      .sort({ date: -1 })
      .toArray();

    if (!votingRecords.length) {
      return null;
    }

    const records = votingRecords.map((doc) => {
      const { _id, ...record } = doc;
      return record as VotingRecord;
    });

    return formatBillVotingInfo(records);
  } catch (error) {
    console.error('Error fetching bill voting info:', error);
    return null;
  }
}
