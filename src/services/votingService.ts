import { getCollection } from '@/lib/mongodb';
import { createDefaultRegistry } from '@/scrapers/stateVotes';
import { VoteIngestionOrchestrator } from '@/scrapers/stateVotes/orchestrator';
import { findVotingRecordsByBillId } from '@/services/votingRecordService';
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

async function getLegislationContext(billId: string) {
  const col = await getCollection('legislation');
  return col.findOne({ id: billId });
}

export async function syncStateBillVotes(billId: string): Promise<boolean> {
  const legislation = await getLegislationContext(billId);
  if (!legislation?.jurisdictionId) return false;

  const jurisdiction = String(legislation.jurisdictionId);
  const stateMatch = jurisdiction.match(/state:([a-z]{2})/i);
  if (!stateMatch) return false;

  const stateAbbr = stateMatch[1].toUpperCase();
  const registry = createDefaultRegistry();
  const orchestrator = new VoteIngestionOrchestrator({
    registry,
    states: [stateAbbr],
    sessionByState: {
      [stateAbbr]: String(legislation.session ?? new Date().getFullYear()),
    },
    openStatesApiKey: process.env.OPENSTATES_API_KEY,
  });

  await orchestrator.syncBillVotes(
    billId,
    jurisdiction,
    stateAbbr,
    legislation.identifier ? String(legislation.identifier) : undefined
  );
  return true;
}

export async function getBillVotingInfo(
  billId: string,
  options: { syncIfMissing?: boolean } = {}
) {
  try {
    if (!billId) {
      return null;
    }

    const { getCongressBillVotingInfo } = await import(
      '@/services/congressVotingRecordService'
    );
    const { isCongressBillId } = await import('@/lib/congressBillId');

    if (isCongressBillId(billId)) {
      return await getCongressBillVotingInfo(billId, options);
    }

    let votingRecords = await findVotingRecordsByBillId(billId);

    if (!votingRecords.length && options.syncIfMissing) {
      await syncStateBillVotes(billId);
      votingRecords = await findVotingRecordsByBillId(billId);
    }

    if (!votingRecords.length) {
      return null;
    }

    const records = votingRecords.map((doc: any) => {
      const { _id, ...record } = doc;
      return record as VotingRecord;
    });

    return formatBillVotingInfo(records);
  } catch (error) {
    console.error('Error fetching bill voting info:', error);
    return null;
  }
}
