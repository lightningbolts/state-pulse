import { describe, expect, it } from 'vitest';
import {
  moBillActionsUrl,
  moVoteToParseResult,
  parseMoBillActions,
} from '../../parsers/moVote';

const ACTIONS_FIXTURE = `
<table id="actionTable">
  <tr><td>4/03/2025</td><td>H 1670</td><td class="billactions">Third Read and Passed (H) - AYES: 150 NOES: 4 PRESENT: 1</td></tr>
  <tr><td>4/29/2025</td><td>S 1184</td><td class="billactions">Third Read and Passed (S) - AYES: 26 NOES: 8 PRESENT: 0</td></tr>
</table>
`;

describe('MO vote parsing', () => {
  it('builds bill actions URLs', () => {
    expect(moBillActionsUrl('HB7')).toContain('BillActions.aspx?bill=HB7');
  });

  it('parses tally-only vote rows from bill actions', () => {
    const votes = parseMoBillActions(ACTIONS_FIXTURE, 'HB7');
    expect(votes).toHaveLength(2);
    expect(votes[0].billIdentifier).toBe('HB 7');
    expect(votes[0].counts.find((c) => c.option === 'yea')?.value).toBe(150);
    expect(votes[1].chamber).toBe('upper');
  });

  it('converts tally rows without member votes', () => {
    const vote = moVoteToParseResult(parseMoBillActions(ACTIONS_FIXTURE, 'HB7')[0]);
    expect(vote.memberVotes).toHaveLength(0);
    expect(vote.result).toBe('pass');
  });
});
