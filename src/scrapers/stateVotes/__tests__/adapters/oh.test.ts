import { describe, expect, it } from 'vitest';
import {
  ohBillHasVotes,
  ohBillVotesUrl,
  parseOhBillVoteDetail,
  parseOhBillVotesPage,
} from '../../parsers/ohVote';

const VOTES_FIXTURE = `
<h1 class="small-bottom-margin">House Bill 50 Votes</h1>
<table class="data-grid legislation-votes-table unhighlighted-table">
  <tbody>
    <tr>
      <th class="date-cell" scope="row"><span>6-18-2025</span></th>
      <td class="chamber-cell"><span>Senate</span></td>
      <td class="result-cell">Passed</td>
      <td class="vote-cell">
        <span class="vote-count-column">Yeas: 32</span>
        <span class="vote-count-column">Nays: 0</span>
        <button id="vote-breakdown-button-1" type="button"></button>
        <div id="vote-breakdown-1" class="vote-breakdown">
          <h3>Yeas</h3>
          <table class="vote-breakdown-table unhighlighted-table">
            <tbody>
              <tr><td><a href="#">Nickie J. Antonio (D)</a></td><td></td></tr>
              <tr><td><a href="#">Tim Schaffer (R)</a></td><td></td></tr>
            </tbody>
          </table>
        </div>
      </td>
    </tr>
  </tbody>
</table>
`;

describe('OH vote parsing', () => {
  it('builds bill vote URLs for the current general assembly', () => {
    expect(ohBillVotesUrl('hb50')).toBe(
      'https://www.legislature.ohio.gov/legislation/136/hb50/votes'
    );
  });

  it('detects pages with vote breakdown panels', () => {
    expect(ohBillHasVotes(VOTES_FIXTURE)).toBe(true);
    expect(ohBillHasVotes('<html><body>No votes</body></html>')).toBe(false);
  });

  it('parses bill vote rows with member breakdowns', () => {
    const votes = parseOhBillVotesPage(VOTES_FIXTURE, 'hb50');
    expect(votes).toHaveLength(1);
    expect(votes[0].billIdentifier).toBe('HB 50');
    expect(votes[0].date).toBe('2025-06-18');
    expect(votes[0].memberVotes).toHaveLength(2);
    expect(votes[0].counts.find((c) => c.option === 'yea')?.value).toBe(32);
  });

  it('parses a specific breakdown by id', () => {
    const vote = parseOhBillVoteDetail(VOTES_FIXTURE, 'hb50', '1');
    expect(vote.chamber).toBe('upper');
    expect(vote.result).toBe('pass');
  });
});
