import * as cheerio from 'cheerio';
import type { HtmlVoteParseResult } from './htmlVoteTable';

const WI_VOTE_MAP: Record<string, string> = {
  Y: 'Yea',
  N: 'Nay',
  P: 'Present',
  A: 'Absent',
};

export function parseWiVoteDetail(html: string): HtmlVoteParseResult {
  const $ = cheerio.load(html);
  const title = $('title').text().trim();
  const rollCallNumber =
    title.match(/Vote\s+(\d+)/i)?.[1] ??
    html.match(/Assembly Vote\s+(\d+)/i)?.[1];

  const motionText =
    $('h1, h2, .motion').first().text().trim() || title || 'Roll call vote';

  const dateMatch = $('body').text().match(
    /(\d{1,2}\/\d{1,2}\/\d{4}|\w+ \d{1,2}, \d{4})/
  );
  const date = dateMatch?.[1] ?? new Date().toISOString().split('T')[0];

  const billIdentifier =
    $('body').text().match(/\b([AS]B\s*\d+[A-Z]?)\b/i)?.[1]?.replace(/\s+/g, ' ') ??
    undefined;

  const memberVotes: { name: string; option: string; party?: string }[] = [];

  $('table.assembly-names tr, table tr').each((_, row) => {
    const cells = $(row).find('td');
    if (!cells.length) return;

    const name = $(row).find('td.name').text().trim();
    if (!name || /name|member/i.test(name)) return;

    let voteRaw = '';
    $(row)
      .find('td')
      .each((__, cell) => {
        const t = $(cell).text().trim();
        if (/^[YNPA]$/.test(t)) voteRaw = t;
      });
    if (!voteRaw) return;

    const partyCell = cells.last().text().trim();
    const party = /^[RD]$/i.test(partyCell) ? partyCell : undefined;

    memberVotes.push({
      name,
      option: WI_VOTE_MAP[voteRaw] ?? voteRaw,
      party,
    });
  });

  const counts = tallyWiCounts(memberVotes);
  const yea = counts.find((c) => c.option === 'yea')?.value ?? 0;
  const nay = counts.find((c) => c.option === 'nay')?.value ?? 0;

  return {
    rollCallNumber,
    motionText,
    date,
    organization: 'Assembly',
    organizationType: 'chamber',
    chamber: 'lower',
    billIdentifier,
    memberVotes,
    counts,
    result: yea >= nay ? 'pass' : 'fail',
  };
}

function tallyWiCounts(
  memberVotes: { name: string; option: string }[]
): HtmlVoteParseResult['counts'] {
  const tally = new Map<string, number>();
  for (const mv of memberVotes) {
    const opt = mv.option.toLowerCase();
    const key = opt.includes('yea')
      ? 'yea'
      : opt.includes('nay')
        ? 'nay'
        : opt.includes('present')
          ? 'present'
          : 'absent';
    tally.set(key, (tally.get(key) ?? 0) + 1);
  }
  return Array.from(tally.entries()).map(([option, value]) => ({
    option: option as 'yea' | 'nay' | 'present' | 'absent',
    value,
  }));
}

export function parseWiVoteIndexLinks(
  html: string,
  baseUrl: string
): { url: string; rollCallNumber?: string; date?: string }[] {
  const $ = cheerio.load(html);
  const links: { url: string; rollCallNumber?: string; date?: string }[] = [];
  const seen = new Set<string>();

  $('a[href*="/votes/assembly/av"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const rc = href.match(/av(\d+)/i)?.[1];
    if (!rc || seen.has(rc)) return;
    seen.add(rc);

    const absolute = href.startsWith('http')
      ? href
      : new URL(href, baseUrl).toString();

    links.push({
      url: absolute,
      rollCallNumber: rc,
    });
  });

  return links;
}
