import { NextRequest, NextResponse } from 'next/server';
import { getBillVotingInfo } from '@/services/votingService';

export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  try {
    const { id } = await context.params;
    if (!id) {
      return NextResponse.json({ error: 'Bill ID is required' }, { status: 400 });
    }

    const votingData = await getBillVotingInfo(id);

    if (!votingData || votingData.votingRecords.length === 0) {
      return NextResponse.json(
        { error: `No voting records found for bill_id: ${id}` },
        { status: 404 }
      );
    }

    return NextResponse.json(votingData);
  } catch (error) {
    console.error('Error fetching bill voting info:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
