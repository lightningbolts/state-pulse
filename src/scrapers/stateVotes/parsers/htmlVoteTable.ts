import * as cheerio from 'cheerio';
import type { OrganizationType, RawMemberVote, VoteChamber, VoteCount } from '@/types/voteRecord';
import { normalizeVoteOption } from '@/types/voteRecord';

export class ParseError extends Error {
  constructor(
    message: string,
    public readonly selector?: string
  ) {
    super(message);
    this.name = 'ParseError';
  }
}

export interface HtmlVoteParseResult {
  rollCallNumber?: string;
  motionText: string;
  date: string;
  organization: string;
  organizationType: OrganizationType;
  chamber: VoteChamber;
  billIdentifier?: string;
  memberVotes: RawMemberVote[];
  counts: VoteCount[];
  result?: 'pass' | 'fail' | 'unknown';
}

export interface HtmlVoteParserConfig {
  memberTableSelector?: string;
  memberNameSelector?: string;
  memberVoteSelector?: string;
  tallySelector?: string;
  motionSelector?: string;
  dateSelector?: string;
  rollCallSelector?: string;
  billSelector?: string;
  organizationType?: OrganizationType;
  chamber?: VoteChamber;
  organization?: string;
  /** When true, throw ParseError if the member table selector matches nothing */
  requireMemberTable?: boolean;
}

function parseTallyText(text: string): VoteCount[] {
  const counts: VoteCount[] = [];
  const patterns: [RegExp, 'yea' | 'nay' | 'present' | 'not_voting'][] = [
    [/yea[s]?\s*:?\s*(\d+)/i, 'yea'],
    [/nay[s]?\s*:?\s*(\d+)/i, 'nay'],
    [/present\s*:?\s*(\d+)/i, 'present'],
    [/(?:not voting|nv|absent)\s*:?\s*(\d+)/i, 'not_voting'],
  ];
  for (const [regex, option] of patterns) {
    const match = text.match(regex);
    if (match) counts.push({ option, value: parseInt(match[1], 10) });
  }
  return counts;
}

export function parseHtmlVotePage(
  html: string,
  config: HtmlVoteParserConfig = {}
): HtmlVoteParseResult {
  const $ = cheerio.load(html);
  const bodyText = $('body').text();

  const motionText =
    (config.motionSelector ? $(config.motionSelector).first().text() : '') ||
    $('h1, h2, .motion, #motion').first().text() ||
    'Roll call vote';
  const motion = motionText.trim() || 'Roll call vote';

  const dateRaw =
    (config.dateSelector ? $(config.dateSelector).first().text() : '') ||
    bodyText.match(/(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2})/)?.[1] ||
    new Date().toISOString().split('T')[0];

  const rollCallNumber =
    (config.rollCallSelector ? $(config.rollCallSelector).first().text() : '') ||
    bodyText.match(/roll\s*call\s*#?\s*(\d+)/i)?.[1] ||
    undefined;

  const billIdentifier =
    (config.billSelector ? $(config.billSelector).first().text() : '') ||
    bodyText.match(/\b([HS][BJCR]\s*\d+[A-Z]?)\b/i)?.[1]?.replace(/\s+/g, ' ') ||
    undefined;

  const memberVotes: RawMemberVote[] = [];
  const tableSelector =
    config.memberTableSelector ?? 'table.vote-table, table#vote-table, table';

  const tables = $(tableSelector);
  if (!tables.length && config.requireMemberTable && config.memberTableSelector) {
    throw new ParseError(
      `No member table found with selector: ${config.memberTableSelector}`,
      config.memberTableSelector
    );
  }

  tables.each((_, table) => {
    $(table)
      .find('tr')
      .each((__, row) => {
        const cells = $(row).find('td');
        if (cells.length < 2) return;
        const nameCell = config.memberNameSelector
          ? $(row).find(config.memberNameSelector)
          : cells.first();
        const voteCell = config.memberVoteSelector
          ? $(row).find(config.memberVoteSelector)
          : cells.last();
        const name = nameCell.text().trim();
        const voteRaw = voteCell.text().trim();
        if (!name || !voteRaw) return;
        if (/^(name|member|legislator|vote)$/i.test(name)) return;
        memberVotes.push({ name, option: voteRaw });
      });
  });

  const tallyText =
    (config.tallySelector ? $(config.tallySelector).text() : '') || bodyText;
  const counts = parseTallyText(tallyText);

  const orgLower = bodyText.toLowerCase();
  const organizationType: OrganizationType =
    config.organizationType ??
    (orgLower.includes('committee') ? 'committee' : 'chamber');

  let chamber: VoteChamber = config.chamber ?? 'lower';
  if (!config.chamber) {
    if (orgLower.includes('senate')) chamber = 'upper';
    else if (orgLower.includes('house')) chamber = 'lower';
  }

  const organization =
    config.organization ??
    (organizationType === 'committee'
      ? $('h1, h2').first().text().trim() || 'Committee'
      : chamber === 'upper'
        ? 'Senate'
        : 'House');

  const yea = counts.find((c) => c.option === 'yea')?.value ?? 0;
  const nay = counts.find((c) => c.option === 'nay')?.value ?? 0;
  const result = yea > nay ? 'pass' : nay > yea ? 'fail' : 'unknown';

  return {
    rollCallNumber: rollCallNumber?.replace(/\D/g, '') || rollCallNumber,
    motionText: motion,
    date: dateRaw.trim(),
    organization: organization.trim(),
    organizationType,
    chamber,
    billIdentifier: billIdentifier?.trim(),
    memberVotes,
    counts,
    result,
  };
}

export function parseFlVoteDetail(html: string): HtmlVoteParseResult {
  const isCommittee = /committee/i.test(html);
  return parseHtmlVotePage(html, {
    memberTableSelector: 'table',
    organizationType: isCommittee ? 'committee' : 'chamber',
    chamber: /senate/i.test(html) ? 'upper' : 'lower',
    organization: isCommittee ? 'Committee' : /senate/i.test(html) ? 'Senate' : 'House',
  });
}

export function parseMnHouseVoteDetail(html: string): HtmlVoteParseResult {
  return parseHtmlVotePage(html, {
    memberTableSelector: 'table',
    chamber: 'lower',
    organization: 'House',
    organizationType: 'chamber',
  });
}

export function parseGenericChamberVoteDetail(
  html: string,
  chamber: VoteChamber,
  organization: string
): HtmlVoteParseResult {
  return parseHtmlVotePage(html, {
    chamber,
    organization,
    organizationType: /committee/i.test(html) ? 'committee' : 'chamber',
  });
}

export function parseVoteIndexLinks(
  html: string,
  baseUrl: string,
  linkPattern?: RegExp
): { url: string; rollCallNumber?: string; date?: string }[] {
  const $ = cheerio.load(html);
  const links: { url: string; rollCallNumber?: string; date?: string }[] = [];
  const pattern = linkPattern ?? /vote|roll/i;

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href || !pattern.test(href)) return;
    const text = $(el).text();
    const rollMatch = text.match(/(\d+)/);
    const dateMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
    const absolute = href.startsWith('http')
      ? href
      : new URL(href, baseUrl).toString();
    links.push({
      url: absolute,
      rollCallNumber: rollMatch?.[1],
      date: dateMatch?.[1],
    });
  });
  return links;
}

export function memberVotesToDisplayOptions(votes: RawMemberVote[]): RawMemberVote[] {
  return votes.map((v) => ({
    ...v,
    option: normalizeVoteOption(v.option),
  }));
}
