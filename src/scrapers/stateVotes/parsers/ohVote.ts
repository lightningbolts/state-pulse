import * as cheerio from 'cheerio';
import type { RawMemberVote, VoteCount } from '@/types/voteRecord';
import { normalizeVoteDate } from '@/types/voteRecord';
import type { HtmlVoteParseResult } from './htmlVoteTable';

export const OH_GENERAL_ASSEMBLY = '136';
const OH_BASE = 'https://www.legislature.ohio.gov';

export interface OhBillVoteRow {
  breakdownId: string;
  billSlug: string;
  billIdentifier?: string;
  date: string;
  chamber: 'lower' | 'upper';
  organization: string;
  result: string;
  counts: VoteCount[];
  memberVotes: RawMemberVote[];
  motionText: string;
}

export function ohBillVotesUrl(billSlug: string): string {
  return `${OH_BASE}/legislation/${OH_GENERAL_ASSEMBLY}/${billSlug.toLowerCase()}/votes`;
}

function parseOhDate(raw: string): string {
  const trimmed = raw.trim();
  const dashMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dashMatch) {
    const [, m, d, y] = dashMatch;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return normalizeVoteDate(trimmed);
}

function billIdentifierFromTitle(title: string): string | undefined {
  const match = title.match(/(House|Senate)\s+Bill\s+(\d+)/i);
  if (!match) return undefined;
  const prefix = /house/i.test(match[1]) ? 'HB' : 'SB';
  return `${prefix} ${match[2]}`;
}

function chamberFromText(text: string): 'lower' | 'upper' {
  return /senate/i.test(text) ? 'upper' : 'lower';
}

function parseMemberLinkText(text: string): RawMemberVote | null {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (!trimmed) return null;
  const match = trimmed.match(/^(.+?)\s*\(([A-Z])\)$/);
  if (match) {
    return { name: match[1].trim(), option: 'yea', party: match[2] };
  }
  return { name: trimmed, option: 'yea' };
}

function parseBreakdownMembers(
  $: cheerio.CheerioAPI,
  breakdownId: string
): RawMemberVote[] {
  const members: RawMemberVote[] = [];
  const panel = $(`#vote-breakdown-${breakdownId}`);
  if (!panel.length) return members;

  panel.find('h3').each((_, heading) => {
    const section = $(heading).text().trim().toLowerCase();
    const option = /nay/.test(section)
      ? 'nay'
      : /absent/.test(section)
        ? 'absent'
        : /excused|not voting/.test(section)
          ? 'not_voting'
          : 'yea';

    $(heading)
      .nextAll('table.vote-breakdown-table')
      .first()
      .find('a')
      .each((__, link) => {
        const text = $(link).text().trim();
        const parsed = parseMemberLinkText(text);
        if (!parsed) return;
        members.push({ ...parsed, option });
      });
  });

  return members;
}

function parseCountsFromRow($row: cheerio.Cheerio<cheerio.Element>): VoteCount[] {
  const counts: VoteCount[] = [];
  $row.find('.vote-count-column').each((_, el) => {
    const text = cheerio.load(el).text().trim();
    const match = text.match(/(Yeas|Nays)\s*:\s*(\d+)/i);
    if (!match) return;
    counts.push({
      option: /nay/i.test(match[1]) ? 'nay' : 'yea',
      value: parseInt(match[2], 10),
    });
  });
  return counts;
}

export function ohBillHasVotes(html: string): boolean {
  return /vote-breakdown-\d+/.test(html);
}

export function parseOhBillVotesPage(
  html: string,
  billSlug: string
): OhBillVoteRow[] {
  const $ = cheerio.load(html);
  const billIdentifier =
    billIdentifierFromTitle($('h1').first().text()) ??
    billSlug.replace(/^([a-z]+)(\d+)$/i, (_, p, n) =>
      `${p.toUpperCase()} ${n}`
    );

  const rows: OhBillVoteRow[] = [];

  $('table.legislation-votes-table tbody tr').each((_, tr) => {
    const $tr = $(tr);
    const breakdownId = $tr
      .find('[id^="vote-breakdown-button-"]')
      .attr('id')
      ?.match(/vote-breakdown-button-(\d+)/)?.[1];
    if (!breakdownId) return;

    const date = parseOhDate($tr.find('.date-cell span').first().text());
    const chamberText = $tr.find('.chamber-cell span').first().text();
    const chamber = chamberFromText(chamberText);
    const result = $tr.find('.result-cell').first().text().trim() || 'unknown';
    const counts = parseCountsFromRow($tr);
    const memberVotes = parseBreakdownMembers($, breakdownId);

    rows.push({
      breakdownId,
      billSlug: billSlug.toLowerCase(),
      billIdentifier,
      date,
      chamber,
      organization: chamber === 'upper' ? 'Senate' : 'House',
      result,
      counts,
      memberVotes,
      motionText: result,
    });
  });

  return rows;
}

export function ohVoteToParseResult(row: OhBillVoteRow): HtmlVoteParseResult {
  const yea = row.counts.find((c) => c.option === 'yea')?.value ?? 0;
  const nay = row.counts.find((c) => c.option === 'nay')?.value ?? 0;
  const result =
    /fail/i.test(row.result) || nay > yea
      ? 'fail'
      : yea >= nay
        ? 'pass'
        : 'unknown';

  return {
    rollCallNumber: `${row.billSlug}-${row.breakdownId}`,
    motionText: row.motionText,
    date: row.date,
    organization: row.organization,
    organizationType: 'chamber',
    chamber: row.chamber,
    billIdentifier: row.billIdentifier,
    memberVotes: row.memberVotes,
    counts: row.counts,
    result,
  };
}

export function parseOhBillVoteDetail(
  html: string,
  billSlug: string,
  breakdownId: string
): HtmlVoteParseResult {
  const row = parseOhBillVotesPage(html, billSlug).find(
    (v) => v.breakdownId === breakdownId
  );
  if (!row) {
    throw new Error(`OH vote breakdown ${breakdownId} not found for ${billSlug}`);
  }
  return ohVoteToParseResult(row);
}
