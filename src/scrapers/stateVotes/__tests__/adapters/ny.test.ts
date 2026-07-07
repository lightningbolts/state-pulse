import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import { parseNyRollCallJson } from '../../adapters/ny';
import { normalizeRawVote } from '../../normalizer';

const fixtures = (name: string) =>
  fs.readFileSync(path.join(__dirname, '../../__fixtures__', name), 'utf-8');

describe('NY adapter parsing', () => {
  it('parses Open Legislation JSON fixture', () => {
    const json = JSON.parse(fixtures('ny/roll-call-response.json'));
    const raw = parseNyRollCallJson(json, '999');
    const record = normalizeRawVote(raw);
    expect(record.counts.length).toBeGreaterThan(0);
    expect(record.motionText).toContain('Floor Vote');
    expect(record.result).toBe('pass');
  });

  it('populates member votes when present in JSON', () => {
    const json = JSON.parse(fixtures('ny/roll-call-response.json'));
    const raw = parseNyRollCallJson(json, '999');
    expect(raw.memberVotes?.length).toBe(3);
    const record = normalizeRawVote(raw);
    expect(record.memberVotes.length).toBe(3);
    expect(record.memberVotes[0].name).toContain('Smith');
  });

  it('handles tally-only when members absent', () => {
    const json = JSON.parse(fixtures('ny/roll-call-response.json'));
    delete json.memberVotes;
    const raw = parseNyRollCallJson(json, '999');
    const record = normalizeRawVote(raw);
    expect(record.memberVotes).toHaveLength(0);
    expect(record.counts.find((c) => c.option === 'yea')?.value).toBe(42);
  });
});
