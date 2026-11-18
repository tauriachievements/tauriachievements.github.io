import { describe, expect, it } from 'vitest';
import { LegionSpec, specFor } from '../../game/wow-specs';
import {
  describeScoreSample,
  formatScoreTick,
  parseChartView,
  performanceChart,
  scoreTicks,
  summarizeSpecScores,
  topAverage
} from './spec-performance';

interface Entry {
  name: string;
  score: number;
}

const FIRE = specFor(8, 'Fire')!;
const FROST = specFor(8, 'Frost')!;
const HOLY = specFor(2, 'Holy')!;
const PROTECTION = specFor(2, 'Protection')!;

const scores = new Map<LegionSpec, Entry[]>([
  [FIRE, [{ name: 'Best', score: 6000 }, { name: 'Example', score: 174 }]],
  [FROST, [{ name: 'Example', score: 1916 }]],
  [HOLY, [{ name: 'Light', score: 6969 }]],
  [PROTECTION, [{ name: 'Light', score: 871 }]]
]);

const summarize = (role?: Parameters<typeof summarizeSpecScores>[2]) =>
  summarizeSpecScores<Entry>(definition => scores.get(definition) ?? [], entry => entry.name, role);

describe('summarizeSpecScores', () => {
  it("averages each spec's ranked scores and names its best character", () => {
    const mage = summarize('dps').classes[0];
    expect(mage.className).toBe('Mage');
    expect(mage.specs.map(spec => [spec.spec, spec.score, spec.count, spec.best?.name])).toEqual([
      ['Fire', Math.round((6000 + 174) / 2), 2, 'Best'],
      ['Frost', 1916, 1, 'Example'],
      ['Arcane', 0, 0, undefined]
    ]);
  });

  it("scores a class by each character's best spec in it, counting a character once", () => {
    const everyone = summarize();
    const paladin = everyone.classes.find(group => group.className === 'Paladin')!;
    expect([paladin.count, paladin.score]).toEqual([1, 6969]);
    const mage = everyone.classes.find(group => group.className === 'Mage')!;
    expect([mage.count, mage.score]).toEqual([2, Math.round((6000 + 1916) / 2)]);
    expect(everyone.characterCount).toBe(3);
  });

  it('orders classes by their best spec, then the next one', () => {
    expect(summarize().classes.slice(0, 2).map(group => group.className)).toEqual(['Paladin', 'Mage']);
  });

  it('lists only the specs of the picked role', () => {
    const tanks = summarize('tank');
    expect(tanks.classes.flatMap(group => group.specs).every(spec => spec.role === 'tank')).toBe(true);
    expect(tanks.characterCount).toBe(1);
    expect(summarize('melee').characterCount).toBe(0);
  });
});

describe('topAverage', () => {
  it('averages the best scores only, or all of them when there are fewer', () => {
    expect(topAverage([1, 5, 3], 2)).toBe(4);
    expect(topAverage([5, 2])).toBe(4);
    expect(topAverage([])).toBe(0);
  });
});

describe('describeScoreSample', () => {
  it('says how many characters the average stands on', () => {
    expect(describeScoreSample(1)).toBe('Only 1 character');
    expect(describeScoreSample(4)).toBe('Average of all 4 characters');
    expect(describeScoreSample(10)).toBe('Average of all 10 characters');
    expect(describeScoreSample(1184)).toBe('Average of the top 10 of 1,184 characters');
  });
});

describe('scoreTicks', () => {
  it('draws clean score gridlines', () => {
    expect(scoreTicks(5368)).toEqual([0, 2000, 4000, 6000]);
    expect(scoreTicks(2400)).toEqual([0, 500, 1000, 1500, 2000, 2500]);
    expect(scoreTicks(0)).toEqual([0, 100]);
    expect([0, 500, 1000, 2500].map(formatScoreTick)).toEqual(['0', '500', '1k', '2.5k']);
  });
});

describe('performanceChart', () => {
  const chart = performanceChart(summarize('dps'));
  const mage = chart.groups.find(group => group.className === 'Mage')!;

  it('labels a gridline at every score tick, the top tick at the top of the plot', () => {
    expect(chart.gridlines.map(line => line.label)).toEqual(['0', '1k', '2k', '3k', '4k']);
    expect(chart.gridlines.map(line => line.position)).toEqual([0, 25, 50, 75, 100]);
  });

  it('sizes each bar by its score against the top tick and writes the value over the best spec only', () => {
    expect(mage.specs.map(spec => [spec.spec, spec.heightPercent, spec.valueLabel, spec.showValue])).toEqual([
      ['Fire', expect.closeTo(77.175), '3087', true],
      ['Frost', expect.closeTo(47.9), '1916', false],
      ['Arcane', 0, '0', false]
    ]);
    expect(mage.specs[0].best?.name).toBe('Best');
  });

  it("labels a class with its score, or a dash when nobody played it", () => {
    expect(mage).toMatchObject({ classIcon: 'assets/class-icons/8.gif', valueLabel: String(Math.round((6000 + 1916) / 2)) });
    expect(chart.groups.find(group => group.className === 'Rogue')?.valueLabel).toBe('-');
  });
});

describe('parseChartView', () => {
  it('reads the address bar, falling back to Popularity', () => {
    expect(['performance', 'popularity', 'nonsense', null].map(parseChartView))
      .toEqual(['performance', 'popularity', 'popularity', 'popularity']);
  });
});
