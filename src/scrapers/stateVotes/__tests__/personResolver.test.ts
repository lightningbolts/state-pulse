import { describe, expect, it } from 'vitest';
import { PersonResolver } from '../personResolver';
import type { PersonRecord } from '../personResolver';

const people: PersonRecord[] = [
  {
    id: 'ocd-person/1',
    name: 'John Smith',
    given_name: 'John',
    family_name: 'Smith',
    party: 'Democratic',
    current_role: { org_classification: 'lower', district: '4' },
  },
  {
    id: 'ocd-person/2',
    name: 'Jane Jones',
    party: 'Republican',
    current_role: { org_classification: 'lower', district: '7' },
  },
  {
    id: 'ocd-person/3',
    name: 'Bob Smith',
    party: 'Democratic',
    current_role: { org_classification: 'lower', district: '12' },
  },
];

describe('PersonResolver', () => {
  const resolver = new PersonResolver(async () => people);

  it('exact name match sets personId', async () => {
    await resolver.loadJurisdiction('ocd-jurisdiction/country:us/state:fl/government');
    const person = resolver.resolve('John Smith', 'ocd-jurisdiction/country:us/state:fl/government');
    expect(person?.id).toBe('ocd-person/1');
  });

  it('fuzzy match Smith, John vs John Smith', async () => {
    await resolver.loadJurisdiction('ocd-jurisdiction/country:us/state:fl/government');
    const person = resolver.resolve('Smith, John', 'ocd-jurisdiction/country:us/state:fl/government');
    expect(person?.id).toBe('ocd-person/1');
  });

  it('ambiguous name returns null', async () => {
    await resolver.loadJurisdiction('ocd-jurisdiction/country:us/state:fl/government');
    const person = resolver.resolve('Smith', 'ocd-jurisdiction/country:us/state:fl/government');
    expect(person).toBeNull();
  });

  it('no match leaves personId unset', async () => {
    const { resolved, unresolved } = await resolver.resolveMemberVotes(
      [{ name: 'Unknown Person', option: 'yea' }],
      'ocd-jurisdiction/country:us/state:fl/government'
    );
    expect(resolved[0].personId).toBeUndefined();
    expect(unresolved).toBe(1);
  });

  it('resolves member votes in batch', async () => {
    const { resolved, unresolved } = await resolver.resolveMemberVotes(
      [
        { name: 'Jane Jones', option: 'nay' },
        { name: 'John Smith', option: 'yea' },
      ],
      'ocd-jurisdiction/country:us/state:fl/government'
    );
    expect(resolved[0].personId).toBe('ocd-person/2');
    expect(resolved[1].personId).toBe('ocd-person/1');
    expect(unresolved).toBe(0);
  });
});
