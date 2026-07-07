import * as cheerio from 'cheerio';
import type { VoteChamber, VoteCount } from '@/types/voteRecord';
import { normalizeVoteDate } from '@/types/voteRecord';
import type { HtmlVoteParseResult } from './htmlVoteTable';

export const MO_SESSION_YEAR = 2025;
export const MO_SESSION_CODE = 'R';
const MO_BASE = 'https://house.mo.gov';

export interface MoVoteRow {
  billSlug: string;
  billIdentifier: string;
  date: string;
  chamber: VoteChamber;
  organization: string;
  motionText: string;
  counts: VoteCount[];
  result: 'pass' | 'fail' | 'unknown';
  sourceUrl: string;
}

export function moBillActionsUrl(
  billSlug: string,
  year = MO_SESSION_YEAR,
  code = MO_SESSION_CODE
): string {
  return `${MO_BASE}/BillActions.aspx?bill=${encodeURIComponent(billSlug)}&year=${year}&code=${code}`;
}

function parseMoDate(raw: string): string {
  const match = raw.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, m, d, y] = match;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return normalizeVoteDate(raw);
}

function chamberFromAction(text: string): VoteChamber {
  if (/\(S\)|Senate/i.test(text)) return 'upper';
  return 'lower';
}

function slugToIdentifier(slug: string): string {
  const match = slug.match(/^([A-Za-z]+)(\d+)$/);
  if (!match) return slug.toUpperCase();
  return `${match[1].toUpperCase()} ${match[2]}`;
}

function parseTallyAction(
  action: string
): Pick<MoVoteRow, 'motionText' | 'counts' | 'result'> | null {
  const match = action.match(
    /^(.*?)(?:\s*-\s*)?AYES:\s*(\d+)\s*NOES:\s*(\d+)(?:\s*PRESENT:\s*(\d+))?/i
  );
  if (!match) return null;

  const motionText = match[1].replace(/\s+/g, ' ').trim();
  const counts: VoteCount[] = [
    { option: 'yea', value: parseInt(match[2], 10) },
    { option: 'nay', value: parseInt(match[3], 10) },
  ];
  if (match[4]) {
    counts.push({ option: 'present', value: parseInt(match[4], 10) });
  }

  const yea = counts.find((c) => c.option === 'yea')?.value ?? 0;
  const nay = counts.find((c) => c.option === 'nay')?.value ?? 0;
  const result =
    /fail|reject|defeat|lost/i.test(motionText)
      ? 'fail'
      : yea >= nay
        ? 'pass'
        : 'fail';

  return { motionText, counts, result };
}

export function parseMoBillActions(
  html: string,
  billSlug: string,
  sourceUrl?: string
): MoVoteRow[] {
  const $ = cheerio.load(html);
  const billIdentifier = slugToIdentifier(billSlug);
  const rows: MoVoteRow[] = [];
  const seen = new Set<string>();

  $('#actionTable tr').each((_, tr) => {
    const $tr = $(tr);
    const cells = $tr.find('td');
    if (cells.length < 2) return;

    const date = parseMoDate(cells.eq(0).text());
    const action = cells.last().text().replace(/\s+/g, ' ').trim();
    const parsed = parseTallyAction(action);
    if (!parsed) return;

    const chamber = chamberFromAction(action);
    const key = `${date}|${chamber}|${parsed.motionText}`;
    if (seen.has(key)) return;
    seen.add(key);

    rows.push({
      billSlug: billSlug.toUpperCase(),
      billIdentifier,
      date,
      chamber,
      organization: chamber === 'upper' ? 'Senate' : 'House',
      motionText: parsed.motionText,
      counts: parsed.counts,
      result: parsed.result,
      sourceUrl: sourceUrl ?? moBillActionsUrl(billSlug),
    });
  });

  return rows;
}

export function moVoteToParseResult(row: MoVoteRow): HtmlVoteParseResult {
  return {
    rollCallNumber: undefined,
    motionText: row.motionText,
    date: row.date,
    organization: row.organization,
    organizationType: 'chamber',
    chamber: row.chamber,
    billIdentifier: row.billIdentifier,
    memberVotes: [],
    counts: row.counts,
    result: row.result,
  };
}
