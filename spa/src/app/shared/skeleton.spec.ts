import { describe, expect, it } from 'vitest';
import { barShare, iconColumns, nameWidth, skeletonSections } from './skeleton';

describe('skeletonSections', () => {
  it('keeps the blocks in order with the counts they ask for', () => {
    expect(skeletonSections(['hero', 'tiles:5', 'rows:2'])).toEqual([
      { kind: 'hero', items: [0] },
      { kind: 'tiles', items: [0, 1, 2, 3, 4] },
      { kind: 'rows', items: [0, 1] }
    ]);
  });

  it('gives a block without a count its default', () => {
    expect(skeletonSections(['switch', 'rows']).map(section => section.items.length)).toEqual([3, 10]);
  });

  it('never makes a negative or fractional number of items', () => {
    expect(skeletonSections(['cards:-2', 'icons:2.7']).map(section => section.items.length)).toEqual([0, 2]);
  });
});

describe('nameWidth', () => {
  it('varies from row to row and repeats after ten rows', () => {
    expect(nameWidth(0)).not.toBe(nameWidth(1));
    expect(nameWidth(10)).toBe(nameWidth(0));
  });
});

describe('iconColumns', () => {
  it('keeps up to seven icons on one phone row, like the boss picker', () => {
    expect(iconColumns(7)).toBe(7);
    expect(iconColumns(3)).toBe(3);
  });

  it('splits more icons over two rows, like the dungeon tiles', () => {
    expect(iconColumns(10)).toBe(5);
    expect(iconColumns(11)).toBe(6);
  });
});

describe('barShare', () => {
  it('falls from the first bar to the last, like a chart sorted by popularity', () => {
    const shares = [0, 1, 2, 3].map(index => barShare(index, 4));

    expect(shares).toEqual([96, 70, 44, 18]);
  });

  it('draws a single bar at full height', () => {
    expect(barShare(0, 1)).toBe(96);
  });
});
