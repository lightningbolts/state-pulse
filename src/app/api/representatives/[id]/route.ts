import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getRepresentativeById, getOpenStatesPersonById, getBillsSponsoredByRep } from '@/services/representativesService';

export async function GET(req: NextRequest, context: { params: { id: string } }) {
  const { id } = await context.params;
  try {
    // Fetch representative data
    const rep = await getRepresentativeById(id);
    if (!rep) {
      return NextResponse.json({ error: 'Representative not found' }, { status: 404 });
    }
    // --- Normalization logic (copied from feed endpoint) ---
    let normalizedRep = rep;
    try {
      if ('terms' in rep && Array.isArray((rep as any).terms)) {
        const terms = (rep as any).terms;
        const latestTerm = terms[terms.length - 1] || {};
        let normId = rep.id || '';
        if (!normId || normId.length < 8) {
          normId = [
            (rep as any).firstName || (rep as any).first_name || '',
            (rep as any).lastName || (rep as any).last_name || '',
            (rep as any).state || '',
            latestTerm.chamber || '',
            latestTerm.startYear || ''
          ].filter(Boolean).join('-');
        }
        normalizedRep = {
          ...rep,
          id: normId,
          office: latestTerm.memberType || '',
          district: '',
          photo: (rep as any).depiction?.imageUrl || '',
          party: ((rep as any).partyHistory && (rep as any).partyHistory[0] && (rep as any).partyHistory[0].partyName)
            ? (rep as any).partyHistory[0].partyName
            : ('party' in rep ? (rep as any).party : ''),
          jurisdiction: 'state' in rep ? (rep as any).state : (latestTerm.stateName || ''),
          name:
            (rep as any).directOrderName ||
            ('name' in rep ? (rep as any).name : '') ||
            ((rep as any).firstName ? (rep as any).firstName + ' ' : '') + ((rep as any).lastName || ''),
        };
      } else {
        // State rep normalization
        let normId = rep.id || '';
        const firstName = (rep as any).firstName || (rep as any).first_name || '';
        const lastName = (rep as any).lastName || (rep as any).last_name || '';
        const stateVal = (rep as any).state || '';
        if ((!normId || normId.length < 8) && firstName && lastName) {
          normId = [firstName, lastName, stateVal].join('-');
        }
        normalizedRep = {
          ...rep,
          id: normId,
        };
      }
    } catch (normError) {
      console.error('[API] Normalization error:', normError, rep);
      return NextResponse.json({ error: 'Normalization error', details: normError instanceof Error ? normError.message : normError, rep }, { status: 500 });
    }
    // Fetch bills sponsored by this representative
    let bills = [];
    try {
      bills = await getBillsSponsoredByRep(normalizedRep.id);
    } catch (billsError) {
      console.error('[API] Bills fetch error:', billsError, normalizedRep);
      return NextResponse.json({ error: 'Bills fetch error', details: billsError instanceof Error ? billsError.message : billsError, rep: normalizedRep }, { status: 500 });
    }
    return NextResponse.json({ representative: normalizedRep, bills });
  } catch (error) {
    console.error('[API] Unexpected error in [id] endpoint:', error);
    return NextResponse.json({ error: 'Failed to fetch representative data', details: error instanceof Error ? error.message : error }, { status: 500 });
  }
}
