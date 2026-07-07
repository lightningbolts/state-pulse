import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { parseCaVoteMatrix, parseTabDelimited } from '../parsers/bulkTabDelimited';

const fixtures = (name: string) =>
  fs.readFileSync(
    path.join(__dirname, '../__fixtures__', name),
    'utf-8'
  );

describe('bulkTabDelimited', () => {
  it('parses CA vote matrix excerpt', () => {
    const content = fixtures('ca/vote-detail-sample.dat');
    const result = parseCaVoteMatrix(content);
    expect(result.memberVotes.length).toBe(5);
    expect(result.memberVotes[0].name).toBe('Smith, John');
    expect(result.billIdentifier).toMatch(/AB 1234/i);
  });

  it('handles quoted fields with tabs', () => {
    const content = '"Smith, John"\tD\t"Aye"\n"Jones, Jane"\tR\t"No"';
    const rows = parseTabDelimited(`Name\tParty\tVote\n${content}`);
    expect(rows[1][0]).toBe('Smith, John');
    expect(rows[2][2]).toBe('No');
  });

  it('identifies committee votes from content', () => {
    const content = fixtures('ca/vote-detail-sample.dat');
    const result = parseCaVoteMatrix(content);
    expect(result.organizationType).toBe('committee');
  });
});
