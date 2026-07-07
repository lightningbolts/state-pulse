import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { parseNyBillVotes } from '../../adapters/ny';
import { normalizeRawVote } from '../../normalizer';

const fixtures = (name: string) =>
  fs.readFileSync(path.join(__dirname, '../../__fixtures__', name), 'utf-8');

describe('NY adapter parsing', () => {
  it('parses Open Legislation bill vote JSON', () => {
    const fixture = JSON.parse(fixtures('ny/bill-with-votes.json'));
    const bill = { printNo: fixture.printNo, session: fixture.session };
    const raw = parseNyBillVotes(bill, fixture.votes)[0];
    const record = normalizeRawVote(raw);
    expect(record.counts.length).toBeGreaterThan(0);
    expect(record.organizationType).toBe('committee');
    expect(record.result).toBe('pass');
  });

  it('populates member votes when present in JSON', () => {
    const fixture = JSON.parse(fixtures('ny/bill-with-votes.json'));
    const bill = { printNo: fixture.printNo, session: fixture.session };
    const raw = parseNyBillVotes(bill, fixture.votes)[0];
    expect(raw.memberVotes?.length).toBe(3);
    const record = normalizeRawVote(raw);
    expect(record.memberVotes.length).toBe(3);
    expect(record.memberVotes[0].name).toContain('Smith');
  });

  it('handles tally-only when members absent', () => {
    const fixture = JSON.parse(fixtures('ny/bill-with-votes.json'));
    const bill = { printNo: fixture.printNo, session: fixture.session };
    const floorVote = { ...fixture.votes[1], memberVotes: { items: {} } };
    const raw = parseNyBillVotes(bill, [floorVote])[0];
    const record = normalizeRawVote(raw);
    expect(record.memberVotes).toHaveLength(0);
    expect(record.organizationType).toBe('chamber');
  });
});
