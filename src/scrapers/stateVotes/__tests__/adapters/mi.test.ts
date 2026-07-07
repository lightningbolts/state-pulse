import { describe, expect, it } from 'vitest';
import {
  billHeadingToObjectName,
  miRollCallUrl,
  parseMiBillRollCalls,
  parseMiRollCallPage,
  parseMiRollCallSummary,
  parseMiSearchBillRefs,
} from '../../parsers/miVote';

const SEARCH_FIXTURE = `
<a href="/Home/GetObject?objectName=2025-HB-4445">HB 4445 of 2025</a>
<a href="/Home/GetObject?objectName=2025-HB-4001">HB 4001 of 2025</a>
`;

const BILL_FIXTURE = `
<h1>2025 House Bill 4445</h1>
<div id="History">
  <table><tbody>
    <tr>
      <td>2/04/2026</td>
      <td><a href='/Home/GetObject?objectName=2026-HJ-02-04-009'>HJ 9</a> Pg. 83</td>
      <td>passed; given immediate effect Roll Call #25 Yeas 66 Nays 38 Excused 0 Not Voting 6</td>
    </tr>
  </tbody></table>
</div>
`;

const ROLL_CALL_FIXTURE = `
<div class="resolution-title">
<h1>2025 House Bill 4445</h1>
<h2 class="success"><span>House Roll Call 25:</span> Passed</h2>
</div>
<table class="roll-call">
  <tr><th colspan="2">66 Yeas / 38 Nays</th></tr>
</table>
<table class="roll-call">
  <tr>
    <td class="yeas"><ul><li><a href="#">Carra <nobr>(R-36)</nobr></a></li></ul></td>
    <td class="nays"><ul><li><a href="#">Andrews <nobr>(D-38)</nobr></a></li></ul></td>
  </tr>
</table>
<table class="roll-call">
  <tr>
    <td class="not-voting" colspan="2">
      <ul><li><a href="#">Hope <nobr>(D-74)</nobr></a></li></ul>
    </td>
  </tr>
</table>
`;

describe('MI vote parsing', () => {
  it('extracts bill object names from search results', () => {
    const bills = parseMiSearchBillRefs(SEARCH_FIXTURE);
    expect(bills.map((b) => b.objectName)).toEqual(['2025-HB-4445', '2025-HB-4001']);
  });

  it('maps MichiganVotes bill headings to legislature object names', () => {
    expect(billHeadingToObjectName('2025 House Bill 4445')).toBe('2025-HB-4445');
  });

  it('builds MichiganVotes roll call URLs', () => {
    expect(miRollCallUrl(2026, 'lower', '25')).toBe(
      'https://www.michiganvotes.org/votes/2026/house/roll-call-25'
    );
  });

  it('parses roll call references from bill history', () => {
    const rollCalls = parseMiBillRollCalls(BILL_FIXTURE, '2025-HB-4445');
    expect(rollCalls).toHaveLength(1);
    expect(rollCalls[0].rollCallNumber).toBe('25');
    expect(rollCalls[0].date).toBe('2026-02-04');
    expect(rollCalls[0].url).toContain('roll-call-25');
  });

  it('parses MichiganVotes roll call summaries', () => {
    const summary = parseMiRollCallSummary(
      ROLL_CALL_FIXTURE,
      'https://www.michiganvotes.org/votes/2026/house/roll-call-25'
    );
    expect(summary?.billObjectName).toBe('2025-HB-4445');
    expect(summary?.rollCallNumber).toBe('25');
  });

  it('parses MichiganVotes roll call member lists', () => {
    const vote = parseMiRollCallPage(ROLL_CALL_FIXTURE);
    expect(vote.rollCallNumber).toBe('25');
    expect(vote.memberVotes.length).toBe(3);
    expect(vote.memberVotes.find((m) => m.name === 'Carra')?.option).toBe('yea');
    expect(vote.memberVotes.find((m) => m.name === 'Andrews')?.option).toBe('nay');
  });
});
