import { describe, expect, it } from 'vitest';
import {
  parsePaRollCallSummary,
  parsePaVoteIndexLinks,
} from '../../parsers/paVote';
import { normalizeRawVote } from '../../normalizer';

describe('PA vote parsing', () => {
  it('parses palegis roll call summary member votes', () => {
    const html = `
      <title>House Roll Call Vote Summary #1321</title>
      <h1>House Floor Roll Call</h1>
      <a href="/house/roll-calls/bybill?sessYr=2025&billBody=H&billNum=2413">Floor</a>
      <div class="rc-member d-flex align-items-center">
        <div class="rc-member-display flex-grow-1 d-print-none">
          <a href='/house/members/bio/1/rep-jane-smith'>Rep. Jane Smith</a>
          <span class="badge bg-party-D">D</span>
        </div>
        <div class="d-print-none"><span class="badge text-bg-success" title="Yea"></span></div>
      </div>
      <div class="rc-member d-flex align-items-center">
        <div class="rc-member-display flex-grow-1 d-print-none">
          <a href='/house/members/bio/2/rep-john-doe'>Rep. John Doe</a>
          <span class="badge bg-party-R">R</span>
        </div>
        <div class="d-print-none"><span class="badge text-bg-danger" title="Nay"></span></div>
      </div>
    `;
    const parsed = parsePaRollCallSummary(html)[0];
    expect(parsed.rollCallNumber).toBe('1321');
    expect(parsed.memberVotes).toHaveLength(2);
    const record = normalizeRawVote({
      adapter: 'pa-palegis',
      jurisdiction: 'ocd-jurisdiction/country:us/state:pa/government',
      session: '2025',
      chamber: parsed.chamber,
      organization: parsed.organization,
      organizationType: parsed.organizationType,
      motionText: parsed.motionText,
      date: parsed.date,
      counts: parsed.counts,
      memberVotes: parsed.memberVotes,
    });
    expect(record.memberVotes[0].name).toContain('Smith');
  });

  it('parses palegis vote index links', () => {
    const html = `
      <tr>
        <td><a href="/house/roll-calls/summary?sessYr=2025&sessInd=0&rcNum=1321">1321</a></td>
        <td>Wednesday Jul 1, 2026</td>
      </tr>
    `;
    const links = parsePaVoteIndexLinks(html, 'https://www.palegis.us');
    expect(links).toHaveLength(1);
    expect(links[0].rollCallNumber).toBe('1321');
    expect(links[0].url).toContain('rcNum=1321');
  });
});
