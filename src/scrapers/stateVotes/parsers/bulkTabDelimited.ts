import type { RawMemberVote, VoteCount } from '@/types/voteRecord';
import { normalizeVoteOption } from '@/types/voteRecord';

export interface CaVoteRow {
  legislatorName: string;
  vote: string;
  party?: string;
}

export interface CaVoteParseResult {
  billIdentifier?: string;
  rollCallNumber?: string;
  motionText: string;
  date: string;
  organization: string;
  organizationType: 'chamber' | 'committee';
  memberVotes: RawMemberVote[];
  counts: VoteCount[];
}

function splitTabLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (ch === '\t' && !inQuotes) {
      result.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  result.push(current);
  return result;
}

export function parseTabDelimited(content: string): string[][] {
  return content
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0)
    .map(splitTabLine);
}

export function parseCaVoteMatrix(content: string): CaVoteParseResult {
  const rows = parseTabDelimited(content);
  if (rows.length < 2) {
    return {
      motionText: 'Roll call vote',
      date: new Date().toISOString().split('T')[0],
      organization: 'Assembly',
      organizationType: 'chamber',
      memberVotes: [],
      counts: [],
    };
  }

  const header = rows[0].map((h) => h.toLowerCase().trim());
  const nameIdx = header.findIndex((h) =>
    ['name', 'legislator', 'member'].some((k) => h.includes(k))
  );
  const voteIdx = header.findIndex((h) =>
    ['vote', 'position', 'aye', 'yea'].some((k) => h.includes(k))
  );
  const partyIdx = header.findIndex((h) => h.includes('party'));

  const memberVotes: RawMemberVote[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const name = nameIdx >= 0 ? row[nameIdx]?.trim() : row[0]?.trim();
    const voteRaw = voteIdx >= 0 ? row[voteIdx]?.trim() : row[row.length - 1]?.trim();
    if (!name || !voteRaw) continue;
    memberVotes.push({
      name,
      option: voteRaw,
      party: partyIdx >= 0 ? row[partyIdx]?.trim() : undefined,
    });
  }

  const tally = new Map<string, number>();
  for (const mv of memberVotes) {
    const opt = normalizeVoteOption(mv.option);
    tally.set(opt, (tally.get(opt) ?? 0) + 1);
  }
  const counts: VoteCount[] = Array.from(tally.entries()).map(([option, value]) => ({
    option: option as VoteCount['option'],
    value,
  }));

  const billMatch = content.match(/\b(AB|SB|ACA|SCA)\s*(\d+)/i);
  const dateMatch = content.match(/(\d{4}-\d{2}-\d{2}|\d{1,2}\/\d{1,2}\/\d{4})/);
  const isCommittee = /committee/i.test(content);

  return {
    billIdentifier: billMatch ? `${billMatch[1]} ${billMatch[2]}` : undefined,
    motionText: isCommittee ? 'Committee roll call vote' : 'Floor roll call vote',
    date: dateMatch?.[1] ?? new Date().toISOString().split('T')[0],
    organization: isCommittee ? 'Committee' : 'Assembly',
    organizationType: isCommittee ? 'committee' : 'chamber',
    memberVotes,
    counts,
  };
}

export function mapBillVersionId(
  billVersionId: string,
  billIdMap: Map<string, string>
): string | undefined {
  return billIdMap.get(billVersionId);
}
