import { describe, expect, it } from 'vitest';
import {
  parseWiVoteDetail,
  parseWiVoteIndexLinks,
} from '../../parsers/wiVote';

describe('WI vote parsing', () => {
  it('parses assembly vote detail with Y/N codes', () => {
    const html = `
      <title>2025 Assembly Vote 1</title>
      <table class="assembly-names">
        <tr><td class="name">ALLEN</td><td>R</td></tr>
        <tr><td>Y</td><td></td><td></td><td class="name">ANDERSON</td><td>D</td></tr>
        <tr><td>N</td><td></td><td></td><td class="name">BARE</td><td>R</td></tr>
      </table>
    `;
    const parsed = parseWiVoteDetail(html);
    expect(parsed.rollCallNumber).toBe('1');
    expect(parsed.memberVotes.length).toBeGreaterThanOrEqual(2);
    expect(parsed.counts.find((c) => c.option === 'yea')?.value).toBeGreaterThan(0);
  });

  it('parses vote index links', () => {
    const html = `
      <a href="/2025/related/votes/assembly/av0001">Vote 1</a>
      <a href="/2025/related/votes/assembly/av0002">Vote 2</a>
    `;
    const links = parseWiVoteIndexLinks(
      html,
      'https://docs.legis.wisconsin.gov/2025/related/votes/assembly'
    );
    expect(links).toHaveLength(2);
    expect(links[0].rollCallNumber).toBe('0001');
  });
});
