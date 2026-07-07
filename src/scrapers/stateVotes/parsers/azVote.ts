import type { RawMemberVote, VoteCount } from '@/types/voteRecord';
import type { HtmlVoteParseResult } from './htmlVoteTable';

const API_BASE = 'https://apps.azleg.gov/api';

export const AZ_SESSION_ID = 130; // 57th legislature, 2nd regular (2025-2026)

export interface AzBillHeader {
  BillStatusActionId: number;
  ActionDate?: string;
  CommitteeShortName?: string;
  CommitteeName?: string;
  LegislativeBody?: string;
  TotalVotes?: number;
  ReferralNumber?: number;
}

export interface AzVoteRecord {
  Action?: string;
  ReportDate?: string;
  Ayes?: number;
  Nays?: number;
  Present?: number;
  Absent?: number;
  NotVoting?: number;
  Excused?: number;
  Votes?: {
    Vote?: string;
    Legislator?: {
      FullName?: string;
      MemberShortName?: string;
      Party?: string;
    };
  }[];
}

export function azBillApiUrl(
  billNumber: string,
  sessionId: number,
  body: 'H' | 'S'
): string {
  return `${API_BASE}/Bill/?billNumber=${encodeURIComponent(billNumber)}&sessionId=${sessionId}&legislativeBody=${body}`;
}

export function azVoteApiUrl(
  billStatusId: number,
  billStatusActionId: number
): string {
  return `${API_BASE}/BillStatusFloorAction?billStatusId=${billStatusId}&billStatusActionId=${billStatusActionId}&includeVotes=true`;
}

export function parseAzVoteAction(
  action: AzVoteRecord,
  billNumber: string,
  header: AzBillHeader
): HtmlVoteParseResult {
  const chamber = header.LegislativeBody === 'S' ? 'upper' : 'lower';
  const organization =
    header.CommitteeShortName === 'COW' || header.CommitteeName
      ? header.CommitteeName ?? 'Committee'
      : chamber === 'upper'
        ? 'Senate'
        : 'House';

  const memberVotes: RawMemberVote[] = [];
  for (const v of action.Votes ?? []) {
    const name =
      v.Legislator?.FullName ?? v.Legislator?.MemberShortName ?? 'Unknown';
    const voteRaw = v.Vote ?? '';
    const option =
      voteRaw === 'Y' ? 'Yea' : voteRaw === 'N' ? 'Nay' : voteRaw === 'P' ? 'Present' : 'Absent';
    memberVotes.push({
      name,
      option,
      party: v.Legislator?.Party,
    });
  }

  const counts = tallyAzCounts(action, memberVotes);
  const yea = counts.find((c) => c.option === 'yea')?.value ?? 0;
  const nay = counts.find((c) => c.option === 'nay')?.value ?? 0;
  const dateRaw = action.ReportDate ?? header.ActionDate ?? '';
  const date = dateRaw.split('T')[0] || new Date().toISOString().split('T')[0];

  return {
    rollCallNumber: String(header.BillStatusActionId),
    motionText: action.Action ?? 'Roll call vote',
    date,
    organization,
    organizationType:
      header.CommitteeShortName && header.CommitteeShortName !== 'COW'
        ? 'committee'
        : 'chamber',
    chamber,
    billIdentifier: billNumber,
    memberVotes,
    counts,
    result: yea >= nay ? 'pass' : 'fail',
  };
}

function tallyAzCounts(
  action: AzVoteRecord,
  memberVotes: RawMemberVote[]
): VoteCount[] {
  if (memberVotes.length) {
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
      option: option as VoteCount['option'],
      value,
    }));
  }

  const counts: VoteCount[] = [];
  if (action.Ayes) counts.push({ option: 'yea', value: action.Ayes });
  if (action.Nays) counts.push({ option: 'nay', value: action.Nays });
  if (action.Present) counts.push({ option: 'present', value: action.Present });
  if (action.NotVoting) counts.push({ option: 'not_voting', value: action.NotVoting });
  if (action.Absent) counts.push({ option: 'absent', value: action.Absent });
  return counts;
}

export async function fetchAzBillNumbers(sessionId: number): Promise<string[]> {
  const url = `${API_BASE}/BillStatusFloorAction/?sessionId=${sessionId}`;
  const response = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 StatePulse/1.0' },
  });
  if (!response.ok) return [];
  const data = (await response.json()) as { BillNumber?: string }[];
  const seen = new Set<string>();
  const numbers: string[] = [];
  for (const row of data) {
    const num = row.BillNumber;
    if (!num || seen.has(num)) continue;
    seen.add(num);
    numbers.push(num);
  }
  return numbers;
}
