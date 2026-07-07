import * as cheerio from 'cheerio';
import type { RawMemberVote } from '@/types/voteRecord';
import type { HtmlVoteParseResult } from './htmlVoteTable';

/** 2025–2026 regular session */
export const MN_SESSION_KEY = 302;
const API_BASE = 'https://www.house.mn.gov';

export interface MnVoteSummaryRow {
  billNumber: string;
  date: string;
  shortDescription: string;
}

export function parseMnDotNetDate(raw: string): string {
  const match = raw.match(/\/Date\((\d+)\)\//);
  if (!match) return raw;
  const date = new Date(parseInt(match[1], 10));
  if (Number.isNaN(date.getTime())) return raw;
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${m}-${d}`;
}

export function parseMnVoteSummaryRows(json: string): MnVoteSummaryRow[] {
  const rows = JSON.parse(json) as {
    Number?: string;
    Date?: string;
    ShortDescription?: string;
  }[];
  return (rows ?? [])
    .filter((row) => row.Number)
    .map((row) => ({
      billNumber: row.Number!,
      date: row.Date ? parseMnDotNetDate(row.Date) : '',
      shortDescription: row.ShortDescription ?? '',
    }));
}

export function mnVoteSummaryRequest(sessionKey = MN_SESSION_KEY): string {
  return JSON.stringify({ SessionKey: sessionKey, sortOption: 'Date' });
}

export function mnVoteSummaryUrl(): string {
  return `${API_BASE}/Votes/GetVoteSummary`;
}

export function mnVoteDetailUrl(
  billNumber: string,
  sessionKey = MN_SESSION_KEY
): string {
  return `${API_BASE}/Votes/Details?SessionKey=${sessionKey}&BillNumber=${encodeURIComponent(billNumber)}`;
}

function findMemberTableHtml(
  $: cheerio.CheerioAPI,
  root: cheerio.Cheerio<cheerio.Element>,
  label: string
): string | null {
  let tableHtml: string | null = null;
  root.find('b').each((_, el) => {
    if (tableHtml) return;
    const text = $(el).text().trim();
    if (!text.toLowerCase().includes(label.toLowerCase())) return;
    const table = $(el).parent().find('table').first();
    if (table.length) tableHtml = $.html(table);
  });
  return tableHtml;
}

function parseMnMemberTable(html: string, option: string): RawMemberVote[] {
  const $ = cheerio.load(html);
  const members: RawMemberVote[] = [];
  $('td').each((_, el) => {
    const name = $(el).text().trim();
    if (!name || name.length < 2) return;
    if (/^(yea|nay|bill|date|journal)/i.test(name)) return;
    members.push({ name, option });
  });
  return members;
}

export function parseMnVoteDetail(html: string): HtmlVoteParseResult[] {
  const $ = cheerio.load(html);
  const results: HtmlVoteParseResult[] = [];

  $('.collapsible-panel').each((panelIdx, panel) => {
    const block = $(panel);
    const headerRow = block.find('table tbody tr').first();
    const billNumber = headerRow.find('td').eq(0).text().trim();
    if (!billNumber) return;

    const description = headerRow.find('td').eq(1).text().replace(/\s+/g, ' ').trim();
    const yea = parseInt(headerRow.find('td').eq(3).text().trim(), 10) || 0;
    const nay = parseInt(headerRow.find('td').eq(4).text().trim(), 10) || 0;
    const date =
      headerRow.find('td').eq(6).text().trim() ||
      block.find('div:contains("Date:")').text().replace(/.*Date:\s*/i, '').trim();

    const memberVotes: RawMemberVote[] = [];
    const affirmative = findMemberTableHtml(
      $,
      block,
      'Those who voted in the affirmative'
    );
    const negative = findMemberTableHtml(
      $,
      block,
      'Those who voted in the negative'
    );

    if (affirmative) memberVotes.push(...parseMnMemberTable(affirmative, 'Yea'));
    if (negative) memberVotes.push(...parseMnMemberTable(negative, 'Nay'));

    results.push({
      rollCallNumber: `${billNumber}-${panelIdx + 1}`,
      motionText: description || 'Roll call vote',
      date,
      organization: 'House',
      organizationType: 'chamber',
      chamber: 'lower',
      billIdentifier: billNumber.replace(/([A-Z]+)(\d+)/, '$1 $2'),
      memberVotes,
      counts: [
        { option: 'yea', value: yea || memberVotes.filter((m) => /yea/i.test(m.option)).length },
        { option: 'nay', value: nay || memberVotes.filter((m) => /nay/i.test(m.option)).length },
      ],
      result: yea >= nay ? 'pass' : 'fail',
    });
  });

  if (!results.length && !html.includes('There are no votes on this bill')) {
    const parsed = parseMnVoteDetailFromBody(html);
    if (parsed) results.push(parsed);
  }

  return results;
}

function parseMnVoteDetailFromBody(html: string): HtmlVoteParseResult | null {
  const $ = cheerio.load(html);
  if ($('h3:contains("There are no votes")').length) return null;

  const billNumber = $('h3').first().text().trim();
  if (!billNumber) return null;

  const memberVotes: RawMemberVote[] = [];
  const affirmative = findMemberTableHtml(
    $,
    $('body'),
    'Those who voted in the affirmative'
  );
  const negative = findMemberTableHtml(
    $,
    $('body'),
    'Those who voted in the negative'
  );
  if (affirmative) memberVotes.push(...parseMnMemberTable(affirmative, 'Yea'));
  if (negative) memberVotes.push(...parseMnMemberTable(negative, 'Nay'));
  if (!memberVotes.length) return null;

  const tally = $('h3')
    .filter((_, el) => /\d+\s+YEA/i.test($(el).text()))
    .first()
    .text();
  const yea = parseInt(tally.match(/(\d+)\s+YEA/i)?.[1] ?? '0', 10);
  const nay = parseInt(tally.match(/(\d+)\s+Nay/i)?.[1] ?? '0', 10);
  const date =
    $('div:contains("Date:")').first().text().replace(/.*Date:\s*/i, '').trim() ||
    new Date().toISOString().split('T')[0];

  return {
    rollCallNumber: billNumber,
    motionText: $('div b').first().text().trim() || 'Roll call vote',
    date,
    organization: 'House',
    organizationType: 'chamber',
    chamber: 'lower',
    billIdentifier: billNumber.replace(/([A-Z]+)(\d+)/, '$1 $2'),
    memberVotes,
    counts: [
      { option: 'yea', value: yea || memberVotes.filter((m) => /yea/i.test(m.option)).length },
      { option: 'nay', value: nay || memberVotes.filter((m) => /nay/i.test(m.option)).length },
    ],
    result: yea >= nay ? 'pass' : 'fail',
  };
}
