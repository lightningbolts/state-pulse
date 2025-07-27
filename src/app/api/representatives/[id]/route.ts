import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getRepresentativeById, getOpenStatesPersonById, getBillsSponsoredByRep } from '@/services/representativesService';

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const { id } = params;
  try {
    // Fetch representative data
    const representative = await getRepresentativeById(id);
    if (!representative) {
      return NextResponse.json({ error: 'Representative not found' }, { status: 404 });
    }
    // Fetch OpenStatesPerson data
    const openStatesPerson = await getOpenStatesPersonById(id);
    // Fetch bills sponsored by this representative
    const bills = await getBillsSponsoredByRep(id);
    return NextResponse.json({ representative, openStatesPerson, bills });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch representative data' }, { status: 500 });
  }
}
