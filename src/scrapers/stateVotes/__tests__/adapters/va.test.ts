import { describe, expect, it } from 'vitest';
import { parseVaVotesCsv } from '../../parsers/vaVote';

describe('VA CSV vote parsing', () => {
  it('parses vote rows with member votes and history metadata', () => {
    const votes = parseVaVotesCsv({
      votesCsv: `"H0101V0001","H0317","Y","H0327","Y","H0231","N"`,
      membersCsv: `"MBR_HOU","MBR_MBRNO","MBR_NAME","MBR_MBRID"\n"H","H0317","Smith, John","H317"`,
      historyCsv: `"Bill_id","History_date","History_description","History_refid"\n"HB47","01/17/24","H Subcommittee recommends reporting (6-Y 4-N)","H0101V0001"`,
    });

    expect(votes).toHaveLength(1);
    expect(votes[0].billIdentifier).toBe('HB 47');
    expect(votes[0].memberVotes.length).toBeGreaterThanOrEqual(3);
    expect(votes[0].counts.find((c) => c.option === 'yea')?.value).toBe(6);
  });
});
