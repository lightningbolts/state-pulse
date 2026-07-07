import * as cheerio from 'cheerio';
import type { RawMemberVote, VoteCount } from '@/types/voteRecord';
import type { HtmlVoteParseResult } from './htmlVoteTable';

const CO_BASE = 'https://leg.colorado.gov';

export const CO_OPENSTATES_SESSION = '2026A';

export interface CoBillVoteLink {
  voteId: string;
  url: string;
  date?: string;
  motionText?: string;
  calendar?: string;
  billIdentifier?: string;
}

export function toCoBillSlug(identifier: string): string {
  const normalized = identifier.replace(/\s+/g, '').toUpperCase();
  const match = normalized.match(/^([A-Z]+)(\d+)$/);
  if (!match) return identifier;
  return `${match[1]}26-${match[2]}`;
}

export function coBillUrl(billSlug: string): string {
  return `${CO_BASE}/bills/${encodeURIComponent(billSlug)}`;
}

export function coFloorVoteUrl(voteId: string): string {
  return `${CO_BASE}/bill_votes/${voteId}`;
}

export function parseCoBillVoteLinks(
  html: string,
  billIdentifier?: string
): CoBillVoteLink[] {
  const $ = cheerio.load(html);
  const links: CoBillVoteLink[] = [];
  const seen = new Set<string>();

  $('a[href*="/bill_votes/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const voteId = href.match(/bill_votes\/(\d+)/i)?.[1];
    if (!voteId || seen.has(voteId)) return;
    seen.add(voteId);

    const row = $(el).closest('tr');
    const date =
      row.find('td[data-label="Date"]').first().text().trim() ||
      row.find('td').first().text().trim() ||
      undefined;
    const motionText =
      row.find('td[data-label="Motion"]').first().text().trim() || undefined;
    const calendar =
      row.find('td[data-label="Calendar"]').first().text().trim() || undefined;

    const url = href.startsWith('http')
      ? href
      : new URL(href, CO_BASE).toString();

    links.push({
      voteId,
      url,
      date,
      motionText,
      calendar,
      billIdentifier,
    });
  });

  return links;
}

function parseCoDate(raw: string): string {
  const match = raw.match(/(\d{1,2}\/\d{1,2}\/\d{4})/);
  return match?.[1] ?? raw.trim();
}

function chamberFromHeading(text: string): 'lower' | 'upper' {
  return /senate/i.test(text) ? 'upper' : 'lower';
}

export function parseCoFloorVote(html: string): HtmlVoteParseResult {
  const $ = cheerio.load(html);
  const billIdentifier =
    $('.tag-heading-white').first().text().trim().replace(/\s+/g, '') || undefined;
  const motionHeading = $('h2').first().text().trim();
  const chamberText = $('h3').first().text().trim();
  const chamber = chamberFromHeading(chamberText);

  const summaryRow = $('table').first().find('tbody tr').first();
  const calendar = summaryRow.find('td[data-label="Calendar"]').text().trim();
  const motion =
    summaryRow.find('td[data-label="Motion"]').text().trim() || 'Roll call vote';
  const votedOn =
    summaryRow.find('td[data-label="Voted on"]').text().trim() ||
    $('td[data-label="Date"]').first().text().trim();
  const date = parseCoDate(votedOn);

  const counts: VoteCount[] = [];
  $('.count-tag').each((_, el) => {
    const value = parseInt($(el).text().trim(), 10);
    if (!Number.isFinite(value)) return;
    const label =
      $(el).closest('td').find('span[id^="tooltip-"]').first().text().trim() ||
      $(el).attr('class') ||
      '';
    const option = /no/i.test(label)
      ? 'nay'
      : /yes|aye/i.test(label)
        ? 'yea'
        : /absent/i.test(label)
          ? 'absent'
          : /excused/i.test(label)
            ? 'not_voting'
            : 'other';
    counts.push({ option, value });
  });

  const memberVotes: RawMemberVote[] = [];
  $('h3').each((_, heading) => {
    const text = $(heading).text();
    if (!/Votes by/i.test(text)) return;
    $(heading)
      .parent()
      .find('table tbody tr')
      .each((__, row) => {
        const name = $(row).find('td').first().text().trim();
        const voteTag = $(row).find('.vote-tag').first().text().trim();
        if (!name || !voteTag || /voice vote/i.test(voteTag)) return;
        memberVotes.push({ name, option: voteTag });
      });
  });

  const yea = counts.find((c) => c.option === 'yea')?.value ?? 0;
  const nay = counts.find((c) => c.option === 'nay')?.value ?? 0;

  return {
    rollCallNumber: billIdentifier,
    motionText: [calendar, motion].filter(Boolean).join(' - ') || motionHeading,
    date,
    organization: chamber === 'upper' ? 'Senate' : 'House',
    organizationType: 'chamber',
    chamber,
    billIdentifier: billIdentifier?.replace(/([A-Z]+)(\d+)/, '$1 $2'),
    memberVotes,
    counts,
    result: yea >= nay ? 'pass' : 'fail',
  };
}
