import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  ParseError,
  parseFlVoteDetail,
  parseHtmlVotePage,
  parseMnHouseVoteDetail,
  parseVoteIndexLinks,
} from '../parsers/htmlVoteTable';

const fixtures = (name: string) =>
  fs.readFileSync(
    path.join(__dirname, '../__fixtures__', name),
    'utf-8'
  );

describe('htmlVoteTable', () => {
  it('parses FL floor vote member table', () => {
    const html = fixtures('fl/house-floor-vote-detail.html');
    const result = parseFlVoteDetail(html);
    expect(result.memberVotes.length).toBe(4);
    expect(result.memberVotes[0].name).toContain('Smith');
    expect(result.rollCallNumber).toBe('1234');
    expect(result.billIdentifier).toMatch(/HB 1001/i);
  });

  it('parses FL committee vote table', () => {
    const html = fixtures('fl/committee-vote-detail.html');
    const result = parseFlVoteDetail(html);
    expect(result.organizationType).toBe('committee');
    expect(result.memberVotes.length).toBe(3);
  });

  it('parses MN House vote detail', () => {
    const html = fixtures('mn/house-vote-detail.html');
    const result = parseMnHouseVoteDetail(html);
    expect(result.rollCallNumber).toBe('100');
    expect(result.memberVotes.length).toBe(3);
    expect(result.counts.find((c) => c.option === 'yea')?.value).toBe(70);
  });

  it('handles tally-only page with no member rows', () => {
    const html = `<html><body><p>Yeas: 10 Nays: 5</p><table><tr><th>Name</th></tr></table></body></html>`;
    const result = parseHtmlVotePage(html);
    expect(result.memberVotes).toHaveLength(0);
    expect(result.counts.find((c) => c.option === 'yea')?.value).toBe(10);
  });

  it('skips malformed rows gracefully', () => {
    const html = `<html><body><table><tr><td></td><td></td></tr><tr><td>Smith</td><td>Yea</td></tr></table></body></html>`;
    const result = parseHtmlVotePage(html);
    expect(result.memberVotes).toHaveLength(1);
  });

  it('throws ParseError when required selector missing', () => {
    const html = '<html><body><p>No table</p></body></html>';
    expect(() =>
      parseHtmlVotePage(html, {
        memberTableSelector: '#missing-table',
        requireMemberTable: true,
      })
    ).toThrow(ParseError);
  });

  it('parses vote index links', () => {
    const html = fixtures('fl/vote-index.html');
    const links = parseVoteIndexLinks(html, 'https://www.flhouse.gov/', /billvote/i);
    expect(links.length).toBe(2);
    expect(links[0].url).toContain('billvote.aspx');
  });
});
