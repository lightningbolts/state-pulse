import { NextResponse } from 'next/server';
import { getHomepageStats } from '@/lib/homepageStatsService';

export async function GET() {
  try {
    const stats = await getHomepageStats();
    return NextResponse.json({ success: true, stats });
  } catch (error) {
    console.error('Error fetching homepage stats:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch statistics',
        stats: {
          legislation: { total: 0, recent: 0, active: 0, daily: 0, topSubjects: [] },
          representatives: { total: 0, state: 0, congress: 0, parties: [] },
          posts: { total: 0, recent: 0, active: 0 },
          jurisdictions: 52,
          lastUpdated: new Date().toISOString(),
        },
      },
      { status: 500 },
    );
  }
}
