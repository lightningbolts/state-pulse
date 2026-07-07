import * as cheerio from 'cheerio';
import type { PersonRecord } from '../personResolver';

const JURISDICTION = 'ocd-jurisdiction/country:us/state:pa/government';

function parseMemberName(
  $: cheerio.CheerioAPI,
  el: cheerio.Element
): string | undefined {
  const block = $(el).closest('.thumb-info, .member-card, .card');
  const inner = block.find('.thumb-info-inner').first().text().trim();
  if (inner) return inner;

  const alt = block.find('img[alt]').attr('alt') ?? '';
  const fromAlt = alt.match(/Representative\s+(.+)|Senator\s+(.+)/i);
  if (fromAlt) return (fromAlt[1] ?? fromAlt[2])?.trim();

  return $(el).text().replace(/^(Rep\.|Sen\.)\s*/i, '').trim() || undefined;
}

export async function fetchPaLegislators(
  httpGet: (url: string) => Promise<string>
): Promise<PersonRecord[]> {
  const people: PersonRecord[] = [];
  const chambers = [
    { url: 'https://www.palegis.us/house/members', org: 'lower' },
    { url: 'https://www.palegis.us/senate/members', org: 'upper' },
  ] as const;

  for (const { url, org } of chambers) {
    try {
      const html = await httpGet(url);
      const $ = cheerio.load(html);
      $("a[href*='/members/bio/']").each((_, el) => {
        const href = ($(el).attr('href') ?? '').trim();
        const id = href.match(/\/bio\/(\d+)\//)?.[1];
        const name = parseMemberName($, el);
        if (!id || !name) return;

        const partyText = $(el)
          .closest('.thumb-info, .member-card, .card')
          .find('[class*="bg-party-"]')
          .text();
        const party = partyText.includes('Democrat')
          ? 'Democratic'
          : partyText.includes('Republican')
            ? 'Republican'
            : undefined;

        const parts = name.split(/\s+/);
        people.push({
          id: `pa-${id}`,
          name,
          given_name: parts[0],
          family_name: parts[parts.length - 1],
          party,
          current_role: { org_classification: org },
        });
      });
    } catch {
      // continue with other chamber
    }
  }

  const byId = new Map(people.map((p) => [p.id, p]));
  return Array.from(byId.values());
}

export const PA_JURISDICTION = JURISDICTION;
