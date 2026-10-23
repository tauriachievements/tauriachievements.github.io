import { describe, expect, it } from 'vitest';
import { SPEC_TIERS, RoleTierList, TierSpec } from './raid-tier-list';
import { TierListImageInfo, formatImageDate, imageColumns, imageFooter, tierListImageName, wrapText } from './raid-tier-list-image';

function spec(id: number, count = 20): TierSpec {
  return {
    id, classId: 1, name: `Spec ${id}`, color: '#fff', art: '', score: 1000, count, percentOfBest: 100,
    fewPlayers: count < 10, note: '', label: '', rankingsQuery: {}
  };
}

function list(sizes: number[], extra: Partial<RoleTierList> = {}): RoleTierList {
  let id = 0;
  return {
    role: 'dps',
    title: 'DPS',
    characterCount: 959,
    rows: SPEC_TIERS.map((tier, index) => ({ tier, specs: Array.from({ length: sizes[index] ?? 0 }, () => spec(++id)) })),
    unplayed: [],
    ...extra
  };
}

const info: TierListImageInfo = {
  raidName: 'The Emerald Nightmare',
  raidSlug: 'emerald-nightmare',
  difficultySlug: 'mythic',
  difficultyName: 'Mythic',
  date: new Date(2026, 9, 3, 23, 30)
};

describe('the tier list image', () => {
  it('is as wide as its fullest tier, between 6 and 12 icons', () => {
    expect(imageColumns(list([2, 2, 3, 7, 10]))).toBe(10);
    expect(imageColumns(list([1, 0, 1, 1, 3]))).toBe(6);
    expect(imageColumns(list([20]))).toBe(12);
  });

  it('is named after the raid, difficulty, role and local day', () => {
    expect(tierListImageName(info, 'healer')).toBe('emerald-nightmare-mythic-healer-tier-list-2026-10-03.png');
    expect(formatImageDate(info.date)).toBe('Oct 3, 2026');
  });

  it('explains the scores in its footer, with the few-players and unplayed notes only when needed', () => {
    expect(imageFooter(list([2, 2, 3, 7, 10]))).toEqual([
      "Each spec's top 10 DPS scores, averaged, from 959 characters. Tier by share of the best spec: S from 95%, A from 85%, B from 75%, C from 60%, F below."
    ]);

    const healers = list([1], { role: 'healer', title: 'Healer', characterCount: 1, unplayed: ['Holy Priest'] });
    healers.rows[0].specs[0] = spec(1, 1);
    expect(imageFooter(healers)).toEqual([
      "Each spec's top 10 HPS scores, averaged, from 1 character. Tier by share of the best spec: S from 95%, A from 85%, B from 75%, C from 60%, F below.",
      'A number on an icon: fewer than 10 characters played it.',
      'Not played: Holy Priest.'
    ]);
  });

  it('wraps text at word breaks to fit the width', () => {
    const measure = (text: string) => text.length;
    expect(wrapText('one two three four', 9, measure)).toEqual(['one two', 'three', 'four']);
    expect(wrapText('unbreakableword', 4, measure)).toEqual(['unbreakableword']);
    expect(wrapText('', 10, measure)).toEqual([]);
  });
});
