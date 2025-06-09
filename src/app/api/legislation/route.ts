import { NextResponse } from 'next/server';
import {
  addLegislation,
  getAllLegislation
} from '@/services/legislationService';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    // TODO: Add validation for the body here (zod or manual)
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
    let sort: Record<string, 1 | -1> = { updatedAt: -1 };
    const sortField = searchParams.get('sortBy');
    const sortDirection = searchParams.get('sortDir');
    if (sortField) {
      sort = { [sortField]: sortDirection === 'asc' ? 1 : -1 };
    }
    const filter: Record<string, any> = {};
    if (searchParams.get('session')) {
      filter.session = searchParams.get('session');
    }
    if (searchParams.get('jurisdiction')) {
      filter.jurisdictionId = searchParams.get('jurisdiction');
    }
    if (searchParams.get('subject')) {
      filter.subjects = searchParams.get('subject');
    }
    if (searchParams.get('chamber')) {
      filter.chamber = searchParams.get('chamber');
    }
    if (searchParams.get('classification')) {
      filter.classification = searchParams.get('classification');
    }
    if (searchParams.get('statusText')) {
      filter.statusText = searchParams.get('statusText');
    }
    if (searchParams.get('sponsor')) {
      filter['sponsors.name'] = searchParams.get('sponsor');
    }
    const firstActionAtGte = searchParams.get('firstActionAt_gte');
    const firstActionAtLte = searchParams.get('firstActionAt_lte');
    if (firstActionAtGte || firstActionAtLte) {
      filter.firstActionAt = {};
      if (firstActionAtGte) filter.firstActionAt.$gte = new Date(firstActionAtGte);
      if (firstActionAtLte) filter.firstActionAt.$lte = new Date(firstActionAtLte);
    }
    const legislations = await getAllLegislation({
      limit,
      skip,
      sort,
      filter
    });
    return NextResponse.json(legislations, { status: 200 });
  } catch (error) {
    console.error('Error fetching all legislation:', error);
    return NextResponse.json({ message: 'Error fetching all legislation', error: (error as Error).message }, { status: 500 });
  }
}
// ...existing code...

