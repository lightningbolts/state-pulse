import { getCollection } from '@/lib/mongodb';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: 'Bill ID is required' }, { status: 400 });
    }

    const votingRecordsCollection = await getCollection('voting_records');
    // Find all voting records for this bill, sorted by date descending
    const votingRecords = await votingRecordsCollection.find({ bill_id: id }).sort({ "date": -1 }).toArray();

    if (!votingRecords || votingRecords.length === 0) {
      return NextResponse.json({ error: `No voting records found for bill_id: ${id}` }, { status: 404 });
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
    
    console.log(`Found ${votingRecords.length} total voting records for bill ${id}`);
    console.log(`Returning ${latestVotingRecords.length} most recent records (one per chamber)`);
    latestVotingRecords.forEach((record: any) => {
      console.log(`  ${record.chamber}: ${record.date} (${record.rollCallNumber})`);
    });

    // Add chamber information to each member vote and flatten the structure
    const enrichedRecords = latestVotingRecords.map((record: any) => ({
      ...record,
      memberVotes: record.memberVotes.map((vote: any) => ({
        ...vote,
        chamber: record.chamber
      }))
    }));

    // Group records by chamber (should be one record per chamber at this point)
    const recordsByChamber = enrichedRecords.reduce((acc: any, record: any) => {
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

    // Return both the individual records and the grouped structure
    return NextResponse.json({
      votingRecords: enrichedRecords,
      recordsByChamber,
      chambers: Object.keys(recordsByChamber)
    });
  } catch (error) {
    console.error('Error fetching bill voting info:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
