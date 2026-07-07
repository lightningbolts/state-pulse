import type { PersonRecord } from '../personResolver';

const JURISDICTION = 'ocd-jurisdiction/country:us/state:ny/government';
const API_BASE = 'https://legislation.nysenate.gov/api/3';

interface NyApiMember {
  memberId?: number;
  fullName?: string;
  shortName?: string;
  chamber?: string;
  districtCode?: number;
}

function apiKey(): string | undefined {
  return process.env.NY_OPENLEG_API_KEY;
}

function chamberToOrg(chamber?: string): string {
  return /assembly/i.test(chamber ?? '') ? 'lower' : 'upper';
}

export async function fetchNyLegislators(
  httpGet: (url: string) => Promise<string>
): Promise<PersonRecord[]> {
  const key = apiKey();
  if (!key) return [];

  const sessionYear = String(new Date().getFullYear() - 1);
  const url = `${API_BASE}/members/${sessionYear}?key=${encodeURIComponent(key)}&limit=250&offset=1`;

  try {
    const data = JSON.parse(await httpGet(url)) as {
      result?: { items?: NyApiMember[] };
    };
    return (data.result?.items ?? []).map((m) => ({
      id: `ny-${m.memberId ?? m.shortName}`,
      name: m.fullName ?? m.shortName ?? 'Unknown',
      family_name: m.shortName,
      current_role: {
        org_classification: chamberToOrg(m.chamber),
        district: m.districtCode,
      },
    }));
  } catch {
    return [];
  }
}

export const NY_JURISDICTION = JURISDICTION;
