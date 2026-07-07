import * as cheerio from 'cheerio';
import type { RawMemberVote, VoteCount } from '@/types/voteRecord';
import type { HtmlVoteParseResult } from './htmlVoteTable';

function parsePaDate(text: string): string {
  const m = text.match(
    /(\w+day\s+\w+\s+\d{1,2},\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4})/
  );
  return m?.[1] ?? new Date().toISOString().split('T')[0];
}

export function parsePaRollCallSummary(html: string): HtmlVoteParseResult[] {
  const $ = cheerio.load(html);
  const results: HtmlVoteParseResult[] = [];

  const rollCallNumber =
    $('title').text().match(/#(\d+)/)?.[1] ??
    html.match(/Roll Call Vote Summary #(\d+)/i)?.[1];

  const dateText = $('body').text();
  const date = parsePaDate(dateText);

  const billIdentifier =
    $('a[href*="billNum="]').first().attr('href')?.match(/billNum=(\d+)/)?.[1];
  const billBody =
    $('a[href*="billBody="]').first().attr('href')?.match(/billBody=([HS])/i)?.[1];
  const bill =
    billBody && billIdentifier
      ? `${billBody}B ${billIdentifier}`
      : billIdentifier;

  const motionText =
    $('h1').first().text().trim() ||
    $('a[href*="roll-calls/bybill"]').first().text().trim() ||
    'Roll call vote';

  const memberVotes: RawMemberVote[] = [];
  const seen = new Set<string>();

  $('.rc-member').each((_, el) => {
    const block = $(el);
    const name =
      block.find("a[href*='/house/members/bio']").first().text().trim() ||
      block.find("a[href*='/senate/members/bio']").first().text().trim();
    if (!name) return;

    const vote =
      block.find('span.badge[title]').attr('title') ??
      block.find('span[title="Yea"], span[title="Nay"]').attr('title');
    if (!vote) return;

    const party =
      block.find('[class*="bg-party-"]').text().trim().charAt(0) || undefined;
    const key = `${name}:${vote}`;
    if (seen.has(key)) return;
    seen.add(key);

    memberVotes.push({
      name: name.replace(/^Rep\.\s*|^Sen\.\s*/i, ''),
      option: vote,
      party,
    });
  });

  const counts = tallyMemberVotes(memberVotes);
  const yea = counts.find((c) => c.option === 'yea')?.value ?? 0;
  const nay = counts.find((c) => c.option === 'nay')?.value ?? 0;

  results.push({
    rollCallNumber,
    motionText,
    date,
    organization: 'House',
    organizationType: /committee/i.test(motionText) ? 'committee' : 'chamber',
    chamber: 'lower',
    billIdentifier: bill,
    memberVotes,
    counts,
    result: yea >= nay ? 'pass' : 'fail',
  });

  return results;
}

function tallyMemberVotes(memberVotes: RawMemberVote[]): VoteCount[] {
  const tally = new Map<string, number>();
  for (const mv of memberVotes) {
    const opt = mv.option.toLowerCase();
    const key =
      opt.includes('yea') || opt === 'y'
        ? 'yea'
        : opt.includes('nay') || opt === 'n'
          ? 'nay'
          : opt.includes('absent')
            ? 'absent'
            : 'not_voting';
    tally.set(key, (tally.get(key) ?? 0) + 1);
  }
  return Array.from(tally.entries()).map(([option, value]) => ({
    option: option as VoteCount['option'],
    value,
  }));
}

export function parsePaVoteIndexLinks(
  html: string,
  baseUrl: string
): { url: string; rollCallNumber?: string; date?: string }[] {
  const $ = cheerio.load(html);
  const links: { url: string; rollCallNumber?: string; date?: string }[] = [];
  const seen = new Set<string>();

  $('a[href*="roll-calls/summary"]').each((_, el) => {
    const href = $(el).attr('href');
    if (!href) return;
    const rcNum = href.match(/rcNum=(\d+)/i)?.[1];
    if (!rcNum || seen.has(rcNum)) return;
    seen.add(rcNum);

    const row = $(el).closest('tr');
    const rowText = row.length ? row.text() : $(el).parent().text();
    const dateMatch = rowText.match(
      /(\w+day\s+\w+\s+\d{1,2},\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4})/
    );

    const absolute = href.startsWith('http')
      ? href
      : new URL(href, baseUrl).toString();

    links.push({
      url: absolute,
      rollCallNumber: rcNum,
      date: dateMatch?.[1],
    });
  });

  return links;
}
