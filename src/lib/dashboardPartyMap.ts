import { getCollection } from '@/lib/mongodb';
import { unstable_cache } from 'next/cache';
import {
  type MajorParty,
  normalizeMajorParty,
  normalizeSponsorLookupKey,
  sponsorKeyVariants,
} from '@/lib/dashboardMetrics';

export type PartyLookup = Record<string, MajorParty>;

async function fetchRepresentativePartyLookup(): Promise<PartyLookup> {
  const representatives = await getCollection('representatives');
  const docs = await representatives
    .find(
      {},
      {
        projection: {
          id: 1,
          name: 1,
          party: 1,
          partyName: 1,
          bioguideId: 1,
        },
      },
    )
    .toArray();

  const lookup: PartyLookup = {};

  const remember = (raw: unknown, party: MajorParty) => {
    if (typeof raw !== 'string' || !raw.trim()) return;
    for (const variant of sponsorKeyVariants(raw)) {
      lookup[variant] = party;
    }
    lookup[normalizeSponsorLookupKey(raw)] = party;
  };

  for (const doc of docs) {
    const party = normalizeMajorParty(
      (doc.party as string | undefined) || (doc.partyName as string | undefined),
    );
    if (!party) continue;
    remember(doc.id, party);
    remember(doc.bioguideId, party);
    remember(doc.name, party);
  }

  return lookup;
}

export const getRepresentativePartyLookup = unstable_cache(
  fetchRepresentativePartyLookup,
  ['dashboard-rep-party-lookup-v1'],
  { revalidate: 600 },
);

export function partyForSponsorKey(lookup: PartyLookup, key: string): MajorParty | null {
  if (!key) return null;
  for (const variant of sponsorKeyVariants(key)) {
    const party = lookup[variant];
    if (party) return party;
  }
  return lookup[normalizeSponsorLookupKey(key)] ?? null;
}
