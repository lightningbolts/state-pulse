import { getCollection } from '@/lib/mongodb';

export async function getBillVotingInfo(billId: string) {
  try {
    if (!billId) {
      return null;
    }

    const votingRecordsCollection = await getCollection('voting_records');
    // Find all voting records for this bill, sorted by date descending
    const votingRecords = await votingRecordsCollection.find({ bill_id: billId }).sort({ "date": -1 }).toArray();

    if (!votingRecords || votingRecords.length === 0) {
      return null;
    }

    // Get the most recent vote for each chamber
    const mostRecentVotes: { [key: string]: any } = {};
    votingRecords.forEach((record: any) => {
      const chamber = record.chamber;
      // Only keep the most recent vote for each chamber (first one due to date desc sort)
      if (!mostRecentVotes[chamber]) {
        mostRecentVotes[chamber] = record;
      }
    });
    
    // Convert to array and ensure we only have one record per chamber
    const latestVotingRecords = Object.values(mostRecentVotes);

    // Serialize the records to plain objects (remove MongoDB ObjectId and other non-serializable fields)
    const serializedRecords = latestVotingRecords.map((record: any) => {
      const serialized = JSON.parse(JSON.stringify(record));
      return {
        ...serialized,
        memberVotes: serialized.memberVotes.map((vote: any) => ({
          ...vote,
          chamber: record.chamber
        }))
      };
    });

    // Group records by chamber (should be one record per chamber at this point)
    const recordsByChamber = serializedRecords.reduce((acc: any, record: any) => {
      const chamber = record.chamber || 'Unknown';
      if (!acc[chamber]) {
        acc[chamber] = [];
      }
      acc[chamber].push(record);
      return acc;
    }, {});

    // Verify we have only one record per chamber
    Object.keys(recordsByChamber).forEach(chamber => {
      if (recordsByChamber[chamber].length > 1) {
        console.warn(`Warning: Multiple records found for chamber ${chamber}, this should not happen`);
        // Keep only the first (most recent) record
        recordsByChamber[chamber] = [recordsByChamber[chamber][0]];
      }
    });

    // Return the same structure as the API
    return {
      votingRecords: serializedRecords,
      recordsByChamber,
      chambers: Object.keys(recordsByChamber)
    };
  } catch (error) {
    console.error('Error fetching bill voting info:', error);
    return null;
  }
}
