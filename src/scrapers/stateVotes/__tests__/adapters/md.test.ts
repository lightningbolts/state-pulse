import { describe, expect, it } from 'vitest';
import {
  parseMdFloorActionIndex,
  parseMdMediaVotes,
} from '../../parsers/mdVote';

const MEDIA_FIXTURE = `
<table class="table table-striped proceedline"><tbody>
<tr><td class="pl-4 text-left font-weight-bold">
  <a href="/mgawebsite/Legislation/Details/SB0282?ys=2026RS">SB 282</a>
</td></tr>
<tr><td class="pl-5 text-left">
  Third Reading Passed <a href="/2026RS/votes/house/0923.pdf" target="_blank">(114-22)</a>
</td></tr>
</tbody></table>
`;

const INDEX_FIXTURE = `
<table id="proceedindex"><tbody>
<tr>
  <td>March 26, 2026</td>
  <td>March 13, 2026</td>
  <td><a href="/mgawebsite/FloorActions/Media/house-50-?year=2026RS">50</a></td>
  <td></td>
</tr>
</tbody></table>
`;

describe('MD vote parsing', () => {
  it('parses floor action index proceedings', () => {
    const proceedings = parseMdFloorActionIndex(INDEX_FIXTURE);
    expect(proceedings).toHaveLength(1);
    expect(proceedings[0].proceedingNumber).toBe('50');
    expect(proceedings[0].date).toMatch(/2026-03-26/);
  });

  it('parses vote tallies from floor media pages', () => {
    const proceeding = {
      proceedingNumber: '50',
      date: '2026-03-26',
      mediaUrl: 'https://example.com/media',
    };
    const votes = parseMdMediaVotes(MEDIA_FIXTURE, proceeding);
    expect(votes).toHaveLength(1);
    expect(votes[0].rollCallNumber).toBe('0923');
    expect(votes[0].billIdentifier).toBe('SB 282');
    expect(votes[0].yea).toBe(114);
    expect(votes[0].nay).toBe(22);
    expect(votes[0].result).toBe('pass');
  });
});
