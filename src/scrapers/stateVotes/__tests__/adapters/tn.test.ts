import { describe, expect, it } from 'vitest';
import { parseTnBillVotes } from '../../parsers/tnVote';

const SAMPLE = `
<div id="tabpanel-votes">
HB0979 by Williams - FLOOR VOTE: REGULAR CALENDAR AS AMENDED PASSAGE ON THIRD CONSIDERATION 4/16/2025
Passed
Ayes...............................................72
Noes................................................5
Present and not voting..................11
Representatives voting Aye were: Alexander, Smith -- 72.
Representatives voting No were: Behn, Boyd -- 5.
Representatives present and not voting were: Barrett, Johnson -- 11.
</div>
`;

describe('TN vote parsing', () => {
  it('parses bill vote blocks from BillInfo HTML', () => {
    const votes = parseTnBillVotes(SAMPLE);
    expect(votes.length).toBeGreaterThan(0);
    expect(votes[0].billIdentifier).toMatch(/HB 0979/i);
    expect(votes[0].memberVotes.length).toBeGreaterThan(3);
    expect(votes[0].counts.find((c) => c.option === 'yea')?.value).toBe(72);
    expect(votes[0].result).toBe('pass');
  });
});
