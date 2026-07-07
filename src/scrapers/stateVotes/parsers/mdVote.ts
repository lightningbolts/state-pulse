import * as cheerio from 'cheerio';
import type { VoteCount } from '@/types/voteRecord';
import type { HtmlVoteParseResult } from './htmlVoteTable';

export const MD_SESSION_YEAR = '2026RS';
const MD_BASE = 'https://mgaleg.maryland.gov';

export interface MdProceedingRef {
  proceedingNumber: string;
  date: string;
  mediaUrl: string;
}

export interface MdVoteRow {
  rollCallNumber: string;
  billIdentifier?: string;
  motionText: string;
  date: string;
  yea: number;
  nay: number;
  result: 'pass' | 'fail' | 'unknown';
  voteUrl: string;
  proceedingNumber: string;
}

export function mdFloorIndexUrl(): string {
  return `${MD_BASE}/mgawebsite/FloorActions/GetFloorActionIndexTable`;
}

export function mdFloorIndexBody(
  sessionYear = MD_SESSION_YEAR,
  chamber: 'House' | 'Senate' = 'House'
): string {
  return `ys=${encodeURIComponent(sessionYear)}&chamber=${encodeURIComponent(chamber)}`;
}

export function mdMediaUrl(
  proceedingNumber: string,
  sessionYear = MD_SESSION_YEAR,
  chamber: 'house' | 'senate' = 'house'
): string {
  return `${MD_BASE}/mgawebsite/FloorActions/Media/${chamber}-${proceedingNumber}-?year=${sessionYear}`;
}

function absoluteUrl(href: string, base = MD_BASE): string {
  if (href.startsWith('http')) return href;
  return new URL(href, base).toString();
}

function parseMdDate(raw: string): string {
  const parsed = new Date(raw.trim());
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }
  return raw.trim();
}

function parseTally(text: string): { yea: number; nay: number } | null {
  const pair = text.match(/\((\d+)\s*-\s*(\d+)\)/);
  if (pair) {
    return { yea: parseInt(pair[1], 10), nay: parseInt(pair[2], 10) };
  }
  const single = text.match(/^\s*(\d+)\s*$/);
  if (single) {
    const total = parseInt(single[1], 10);
    return { yea: total, nay: 0 };
  }
  return null;
}

function deriveResult(motionText: string, yea: number, nay: number): 'pass' | 'fail' | 'unknown' {
  const motion = motionText.toLowerCase();
  if (/reject|fail|defeat|lost/i.test(motion)) return 'fail';
  if (/pass|adopt|concur|approve/i.test(motion)) return 'pass';
  if (yea > nay) return 'pass';
  if (nay > yea) return 'fail';
  return 'unknown';
}

export function parseMdFloorActionIndex(
  html: string,
  baseUrl = MD_BASE
): MdProceedingRef[] {
  const $ = cheerio.load(html);
  const proceedings: MdProceedingRef[] = [];

  $('table#proceedindex tbody tr, table.table-striped tbody tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < 3) return;

    const date = parseMdDate(cells.eq(0).text());
    const link = cells.eq(2).find('a[href*="FloorActions/Media"]').first();
    const href = link.attr('href');
    if (!href) return;

    const proceedingNumber =
      href.match(/\/(house|senate)-([^/?]+)-/i)?.[2] ?? link.text().trim();
    if (!proceedingNumber) return;

    proceedings.push({
      proceedingNumber,
      date,
      mediaUrl: absoluteUrl(href, baseUrl),
    });
  });

  return proceedings;
}

export function parseMdMediaVotes(
  html: string,
  proceeding: MdProceedingRef,
  chamber: 'lower' | 'upper' = 'lower'
): MdVoteRow[] {
  const $ = cheerio.load(html);
  const votes: MdVoteRow[] = [];
  let currentBill: string | undefined;
  const chamberPath = chamber === 'upper' ? 'senate' : 'house';

  const dateMatch = $('h2').first().text().match(/\((\d{1,2}\/\d{1,2}\/\d{4})\)/);
  const pageDate = dateMatch?.[1]
    ? parseMdDate(dateMatch[1])
    : proceeding.date;

  $('table.proceedline tbody tr').each((_, row) => {
    const cell = $(row).find('td').first();
    const cellText = cell.text().replace(/\s+/g, ' ').trim();

    const billLink = cell.find('a[href*="/Legislation/Details/"]').first();
    if (billLink.length) {
      currentBill = billLink.text().replace(/\s+/g, ' ').trim();
      return;
    }

    const voteLink = cell.find(`a[href*="/votes/${chamberPath}/"]`).first();
    const voteHref = voteLink.attr('href');
    if (!voteHref) return;

    const rollCallNumber = voteHref.match(/\/(\d+)\.pdf/i)?.[1];
    if (!rollCallNumber) return;

    const tally = parseTally(voteLink.text());
    if (!tally) return;

    const motionText =
      cellText
        .replace(voteLink.text(), '')
        .replace(/\s+/g, ' ')
        .trim() || 'Roll call vote';

    if (/^quorum/i.test(motionText) && !/\(\d+\s*-\s*\d+\)/.test(voteLink.text())) {
      return;
    }

    votes.push({
      rollCallNumber,
      billIdentifier: currentBill,
      motionText,
      date: pageDate,
      yea: tally.yea,
      nay: tally.nay,
      result: deriveResult(motionText, tally.yea, tally.nay),
      voteUrl: absoluteUrl(voteHref),
      proceedingNumber: proceeding.proceedingNumber,
    });
  });

  return votes;
}

export function mdVoteToParseResult(row: MdVoteRow): HtmlVoteParseResult {
  const counts: VoteCount[] = [
    { option: 'yea', value: row.yea },
    { option: 'nay', value: row.nay },
  ];

  return {
    rollCallNumber: row.rollCallNumber,
    motionText: row.motionText,
    date: row.date,
    organization: 'House',
    organizationType: 'chamber',
    chamber: 'lower',
    billIdentifier: row.billIdentifier,
    memberVotes: [],
    counts,
    result: row.result,
  };
}
