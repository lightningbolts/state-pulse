import { getCollection } from '@/lib/mongodb';
import { isCongressBillId } from '@/lib/congressBillId';

function displayOpenStatesId(id: string): string {
  if (id.startsWith('ocd-bill/')) {
    const rest = id.replace('ocd-bill/', '');
    const idx = rest.indexOf('-');
    if (idx !== -1) return 'ocd-bill_' + rest.slice(idx + 1);
    return 'ocd-bill_' + rest;
  }
  return id;
}

export function normalizeBillIdentifier(identifier: string): string {
  return identifier
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ')
    .replace(/([A-Z]+)\s*(\d+)/, '$1 $2');
}

export async function linkBillIdentifier(
  billIdentifier: string | undefined,
  jurisdiction: string,
  session: string
): Promise<string | null> {
  if (!billIdentifier) return null;

  const normalized = normalizeBillIdentifier(billIdentifier);
  const col = await getCollection('legislation');

  const doc = await col.findOne({
    $or: [
      { identifier: normalized },
      { identifier: billIdentifier },
      { identifier: billIdentifier.replace(/\s+/g, '') },
    ],
    jurisdictionId: jurisdiction,
    session,
  });

  if (doc?.id) {
    if (isCongressBillId(String(doc.id))) return null;
    return String(doc.id);
  }

  const fuzzy = await col.findOne({
    identifier: { $regex: new RegExp(billIdentifier.replace(/\s+/g, '\\s*'), 'i') },
    jurisdictionId: jurisdiction,
  });

  if (fuzzy?.id && !isCongressBillId(String(fuzzy.id))) {
    return String(fuzzy.id);
  }

  return null;
}

export async function linkOpenStatesBillId(
  openStatesBillId: string
): Promise<string | null> {
  if (isCongressBillId(openStatesBillId)) return null;
  const col = await getCollection('legislation');
  const displayId = displayOpenStatesId(openStatesBillId);
  const doc = await col.findOne({
    $or: [{ id: displayId }, { id: openStatesBillId }],
  });
  return doc?.id ? String(doc.id) : displayId;
}

export function rejectFederalBillId(billId: string): boolean {
  return isCongressBillId(billId);
}
