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

    // List all indexes to verify
    const indexes = await db.collection('legislation').listIndexes().toArray();

    return NextResponse.json({
      success: true,
      message: 'Indexes created successfully',
      createdIndexes: [index1, index2, index3],
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
