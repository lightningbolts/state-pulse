import { NextRequest, NextResponse } from 'next/server';
import { getCollection } from '@/lib/mongodb';

interface SearchBillsRequest {
  query: string;
  userLocation?: {
    state?: string;
    city?: string;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body: SearchBillsRequest = await request.json();
    const { query, userLocation } = body;

    console.log('Received search request:', { query, userLocation });

    if (!query || query.trim().length < 2) {
      return NextResponse.json(
        { error: 'Search query must be at least 2 characters' },
        { status: 400 }
      );
    }

    console.log('Attempting to connect to legislation collection...');
    const legislationCollection = await getCollection('legislation');
    console.log('Successfully connected to legislation collection');

    // Build comprehensive search criteria
    const baseSearchCriteria = {
      $or: [
        { title: { $regex: query, $options: 'i' } },
        { identifier: { $regex: query, $options: 'i' } },
        { summary: { $regex: query, $options: 'i' } },
        { geminiSummary: { $regex: query, $options: 'i' } },
        { subjects: { $regex: query, $options: 'i' } },
        { classification: { $regex: query, $options: 'i' } },
        { latestActionDescription: { $regex: query, $options: 'i' } },
        { statusText: { $regex: query, $options: 'i' } },
        { fullText: { $regex: query, $options: 'i' } },
        // Add sponsor search functionality
        { 'sponsors.name': { $regex: query, $options: 'i' } },
        { 'sponsors.classification': { $regex: query, $options: 'i' } }
      ]
    };

    // If user location is provided, add state filtering
    let searchCriteria = baseSearchCriteria;
    if (userLocation?.state) {
      searchCriteria = {
        $and: [
          baseSearchCriteria,
          {
            $or: [
              { jurisdictionName: { $regex: userLocation.state, $options: 'i' } },
              { jurisdictionId: { $regex: userLocation.state, $options: 'i' } }
            ]
          }
        ]
      };
    }

    console.log('Executing database query for query:', query);

    // Search bills in the database
    const bills = await legislationCollection
      .find(searchCriteria)
      .project({
        _id: 1,
        id: 1,
        identifier: 1,
        title: 1,
        subjects: 1,
        classification: 1,
        jurisdictionName: 1,
        latestActionDescription: 1,
        latestActionAt: 1,
        summary: 1,
        geminiSummary: 1,
        statusText: 1,
        sponsors: 1,
        chamber: 1
      })
      .limit(10)
      .sort({ latestActionAt: -1 })
      .toArray();

    console.log(`Found ${bills.length} bills for query: "${query}"`);

    // Format the results for the frontend
    const formattedBills = bills.map(bill => {
      // Extract sponsor names for display
      const sponsorNames = bill.sponsors && Array.isArray(bill.sponsors)
        ? bill.sponsors.map((sponsor: any) => sponsor.name || sponsor).filter(Boolean)
        : [];

      return {
        id: bill.id || bill._id.toString(),
        identifier: bill.identifier || 'No ID',
        title: bill.title || 'Untitled Bill',
        subject: bill.subjects || [],
        classification: bill.classification || [],
        from_organization: {
          name: bill.jurisdictionName || 'Unknown'
        },
        latest_action_description: bill.latestActionDescription || 'No recent action',
        latest_action_date: bill.latestActionAt
          ? new Date(bill.latestActionAt).toISOString().split('T')[0]
          : 'Unknown',
        abstract: bill.geminiSummary || bill.summary || 'No summary available',
        sponsors: sponsorNames,
        chamber: bill.chamber || 'Unknown'
      };
    });

    console.log('Returning formatted results:', formattedBills.length);

    return NextResponse.json({
      bills: formattedBills,
      count: formattedBills.length,
      query: query,
      userLocation: userLocation
    });

  } catch (error) {
    console.error('Error searching bills:', error);
    return NextResponse.json(
      {
        error: 'Failed to search bills',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
