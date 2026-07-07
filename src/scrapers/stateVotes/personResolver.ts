import type { CanonicalMemberVote } from '@/types/voteRecord';

export interface PersonRecord {
  id: string;
  name: string;
  given_name?: string;
  family_name?: string;
  party?: string;
  current_role?: {
    org_classification?: string;
    district?: string | number;
  };
}

function normalizeName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z\s,]/g, '')
    .trim();
}

function parseNameParts(name: string): { first: string; last: string } {
  const cleaned = name.trim();
  if (cleaned.includes(',')) {
    const [last, first] = cleaned.split(',').map((s) => s.trim());
    return { first: first?.split(/\s/)[0] ?? '', last: last ?? '' };
  }
  const parts = cleaned.split(/\s+/);
  if (parts.length === 1) return { first: '', last: parts[0] };
  return { first: parts[0], last: parts[parts.length - 1] };
}

function namesMatch(a: string, b: string): boolean {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb) return true;
  const pa = parseNameParts(a);
  const pb = parseNameParts(b);
  if (pa.last && pb.last && pa.last === pb.last) {
    if (!pa.first || !pb.first) return true;
    if (pa.first[0] === pb.first[0]) return true;
    if (pa.first === pb.first) return true;
  }
  return false;
}

export class PersonResolver {
  private cache = new Map<string, PersonRecord[]>();

  constructor(
    private readonly fetchPeople: (
      jurisdiction: string
    ) => Promise<PersonRecord[]>
  ) {}

  async loadJurisdiction(jurisdiction: string): Promise<void> {
    if (!this.cache.has(jurisdiction)) {
      const people = await this.fetchPeople(jurisdiction);
      this.cache.set(jurisdiction, people);
    }
  }

  resolve(
    name: string,
    jurisdiction: string,
    chamber?: string
  ): PersonRecord | null {
    const people = this.cache.get(jurisdiction) ?? [];
    const normalized = normalizeName(name);
    const { last } = parseNameParts(name);

    const chamberFiltered = chamber
      ? people.filter((p) => {
          const org = p.current_role?.org_classification?.toLowerCase() ?? '';
          if (chamber === 'upper') return org.includes('upper') || org.includes('senate');
          if (chamber === 'lower') return org.includes('lower') || org.includes('house');
          return true;
        })
      : people;

    const exact = chamberFiltered.filter((p) => namesMatch(p.name, name));
    if (exact.length === 1) return exact[0];

    const byLast = chamberFiltered.filter((p) => {
      const pl = parseNameParts(p.name).last;
      return pl && normalizeName(pl) === normalizeName(last);
    });
    if (byLast.length === 1) return byLast[0];

    const fuzzy = chamberFiltered.filter(
      (p) =>
        normalizeName(p.name).includes(normalized) ||
        normalized.includes(normalizeName(p.name))
    );
    if (fuzzy.length === 1) return fuzzy[0];

    return null;
  }

  async resolveMemberVotes(
    memberVotes: CanonicalMemberVote[],
    jurisdiction: string,
    chamber?: string
  ): Promise<{ resolved: CanonicalMemberVote[]; unresolved: number }> {
    await this.loadJurisdiction(jurisdiction);
    let unresolved = 0;
    const resolved = memberVotes.map((mv) => {
      if (mv.personId) return mv;
      const person = this.resolve(mv.name, jurisdiction, chamber);
      if (person) {
        return {
          ...mv,
          personId: person.id,
          party: mv.party ?? person.party,
          district:
            mv.district ?? person.current_role?.district?.toString(),
        };
      }
      unresolved++;
      return mv;
    });
    return { resolved, unresolved };
  }
}

export async function fetchOpenStatesPeople(
  jurisdiction: string,
  apiKey: string
): Promise<PersonRecord[]> {
  const url = `https://v3.openstates.org/people?jurisdiction=${encodeURIComponent(jurisdiction)}&per_page=200&apikey=${apiKey}`;
  const all: PersonRecord[] = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(`${url}&page=${page}`);
    if (response.status === 429) {
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }
    if (!response.ok) break;
    const data = (await response.json()) as {
      results: PersonRecord[];
      pagination: { max_page: number };
    };
    all.push(...(data.results ?? []));
    hasMore = page < (data.pagination?.max_page ?? 1);
    page++;
  }
  return all;
}

export function createPersonResolver(apiKey?: string): PersonResolver {
  return new PersonResolver(async (jurisdiction) => {
    if (!apiKey) return [];
    return fetchOpenStatesPeople(jurisdiction, apiKey);
  });
}
