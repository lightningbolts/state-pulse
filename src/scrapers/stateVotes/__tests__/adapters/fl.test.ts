import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { normalizeRawVote } from '../../normalizer';
import { parseFlVoteDetail, parseVoteIndexLinks } from '../../parsers/htmlVoteTable';

const fixtures = (name: string) =>
  fs.readFileSync(path.join(__dirname, '../../__fixtures__', name), 'utf-8');

describe('FL adapter parsing', () => {
  it('parses floor fixture with lower chamber and pass result', () => {
    const html = fixtures('fl/house-floor-vote-detail.html');
    const parsed = parseFlVoteDetail(html);
    const record = normalizeRawVote({
      adapter: 'fl-html',
      jurisdiction: 'ocd-jurisdiction/country:us/state:fl/government',
      session: '2024',
      chamber: parsed.chamber,
      organization: parsed.organization,
      organizationType: parsed.organizationType,
      rollCallNumber: parsed.rollCallNumber,
      motionText: parsed.motionText,
      date: parsed.date,
      result: parsed.result,
      counts: parsed.counts,
      memberVotes: parsed.memberVotes,
      billIdentifier: parsed.billIdentifier,
      sources: [{ url: 'https://example.com' }],
      rawContent: html,
    });
    expect(record.chamber).toBe('lower');
    expect(record.result).toBe('pass');
    expect(record.memberVotes.length).toBe(4);
    expect(record.billIdentifier).toMatch(/HB 1001/i);
  });

  it('parses committee fixture', () => {
    const html = fixtures('fl/committee-vote-detail.html');
    const parsed = parseFlVoteDetail(html);
    expect(parsed.organizationType).toBe('committee');
    const record = normalizeRawVote({
      adapter: 'fl-html',
      jurisdiction: 'ocd-jurisdiction/country:us/state:fl/government',
      session: '2024',
      chamber: parsed.chamber,
      organization: parsed.organization,
      organizationType: parsed.organizationType,
      motionText: parsed.motionText,
      date: parsed.date,
      counts: parsed.counts,
      memberVotes: parsed.memberVotes,
      sources: [{ url: 'https://example.com' }],
    });
    expect(record.organizationType).toBe('committee');
  });

  it('parses vote index links', () => {
    const html = fixtures('fl/vote-index.html');
    const links = parseVoteIndexLinks(html, 'https://flhouse.gov', /billvote/i);
    expect(links.length).toBeGreaterThan(0);
  });
});
