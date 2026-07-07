import {NextResponse} from 'next/server';
import {
  addLegislation,
  getAllLegislationWithFiltering,
  getCachedPolicyFeedPage,
  isUnfilteredPolicyFeedRequest,
} from '@/services/legislationService';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const newLegislation = await addLegislation(body);
    return NextResponse.json(newLegislation, { status: 201 });
  } catch (error) {
    console.error('Error creating legislation:', error);
    return NextResponse.json({ message: 'Error creating legislation', error: (error as Error).message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);

    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit') || '100', 10) : 100;
    const skip = searchParams.get('skip') ? parseInt(searchParams.get('skip') || '0', 10) : 0;
    const sortBy = searchParams.get('sortBy') || undefined;
    const sortDir = (searchParams.get('sortDir') as 'asc' | 'desc') || 'desc';
    const context = (searchParams.get('context') as 'policy-updates-feed' | 'policy-tracker' | 'email-script' | 'api') || 'api';

    const filterParams = {
      search: searchParams.get('search') || undefined,
      skip,
      context,
      showCongress: searchParams.get('showCongress') === 'true',
      sponsorId: searchParams.get('sponsorId') || undefined,
      showOnlyEnacted: searchParams.get('showOnlyEnacted') || undefined,
      jurisdictionName: searchParams.get('jurisdictionName') || undefined,
      subject: searchParams.get('subject') || undefined,
      classification: searchParams.get('classification') || undefined,
      chamber: searchParams.get('chamber') || undefined,
    };

    const legislations = isUnfilteredPolicyFeedRequest(filterParams)
      ? await getCachedPolicyFeedPage(limit, skip, sortBy || 'createdAt', sortDir)
      : await getAllLegislationWithFiltering({
          search: filterParams.search,
          limit,
          skip,
          sortBy,
          sortDir,
          showCongress: filterParams.showCongress,
          sponsorId: filterParams.sponsorId,
          showOnlyEnacted: filterParams.showOnlyEnacted,
          session: searchParams.get('session') || undefined,
          identifier: searchParams.get('identifier') || undefined,
          jurisdiction: searchParams.get('jurisdiction') || undefined,
          jurisdictionName: filterParams.jurisdictionName,
          subject: filterParams.subject,
          chamber: filterParams.chamber,
          classification: filterParams.classification,
          statusText: searchParams.get('statusText') || undefined,
          sponsor: searchParams.get('sponsor') || undefined,
          firstActionAt_gte: searchParams.get('firstActionAt_gte') || undefined,
          firstActionAt_lte: searchParams.get('firstActionAt_lte') || undefined,
          state: searchParams.get('state') || undefined,
          stateAbbr: searchParams.get('stateAbbr') || undefined,
          context,
        });

    return NextResponse.json(legislations, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching all legislation:', error);
    return NextResponse.json({ message: 'Error fetching all legislation', error: (error as Error).message }, { status: 500 });
  }
}
