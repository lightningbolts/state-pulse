import * as cheerio from 'cheerio';
import type { RawMemberVote, VoteChamber, VoteCount } from '@/types/voteRecord';
import { normalizeVoteDate } from '@/types/voteRecord';
import type { HtmlVoteParseResult } from './htmlVoteTable';

export const WA_YEAR = 2025;
export const WA_BIENNIUM = '2025-26';
const WA_BASE = 'https://app.leg.wa.gov';

export interface WaRollCallRow {
  billNumber: string;
  billIdentifier: string;
  chamber: VoteChamber;
  date: string;
  motionText: string;
  transcriptNo?: string;
  counts: VoteCount[];
  memberVotes: RawMemberVote[];
  rollCallsUrl: string;
}

export function waBillSummaryUrl(billNumber: number | string, year = WA_YEAR): string {
  return `${WA_BASE}/billsummary?BillNumber=${billNumber}&Year=${year}`;
}

export function waRollCallsUrl(
  billNumber: number | string,
  biennium = WA_BIENNIUM
): string {
  return `${WA_BASE}/bi/RollCallsOnABill/RollCall?biennium=${encodeURIComponent(biennium)}&billNumber=${billNumber}&initiative=False`;
}

export function waBillHasRollCalls(html: string): boolean {
  return /RollCallsOnABill\/RollCall/i.test(html);
}

function parseWaDate(raw: string): string {
  const match = raw.trim().match(/^(\d{2})-(\d{2})-(\d{4})$/);
  if (match) {
    const [, m, d, y] = match;
    return `${y}-${m}-${d}`;
  }
  return normalizeVoteDate(raw);
}

function chamberFromLabel(text: string): VoteChamber {
  return /senate/i.test(text) ? 'upper' : 'lower';
}

function parseVoteCounts(text: string): VoteCount[] {
  const counts: VoteCount[] = [];
  const patterns: [RegExp, VoteCount['option']][] = [
    [/Yeas:\s*(\d+)/i, 'yea'],
    [/Nays:\s*(\d+)/i, 'nay'],
    [/Absent:\s*(\d+)/i, 'absent'],
    [/Excused:\s*(\d+)/i, 'not_voting'],
  ];
  for (const [regex, option] of patterns) {
    const match = text.match(regex);
    if (match) counts.push({ option, value: parseInt(match[1], 10) });
  }
  return counts;
}

function parseMemberList(text: string, option: string): RawMemberVote[] {
  const trimmed = text.replace(/\s+/g, ' ').trim();
  if (!trimmed || /^none$/i.test(trimmed)) return [];
  return trimmed
    .split(',')
    .map((name) => name.trim())
    .filter(Boolean)
    .map((name) => ({ name, option }));
}

export function parseWaRollCallsPage(
  html: string,
  billNumber: string | number
): WaRollCallRow[] {
  const $ = cheerio.load(html);
  const billIdentifier = `HB ${billNumber}`;
  const rollCallsUrl = waRollCallsUrl(billNumber);
  const rows: WaRollCallRow[] = [];

  $('div.rollcall').each((_, block) => {
    const $block = $(block);
    const chamberText = $block.find('div').first().text();
    const chamber = chamberFromLabel(chamberText);
    const motionText =
      $block
        .find('div')
        .filter((__, el) => /Motion:/i.test($(el).text()))
        .first()
        .text()
        .replace(/^Motion:\s*/i, '')
        .trim() || 'Roll call vote';
    const date = parseWaDate(
      $block
        .find('div')
        .filter((__, el) => /^Date:/i.test($(el).text()))
        .first()
        .text()
        .replace(/^Date:\s*/i, '')
    );
    const transcriptNo = $block
      .find('div')
      .filter((__, el) => /Transcript No:/i.test($(el).text()))
      .first()
      .text()
      .match(/Transcript No:\s*(\d+)/i)?.[1];

    const voteCountText = $block.find('.vote-count').first().text();
    const counts = parseVoteCounts(voteCountText);

    const memberVotes: RawMemberVote[] = [];
    $block.find('table tr').each((__, row) => {
      const label = $(row).find('td').first().text().toLowerCase();
      const names = $(row).find('td').eq(1).text();
      if (/yea/.test(label)) {
        memberVotes.push(...parseMemberList(names, 'yea'));
      } else if (/nay/.test(label)) {
        memberVotes.push(...parseMemberList(names, 'nay'));
      } else if (/absent/.test(label)) {
        memberVotes.push(...parseMemberList(names, 'absent'));
      } else if (/excused/.test(label)) {
        memberVotes.push(...parseMemberList(names, 'not_voting'));
      }
    });

    rows.push({
      billNumber: String(billNumber),
      billIdentifier,
      chamber,
      date,
      motionText,
      transcriptNo,
      counts,
      memberVotes,
      rollCallsUrl,
    });
  });

  return rows;
}

export function waVoteToParseResult(row: WaRollCallRow): HtmlVoteParseResult {
  const yea = row.counts.find((c) => c.option === 'yea')?.value ?? 0;
  const nay = row.counts.find((c) => c.option === 'nay')?.value ?? 0;

  return {
    rollCallNumber: row.transcriptNo,
    motionText: row.motionText,
    date: row.date,
    organization: row.chamber === 'upper' ? 'Senate' : 'House',
    organizationType: 'chamber',
    chamber: row.chamber,
    billIdentifier: row.billIdentifier,
    memberVotes: row.memberVotes,
    counts: row.counts,
    result: yea >= nay ? 'pass' : 'fail',
  };
}

export function parseWaRollCallDetail(
  html: string,
  billNumber: string,
  date: string,
  chamber: VoteChamber
): HtmlVoteParseResult {
  const row = parseWaRollCallsPage(html, billNumber).find(
    (vote) => vote.date === date && vote.chamber === chamber
  );
  if (!row) {
    throw new Error(`WA roll call not found for HB ${billNumber} ${date} ${chamber}`);
  }
  return waVoteToParseResult(row);
}
