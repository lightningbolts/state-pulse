import { describe, expect, it } from 'vitest';
import { parseCoBillVoteLinks, parseCoFloorVote, toCoBillSlug } from '../../parsers/coVote';

const BILL_FIXTURE = `
<table><tbody>
<tr><td data-label="Date">03/13/2026</td><td data-label="Motion">Repass</td>
<td><a href="https://leg.colorado.gov/bill_votes/28671">Vote record</a></td></tr>
</tbody></table>
`;

const VOTE_FIXTURE = `
<div class="tag-heading-white">HB26-1001</div>
<h2>Housing bill</h2>
<h3>House</h3>
<table><tbody><tr>
  <td data-label="Calendar">Senate amendments</td>
  <td data-label="Motion">Repass</td>
  <td data-label="Voted on">03/13/2026 09:53:02 AM</td>
</tr></tbody></table>
<div class="count-tag Yes">40</div><span id="tooltip-yes">Yes</span>
<div class="count-tag No">24</div><span id="tooltip-no">No</span>
<h3>Votes by House member</h3>
<table><tbody>
  <tr><td>Alice Smith</td><td><span class="vote-tag Yes">Yes</span></td></tr>
  <tr><td>Bob Jones</td><td><span class="vote-tag No">No</span></td></tr>
</tbody></table>
`;

describe('CO vote parsing', () => {
  it('converts Open States identifiers to Colorado bill slugs', () => {
    expect(toCoBillSlug('HB 1001')).toBe('HB26-1001');
  });

  it('parses bill vote links from bill pages', () => {
    const links = parseCoBillVoteLinks(BILL_FIXTURE, 'HB26-1001');
    expect(links).toHaveLength(1);
    expect(links[0].voteId).toBe('28671');
    expect(links[0].date).toBe('03/13/2026');
  });

  it('parses floor vote detail with member votes', () => {
    const vote = parseCoFloorVote(VOTE_FIXTURE);
    expect(vote.billIdentifier).toBe('HB 26-1001');
    expect(vote.memberVotes.length).toBe(2);
    expect(vote.counts.find((c) => c.option === 'yea')?.value).toBe(40);
  });
});
