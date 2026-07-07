import * as cheerio from 'cheerio';
import type { PersonRecord } from '../personResolver';

const BASE_URL = 'https://www.ncleg.gov';

function normalizeParty(raw: string): string {
  if (raw === 'R') return 'Republican';
  if (raw === 'D') return 'Democratic';
  return raw;
}

export async function fetchNcLegislators(
  fetchHtml: (url: string) => Promise<string>
): Promise<PersonRecord[]> {
  const people: PersonRecord[] = [];

  for (const chamberCode of ['H', 'S'] as const) {
    const url = `${BASE_URL}/Members/MemberList/${chamberCode}`;
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);

    $('a[href*="/Members/Biography/"]').each((_, el) => {
      const href = $(el).attr('href') ?? '';
      const text = $(el).text().trim();
      const match = text.match(/^(.+?)\s*\(([RD])\)$/);
      if (!match) return;

      const name = match[1].trim();
      const party = normalizeParty(match[2]);
      const idMatch = href.match(/\/Biography\/[HS]\/(\d+)/);
      const parts = name.split(/\s+/);
      const family_name = parts[parts.length - 1];

      people.push({
        id: `nc-leg/${chamberCode}/${idMatch?.[1] ?? name}`,
        name,
        family_name,
        given_name: parts.slice(0, -1).join(' '),
        party,
        current_role: {
          org_classification: chamberCode === 'S' ? 'upper' : 'lower',
        },
      });
    });
  }

  return people;
}
