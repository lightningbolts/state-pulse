import type { RawMemberVote, VoteCount } from '@/types/voteRecord';
import type { HtmlVoteParseResult } from './htmlVoteTable';

export const VA_DEFAULT_SESSION_CODE = '251';

export interface VaHistoryRow {
  billId: string;
  date: string;
  description: string;
  voteRefId?: string;
}

export interface VaMemberRow {
  memberId: string;
  name: string;
  chamber: 'lower' | 'upper';
}

export interface VaCsvBundle {
  votesCsv: string;
  membersCsv: string;
  historyCsv: string;
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === ',' && !inQuotes) {
      cells.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  cells.push(current);
  return cells.map((c) => c.trim());
}

function parseCsv(content: string): string[][] {
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map(parseCsvLine);
}

export function parseVaMembersCsv(csv: string): Map<string, VaMemberRow> {
  const rows = parseCsv(csv);
  const header = rows[0] ?? [];
  const idIdx = header.findIndex((h) => /MBR_MBRID/i.test(h));
  const nameIdx = header.findIndex((h) => /MBR_NAME/i.test(h));
  const chamberIdx = header.findIndex((h) => /MBR_HOU/i.test(h));
  const map = new Map<string, VaMemberRow>();

  for (const row of rows.slice(1)) {
    const memberId = row[idIdx]?.trim();
    const name = row[nameIdx]?.trim();
    if (!memberId || !name) continue;
    const chamber = row[chamberIdx]?.trim().toUpperCase() === 'S' ? 'upper' : 'lower';
    map.set(memberId, { memberId, name: name.replace(/\s+/g, ' '), chamber });
  }

  return map;
}

export function parseVaHistoryCsv(csv: string): Map<string, VaHistoryRow> {
  const rows = parseCsv(csv);
  const map = new Map<string, VaHistoryRow>();

  for (const row of rows.slice(1)) {
    const billId = row[0];
    const date = row[1];
    const description = row[2];
    const voteRefId = row[3]?.trim();
    if (!voteRefId) continue;
    map.set(voteRefId, {
      billId,
      date,
      description,
      voteRefId,
    });
  }

  return map;
}

function parseVoteOption(raw: string): string {
  switch (raw.trim().toUpperCase()) {
    case 'Y':
      return 'Yea';
    case 'N':
      return 'Nay';
    case 'X':
      return 'Not Voting';
    default:
      return raw;
  }
}

function parseTallyFromDescription(description: string): VoteCount[] {
  const match = description.match(/\((\d+)-Y\s+(\d+)-N\)/i);
  if (!match) return [];
  return [
    { option: 'yea', value: parseInt(match[1], 10) },
    { option: 'nay', value: parseInt(match[2], 10) },
  ];
}

export function parseVaVotesCsv(
  bundle: VaCsvBundle
): HtmlVoteParseResult[] {
  const members = parseVaMembersCsv(bundle.membersCsv);
  const history = parseVaHistoryCsv(bundle.historyCsv);
  const rows = parseCsv(bundle.votesCsv);
  const results: HtmlVoteParseResult[] = [];

  for (const row of rows) {
    const voteRefId = row[0];
    if (!voteRefId) continue;

    const meta = history.get(voteRefId);
    const memberVotes: RawMemberVote[] = [];
    let chamber: 'lower' | 'upper' = voteRefId.startsWith('S') ? 'upper' : 'lower';

    for (let i = 1; i + 1 < row.length; i += 2) {
      const memberId = row[i]?.trim();
      const vote = row[i + 1]?.trim();
      if (!memberId || !vote) continue;
      const member = members.get(memberId);
      if (member) chamber = member.chamber;
      memberVotes.push({
        name: member?.name ?? memberId,
        option: parseVoteOption(vote),
        externalId: memberId,
      });
    }

    const tally = parseTallyFromDescription(meta?.description ?? '');
    const counts = tally.length ? tally : aggregateMemberCounts(memberVotes);
    const yea = counts.find((c) => c.option === 'yea')?.value ?? 0;
    const nay = counts.find((c) => c.option === 'nay')?.value ?? 0;

    results.push({
      rollCallNumber: voteRefId,
      motionText: meta?.description ?? 'Roll call vote',
      date: meta?.date ?? '',
      organization: chamber === 'upper' ? 'Senate' : 'House',
      organizationType: /committee/i.test(meta?.description ?? '')
        ? 'committee'
        : 'chamber',
      chamber,
      billIdentifier: meta?.billId?.replace(/([A-Z]+)(\d+)/, '$1 $2'),
      memberVotes,
      counts,
      result: yea >= nay ? 'pass' : 'fail',
    });
  }

  return results;
}

function aggregateMemberCounts(memberVotes: RawMemberVote[]): VoteCount[] {
  const tally = new Map<string, number>();
  for (const vote of memberVotes) {
    const key = vote.option.toLowerCase().includes('nay')
      ? 'nay'
      : vote.option.toLowerCase().includes('yea')
        ? 'yea'
        : 'not_voting';
    tally.set(key, (tally.get(key) ?? 0) + 1);
  }
  return Array.from(tally.entries()).map(([option, value]) => ({
    option: option as 'yea' | 'nay' | 'not_voting',
    value,
  }));
}

export function vaCsvUrl(
  sessionCode: string,
  fileName: 'Vote.csv' | 'Members.csv' | 'History.csv',
  useLegacy = false
): string {
  const host = useLegacy
    ? 'https://legacylis.virginia.gov'
    : 'https://lis.virginia.gov';
  return `${host}/SiteInformation/csv/${sessionCode}/${fileName}`;
}
