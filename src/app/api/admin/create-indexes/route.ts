import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';

export async function GET(request: NextRequest) {
  return await createIndexes();
}

export async function POST(request: NextRequest) {
  return await createIndexes();
}

async function createIndexes() {
  try {
    const { db } = await connectToDatabase();

    console.log('Creating indexes for map data optimization...');

    // Index for jurisdictionName (most important for grouping)
    const index1 = await db.collection('legislation').createIndex(
      { jurisdictionName: 1 },
      { background: true, name: 'jurisdiction_name_idx' }
    );

    // Compound index for jurisdictionName and latestActionAt (for recent activity queries)
    const index2 = await db.collection('legislation').createIndex(
      { jurisdictionName: 1, latestActionAt: -1 },
      { background: true, name: 'jurisdiction_latest_action_idx' }
    );

    // Index for latestActionAt (for date-based filtering)
    const index3 = await db.collection('legislation').createIndex(
      { latestActionAt: -1 },
      { background: true, name: 'latest_action_idx' }
    );

    // Index for createdAt (default feed sort)
    const index4 = await db.collection('legislation').createIndex(
      { createdAt: -1 },
      { background: true, name: 'created_at_idx' }
    );

    // Compound index for feed pagination with jurisdiction filter
    const index5 = await db.collection('legislation').createIndex(
      { jurisdictionName: 1, createdAt: -1 },
      { background: true, name: 'jurisdiction_created_at_idx' }
    );

    // Index for voting record bill lookups
    const index6 = await db.collection('voting_records').createIndex(
      { bill_id: 1, date: -1 },
      { background: true, name: 'bill_id_date_idx' }
    );

    const index7 = await db.collection('voting_records').createIndex(
      { congress: 1, legislationType: 1, legislationNumber: 1, date: -1 },
      { background: true, name: 'congress_legislation_vote_idx' }
    );

    // List all indexes to verify
    const indexes = await db.collection('legislation').listIndexes().toArray();

    return NextResponse.json({
      success: true,
      message: 'Indexes created successfully',
      createdIndexes: [index1, index2, index3, index4, index5, index6, index7],
      allIndexes: indexes.map(idx => ({ name: idx.name, key: idx.key }))
    });

  } catch (error) {
    console.error('Error creating indexes:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create indexes',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
