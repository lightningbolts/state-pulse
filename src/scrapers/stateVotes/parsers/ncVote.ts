import * as cheerio from 'cheerio';
import type { RawMemberVote, VoteChamber, VoteCount } from '@/types/voteRecord';

export interface NcDiscoveredRollCall {
  rollCallNumber: string;
  chamberCode: 'H' | 'S';
  chamber: VoteChamber;
  organization: string;
  billIdentifier?: string;
  motionText: string;
  date: string;
  result: 'pass' | 'fail' | 'unknown';
  counts: VoteCount[];
  transcriptUrl: string;
}

const BASE_URL = 'https://www.ncleg.gov';

function parseNcDate(raw: string): string {
  const match = raw.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (!match) return raw.trim();
  const [, m, d, y] = match;
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

export function parseNcRollCallHistory(
  html: string,
  session: string,
  chamberCode: 'H' | 'S'
): NcDiscoveredRollCall[] {
  const $ = cheerio.load(html);
  const chamber: VoteChamber = chamberCode === 'S' ? 'upper' : 'lower';
  const organization = chamberCode === 'S' ? 'Senate' : 'House';
  const votes: NcDiscoveredRollCall[] = [];

  $('#vote-report tbody tr').each((_, row) => {
    const cells = $(row).find('td');
    if (cells.length < 10) return;

    const rollCallNumber = $(cells[0]).text().trim();
    const billLink = $(cells[3]).find('a').text().trim();
    const motionText = $(cells[4]).text().trim();
    const dateRaw = $(cells[5]).text().trim();
    const resultRaw = $(cells[6]).text().trim().toUpperCase();
    const aye = parseInt($(cells[7]).text().trim(), 10) || 0;
    const nay = parseInt($(cells[8]).text().trim(), 10) || 0;
    const notVoting = parseInt($(cells[9]).text().trim(), 10) || 0;
    const excusedAbs = parseInt($(cells[10]).text().trim(), 10) || 0;

    if (!rollCallNumber || !motionText) return;

    const counts: VoteCount[] = [
      { option: 'yea', value: aye },
      { option: 'nay', value: nay },
      { option: 'not_voting', value: notVoting },
      { option: 'absent', value: excusedAbs },
    ].filter((c) => c.value > 0);

    votes.push({
      rollCallNumber,
      chamberCode,
      chamber,
      organization,
      billIdentifier: billLink || undefined,
      motionText,
      date: parseNcDate(dateRaw),
      result: resultRaw === 'PASS' ? 'pass' : resultRaw === 'FAIL' ? 'fail' : 'unknown',
      counts,
      transcriptUrl: `${BASE_URL}/Legislation/Votes/RollCallVoteTranscript/${session}/${chamberCode}/${rollCallNumber}`,
    });
  });

  return votes;
}

function parseNameList(text: string): string[] {
  if (!text || /^none$/i.test(text.trim())) return [];
  return text
    .split(';')
    .map((n) => n.trim())
    .filter(Boolean);
}

export function parseNcRollCallTranscript(html: string): RawMemberVote[] {
  const $ = cheerio.load(html);
  const memberVotes: RawMemberVote[] = [];
  const seen = new Set<string>();

  const addVotes = (names: string[], option: string) => {
    for (const name of names) {
      const key = `${name}|${option}`;
      if (seen.has(key)) continue;
      seen.add(key);
      memberVotes.push({ name, option });
    }
  };

  $('.row.ncga-row-no-gutters .row.ncga-row-no-gutters').each((_, row) => {
    const cols = $(row).find('> .col-12');
    if (cols.length < 2) return;

    const label = cols.first().find('.font-weight-bold').text().trim();
    const namesText = cols.last().text().trim();
    if (!label || !namesText || /^none$/i.test(namesText)) return;

    if (/^Ayes?\b/i.test(label)) {
      addVotes(parseNameList(namesText), 'Yea');
    } else if (/^Noes?\b/i.test(label)) {
      addVotes(parseNameList(namesText), 'Nay');
    } else if (/^Excused Absence/i.test(label)) {
      addVotes(parseNameList(namesText), 'Absent');
    } else if (/^Not Voting/i.test(label)) {
      addVotes(parseNameList(namesText), 'NV');
    } else if (/^Excused Vote/i.test(label)) {
      addVotes(parseNameList(namesText), 'Present');
    }
  });

  return memberVotes;
}
