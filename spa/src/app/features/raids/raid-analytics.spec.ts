import { describe, expect, it } from 'vitest';
import { RaidBoss, RaidCharacter, RaidDifficulty, RaidKillDetails, RaidMember, RaidSpec } from './raid-logs.types';
import { RoleFilter } from '../../game/wow';
import {
  formatPoints,
  formatShare,
  heatColor,
  pickSamples,
  sortByPerformance,
  specsMatching,
  topPlayerCount
} from './raid-analytics';

const boss = (index: number, slug: string): RaidBoss => ({ id: index, slug, name: slug, shortName: slug, index, portrait: '' });
const nythendra = boss(0, 'nythendra');
const ursoc = boss(1, 'ursoc');
const heroic: RaidDifficulty = { id: 15, slug: 'heroic', name: 'Heroic', shortName: 'HC', kills: 1 };

const fire: RaidSpec = { id: 63, classId: 8, name: 'Fire', role: 'dps', range: 'ranged' };
const holy: RaidSpec = { id: 65, classId: 2, name: 'Holy', role: 'healer' };

const characters = new Map<string, RaidCharacter>();
function character(name: string, classId = 8): RaidCharacter {
  let known = characters.get(name);
  if (!known) {
    known = { name, realm: 'Tauri', classId, race: 1, gender: 0, guild: '' };
    characters.set(name, known);
  }
  return known;
}

function member(name: string, spec: RaidSpec | undefined, dps: number, hps = 0, itemLevel = 870): RaidMember {
  return {
    character: character(name, spec?.classId),
    spec,
    itemLevel,
    damage: 0,
    healing: 0,
    absorbs: 0,
    overhealing: 0,
    damageTaken: 0,
    interrupts: 0,
    dispels: 0,
    dps,
    hps,
    talents: '',
    trinkets: []
  };
}

let logId = 0;
function kill(raidBoss: RaidBoss, killedAt: number, members: RaidMember[]): RaidKillDetails {
  return {
    realm: 'Tauri', logId: ++logId, boss: raidBoss, difficulty: heroic, killedAt, fightMs: 300_000,
    faction: 0, wipes: 0, deaths: 0, resurrects: 0, items: [], members
  };
}

describe('pickSamples', () => {
  const everyone = () => true;

  it('keeps each character\'s best kill per boss and spec, and ranks the spec on each boss', () => {
    const samples = pickSamples([
      kill(nythendra, 1, [member('Alpha', fire, 100), member('Beta', fire, 300), member('Healz', holy, 10, 500)]),
      kill(nythendra, 2, [member('Alpha', fire, 400), member('Beta', fire, 200)]),
      kill(ursoc, 3, [member('Alpha', fire, 50)])
    ], everyone);

    expect(samples.filter(sample => sample.character.name === 'Alpha').map(sample => [sample.boss.slug, sample.value, sample.kill.killedAt]))
      .toEqual([['nythendra', 400, 2], ['ursoc', 50, 3]]);
    expect(samples.filter(sample => sample.boss === nythendra && sample.spec === fire).map(sample => [sample.character.name, sample.rank, sample.isTop, sample.relative]))
      .toEqual([['Alpha', 1, true, 1], ['Beta', 2, false, .75]]);
    expect(samples.find(sample => sample.spec === holy)?.value).toBe(500);
  });

  it('counts only the members the page asks for, and ranks them among themselves', () => {
    const samples = pickSamples([
      kill(nythendra, 1, [member('Alpha', fire, 500, 0, 800), member('Beta', fire, 300), member('Gamma', fire, 200)])
    ], candidate => candidate.itemLevel > 850);

    expect(samples.map(sample => [sample.character.name, sample.rank, sample.relative])).toEqual([['Beta', 1, 1], ['Gamma', 2, 200 / 300]]);
  });

  it('leaves out members without a spec, and a former character with the name', () => {
    const former = { ...member('Alpha', fire, 900), character: { ...character('Alpha'), former: true } };
    const samples = pickSamples([kill(nythendra, 1, [former, member('Nobody', undefined, 999), member('Beta', fire, 300)])], everyone);
    expect(samples.map(sample => [sample.character.name, sample.rank, sample.relative])).toEqual([['Beta', 1, 1]]);
  });

  it('counts a tenth of a ranking, rounded up, as its top players', () => {
    expect([0, 1, 9, 10, 11, 25].map(topPlayerCount)).toEqual([0, 1, 1, 1, 2, 3]);
  });
});

describe('specsMatching', () => {
  const retribution: RaidSpec = { id: 70, classId: 2, name: 'Retribution', role: 'dps', range: 'melee' };
  const specs = [fire, holy, retribution];
  const names = (classId: number | undefined, role: RoleFilter | undefined) =>
    specsMatching(specs, classId, role).map(spec => spec.name);

  it('keeps every spec without a class or a role', () => {
    expect(names(undefined, undefined)).toEqual(['Fire', 'Holy', 'Retribution']);
  });

  it('narrows by class, by role, and by both', () => {
    expect(names(2, undefined)).toEqual(['Holy', 'Retribution']);
    expect(names(undefined, 'dps')).toEqual(['Fire', 'Retribution']);
    expect(names(2, 'healer')).toEqual(['Holy']);
    expect(names(8, 'healer')).toEqual([]);
  });

  it('narrows to the melee or the ranged damage specs', () => {
    expect(names(undefined, 'melee')).toEqual(['Retribution']);
    expect(names(undefined, 'ranged')).toEqual(['Fire']);
    expect(names(2, 'ranged')).toEqual([]);
  });
});

describe('sortByPerformance', () => {
  const retribution: RaidSpec = { id: 70, classId: 2, name: 'Retribution', role: 'dps' };
  const arcane: RaidSpec = { id: 62, classId: 8, name: 'Arcane', role: 'dps' };
  const frost: RaidSpec = { id: 64, classId: 8, name: 'Frost', role: 'dps' };
  const scored = (...values: number[]) => values.map((score, index) => ({ character: character(`Scored${score}x${index}`), score }));
  const names = (items: Array<{ spec: RaidSpec }>) => items.map(item => item.spec.name);

  it('orders by the average of each spec\'s top ten scores, not its single best', () => {
    const scores = new Map([
      [fire, scored(6969, ...Array<number>(10).fill(1000))],
      [retribution, scored(5000)]
    ]);
    expect(names(sortByPerformance([{ spec: fire }, { spec: retribution }], scores))).toEqual(['Retribution', 'Fire']);
  });

  it('puts unscored specs last and keeps the given order on a tie', () => {
    const scores = new Map([[arcane, scored(3000)], [fire, scored(3000)]]);
    expect(names(sortByPerformance([{ spec: frost }, { spec: arcane }, { spec: fire }], scores))).toEqual(['Arcane', 'Fire', 'Frost']);
  });
});

describe('formatting', () => {
  it('formats shares and differences', () => {
    expect([0, .004, .005, .571, 1].map(formatShare)).toEqual(['0%', '<1%', '1%', '57%', '100%']);
    expect([.234, -.08, .001].map(formatPoints)).toEqual(['+23', '−8', '0']);
  });

  it('shades a heatmap cell from faint to strong gold with the share', () => {
    expect(heatColor(0)).toBe('rgba(247, 181, 0, 0.040)');
    expect(heatColor(1)).toBe('rgba(247, 181, 0, 0.540)');
  });
});
