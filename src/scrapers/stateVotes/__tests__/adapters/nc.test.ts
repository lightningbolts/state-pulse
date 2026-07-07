import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';
import {
  parseNcRollCallTranscript,
} from '../../parsers/ncVote';

const fixtures = (name: string) =>
  fs.readFileSync(path.join(__dirname, '../../__fixtures__', name), 'utf-8');

describe('NC adapter parsing', () => {
  it('parses roll call transcript member lists', () => {
    const html = fixtures('nc/roll-call-transcript.html');
    const members = parseNcRollCallTranscript(html);
    expect(members.length).toBe(9);
    expect(members.filter((m) => m.option === 'Yea').length).toBe(6);
    expect(members.filter((m) => m.option === 'Nay').length).toBe(3);
    expect(members.some((m) => m.name === 'Pless')).toBe(true);
  });
});
