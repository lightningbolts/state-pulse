// This test suite is for the transformOpenStatesBill function which transforms OpenStatesBill data into a format suitable for Firestore.
import { transformOpenStatesBill } from './fetchOpenStatesDataHistorical';
import { Timestamp } from 'firebase/firestore';
import { OpenStatesBill } from '@/types/legislation';
import { describe, it, expect } from 'vitest';

describe('transformOpenStatesBill', () => {
  it('should transform a valid OpenStatesBill into FirestoreLegislation', () => {
    const mockBill: OpenStatesBill = {
      id: 'ocd-bill/123',
      identifier: 'HB 101',
      title: 'An Act to Test',
      session: '2023rs',
      jurisdiction: {
        id: 'ocd-jurisdiction/country:us/state:al/government',
        name: 'Alabama',
        classification: 'state',
      },
      sponsorships: [
        {
          name: 'John Doe',
          person_id: 'ocd-person/456',
          entity_type: 'person',
          primary: true,
          classification: 'primary',
        },
      ],
      actions: [
        {
          description: 'Introduced in House',
          date: '2023-01-01',
          organization: { id: 'ocd-organization/789', name: 'House', classification: 'lower' },
          classification: ['introduction'],
          order: 1,
        },
      ],
      versions: [
        {
          note: 'Introduced Version',
          date: '2023-01-02',
          classification: 'introduced',
          links: [{ url: 'https://example.com/bill.pdf', media_type: 'application/pdf' }],
        },
      ],
      abstracts: [{ abstract: 'This is a test bill.' }],
      subject: ['Testing', 'Legislation'],
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-02T00:00:00Z',
      openstates_url: 'https://openstates.org/bill/123',
    };

    const expectedOutput = {
      sourceId: 'ocd-bill/123',
      title: 'An Act to Test',
      billNumber: 'HB 101',
      jurisdiction: 'AL',
      status: 'Introduced in House',
      summary: 'This is a test bill.',
      fullTextUrl: 'https://example.com/bill.pdf',
      sponsors: [
        {
          name: 'John Doe',
          id: 'ocd-person/456',
          entityType: 'person',
          primary: true,
          classification: 'primary',
        },
      ],
      introductionDate: Timestamp.fromDate(new Date('2023-01-01')),
      lastActionDate: Timestamp.fromDate(new Date('2023-01-01')),
      history: [
        {
          date: Timestamp.fromDate(new Date('2023-01-01')),
          action: 'Introduced in House',
          actor: 'House',
          details: 'introduction',
        },
      ],
      tags: ['Testing', 'Legislation'],
      chamber: 'lower',
      versions: [
        {
          date: Timestamp.fromDate(new Date('2023-01-02')),
          name: 'Introduced Version',
          url: 'https://example.com/bill.pdf',
        },
      ],
      createdAt: expect.any(Timestamp),
      updatedAt: expect.any(Timestamp),
    };

    const result = transformOpenStatesBill(mockBill, 'AL');
    expect(result).toEqual(expectedOutput);
  });

  it('should handle missing optional fields gracefully', () => {
    const mockBill: OpenStatesBill = {
      id: 'ocd-bill/124',
      identifier: 'HB 102',
      title: 'A Bill with Missing Fields',
      session: '2023rs',
      jurisdiction: {
        id: 'ocd-jurisdiction/country:us/state:al/government',
        name: 'Alabama',
        classification: 'state',
      },
      sponsorships: [],
      actions: [],
      versions: [],
      abstracts: [],
      subject: null,
      created_at: '2023-01-01T00:00:00Z',
      updated_at: '2023-01-02T00:00:00Z',
      openstates_url: 'https://openstates.org/bill/124',
    };

    const expectedOutput = {
      sourceId: 'ocd-bill/124',
      title: 'A Bill with Missing Fields',
      billNumber: 'HB 102',
      jurisdiction: 'AL',
      status: 'Unknown',
      sponsors: [],
      createdAt: expect.any(Timestamp),
      updatedAt: expect.any(Timestamp),
    };

    const result = transformOpenStatesBill(mockBill, 'AL');
    expect(result).toEqual(expectedOutput);
  });
});