import { NextRequest, NextResponse } from 'next/server';
import { PublicHearing } from "@/types/event";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const state = searchParams.get('state');
    const city = searchParams.get('city');
    const county = searchParams.get('county');

    // In a real implementation, this would fetch from government APIs or databases
    // For now, we'll return mock data with realistic upcoming hearings
    const hearings = generateMockHearings(state, city, county);

    return NextResponse.json({
      hearings,
      source: 'mock',
      location: { state, city, county }
    });

  } catch (error) {
    console.error('Error fetching public hearings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch public hearing information' },
      { status: 500 }
    );
  }
}

function generateMockHearings(state?: string | null, city?: string | null, county?: string | null): PublicHearing[] {
  const today = new Date();
  const hearings: PublicHearing[] = [];

  // Generate upcoming hearings for the next 3 months
  const baseDate = new Date(today);

  // City Council Meeting (First Tuesday of each month)
  for (let i = 0; i < 3; i++) {
    const meetingDate = getFirstTuesdayOfMonth(baseDate.getFullYear(), baseDate.getMonth() + i);
    if (meetingDate > today) {
      hearings.push({
        id: `city-council-${i}`,
        title: 'City Council Regular Meeting',
        date: meetingDate.toISOString().split('T')[0],
        time: '7:00 PM',
        location: `${city || 'City'} Hall Council Chambers`,
        type: 'city_council',
        description: 'Regular monthly city council meeting to discuss municipal matters and public concerns.',
        agenda: [
          'Call to Order and Roll Call',
          'Public Comment Period',
          'Budget Review and Appropriations',
          'Zoning and Planning Updates',
          'New Business',
          'Adjournment'
        ],
        contact: {
          phone: '(555) 123-4567',
          email: `clerk@${city?.toLowerCase() || 'city'}.gov`,
          website: `https://${city?.toLowerCase() || 'city'}.gov/meetings`
        },
        isVirtual: false,
        status: 'scheduled'
      });
    }
  }

  // Planning Commission (Second Thursday of each month)
  for (let i = 0; i < 3; i++) {
    const meetingDate = getSecondThursdayOfMonth(baseDate.getFullYear(), baseDate.getMonth() + i);
    if (meetingDate > today) {
      hearings.push({
        id: `planning-${i}`,
        title: 'Planning Commission Hearing',
        date: meetingDate.toISOString().split('T')[0],
        time: '6:30 PM',
        location: 'Virtual Meeting',
        type: 'planning_commission',
        description: 'Public hearing on development proposals and zoning matters.',
        agenda: [
          'Review of Pending Development Applications',
          'Zoning Variance Requests',
          'Environmental Impact Assessments',
          'Public Comments',
          'Commission Deliberation and Voting'
        ],
        contact: {
          phone: '(555) 987-6543',
          email: `planning@${county?.toLowerCase() || 'county'}.gov`
        },
        isVirtual: true,
        virtualLink: 'https://zoom.us/j/123456789',
        status: 'scheduled'
      });
    }
  }

  // School Board Meeting (Third Monday of each month)
  for (let i = 0; i < 3; i++) {
    const meetingDate = getThirdMondayOfMonth(baseDate.getFullYear(), baseDate.getMonth() + i);
    if (meetingDate > today) {
      hearings.push({
        id: `school-board-${i}`,
        title: 'School Board Meeting',
        date: meetingDate.toISOString().split('T')[0],
        time: '7:30 PM',
        location: 'School District Administration Building',
        type: 'school_board',
        description: 'Regular school board meeting to discuss educational policies and district matters.',
        agenda: [
          'Superintendent\'s Report',
          'Budget and Finance Committee Report',
          'Curriculum and Instruction Updates',
          'Personnel Matters',
          'Public Input Session',
          'Board Discussion and Action Items'
        ],
        contact: {
          phone: '(555) 555-0123',
          email: 'board@schooldistrict.edu',
          website: 'https://schooldistrict.edu/board'
        },
        isVirtual: false,
        status: 'scheduled'
      });
    }
  }

  // County Board Meeting (Second and Fourth Tuesdays)
  for (let i = 0; i < 6; i++) {
    const meetingDate = getSecondAndFourthTuesdays(baseDate.getFullYear(), baseDate.getMonth() + Math.floor(i / 2))[i % 2];
    if (meetingDate && meetingDate > today) {
      hearings.push({
        id: `county-board-${i}`,
        title: 'County Board Meeting',
        date: meetingDate.toISOString().split('T')[0],
        time: '6:00 PM',
        location: `${county || 'County'} Government Center`,
        type: 'county_board',
        description: 'County board meeting to address county-wide issues and services.',
        agenda: [
          'County Administrator\'s Report',
          'Department Head Updates',
          'Budget and Financial Matters',
          'Public Works and Infrastructure',
          'Health and Human Services',
          'Public Comment Period'
        ],
        contact: {
          phone: '(555) 789-0123',
          email: `board@${county?.toLowerCase() || 'county'}.gov`,
          website: `https://${county?.toLowerCase() || 'county'}.gov/board`
        },
        isVirtual: false,
        status: 'scheduled'
      });
    }
  }

  // Sort hearings by date
  hearings.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return hearings.slice(0, 10); // Return up to 10 upcoming hearings
}

// Helper functions to calculate meeting dates
function getFirstTuesdayOfMonth(year: number, month: number): Date {
  const firstDay = new Date(year, month, 1);
  const dayOfWeek = firstDay.getDay();
  const daysToAdd = dayOfWeek === 0 ? 2 : dayOfWeek === 1 ? 1 : 9 - dayOfWeek;
  return new Date(year, month, 1 + daysToAdd);
}

function getSecondThursdayOfMonth(year: number, month: number): Date {
  const firstDay = new Date(year, month, 1);
  const dayOfWeek = firstDay.getDay();
  const daysToAdd = dayOfWeek <= 4 ? 4 - dayOfWeek + 7 : 11 - dayOfWeek;
  return new Date(year, month, 1 + daysToAdd);
}

function getThirdMondayOfMonth(year: number, month: number): Date {
  const firstDay = new Date(year, month, 1);
  const dayOfWeek = firstDay.getDay();
  const daysToAdd = dayOfWeek === 0 ? 15 : dayOfWeek === 1 ? 14 : 15 - dayOfWeek + 7;
  return new Date(year, month, 1 + daysToAdd);
}

function getSecondAndFourthTuesdays(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const dayOfWeek = firstDay.getDay();
  const daysToSecond = dayOfWeek === 0 ? 9 : dayOfWeek <= 2 ? 2 - dayOfWeek + 7 : 9 - dayOfWeek;
  const daysToFourth = daysToSecond + 14;

  const secondTuesday = new Date(year, month, 1 + daysToSecond);
  const fourthTuesday = new Date(year, month, 1 + daysToFourth);

  // Check if fourth Tuesday is still in the same month
  const fourthValid = fourthTuesday.getMonth() === month;

  return [secondTuesday, fourthValid ? fourthTuesday : null];
}
