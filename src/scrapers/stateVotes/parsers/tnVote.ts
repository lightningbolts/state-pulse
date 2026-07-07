import * as cheerio from 'cheerio';
import type { RawMemberVote } from '@/types/voteRecord';
import type { HtmlVoteParseResult } from './htmlVoteTable';

export const TN_GENERAL_ASSEMBLY = '114';

interface TnVoteBlock {
  billIdentifier: string;
  motionText: string;
  date: string;
  chamber: 'lower' | 'upper';
  organizationType: 'chamber' | 'committee';
  result: 'pass' | 'fail';
  yea: number;
  nay: number;
  present: number;
  memberVotes: RawMemberVote[];
}

function parseTnDate(raw: string): string {
  const m = raw.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
  return m?.[1] ?? raw;
}

function parseMemberList(text: string, option: string): RawMemberVote[] {
  return text
    .split(',')
    .map((n) => n.trim().replace(/\s+--\s+\d+\.?$/, ''))
    .filter((n) => n.length > 1)
    .map((name) => ({ name: name.replace(/\s+--\s+\d+$/, '').trim(), option }));
}

function chamberFromBlock(text: string): 'lower' | 'upper' {
  if (/Senators voting/i.test(text) || /\bSENATE\b/.test(text)) return 'upper';
  return 'lower';
}

function organizationTypeFromMotion(motion: string): 'chamber' | 'committee' {
  return /COMMITTEE|SUBCOMMITTEE/i.test(motion) ? 'committee' : 'chamber';
}

export function parseTnBillVotes(html: string): HtmlVoteParseResult[] {
  const $ = cheerio.load(html);
  const text =
    $('#tabpanel-votes, [data-tab="votes"], [aria-label="House Votes"]').text() ||
    $('body').text();

  const blocks: TnVoteBlock[] = [];
  const votePattern =
    /((?:HB|SB|HJR|SJR|HCR|SCR)\d+)\s+by\s+[^-]+-\s+([^0-9]+?)\s+(\d{1,2}\/\d{1,2}\/\d{4})\s*(Passed|Failed)/gi;

  let match: RegExpExecArray | null;
  while ((match = votePattern.exec(text)) !== null) {
    const billIdentifier = match[1].replace(/(\D)(\d+)/, '$1 $2');
    const motionText = match[2].replace(/\s+/g, ' ').trim();
    const date = parseTnDate(match[3]);
    const result = match[4].toLowerCase() === 'passed' ? 'pass' : 'fail';
    const slice = text.slice(match.index, match.index + 2500);
    const yea = parseInt(slice.match(/Ayes\.+?(\d+)/i)?.[1] ?? '0', 10);
    const nay = parseInt(slice.match(/Noes\.+?(\d+)/i)?.[1] ?? '0', 10);
    const present = parseInt(
      slice.match(/Present and not voting\.+?(\d+)/i)?.[1] ?? '0',
      10
    );

    const memberVotes: RawMemberVote[] = [];
    const ayeMatch = slice.match(
      /(?:Representatives|Senators) voting Aye were:\s*([^.<]+)/i
    );
    const nayMatch = slice.match(
      /(?:Representatives|Senators) voting No were:\s*([^.<]+)/i
    );
    const pnvMatch = slice.match(
      /(?:Representatives|Senators) present and not voting were:\s*([^.<]+)/i
    );
    if (ayeMatch) memberVotes.push(...parseMemberList(ayeMatch[1], 'Yea'));
    if (nayMatch) memberVotes.push(...parseMemberList(nayMatch[1], 'Nay'));
    if (pnvMatch) memberVotes.push(...parseMemberList(pnvMatch[1], 'Not Voting'));

    const chamber = chamberFromBlock(slice);
    blocks.push({
      billIdentifier,
      motionText,
      date,
      chamber,
      organizationType: organizationTypeFromMotion(motionText),
      result,
      yea,
      nay,
      present,
      memberVotes,
    });
  }

  return blocks.map((b, i) => ({
    rollCallNumber: `${b.billIdentifier}-${i + 1}`,
    motionText: b.motionText,
    date: b.date,
    organization:
      b.organizationType === 'committee'
        ? 'Committee'
        : b.chamber === 'upper'
          ? 'Senate'
          : 'House',
    organizationType: b.organizationType,
    chamber: b.chamber,
    billIdentifier: b.billIdentifier,
    memberVotes: b.memberVotes,
    counts: [
      { option: 'yea', value: b.yea },
      { option: 'nay', value: b.nay },
      ...(b.present ? [{ option: 'present' as const, value: b.present }] : []),
    ],
    result: b.result,
  }));
}

export function tnBillUrl(billNumber: string, ga = TN_GENERAL_ASSEMBLY): string {
  const normalized = billNumber.replace(/\s+/g, '');
  return `https://wapp.capitol.tn.gov/apps/BillInfo/Default?BillNumber=${encodeURIComponent(normalized)}&ga=${ga}`;
}

export function toTnBillNumber(identifier: string): string {
  return identifier.replace(/\s+/g, '').toUpperCase();
}
