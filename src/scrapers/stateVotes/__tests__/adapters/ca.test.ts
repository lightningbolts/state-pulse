import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { parseCaVoteMatrix } from '../../parsers/bulkTabDelimited';
import { normalizeRawVote } from '../../normalizer';

const fixtures = (name: string) =>
  fs.readFileSync(path.join(__dirname, '../../__fixtures__', name), 'utf-8');

describe('CA adapter parsing', () => {
  it('parses bulk vote file excerpt with member matrix', () => {
    const content = fixtures('ca/vote-detail-sample.dat');
    const parsed = parseCaVoteMatrix(content);
    expect(parsed.memberVotes.length).toBe(5);
    const record = normalizeRawVote({
      adapter: 'ca-bulk',
      jurisdiction: 'ocd-jurisdiction/country:us/state:ca/government',
      session: '2024',
      chamber: 'lower',
      organization: parsed.organization,
      organizationType: parsed.organizationType,
      motionText: parsed.motionText,
      date: parsed.date,
      counts: parsed.counts,
      memberVotes: parsed.memberVotes,
      billIdentifier: parsed.billIdentifier,
      sources: [{ url: 'https://downloads.leginfo.legislature.ca.gov' }],
      rawContent: content,
    });
    expect(record.memberVotes.length).toBe(5);
    expect(record.provenance.rawHash).toBeDefined();
  });

  it('committee vote has committee organization type', () => {
    const content = fixtures('ca/vote-detail-sample.dat');
    const parsed = parseCaVoteMatrix(content);
    expect(parsed.organizationType).toBe('committee');
  });
});
