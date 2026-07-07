import { describe, expect, it } from 'vitest';
import { parseAzVoteAction, type AzBillHeader } from '../../parsers/azVote';

describe('AZ vote parsing', () => {
  it('parses floor action JSON with member votes', () => {
    const header: AzBillHeader = {
      BillStatusActionId: 246419,
      ActionDate: '2026-02-05T10:46:50',
      CommitteeShortName: 'COW',
      CommitteeName: 'Committee of the Whole',
      LegislativeBody: 'H',
      TotalVotes: 60,
    };
    const action = {
      Action: 'Passed',
      ReportDate: '2026-02-05T10:46:50',
      Ayes: 38,
      Nays: 22,
      Votes: [
        {
          Vote: 'Y',
          Legislator: { FullName: 'Jane Smith', Party: 'D' },
        },
        {
          Vote: 'N',
          Legislator: { FullName: 'John Doe', Party: 'R' },
        },
      ],
    };
    const parsed = parseAzVoteAction(action, 'HB2010', header);
    expect(parsed.memberVotes).toHaveLength(2);
    expect(parsed.counts.find((c) => c.option === 'yea')?.value).toBe(1);
    expect(parsed.counts.find((c) => c.option === 'nay')?.value).toBe(1);
    expect(parsed.billIdentifier).toBe('HB2010');
    expect(parsed.result).toBe('pass');
  });
});
