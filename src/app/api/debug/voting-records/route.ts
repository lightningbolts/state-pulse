import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const representativeId = searchParams.get('repId');
    
    if (!representativeId) {
      return NextResponse.json({ error: 'Representative ID required' }, { status: 400 });
    }

    const votingRecordsCollection = await getCollection('voting_records');
    
    // Get total count for this representative
    const totalCount = await votingRecordsCollection.countDocuments({
      'memberVotes.bioguideId': representativeId
    });
    
    // Get count with undefined bill_ids
    const undefinedCount = await votingRecordsCollection.countDocuments({
      'memberVotes.bioguideId': representativeId,
      bill_id: /undefined/
    });
    
    // Get count with valid bill_ids
    const validBillCount = await votingRecordsCollection.countDocuments({
      'memberVotes.bioguideId': representativeId,
      bill_id: { 
        $not: /undefined/, 
        $exists: true, 
        $ne: null 
      }
    });
    
    // Get sample bill_ids
    const sampleRecords = await votingRecordsCollection.find({
      'memberVotes.bioguideId': representativeId
    }).project({ bill_id: 1, date: 1, voteQuestion: 1 }).limit(10).toArray();
    
    // Get date range
    const dateRange = await votingRecordsCollection.aggregate([
      { $match: { 'memberVotes.bioguideId': representativeId } },
      { $group: { 
        _id: null, 
        minDate: { $min: '$date' }, 
        maxDate: { $max: '$date' } 
      } }
    ]).toArray();
    
    return NextResponse.json({
      representativeId,
      totalCount,
      undefinedCount,
      validBillCount,
      dateRange: dateRange[0] || null,
      sampleRecords
    });
    
  } catch (error) {
    console.error('Error in debug endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
