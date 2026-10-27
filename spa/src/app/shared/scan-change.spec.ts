import { describe, it, expect } from 'vitest';
import { rankChangeLabel, scanChanges, signedChange, valueChangeLabel } from './scan-change';

interface Entry {
  readonly name: string;
  readonly points: number;
}

const changes = (current: Entry[], previous: Entry[]) =>
  scanChanges(current, previous, entry => entry.name, entry => entry.points);

describe('scanChanges', () => {
  it('ranks by position and measures the ranks climbed and the value gained', () => {
    const previous = [{ name: 'A', points: 2000 }, { name: 'B', points: 1900 }, { name: 'C', points: 1800 }];
    const current = [{ name: 'B', points: 2050 }, { name: 'A', points: 1980 }, { name: 'C', points: 1800 }];

    expect([...changes(current, previous)]).toEqual([
      ['B', { rank: 1, value: 150, isNew: false }],
      ['A', { rank: -1, value: -20, isNew: false }]
    ]);
  });

  it('marks an entry the previous ranking lacked as new', () => {
    const current = [{ name: 'New', points: 2100 }, { name: 'A', points: 2000 }];

    expect([...changes(current, [{ name: 'A', points: 2000 }])]).toEqual([
      ['New', { rank: 0, value: 0, isNew: true }],
      ['A', { rank: -1, value: 0, isNew: false }]
    ]);
  });

  it('leaves out an entry that kept its rank and value', () => {
    expect(changes([{ name: 'A', points: 1 }], [{ name: 'A', points: 1 }]).size).toBe(0);
  });
});

describe('change labels', () => {
  it('signs a change with a plus or a minus sign', () => {
    expect(signedChange(24)).toBe('+24');
    expect(signedChange(-12)).toBe('−12');
    expect(signedChange(-1_500_000, magnitude => `${magnitude / 1_000_000}M`)).toBe('−1.5M');
  });

  it('says how far a rank moved and since when', () => {
    expect(rankChangeLabel(3)).toBe('Climbed 3 ranks since the last scan');
    expect(rankChangeLabel(-1)).toBe('Fell 1 rank since the last scan');
    expect(rankChangeLabel(2, 'since Oct 26')).toBe('Climbed 2 ranks since Oct 26');
  });

  it('says how much a value changed', () => {
    expect(valueChangeLabel(-12, 'rating')).toBe('−12 rating since the last scan');
    expect(valueChangeLabel(3, 'games', 'since Oct 26')).toBe('+3 games since Oct 26');
  });
});
