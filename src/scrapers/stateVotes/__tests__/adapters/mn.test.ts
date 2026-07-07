import { describe, expect, it } from 'vitest';
import { parseMnVoteDetail } from '../../parsers/mnVote';

const SAMPLE = `
<div class="collapsible-panel">
  <table><tbody><tr>
    <td>HF0719</td>
    <td>H.F. NO. 719<br>CALENDAR FOR THE DAY<br>Passage, as amended</td>
    <td></td><td>122</td><td>11</td><td></td><td>05/17/2026</td>
  </tr></tbody></table>
  <div class="panel-content">
    <H3>122 YEA and 11 Nay</H3>
    <div><b>Those who voted in the affirmative were:</b>
      <table><tr><td>Smith<td><td>Jones<td></tr></table>
    </div>
    <div><b>Those who voted in the negative were:</b>
      <table><tr><td>Doe<td></tr></table>
    </div>
  </div>
</div>
`;

describe('MN vote parsing', () => {
  it('parses house vote detail with member lists', () => {
    const votes = parseMnVoteDetail(SAMPLE);
    expect(votes).toHaveLength(1);
    expect(votes[0].billIdentifier).toBe('HF 0719');
    expect(votes[0].memberVotes.length).toBeGreaterThanOrEqual(3);
    expect(votes[0].counts.find((c) => c.option === 'yea')?.value).toBe(122);
    expect(votes[0].result).toBe('pass');
  });
});
