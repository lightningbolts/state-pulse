import { getCollection } from '@/lib/mongodb';
import {
  isBipartisanParties,
  roundRate,
  sponsorKeyExpression,
  type MajorParty,
} from '@/lib/dashboardMetrics';
import { getRepresentativePartyLookup, partyForSponsorKey } from '@/lib/dashboardPartyMap';

export type BipartisanCounts = {
  scoredBills: number;
  bipartisanBills: number;
  bipartisanRate: number | null;
};

const EMPTY_COUNTS: BipartisanCounts = {
  scoredBills: 0,
  bipartisanBills: 0,
  bipartisanRate: null,
};

type BillSponsorRow = {
  _id?: unknown;
  jurisdictionName?: string;
  sponsorKeys?: unknown[];
};

function scoreRows(
  rows: BillSponsorRow[],
  lookup: Record<string, MajorParty>,
): Map<string, { scored: number; bipartisan: number }> {
  const byJurisdiction = new Map<string, { scored: number; bipartisan: number }>();

  for (const row of rows) {
    const jurisdiction = row.jurisdictionName || '_';
    const keys = (row.sponsorKeys || []).filter((key): key is string => typeof key === 'string' && key.length > 0);
    if (keys.length < 2) continue;

    const resolvedParties: MajorParty[] = [];
    for (const key of keys) {
      const party = partyForSponsorKey(lookup, key);
      if (party) resolvedParties.push(party);
    }
    if (resolvedParties.length < 2) continue;

    const current = byJurisdiction.get(jurisdiction) || { scored: 0, bipartisan: 0 };
    current.scored += 1;
    if (isBipartisanParties(resolvedParties)) current.bipartisan += 1;
    byJurisdiction.set(jurisdiction, current);
  }

  return byJurisdiction;
}

function toCounts(entry: { scored: number; bipartisan: number } | undefined): BipartisanCounts {
  if (!entry) return EMPTY_COUNTS;
  return {
    scoredBills: entry.scored,
    bipartisanBills: entry.bipartisan,
    bipartisanRate: roundRate(entry.bipartisan, entry.scored),
  };
}

async function fetchSponsorKeyRows(match: object): Promise<BillSponsorRow[]> {
  const legislation = await getCollection('legislation');
  return legislation
    .aggregate(
      [
        {
          $match: {
            ...match,
            'sponsors.1': { $exists: true },
          },
        },
        {
          $project: {
            _id: 0,
            jurisdictionName: 1,
            sponsorKeys: sponsorKeyExpression,
          },
        },
      ],
      { maxTimeMS: 20000, allowDiskUse: true },
    )
    .toArray() as Promise<BillSponsorRow[]>;
}

export async function computeBipartisanByJurisdiction(
  match: object,
): Promise<Record<string, BipartisanCounts>> {
  const [rows, lookup] = await Promise.all([
    fetchSponsorKeyRows(match),
    getRepresentativePartyLookup(),
  ]);
  const scored = scoreRows(rows, lookup);
  const result: Record<string, BipartisanCounts> = {};
  for (const [jurisdiction, entry] of scored) {
    result[jurisdiction] = toCounts(entry);
  }
  return result;
}

export async function computeBipartisanForMatch(match: object): Promise<BipartisanCounts> {
  const byJurisdiction = await computeBipartisanByJurisdiction(match);
  const totals = Object.values(byJurisdiction).reduce(
    (acc, entry) => {
      acc.scored += entry.scoredBills;
      acc.bipartisan += entry.bipartisanBills;
      return acc;
    },
    { scored: 0, bipartisan: 0 },
  );
  return toCounts(totals);
}
