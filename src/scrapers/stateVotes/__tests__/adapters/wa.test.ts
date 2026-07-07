import { describe, expect, it } from 'vitest';
import {
  parseWaRollCallsPage,
  waBillHasRollCalls,
  waRollCallsUrl,
  waVoteToParseResult,
} from '../../parsers/waVote';

const ROLL_CALLS_FIXTURE = `
<div class="rollcall">
  <div>Chamber: HOUSE&nbsp;&nbsp;2025 Regular Session</div>
  <div>Motion: 3RD READING &amp; FINAL PASSAGE</div>
  <div>Transcript No: 32</div>
  <div>Date: 02-13-2025</div>
  <div class="vote-count">Yeas: 93 Nays: 0  Absent: 0 Excused: 5</div>
  <table>
    <tr><td>Voting yea:</td><td>Representatives Smith, Jones</td></tr>
    <tr><td>Voting nay:</td><td>None </td></tr>
    <tr><td>Excused:</td><td>Representatives Adams</td></tr>
  </table>
</div>
`;

const SUMMARY_FIXTURE = `
<a href="https://app.leg.wa.gov/bi/RollCallsOnABill/RollCall?biennium=2025-26&billNumber=1039">View all roll calls</a>
`;

describe('WA vote parsing', () => {
  it('detects bill summary pages with roll call links', () => {
    expect(waBillHasRollCalls(SUMMARY_FIXTURE)).toBe(true);
    expect(waBillHasRollCalls('<html>no votes</html>')).toBe(false);
  });

  it('builds roll call page URLs', () => {
    expect(waRollCallsUrl(1039)).toContain('billNumber=1039');
  });

  it('parses roll call blocks with member names', () => {
    const votes = parseWaRollCallsPage(ROLL_CALLS_FIXTURE, 1039);
    expect(votes).toHaveLength(1);
    expect(votes[0].date).toBe('2025-02-13');
    expect(votes[0].memberVotes.length).toBe(3);
    expect(votes[0].counts.find((c) => c.option === 'yea')?.value).toBe(93);
  });

  it('converts parsed rows to canonical parse results', () => {
    const vote = waVoteToParseResult(parseWaRollCallsPage(ROLL_CALLS_FIXTURE, 1039)[0]);
    expect(vote.chamber).toBe('lower');
    expect(vote.result).toBe('pass');
  });
});
