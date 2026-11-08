import { describe, expect, it } from 'vitest';
import { RaidBoss, RaidSpec } from './raid-logs.types';
import { BossTrinketShares, TrinketItem, TrinketPair, TrinketSample, TrinketSummary, TrinketUse } from './raid-trinkets';
import {
  trinketHeatRows,
  trinketInsights,
  trinketMetaTitle,
  trinketPairRows,
  trinketRows,
  trinketStats
} from './raid-trinkets-views';

const nythendra: RaidBoss = { id: 0, slug: 'nythendra', name: 'Nythendra', shortName: 'Nythendra', index: 0, portrait: '' };
const ursoc: RaidBoss = { id: 1, slug: 'ursoc', name: 'Ursoc', shortName: 'Ursoc', index: 1, portrait: '' };
const fire: RaidSpec = { id: 63, classId: 8, name: 'Fire', role: 'dps' };

const trinket = (id: number, name: string): TrinketItem => ({ id, name, icon: `icon_${id}`, quality: 4 });
const chrono = trinket(1, 'Chrono Shard');
const horn = trinket(2, 'Horn of Valor');
const writ = trinket(3, 'Infernal Writ');

const use = (item: TrinketItem, count: number, share: number, topShare: number, standing?: number): TrinketUse =>
  ({ item, count, characters: count, share, topCount: Math.round(topShare * 10), topShare, standing, best: {} as TrinketSample });

const chronoUse = use(chrono, 40, .4, .3, .52);
const hornUse = use(horn, 30, .3, .7, .68);
const writUse = use(writ, 12, .12, 0, .3);
const summary: TrinketSummary = { picks: 100, topPicks: 10, characters: 80, trinkets: [chronoUse, hornUse, writUse] };

const pair = (items: [TrinketItem, TrinketItem], count: number, share: number, topShare: number): TrinketPair =>
  ({ key: items.map(entry => entry.name).join('|'), items, count, share, topCount: Math.round(topShare * 10), topShare });
const pairs = [pair([chrono, horn], 20, .2, .3), pair([chrono, writ], 8, .08, 0), pair([horn, writ], 4, .04, .5)];

const nythendraShares: BossTrinketShares = { boss: nythendra, picks: 20, shares: [.3, .6, .1], elsewhere: [.45, .2, .12], elsewherePicks: 80 };
const ursocShares: BossTrinketShares = { boss: ursoc, picks: 0, shares: [0, 0, 0], elsewhere: [.4, .3, .12], elsewherePicks: 100 };
const names = ['Chrono Shard', 'Horn of Valor', 'Infernal Writ'];

describe('trinketMetaTitle', () => {
  it('names the difficulty and the boss, or every boss', () => {
    expect(trinketMetaTitle('Mythic', undefined)).toBe('Trinket meta · Mythic · All bosses');
    expect(trinketMetaTitle('Heroic', 'Ursoc')).toBe('Trinket meta · Heroic · Ursoc');
  });
});

describe('trinketStats', () => {
  it('counts characters, trinkets, pairs and top players', () => {
    expect(trinketStats(summary, pairs, undefined)).toEqual([
      { label: 'Characters', value: '80', note: '100 boss kills counted' },
      { label: 'Trinkets seen', value: '3', note: 'most worn: 40%' },
      { label: 'Pairs seen', value: '3', note: 'most worn: 20%' },
      { label: 'Top 10%', value: '10', note: 'best of each boss ranking' }
    ]);
  });

  it('speaks of the picked boss, and of nothing seen yet', () => {
    const empty: TrinketSummary = { picks: 0, topPicks: 0, characters: 0, trinkets: [] };
    expect(trinketStats(empty, [], ursoc).map(tile => tile.note)).toEqual(['killed Ursoc', '-', '-', 'best of the Ursoc ranking']);
  });
});

describe('trinketRows', () => {
  it('ranks the ten most worn trinkets against the most worn one, with the top players\' edge and how their wearers rank', () => {
    const many: TrinketSummary = { ...summary, trinkets: [...summary.trinkets, ...Array.from({ length: 9 }, (_, index) => use(trinket(10 + index, `Extra ${index}`), 5, .05, .05))] };
    const rows = trinketRows(many);

    expect(rows).toHaveLength(10);
    expect(rows.slice(0, 3).map(row => [row.rank, row.item.name, row.meter, row.edge, row.edgeTone, row.beats])).toEqual([
      [1, 'Chrono Shard', 1, '−10', 'down', '52%'],
      [2, 'Horn of Valor', expect.closeTo(.75), '+40', 'up', '68%'],
      [3, 'Infernal Writ', expect.closeTo(.3), '−12', 'down', '30%']
    ]);
    expect(rows[3]).toMatchObject({ edge: undefined, beats: '-' });
  });

  it('shows no edges below five top players', () => {
    expect(trinketRows({ ...summary, topPicks: 4 }).every(row => row.edge === undefined)).toBe(true);
  });
});

describe('trinketPairRows', () => {
  it('ranks the five most worn pairs against the most worn one', () => {
    const rows = trinketPairRows([...pairs, ...pairs.map(entry => ({ ...entry, key: `${entry.key}+` }))]);
    expect(rows).toHaveLength(5);
    expect(rows.slice(0, 2).map(row => [row.rank, row.meter])).toEqual([[1, 1], [2, expect.closeTo(.4)]]);
  });
});

describe('trinketInsights', () => {
  const sources = { summary, pairs, spec: fire, boss: undefined, bossShares: [nythendraShares, ursocShares], names };

  it('finds what top players favour and avoid, the strongest showing and the top players\' pair', () => {
    expect(trinketInsights(sources).map(insight => [insight.id, insight.title, insight.text, insight.items.map(item => item.name)])).toEqual([
      ['favoured', 'Horn of Valor', '70% of the top 10% wear it, against 30% of everyone.', ['Horn of Valor']],
      ['avoided', 'Infernal Writ', 'Only 0% of the top 10% wear it, against 12% of everyone.', ['Infernal Writ']],
      ['strongest', 'Horn of Valor', 'On average its wearers beat 68% of the Fire Mages on the same boss. The middle of a ranking beats 50%.', ['Horn of Valor']],
      ['pair', 'Horn of Valor + Infernal Writ', '50% of the top 10% wear both, against 4% of everyone.', ['Horn of Valor', 'Infernal Writ']]
    ]);
  });

  it('adds the trinket worn most above the other bosses on the picked boss', () => {
    const boss = trinketInsights({ ...sources, boss: nythendra }).find(insight => insight.id === 'boss');
    expect(boss).toMatchObject({ label: 'Worn for Nythendra', title: 'Horn of Valor', tone: 'up', text: '60% wear it on Nythendra, against 20% on the other bosses.' });
  });

  it('has nothing to say without a spec or characters', () => {
    expect(trinketInsights({ ...sources, spec: undefined })).toEqual([]);
    expect(trinketInsights({ ...sources, summary: { ...summary, picks: 0, trinkets: [] } })).toEqual([]);
  });
});

describe('trinketHeatRows', () => {
  it('lays out a row per shown trinket with a cell per boss, flagging the notable ones', () => {
    const rows = trinketHeatRows([nythendraShares, ursocShares], names, [hornUse, chronoUse]);

    expect(rows.map(row => row.key)).toEqual(['Horn of Valor', 'Chrono Shard']);
    expect(rows[0].cells[0]).toEqual({
      share: .6,
      label: '60%',
      notable: true,
      thin: false,
      tip: 'Horn of Valor on Nythendra',
      tipNote: '60% of 20 · 20% on the other bosses'
    });
    expect(rows[1].cells[0]).toMatchObject({ label: '30%', notable: false });
    expect(rows[0].cells[1]).toMatchObject({ label: '-', thin: true, tipNote: 'Nobody played the spec here' });
  });
});
