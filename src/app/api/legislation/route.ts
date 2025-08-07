import { NextResponse } from 'next/server';
import {
  addLegislation,
  getAllLegislation
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
    // Parse filtering parameters
    const otherFilters: Record<string, any> = {};
    // Always filter by sponsorId if present
    const sponsorIdParam = searchParams.get('sponsorId');
    if (sponsorIdParam) {
      // Normalize id to use slashes (ocd-person/uuid) for matching sponsors.id
      const normalizedId = sponsorIdParam.replace(/^ocd-person_/, 'ocd-person/').replace(/_/g, '-').replace('ocd-person/-', 'ocd-person/');
      otherFilters['$or'] = [
        { 'sponsors.id': sponsorIdParam },
        { 'sponsors.id': normalizedId }
      ];
    }

    // Parse pagination parameters
    const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit') || '100', 10) : 100;
    const skip = searchParams.get('skip') ? parseInt(searchParams.get('skip') || '0', 10) : 0;

    // Parse sorting parameters
    const sortField = searchParams.get('sortBy');
    const sortDirection = searchParams.get('sortDir');

    let sort: Record<string, 1 | -1> = {};
    if (sortField) {
      sort = { [sortField]: sortDirection === 'asc' ? 1 : -1 };
    } else {
      // Default sort if not provided
      sort = { updatedAt: -1 };
    }

    // Common filters
    if (searchParams.get('session')) {
      otherFilters.session = searchParams.get('session');
    }
    if (searchParams.get('identifier')) {
      otherFilters.identifier = searchParams.get('identifier');
    }
    if (searchParams.get('jurisdiction')) {
      otherFilters.jurisdictionId = searchParams.get('jurisdiction');
    }
    // Handle Congress vs State filtering
    const showCongressParam = searchParams.get('showCongress');
    const stateParamForCongress = searchParams.get('state');
    const stateAbbrParamForCongress = searchParams.get('stateAbbr');
    const isCongress = (
      showCongressParam === 'true' ||
      (stateParamForCongress && stateParamForCongress.toLowerCase() === 'united states congress') ||
      (stateAbbrParamForCongress && stateAbbrParamForCongress.toUpperCase() === 'US')
    );
    if (isCongress) {
      console.log('[API] Filtering for ALL Congress sessions');
      otherFilters.jurisdictionName = 'United States Congress';
    } else if (searchParams.get('jurisdictionName')) {
      const jurisdictionNameParam = searchParams.get('jurisdictionName');
      otherFilters.jurisdictionName = jurisdictionNameParam;
    }
    if (searchParams.get('subject')) {
      otherFilters.subjects = searchParams.get('subject');
    }
    if (searchParams.get('chamber')) {
      otherFilters.chamber = searchParams.get('chamber');
    }
    if (searchParams.get('classification')) {
      otherFilters.classification = searchParams.get('classification');
    }
    if (searchParams.get('statusText')) {
      otherFilters.statusText = searchParams.get('statusText');
    }
    if (searchParams.get('sponsor')) {
      const sponsorId = searchParams.get('sponsorId');
      if (showCongressParam === 'true') {
      } else if (sponsorId) {
        const normalizedId = sponsorId.replace(/^ocd-person_/, 'ocd-person/').replace(/_/g, '-').replace('ocd-person/-', 'ocd-person/');
        otherFilters['$or'] = [
          { 'sponsors.id': sponsorId },
          { 'sponsors.id': normalizedId }
        ];
      } else {
        const sponsorName = searchParams.get('sponsor');
        otherFilters['sponsors.name'] = sponsorName;
      }
    }
    // Date range filters (e.g., firstActionAt_gte, firstActionAt_lte)
    const firstActionAtGte = searchParams.get('firstActionAt_gte');
    const firstActionAtLte = searchParams.get('firstActionAt_lte');
    if (firstActionAtGte || firstActionAtLte) {
      otherFilters.firstActionAt = {};
      if (firstActionAtGte) otherFilters.firstActionAt.$gte = new Date(firstActionAtGte);
      if (firstActionAtLte) otherFilters.firstActionAt.$lte = new Date(firstActionAtLte);
    }

    // Full text search
    const searchValue = searchParams.get('search');
    let finalFilter = { ...otherFilters };
    if (searchValue) {
      const searchOr = [
        { title: { $regex: searchValue, $options: 'i' } },
        { summary: { $regex: searchValue, $options: 'i' } },
        { identifier: { $regex: searchValue, $options: 'i' } },
        { classification: searchValue },
        { classification: { $regex: searchValue, $options: 'i' } },
        { subjects: searchValue },
        { subjects: { $regex: searchValue, $options: 'i' } }
      ];
      // If there are other filters, combine with $and
      const filtersWithoutOr = { ...otherFilters };
      delete filtersWithoutOr.$or;
      finalFilter = { $and: [filtersWithoutOr, { $or: searchOr }] };
    }

    // Debug: log the final filter/query before running the search
    // console.log('[API] Final MongoDB filter:', JSON.stringify(finalFilter, null, 2));
    let legislations = await getAllLegislation({
      limit,
      skip,
      sort,
      filter: finalFilter,
      showCongress: showCongressParam === 'true'
    });

    // Fuzzy search fallback: only if no results and a search term is present
    if (searchValue && legislations.length === 0) {
      // Strictly apply all non-search filters (deep copy, excluding $or)
      const fuzzyFilter: Record<string, any> = JSON.parse(JSON.stringify(otherFilters));
      if (fuzzyFilter.$or) delete fuzzyFilter.$or;
      // Congress, session, chamber, etc. are already present if set
      const allCandidates = await getAllLegislation({
        limit: 100,
        skip: 0,
        sort,
        filter: fuzzyFilter,
        showCongress: showCongressParam === 'true'
      });
      if (allCandidates.length > 0) {
        const Fuse = (await import('fuse.js')).default;
        // Only use the same fields as regular full text search
        const fuseKeys = [
          "title",
          "summary",
          "identifier",
          "classification",
          "subjects"
        ];
        const normalizedCandidates = allCandidates.map((u: any, idx: number) => ({
          idx,
          title: u.title ? String(u.title).toLowerCase().trim() : '',
          summary: u.summary ? String(u.summary).toLowerCase().trim() : '',
          identifier: u.identifier ? String(u.identifier).toLowerCase().trim() : '',
          classification: Array.isArray(u.classification) ? u.classification.map((v: any) => String(v).toLowerCase().trim()) : [],
          subjects: Array.isArray(u.subjects) ? u.subjects.map((v: any) => String(v).toLowerCase().trim()) : [],
        }));
        const fuse = new Fuse(normalizedCandidates, {
          keys: fuseKeys,
          threshold: 0.4,
          ignoreLocation: true,
          includeScore: true,
          findAllMatches: true,
          minMatchCharLength: 2,
        });
        const fuzzyResults = fuse.search(searchValue.trim().toLowerCase()).map(r => r.item.idx);
        legislations = fuzzyResults.map(idx => allCandidates[idx]).slice(0, limit);
      }
    }
    return NextResponse.json(legislations, { status: 200 });
  } catch (error: any) {
    console.error('Error fetching all legislation:', error);
    return NextResponse.json({ message: 'Error fetching all legislation', error: (error as Error).message }, { status: 500 });
  }
}