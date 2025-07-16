import { NextRequest, NextResponse } from 'next/server';
import { ElectionEvent } from '@/types/event';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const state = searchParams.get('state');
    const city = searchParams.get('city');

    // In a real implementation, this would fetch from a voting information API
    // For now, we'll return mock data with realistic upcoming election dates
    const events = generateMockVotingEvents(state, city);

    return NextResponse.json({
      events,
      source: 'mock',
      location: { state, city }
    });

  } catch (error) {
    console.error('Error fetching voting information:', error);
    return NextResponse.json(
      { error: 'Failed to fetch voting information' },
      { status: 500 }
    );
  }
}

function generateMockVotingEvents(state?: string | null, city?: string | null): ElectionEvent[] {
  const today = new Date();
  const events: ElectionEvent[] = [];

  // Generate realistic upcoming election events
  const nextElectionDates = [
    { date: new Date(2025, 10, 4), type: 'election' as const, title: 'General Election' },
    { date: new Date(2025, 7, 15), type: 'primary' as const, title: 'Primary Election' },
    { date: new Date(2025, 2, 18), type: 'election' as const, title: 'Municipal Election' }
  ];

  nextElectionDates.forEach((election, index) => {
    if (election.date > today) {
      // Registration deadline (30 days before election)
      const registrationDeadline = new Date(election.date);
      registrationDeadline.setDate(registrationDeadline.getDate() - 30);

      if (registrationDeadline > today) {
        events.push({
          id: `reg-${index}`,
          type: 'registration_deadline',
          title: 'Voter Registration Deadline',
          date: registrationDeadline.toISOString().split('T')[0],
          description: `Last day to register to vote for the ${election.title}`,
          requirements: ['Valid ID', 'Proof of residence', 'US citizenship'],
          isUrgent: registrationDeadline.getTime() - today.getTime() < 14 * 24 * 60 * 60 * 1000 // Within 2 weeks
        });
      }

      // Early voting period (14 days before election)
      const earlyVotingStart = new Date(election.date);
      earlyVotingStart.setDate(earlyVotingStart.getDate() - 14);

      if (earlyVotingStart > today) {
        events.push({
          id: `early-${index}`,
          type: 'early_voting',
          title: 'Early Voting Period Begins',
          date: earlyVotingStart.toISOString().split('T')[0],
          description: `Early voting locations open for the ${election.title}`,
          location: `Various locations throughout ${city || state || 'the area'}`
        });
      }

      // Absentee ballot deadline (7 days before election)
      const absenteeDeadline = new Date(election.date);
      absenteeDeadline.setDate(absenteeDeadline.getDate() - 7);

      if (absenteeDeadline > today) {
        events.push({
          id: `absentee-${index}`,
          type: 'absentee_deadline',
          title: 'Absentee Ballot Request Deadline',
          date: absenteeDeadline.toISOString().split('T')[0],
          description: `Last day to request an absentee ballot for the ${election.title}`,
          requirements: ['Valid reason for absentee voting', 'Completed application form']
        });
      }

      // Election day
      events.push({
        id: `election-${index}`,
        type: election.type,
        title: election.title,
        date: election.date.toISOString().split('T')[0],
        description: `${election.title} - polling locations open 7 AM to 8 PM`,
        location: `Polling locations throughout ${city || state || 'the area'}`
      });
    }
  });

  // Sort events by date
  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return events;
}
