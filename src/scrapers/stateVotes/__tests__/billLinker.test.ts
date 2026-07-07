import { describe, expect, it } from 'vitest';
import {
  normalizeBillIdentifier,
  rejectFederalBillId,
} from '../billLinker';

describe('billLinker', () => {
  it('normalizes HB 1234 and HB1234 to same form', () => {
    expect(normalizeBillIdentifier('HB1234')).toBe('HB 1234');
    expect(normalizeBillIdentifier('hb 1234')).toBe('HB 1234');
  });

  it('rejects federal bill IDs', () => {
    expect(rejectFederalBillId('congress-bill-119-hr-100')).toBe(true);
    expect(rejectFederalBillId('ocd-bill_abc')).toBe(false);
  });
});
