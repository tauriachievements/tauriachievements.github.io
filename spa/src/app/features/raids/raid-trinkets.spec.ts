import { describe, expect, it } from 'vitest';
import { RaidBoss, RaidCharacter, RaidDifficulty, RaidKillDetails, RaidMember, RaidSpec, RaidTrinket } from './raid-logs.types';
import {
  TrinketItem,
  TrinketSample,
  TrinketSummary,
  TrinketUse,
  bossTrinketShares,
  notableTrinkets,
  specTrinketSummaries,
  strongestShowing,
  topPlayerTrinketEdge,
  trinketItems,
  trinketPairs,
  trinketSamples,
  trinketUses
} from './raid-trinkets';

const boss = (index: number, slug: string): RaidBoss => ({ id: index, slug, name: slug, shortName: slug, index, portrait: '' });
const nythendra = boss(0, 'nythendra');
const ursoc = boss(1, 'ursoc');
const heroic: RaidDifficulty = { id: 15, slug: 'heroic', name: 'Heroic', shortName: 'HC', kills: 1 };

const fire: RaidSpec = { id: 63, classId: 8, name: 'Fire', role: 'dps', range: 'ranged' };
const frost: RaidSpec = { id: 64, classId: 8, name: 'Frost', role: 'dps', range: 'ranged' };
const holy: RaidSpec = { id: 65, classId: 2, name: 'Holy', role: 'healer' };

const BADGE = 'Vindictive Combatant\'s Badge';
const chrono: RaidTrinket = { id: 1, itemLevel: 870, name: 'Chrono Shard', quality: 4, icon: 'chrono' };
const horn: RaidTrinket = { id: 2, itemLevel: 860, name: 'Horn of Valor', quality: 3, icon: 'horn' };
const allianceBadge: RaidTrinket = { id: 10, itemLevel: 840, name: BADGE, quality: 3, icon: 'badge_alliance' };
const hordeBadge: RaidTrinket = { id: 11, itemLevel: 840, name: BADGE, quality: 3, icon: 'badge_horde' };

const characters = new Map<string, RaidCharacter>();
function character(name: string, classId = 8): RaidCharacter {
  let known = characters.get(name);
  if (!known) {
    known = { name, realm: 'Tauri', classId, race: 1, gender: 0, guild: '' };
    characters.set(name, known);
  }
  return known;
}

function member(name: string, spec: RaidSpec, value: number, trinkets: RaidTrinket[]): RaidMember {
  return {
    character: character(name, spec.classId),
    spec,
    itemLevel: 870,
    damage: 0,
    healing: 0,
    absorbs: 0,
    overhealing: 0,
    damageTaken: 0,
    interrupts: 0,
    dispels: 0,
    dps: spec.role === 'healer' ? 0 : value,
    hps: spec.role === 'healer' ? value : 0,
    talents: '',
    trinkets
  };
}

let logId = 0;
function kill(raidBoss: RaidBoss, killedAt: number, members: RaidMember[]): RaidKillDetails {
  return {
    realm: 'Tauri', logId: ++logId, boss: raidBoss, difficulty: heroic, killedAt, fightMs: 300_000,
    faction: 0, wipes: 0, deaths: 0, resurrects: 0, items: [], members
  };
}

const item = (trinket: RaidTrinket): TrinketItem => ({ id: trinket.id, name: trinket.name, icon: trinket.icon, quality: trinket.quality });
const items = new Map([chrono, horn, allianceBadge].map(trinket => [trinket.name, item(trinket)]));

let sampleId = 0;
function sample(trinkets: string[], extra: Partial<TrinketSample> = {}): TrinketSample {
  return { trinkets, isTop: false, key: `character ${++sampleId}`, relative: .5, value: 100, boss: nythendra, spec: fire, ...extra } as TrinketSample;
}

describe('trinketSamples', () => {
  it('keeps each character\'s best kill per boss and spec, with the trinkets they wore there, each name once', () => {
    const samples = trinketSamples([
      kill(nythendra, 1, [member('Alpha', fire, 100, [chrono, horn])]),
      kill(nythendra, 2, [member('Alpha', fire, 400, [{ ...chrono, itemLevel: 880 }, allianceBadge]), member('Beta', fire, 300, [hordeBadge, allianceBadge])])
    ]);

    expect(samples.map(entry => [entry.character.name, entry.value, entry.trinkets])).toEqual([
      ['Alpha', 400, ['Chrono Shard', BADGE]],
      ['Beta', 300, [BADGE]]
    ]);
  });

  it('leaves out members who wore no trinkets, so they don\'t take a place in the ranking', () => {
    const samples = trinketSamples([kill(nythendra, 1, [member('Gamma', fire, 999, []), member('Alpha', fire, 100, [chrono])])]);
    expect(samples.map(entry => [entry.character.name, entry.rank, entry.isTop])).toEqual([['Alpha', 1, true]]);
  });

  it('gives each character the share of the spec\'s ranking on that boss they beat', () => {
    const samples = trinketSamples([
      kill(nythendra, 1, [member('Alpha', fire, 400, [chrono]), member('Beta', fire, 300, [chrono]), member('Delta', fire, 200, [horn])]),
      kill(nythendra, 2, [member('Healz', holy, 900, [horn])])
    ]);

    expect(samples.map(entry => [entry.character.name, entry.standing])).toEqual([
      ['Alpha', 1],
      ['Beta', .5],
      ['Delta', 0],
      ['Healz', undefined]
    ]);
  });
});

describe('trinketItems', () => {
  it('shows each trinket as its most worn item, so the Alliance and Horde versions count as one', () => {
    const samples = trinketSamples([kill(nythendra, 1, [
      member('Alpha', fire, 100, [allianceBadge]),
      member('Beta', fire, 90, [allianceBadge, chrono]),
      member('Delta', fire, 80, [hordeBadge])
    ])]);

    expect(trinketItems(samples).get(BADGE)).toEqual({ id: 10, name: BADGE, icon: 'badge_alliance', quality: 3 });
    expect(trinketItems(samples).get('Chrono Shard')).toEqual(item(chrono));
  });

  it('takes the lower item id on a tie', () => {
    const samples = trinketSamples([kill(nythendra, 1, [member('Alpha', fire, 100, [hordeBadge]), member('Beta', fire, 90, [allianceBadge])])]);
    expect(trinketItems(samples).get(BADGE)?.id).toBe(10);
  });
});

describe('trinketUses', () => {
  it('shares each trinket among the characters, for everyone and the top players, most worn first', () => {
    const summary = trinketUses([
      sample(['Chrono Shard', 'Horn of Valor'], { isTop: true, standing: 1 }),
      sample(['Chrono Shard', BADGE], { standing: .5 }),
      sample(['Horn of Valor'], { standing: 0 }),
      sample(['Chrono Shard'])
    ], items);

    expect([summary.picks, summary.topPicks, summary.characters]).toEqual([4, 1, 4]);
    expect(summary.trinkets.map(use => [use.item.name, use.count, use.share, use.topCount, use.topShare, use.standing])).toEqual([
      ['Chrono Shard', 3, .75, 1, 1, .75],
      ['Horn of Valor', 2, .5, 1, 1, .5],
      [BADGE, 1, .25, 0, 0, .5]
    ]);
  });

  it('orders a tie by the top players\' count, then by name', () => {
    const summary = trinketUses([sample(['Horn of Valor']), sample(['Chrono Shard']), sample([BADGE], { isTop: true })], items);
    expect(summary.trinkets.map(use => use.item.name)).toEqual([BADGE, 'Chrono Shard', 'Horn of Valor']);
  });

  it('counts a character once however many bosses they wore it on', () => {
    const summary = trinketUses([sample(['Chrono Shard'], { key: 'Alpha' }), sample(['Chrono Shard'], { key: 'Alpha', boss: ursoc }), sample(['Chrono Shard'])], items);
    expect([summary.picks, summary.characters, summary.trinkets[0].count, summary.trinkets[0].characters]).toEqual([3, 2, 3, 2]);
  });

  it('keeps the wearer closest to the top of their boss\'s ranking as the best showing', () => {
    const near = sample(['Chrono Shard'], { relative: .9, value: 100 });
    const nearer = sample(['Chrono Shard'], { relative: .95, value: 80 });
    const sameButMore = sample(['Chrono Shard'], { relative: .95, value: 90 });
    expect(trinketUses([near, nearer, sameButMore], items).trinkets[0].best).toBe(sameButMore);
  });

  it('has no standing for a trinket nobody with a ranking to beat wore', () => {
    expect(trinketUses([sample(['Chrono Shard'])], items).trinkets[0].standing).toBeUndefined();
  });
});

describe('trinketPairs', () => {
  it('lists the pairs worn together, most worn first, shared among every character', () => {
    const pairs = trinketPairs([
      sample(['Horn of Valor', 'Chrono Shard'], { isTop: true }),
      sample(['Chrono Shard', 'Horn of Valor']),
      sample([BADGE, 'Chrono Shard']),
      sample(['Horn of Valor'])
    ], items);

    expect(pairs.map(pair => [pair.items.map(entry => entry.name), pair.count, pair.share, pair.topCount, pair.topShare])).toEqual([
      [['Chrono Shard', 'Horn of Valor'], 2, .5, 1, 1],
      [['Chrono Shard', BADGE], 1, .25, 0, 0]
    ]);
  });
});

describe('bossTrinketShares and notableTrinkets', () => {
  const wearing = (count: number, of: number, raidBoss: RaidBoss) =>
    Array.from({ length: of }, (_, index) => sample(index < count ? ['Chrono Shard', 'Horn of Valor'] : ['Horn of Valor'], { boss: raidBoss }));

  it('shares each boss\'s characters among the trinkets, beside the other bosses\'', () => {
    const [onNythendra, onUrsoc] = bossTrinketShares([...wearing(8, 10, nythendra), ...wearing(2, 10, ursoc)], [nythendra, ursoc], ['Chrono Shard', 'Horn of Valor']);

    expect(onNythendra).toEqual({ boss: nythendra, picks: 10, shares: [.8, 1], elsewhere: [.2, 1], elsewherePicks: 10 });
    expect(onUrsoc.shares).toEqual([.2, 1]);
  });

  it('marks a trinket worn ten points more on a boss, with ten characters on each side', () => {
    const [onNythendra, onUrsoc] = bossTrinketShares([...wearing(8, 10, nythendra), ...wearing(2, 10, ursoc)], [nythendra, ursoc], ['Chrono Shard', 'Horn of Valor']);
    expect(notableTrinkets(onNythendra)).toEqual([{ index: 0, share: .8, elsewhere: .2, difference: expect.closeTo(.6) }]);
    expect(notableTrinkets(onUrsoc)).toEqual([]);

    const [few] = bossTrinketShares([...wearing(8, 9, nythendra), ...wearing(2, 10, ursoc)], [nythendra, ursoc], ['Chrono Shard']);
    expect(notableTrinkets(few)).toEqual([]);
  });
});

describe('topPlayerTrinketEdge', () => {
  const use = (name: string, share: number, topShare: number) => ({ item: items.get(name), share, topShare }) as TrinketUse;
  const summary = (topPicks: number, trinkets: TrinketUse[]) => ({ picks: 100, topPicks, characters: 100, trinkets }) as TrinketSummary;
  const trinkets = [use('Chrono Shard', .3, .6), use('Horn of Valor', .5, .2), use(BADGE, .2, .22)];

  it('finds the trinket the top players favour most, and the one they skip most', () => {
    expect(topPlayerTrinketEdge(summary(10, trinkets), 'more')).toMatchObject({ use: trinkets[0], difference: expect.closeTo(.3) });
    expect(topPlayerTrinketEdge(summary(10, trinkets), 'less')).toMatchObject({ use: trinkets[1], difference: expect.closeTo(-.3) });
  });

  it('says nothing without five top players or a five-point difference', () => {
    expect(topPlayerTrinketEdge(summary(4, trinkets), 'more')).toBeUndefined();
    expect(topPlayerTrinketEdge(summary(10, [trinkets[2]]), 'more')).toBeUndefined();
  });
});

describe('strongestShowing', () => {
  const use = (name: string, characters: number, standing: number | undefined, count = characters) =>
    ({ item: items.get(name), count, characters, standing }) as TrinketUse;
  const summary = (trinkets: TrinketUse[]) => ({ picks: 100, topPicks: 10, characters: 100, trinkets }) as TrinketSummary;

  it('finds the trinket whose wearers rank best, among those ten or more characters wore', () => {
    const best = use('Horn of Valor', 10, .7);
    expect(strongestShowing(summary([use('Chrono Shard', 40, .6), best, use(BADGE, 9, .95, 30)]))).toBe(best);
  });

  it('says nothing when no trinket\'s wearers beat more than half', () => {
    expect(strongestShowing(summary([use('Chrono Shard', 40, .5), use('Horn of Valor', 20, undefined)]))).toBeUndefined();
  });
});

describe('specTrinketSummaries', () => {
  it('summarises each spec in the order given, a spec nobody played included', () => {
    const summaries = specTrinketSummaries([sample(['Chrono Shard'], { spec: fire }), sample(['Horn of Valor'], { spec: holy })], [holy, frost, fire], items);

    expect(summaries.map(entry => [entry.spec.name, entry.summary.picks, entry.summary.trinkets.map(use => use.item.name)])).toEqual([
      ['Holy', 1, ['Horn of Valor']],
      ['Frost', 0, []],
      ['Fire', 1, ['Chrono Shard']]
    ]);
  });
});
