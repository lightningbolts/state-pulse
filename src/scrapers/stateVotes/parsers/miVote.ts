import * as cheerio from 'cheerio';
import type { RawMemberVote, VoteCount, VoteChamber } from '@/types/voteRecord';
import { normalizeVoteDate } from '@/types/voteRecord';
import type { HtmlVoteParseResult } from './htmlVoteTable';

export const MI_SESSION = '2025-2026';
const MI_LEGISLATURE = 'https://legislature.mi.gov';
const MI_VOTES = 'https://www.michiganvotes.org';

export interface MiBillRef {
  objectName: string;
  billIdentifier: string;
}

export interface MiRollCallRef {
  rollCallNumber: string;
  chamber: VoteChamber;
  date: string;
  billIdentifier?: string;
  billObjectName?: string;
  counts: VoteCount[];
  url: string;
}

export function miHouseBillSearchUrl(): string {
  return `${MI_LEGISLATURE}/Search/ExecuteSearch?sessions=${encodeURIComponent(MI_SESSION)}&docTypes=${encodeURIComponent('House Bill')}&number=`;
}

export function miSenateBillSearchUrl(): string {
  return `${MI_LEGISLATURE}/Search/ExecuteSearch?sessions=${encodeURIComponent(MI_SESSION)}&docTypes=${encodeURIComponent('Senate Bill')}&number=`;
}

export function miBillUrl(objectName: string): string {
  return `${MI_LEGISLATURE}/Bills/Bill?ObjectName=${encodeURIComponent(objectName)}`;
}

export function miRollCallUrl(
  year: number,
  chamber: VoteChamber,
  rollCallNumber: string
): string {
  const chamberSlug = chamber === 'upper' ? 'senate' : 'house';
  return `${MI_VOTES}/votes/${year}/${chamberSlug}/roll-call-${rollCallNumber}`;
}

function objectNameToIdentifier(objectName: string): string {
  const match = objectName.match(/^(\d{4})-([A-Z]+)-(\d+)$/i);
  if (!match) return objectName;
  return `${match[2].toUpperCase()} ${match[3]}`;
}

function billNumberFromObjectName(objectName: string): number {
  const match = objectName.match(/-(\d+)$/);
  return match ? parseInt(match[1], 10) : 0;
}

export function parseMiSearchBillRefs(html: string): MiBillRef[] {
  const refs = new Map<string, MiBillRef>();
  const pattern = /objectName=([0-9]{4}-[A-Za-z]+-\d+)/gi;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(html)) !== null) {
    const objectName = match[1].toUpperCase();
    if (refs.has(objectName)) continue;
    refs.set(objectName, {
      objectName,
      billIdentifier: objectNameToIdentifier(objectName),
    });
  }

  return Array.from(refs.values()).sort(
    (a, b) => billNumberFromObjectName(b.objectName) - billNumberFromObjectName(a.objectName)
  );
}

function chamberFromJournal(htmlFragment: string): VoteChamber {
  if (/-SJ-/i.test(htmlFragment) || />\s*SJ\s/i.test(htmlFragment)) {
    return 'upper';
  }
  return 'lower';
}

function parseTallies(text: string): VoteCount[] {
  const counts: VoteCount[] = [];
  const patterns: [RegExp, VoteCount['option']][] = [
    [/Yeas\s+(\d+)/i, 'yea'],
    [/Nays\s+(\d+)/i, 'nay'],
    [/Excused\s+(\d+)/i, 'not_voting'],
    [/Not Voting\s+(\d+)/i, 'not_voting'],
  ];
  for (const [regex, option] of patterns) {
    const match = text.match(regex);
    if (match) counts.push({ option, value: parseInt(match[1], 10) });
  }
  return counts;
}

function parseMiDate(raw: string): string {
  const trimmed = raw.trim();
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) {
    const [, m, d, y] = match;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  return normalizeVoteDate(trimmed);
}

export function parseMiBillRollCalls(
  html: string,
  billObjectName?: string
): MiRollCallRef[] {
  const $ = cheerio.load(html);
  const billIdentifier =
    objectNameToIdentifier(billObjectName ?? '') ||
    $('h1').first().text().replace(/\s+/g, ' ').trim() ||
    undefined;

  const rollCalls: MiRollCallRef[] = [];
  const seen = new Set<string>();

  $('#History tbody tr').each((_, tr) => {
    const $tr = $(tr);
    const date = parseMiDate($tr.find('td').first().text());
    const journalHtml = $tr.find('td').eq(1).html() ?? '';
    const action = $tr.find('td').last().text().replace(/\s+/g, ' ').trim();
    const rollMatch = action.match(/Roll Call\s*#?\s*(\d+)/i);
    if (!rollMatch) return;

    const rollCallNumber = rollMatch[1];
    const chamber = chamberFromJournal(journalHtml);
    const year = parseInt(date.slice(0, 4), 10);
    if (!year) return;

    const key = `${year}-${chamber}-${rollCallNumber}`;
    if (seen.has(key)) return;
    seen.add(key);

    rollCalls.push({
      rollCallNumber,
      chamber,
      date,
      billIdentifier,
      billObjectName,
      counts: parseTallies(action),
      url: miRollCallUrl(year, chamber, rollCallNumber),
    });
  });

  return rollCalls;
}

function parseMemberList(
  $: cheerio.CheerioAPI,
  container: cheerio.Cheerio<cheerio.Element>,
  option: string
): RawMemberVote[] {
  const members: RawMemberVote[] = [];
  container.find('li a').each((_, link) => {
    const text = $(link).text().replace(/\s+/g, ' ').trim();
    const match = text.match(/^(.+?)\s*\(([A-Z])-(\d+)\)$/);
    if (match) {
      members.push({
        name: match[1].trim(),
        option,
        party: match[2],
        district: match[3],
      });
      return;
    }
    if (text) members.push({ name: text, option });
  });
  return members;
}

export function billHeadingToObjectName(heading: string): string | undefined {
  const house = heading.match(/(\d{4})\s+House Bill\s+(\d+)/i);
  if (house) return `${house[1]}-HB-${house[2]}`;
  const senate = heading.match(/(\d{4})\s+Senate Bill\s+(\d+)/i);
  if (senate) return `${senate[1]}-SB-${senate[2]}`;
  return undefined;
}

export interface MiRollCallSummary {
  rollCallNumber: string;
  chamber: VoteChamber;
  billIdentifier: string;
  billObjectName?: string;
  motionText: string;
  url: string;
}

export function parseMiRollCallSummary(html: string, url: string): MiRollCallSummary | null {
  const $ = cheerio.load(html);
  const heading = $('.resolution-title h1').first().text().replace(/\s+/g, ' ').trim();
  if (!heading || /page not found/i.test($('title').text())) return null;

  const billIdentifier =
    heading.match(/\d{4}\s+(?:House|Senate)\s+Bill\s+\d+/i)?.[0] ?? heading;
  const billObjectName = billHeadingToObjectName(heading);
  const motionHeading = $('.resolution-title h2').first().text().replace(/\s+/g, ' ').trim();
  const rollCallNumber = motionHeading.match(/Roll Call\s+(\d+)/i)?.[1];
  if (!rollCallNumber) return null;

  const chamber: VoteChamber = /senate roll call/i.test(motionHeading)
    ? 'upper'
    : 'lower';

  return {
    rollCallNumber,
    chamber,
    billIdentifier,
    billObjectName,
    motionText: motionHeading,
    url,
  };
}

export function parseMiRollCallPage(html: string): HtmlVoteParseResult {
  const summary = parseMiRollCallSummary(html, '');
  const $ = cheerio.load(html);
  const heading = $('.resolution-title h2').first().text().replace(/\s+/g, ' ').trim();
  const chamber: VoteChamber =
    summary?.chamber ?? (/senate/i.test(heading) ? 'upper' : 'lower');
  const rollCallNumber = summary?.rollCallNumber;
  const billIdentifier = summary?.billIdentifier;

  const counts: VoteCount[] = [];
  $('table.roll-call').first().find('th').first().each((_, th) => {
    const text = $(th).text().replace(/\s+/g, ' ');
    counts.push(...parseTallies(text));
  });

  const memberVotes: RawMemberVote[] = [];
  $('td.yeas').each((_, cell) => {
    memberVotes.push(...parseMemberList($, $(cell), 'yea'));
  });
  $('td.nays').each((_, cell) => {
    memberVotes.push(...parseMemberList($, $(cell), 'nay'));
  });
  $('td.not-voting').each((_, cell) => {
    memberVotes.push(...parseMemberList($, $(cell), 'not_voting'));
  });

  const yea = counts.find((c) => c.option === 'yea')?.value ?? 0;
  const nay = counts.find((c) => c.option === 'nay')?.value ?? 0;
  const result = /fail/i.test(heading)
    ? 'fail'
    : /pass/i.test(heading) || yea > nay
      ? 'pass'
      : 'unknown';

  return {
    rollCallNumber,
    motionText: heading || 'Roll call vote',
    date: new Date().toISOString().split('T')[0],
    organization: chamber === 'upper' ? 'Senate' : 'House',
    organizationType: 'chamber',
    chamber,
    billIdentifier,
    memberVotes,
    counts,
    result,
  };
}
