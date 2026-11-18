import { describe, expect, it } from 'vitest';
import {
  MAX_SCORE,
  bossStanding,
  fitClassAndSpec,
  killsBefore,
  leaderboardRole,
  performanceQuality,
  rankCharacters,
  rankScores,
  rankedClassOptions,
  rankedSpecs,
  roleMetric,
  scoreChanges,
  scoreCharacters,
  scoresBySpec,
  scoresBySpecForKills,
  specPerformance
} from './raid-scores';
import { RaidBoss, RaidCharacter, RaidKillDetails, RaidSpec } from './raid-logs.types';
import { characterKey, logKey } from './raid-logs';
import { index, mythic, kills } from './raid-logs.fixture';
import { LEGION_SPECS } from '../../game/wow-specs';
import { Role } from '../../game/wow';

describe('rankCharacters', () => {
  it("ranks each character's best kill, healers and tanks by healing", () => {
    const dps = rankCharacters(kills, 'dps');
    expect(dps.map(entry => [entry.rank, entry.member.character.name, Math.round(entry.value)])).toEqual([
      [1, 'Kael', 600_000],
      [2, 'Sósa', 500_000],
      [3, 'Light', 200_000]
    ]);
    expect(rankCharacters(kills, 'hps').map(entry => [entry.member.character.name, entry.member.spec?.name])).toEqual([['Light', 'Holy']]);
  });

  it('ranks a tank by healing', () => {
    const tankKill = kills.filter(kill => kill.logId === 11);
    expect(rankCharacters(tankKill, 'hps').map(entry => [entry.member.character.name, entry.member.spec?.name, Math.round(entry.value)]))
      .toEqual([['Light', 'Protection', 3_571]]);
  });

  it('ranks a spec on kills played as that spec only', () => {
    const fire = rankCharacters(kills, 'dps', { specId: 63 });
    expect(fire.map(entry => [entry.member.character.name, entry.kill.logId])).toEqual([['Kael', 11], ['Sósa', 11]]);
  });

  it('filters by realm and class', () => {
    expect(rankCharacters(kills, 'dps', { realm: 'tauri' }).map(entry => entry.member.character.name)).toEqual(['Kael']);
    expect(rankCharacters(kills, 'dps', { classId: 2 }).map(entry => entry.member.character.name)).toEqual(['Light']);
  });

  it('ranks only ranged or melee damage specs by range, so a tank is in neither', () => {
    expect(rankCharacters(kills, 'dps', { role: 'ranged' }).map(entry => [entry.rank, entry.member.character.name])).toEqual([
      [1, 'Kael'],
      [2, 'Sósa']
    ]);
    expect(rankCharacters(kills, 'dps', { role: 'melee' })).toEqual([]);
  });

  it('ranks the tanks alone, or the damage specs without the tanks', () => {
    expect(rankCharacters(kills, 'dps', { role: 'tank' }).map(entry => [entry.rank, entry.member.character.name])).toEqual([
      [1, 'Light']
    ]);
    expect(rankCharacters(kills, 'dps', { role: 'dps' }).map(entry => entry.member.character.name)).toEqual(['Kael', 'Sósa']);
  });
});

describe('rankedSpecs', () => {
  it("lists a class's specs the metric ranks, in the index's order", () => {
    expect(rankedSpecs(index.specs, 8, 'dps').map(spec => spec.name)).toEqual(['Fire', 'Frost']);
    expect(rankedSpecs(index.specs, 2, 'dps').map(spec => spec.name)).toEqual(['Protection']);
    expect(rankedSpecs(index.specs, 2, 'hps').map(spec => spec.name)).toEqual(['Holy', 'Protection']);
    expect(rankedSpecs(index.specs, 8, 'hps')).toEqual([]);
    expect(rankedSpecs(index.specs, undefined, 'dps')).toEqual([]);
  });

  it('keeps only the specs of the role when one is given', () => {
    expect(rankedSpecs(index.specs, 8, 'dps', 'ranged').map(spec => spec.name)).toEqual(['Fire', 'Frost']);
    expect(rankedSpecs(index.specs, 8, 'dps', 'melee')).toEqual([]);
    expect(rankedSpecs(index.specs, 2, 'dps', 'melee')).toEqual([]);
    expect(rankedSpecs(index.specs, 2, 'dps', 'tank').map(spec => spec.name)).toEqual(['Protection']);
    expect(rankedSpecs(index.specs, 2, 'dps', 'dps')).toEqual([]);
  });
});

const allSpecs: ReadonlyMap<number, RaidSpec> = new Map(LEGION_SPECS.map(spec => [spec.id, {
  id: spec.id,
  classId: spec.classId,
  name: spec.spec,
  role: spec.role,
  range: spec.range
}]));

describe('rankedClassOptions', () => {
  const labels = (options: ReturnType<typeof rankedClassOptions>) => options.map(option => option.label);

  it('lists the classes with a spec the metric and range rank, after "All classes"', () => {
    expect(labels(rankedClassOptions(index.specs, 'dps'))).toEqual(['All classes', 'Mage', 'Paladin']);
    expect(labels(rankedClassOptions(index.specs, 'hps'))).toEqual(['All classes', 'Paladin']);
    expect(labels(rankedClassOptions(allSpecs, 'hps'))).toEqual([
      'All classes', 'Death Knight', 'Demon Hunter', 'Druid', 'Monk', 'Paladin', 'Priest', 'Shaman', 'Warrior'
    ]);
    expect(labels(rankedClassOptions(allSpecs, 'dps', 'ranged'))).toEqual([
      'All classes', 'Druid', 'Hunter', 'Mage', 'Priest', 'Shaman', 'Warlock'
    ]);
    expect(labels(rankedClassOptions(allSpecs, 'dps', 'melee'))).toEqual([
      'All classes', 'Death Knight', 'Demon Hunter', 'Druid', 'Hunter', 'Monk', 'Paladin', 'Rogue', 'Shaman', 'Warrior'
    ]);
    expect(labels(rankedClassOptions(allSpecs, 'dps', 'tank'))).toEqual([
      'All classes', 'Death Knight', 'Demon Hunter', 'Druid', 'Monk', 'Paladin', 'Warrior'
    ]);
  });
});

describe('fitClassAndSpec', () => {
  it('keeps a class and spec the view ranks', () => {
    expect(fitClassAndSpec(allSpecs, { classId: 3, specId: 253 }, 'dps', 'ranged')).toEqual({ classId: 3, specId: 253 });
    expect(fitClassAndSpec(allSpecs, { classId: 5 }, 'hps')).toEqual({ classId: 5, specId: undefined });
  });

  it('clears a class the view does not rank, and its spec', () => {
    expect(fitClassAndSpec(allSpecs, { classId: 4, specId: 259 }, 'dps', 'ranged')).toEqual({ classId: undefined, specId: undefined });
    expect(fitClassAndSpec(allSpecs, { classId: 8, specId: 63 }, 'hps')).toEqual({ classId: undefined, specId: undefined });
  });

  it("swaps a spec the view does not rank for the class's only ranked spec", () => {
    expect(fitClassAndSpec(allSpecs, { classId: 3, specId: 253 }, 'dps', 'melee')).toEqual({ classId: 3, specId: 255 });
    expect(fitClassAndSpec(allSpecs, { classId: 5, specId: 257 }, 'dps')).toEqual({ classId: 5, specId: 258 });
    expect(fitClassAndSpec(allSpecs, { classId: 7 }, 'dps', 'ranged')).toEqual({ classId: 7, specId: 262 });
    expect(fitClassAndSpec(allSpecs, { classId: 2, specId: 70 }, 'dps', 'tank')).toEqual({ classId: 2, specId: 66 });
    expect(fitClassAndSpec(allSpecs, { classId: 1, specId: 71 }, 'hps')).toEqual({ classId: 1, specId: 73 });
  });

  it('drops a spec the view does not rank when the class has several it does', () => {
    expect(fitClassAndSpec(allSpecs, { classId: 2, specId: 70 }, 'hps')).toEqual({ classId: 2, specId: undefined });
  });

  it('drops a spec without a class', () => {
    expect(fitClassAndSpec(allSpecs, { specId: 253 }, 'dps')).toEqual({ classId: undefined, specId: undefined });
  });
});

describe('bossStanding', () => {
  const light = characterKey({ name: 'Light', realm: 'Evermoon' });
  const sosa = characterKey({ name: 'Sósa', realm: 'Evermoon' });

  it('ranks the character among everyone, against the best anyone did', () => {
    expect(bossStanding(kills, 'dps', light)).toEqual({ rank: 3, ranked: 3, relative: 1 / 3 });
    expect(bossStanding(kills, 'dps', sosa)).toEqual({ rank: 2, ranked: 3, relative: 500_000 / 600_000 });
  });

  it('ranks the character among their class only, against the best of the class', () => {
    expect(bossStanding(kills, 'dps', light, { classId: 2 })).toEqual({ rank: 1, ranked: 1, relative: 1 });
    expect(bossStanding(kills, 'dps', sosa, { classId: 8 })).toEqual({ rank: 2, ranked: 2, relative: 500_000 / 600_000 });
  });

  it('has no rank or share for a character the ranking leaves out, but counts the others', () => {
    expect(bossStanding(kills, 'hps', sosa)).toEqual({ rank: undefined, ranked: 1, relative: 0 });
    expect(bossStanding(kills, 'hps', sosa, { classId: 8 })).toEqual({ rank: undefined, ranked: 0, relative: 0 });
    expect(bossStanding([], 'dps', sosa)).toEqual({ rank: undefined, ranked: 0, relative: 0 });
  });
});

describe('scoreCharacters', () => {
  const bosses = ['one', 'two', 'three', 'four'].map((slug, bossIndex): RaidBoss =>
    ({ id: bossIndex, slug, name: slug, shortName: slug, index: bossIndex, portrait: '' }));
  const fire = index.specs.get(63)!;
  const frost = index.specs.get(64)!;
  const holy = index.specs.get(65)!;
  const protection = index.specs.get(66)!;

  const character = (name: string, race = 10, classId = 8): RaidCharacter =>
    ({ name, realm: 'Tauri', classId, race, gender: 0, guild: '' });

  function kill(boss: number, killedAt: number, members: Array<[RaidCharacter, RaidSpec, number, number?]>): RaidKillDetails {
    return {
      realm: 'Tauri', logId: boss * 100 + killedAt, boss: bosses[boss], difficulty: mythic, killedAt, fightMs: 1_000,
      faction: 1, wipes: 0, deaths: 0, resurrects: 0, items: [],
      members: members.map(([who, spec, dps, hps = 0]) => ({
        character: who, spec, itemLevel: 860 + killedAt, damage: dps, healing: hps, absorbs: 0, overhealing: 0,
        damageTaken: 0, interrupts: 0, dispels: 0, dps, hps, talents: '', trinkets: []
      }))
    };
  }

  const bossKills = [
    [kill(0, 1, [[character('Best'), fire, 100], [character('Example'), fire, 10], [character('Light', 10, 2), holy, 0, 50]])],
    [kill(1, 2, [[character('Best'), fire, 200], [character('Example'), frost, 160]])],
    [kill(2, 3, [[character('Best'), fire, 1000], [character('Example'), frost, 300]])],
    [kill(3, 4, [[character('Best'), fire, 1000], [character('Tank', 1, 2), protection, 500]])]
  ];

  it('averages each boss against its best, out of 6969', () => {
    const scores = scoreCharacters(bosses, bossKills, 'dps');
    expect(scores.map(entry => [entry.character.name, entry.score, entry.killed])).toEqual([
      ['Best', MAX_SCORE, 4],
      ['Example', 2090, 3]
    ]);

    const example = scores[1];
    expect(example.performance).toBeCloseTo(.3);
    expect(example.bosses.map(entry => entry.relative)).toEqual([.1, .8, .3, 0]);
    expect(example.bosses[3].best).toBeUndefined();
  });

  it("gives the score's share of each boss as bossStanding among everyone", () => {
    const example = scoreCharacters(bosses, bossKills, 'dps')[1];
    const key = characterKey(example.character);
    expect(bossKills.map(kills => bossStanding(kills, 'dps', key).relative)).toEqual(example.bosses.map(entry => entry.relative));
  });

  it("leaves the tanks off the DPS list, so a tank's damage never sets the best", () => {
    const tankTopped = [[kill(0, 1, [[character('Best'), fire, 100], [character('Tank', 1, 2), protection, 400]])], [], [], []];
    expect(scoreCharacters(bosses, tankTopped, 'dps').map(entry => [entry.character.name, entry.score])).toEqual([['Best', MAX_SCORE]]);
  });

  it('scores the tanks on DPS, against the best tank', () => {
    const tankKills = [
      [kill(0, 1, [
        [character('Tank', 1, 2), protection, 500], [character('Wall', 1, 2), protection, 250],
        [character('Best'), fire, 1000], [character('Light', 10, 2), holy, 0, 900]
      ])],
      [kill(1, 2, [[character('Tank', 1, 2), protection, 100], [character('Wall', 1, 2), protection, 400]])],
      [],
      []
    ];
    expect(scoreCharacters(bosses, tankKills, 'tank').map(entry => [entry.character.name, entry.score, entry.killed])).toEqual([
      ['Wall', Math.floor(MAX_SCORE * (.5 + 1) / 2), 2],
      ['Tank', Math.floor(MAX_SCORE * (1 + .25) / 2), 2]
    ]);
  });

  it('scores only the healers on HPS, against the best healer, even where a tank healed more', () => {
    const healingKills = [
      [kill(0, 1, [[character('Light', 10, 2), holy, 0, 100], [character('Tank', 1, 2), protection, 500, 25], [character('Best'), fire, 1000, 900]])],
      [kill(1, 2, [[character('Light', 10, 2), holy, 0, 50], [character('Mend', 10, 2), holy, 0, 100], [character('Tank', 1, 2), protection, 500, 200]])],
      [],
      []
    ];
    expect(scoreCharacters(bosses, healingKills, 'healer').map(entry => [entry.character.name, entry.score])).toEqual([
      ['Light', Math.floor(MAX_SCORE * (1 + .5) / 2)],
      ['Mend', Math.floor(MAX_SCORE * (0 + 1) / 2)]
    ]);
  });

  it('leaves a boss nobody has killed out of the average', () => {
    const scores = scoreCharacters(bosses, [...bossKills.slice(0, 3), []], 'dps');
    expect(scores.find(entry => entry.character.name === 'Example')?.score).toBe(Math.floor(MAX_SCORE * 1.2 / 3));
    expect(scoreCharacters(bosses, [[], [], [], []], 'dps')).toEqual([]);
  });

  it('shows the spec played most, the latest item level and the faction of the race', () => {
    const scores = scoreCharacters(bosses, bossKills, 'dps');
    const example = scores.find(entry => entry.character.name === 'Example')!;
    expect(example.spec?.name).toBe('Frost');
    expect(example.itemLevel).toBe(863);
    expect(example.faction).toBe(1);
    expect(scoreCharacters(bosses, bossKills, 'tank').find(entry => entry.character.name === 'Tank')?.faction).toBe(0);
  });

  it('ranks the filtered rows from 1, keeping the scores', () => {
    const visitor: RaidCharacter = { ...character('Visitor'), realm: 'WoD' };
    const withVisitor = bossKills.map((kills, boss) => boss === 0 ? [...kills, kill(0, 5, [[visitor, frost, 50]])] : kills);
    const scores = scoreCharacters(bosses, withVisitor, 'dps');
    expect(rankScores(scores, { realm: 'wod' }).map(entry => [entry.rank, entry.character.name, entry.score]))
      .toEqual([[1, 'Visitor', Math.floor(MAX_SCORE * .5 / 4)]]);
    expect(rankScores(scores, { classId: 8 }).map(entry => entry.rank)).toEqual([1, 2, 3]);
    expect(rankScores(scores, { classId: 2 })).toEqual([]);
  });

  it('scores a spec on the kills played as it, against the best of any damage spec', () => {
    const fireOnly = scoreCharacters(bosses, bossKills, 'dps', fire.id);
    expect(fireOnly.map(entry => [entry.character.name, entry.score, entry.killed])).toEqual([
      ['Best', MAX_SCORE, 4],
      ['Example', Math.floor(MAX_SCORE * .1 / 4), 1]
    ]);
    expect(fireOnly[1].spec?.name).toBe('Fire');
  });

  it("leaves out a former character with the name, whose kill still sets the boss's best", () => {
    const former: RaidCharacter = { ...character('Example', 10, 2), former: true };
    const withFormer = bossKills.map((kills, boss) => boss === 0 ? [...kills, kill(0, 5, [[former, protection, 400]])] : kills);

    expect(scoreCharacters(bosses, withFormer, 'tank').map(entry => [entry.character.name, entry.character.classId, entry.score]))
      .toEqual([['Tank', 2, Math.floor(MAX_SCORE / 2)]]);
    expect(scoreCharacters(bosses, withFormer, 'dps').map(entry => [entry.character.name, entry.score]))
      .toEqual([['Best', MAX_SCORE], ['Example', 2090]]);
    expect(rankCharacters(withFormer[0], 'dps').map(entry => entry.member.character.name)).toEqual(['Best', 'Example']);
    expect(bossStanding(withFormer[0], 'dps', characterKey(former))).toEqual({ rank: 2, ranked: 2, relative: 10 / 400 });
    expect(scoresBySpec(bosses, withFormer).get(protection)?.map(entry => entry.character.name)).toEqual(['Tank']);
  });

  describe('by spec', () => {
    it('gives each character the score the leaderboard shows with their spec picked', () => {
      const bySpec = scoresBySpec(bosses, bossKills);
      expect([...bySpec].map(([spec, scores]) => [spec.name, scores.map(entry => [entry.character.name, entry.score])])).toEqual([
        ['Fire', [['Best', MAX_SCORE], ['Example', 174]]],
        ['Holy', [['Light', MAX_SCORE]]],
        ['Frost', [['Example', 1916]]],
        ['Protection', [['Tank', MAX_SCORE]]]
      ]);

      for (const [spec, scores] of bySpec) {
        const leaderboard = scoreCharacters(bosses, bossKills, spec.role, spec.id);
        expect(new Map(scores.map(entry => [entry.character.name, entry.score])))
          .toEqual(new Map(leaderboard.map(entry => [entry.character.name, entry.score])));
      }
    });

    it('measures a healer against the best healer and a tank against the best tank', () => {
      const mixed = [[kill(0, 1, [
        [character('Light', 10, 2), holy, 0, 100], [character('Tank', 1, 2), protection, 500, 400], [character('Best'), fire, 1000]
      ])], [], [], []];
      const bySpec = scoresBySpec(bosses, mixed);
      expect(bySpec.get(holy)?.map(entry => entry.score)).toEqual([MAX_SCORE]);
      expect(bySpec.get(protection)?.map(entry => entry.score)).toEqual([MAX_SCORE]);
      expect(bySpec.get(protection)).toEqual(scoreCharacters(bosses, mixed, 'tank', protection.id)
        .map(entry => ({ character: entry.character, score: entry.score })));
    });

    it("sorts one difficulty's kills by boss before scoring them", () => {
      expect(scoresBySpecForKills(bosses, bossKills.flat().reverse())).toEqual(scoresBySpec(bosses, bossKills));
    });

    it("averages each spec's best scores and orders classes by their best spec", () => {
      const scores = scoresBySpec(bosses, bossKills);
      const damage = specPerformance(scores, 'dps');
      const mage = damage.classes[0];
      expect(mage.className).toBe('Mage');
      expect(mage.specs.map(spec => [spec.spec, spec.score, spec.count, spec.best?.character.name])).toEqual([
        ['Fire', Math.round((MAX_SCORE + 174) / 2), 2, 'Best'],
        ['Frost', 1916, 1, 'Example'],
        ['Arcane', 0, 0, undefined]
      ]);
      expect([mage.count, mage.score]).toEqual([2, Math.round((MAX_SCORE + 1916) / 2)]);
      expect(damage.characterCount).toBe(2);
      expect(damage.classes.every(group => group.specs.every(spec => spec.role === 'dps'))).toBe(true);

      const everyone = specPerformance(scores);
      expect(everyone.classes.slice(0, 2).map(group => [group.className, group.score])).toEqual([
        ['Paladin', MAX_SCORE],
        ['Mage', Math.round((MAX_SCORE + 1916) / 2)]
      ]);
      expect(everyone.characterCount).toBe(4);
    });

    it('limits the spec performance to the melee or the ranged damage specs', () => {
      const scores = scoresBySpec(bosses, bossKills);
      const ranged = specPerformance(scores, 'ranged');
      expect(ranged.classes[0].specs.map(spec => [spec.spec, spec.count])).toEqual([['Fire', 2], ['Frost', 1], ['Arcane', 0]]);
      expect(ranged.classes.flatMap(group => group.specs).every(spec => spec.range === 'ranged')).toBe(true);
      expect(ranged.characterCount).toBe(2);

      const melee = specPerformance(scores, 'melee');
      expect(melee.characterCount).toBe(0);
      expect(melee.classes.map(group => group.className)).toContain('Rogue');
      expect(melee.classes.map(group => group.className)).not.toContain('Mage');
    });
  });

  describe('since the previous scan', () => {
    const changesWithout = (kills: RaidKillDetails[][], newKill: RaidKillDetails, bossCount = 4, role: Role = 'dps') => {
      const scored = bosses.slice(0, bossCount);
      const before = killsBefore(kills, new Set([logKey(newKill)]));
      return scoreChanges(rankScores(scoreCharacters(scored, kills, role)), rankScores(scoreCharacters(scored, before, role)));
    };

    it('leaves out only the kills the previous scan did not have', () => {
      expect(killsBefore(bossKills, new Set([logKey(bossKills[3][0])])).map(kills => kills.length)).toEqual([1, 1, 1, 0]);
    });

    it('measures the ranks climbed and the score gained', () => {
      const newKill = kill(1, 5, [[character('B'), fire, 200]]);
      const kills = [
        [kill(0, 1, [[character('A'), fire, 100], [character('B'), fire, 90]])],
        [kill(1, 2, [[character('A'), fire, 100], [character('B'), fire, 50]]), newKill]
      ];
      expect([...changesWithout(kills, newKill, 2)]).toEqual([
        ['tauri/B', { rank: 1, value: 6620 - 4878, isNew: false }],
        ['tauri/A', { rank: -1, value: 5226 - MAX_SCORE, isNew: false }]
      ]);
    });

    it("marks a character new to the ranking and leaves out one who didn't move", () => {
      const changes = changesWithout(bossKills, bossKills[3][0]);
      expect(changes.has('tauri/Best')).toBe(false);
      expect(changes.get('tauri/Example')).toEqual({ rank: 0, value: 2090 - 2787, isNew: false });
      expect(changes.has('tauri/Tank')).toBe(false);
      expect(changesWithout(bossKills, bossKills[3][0], 4, 'tank').get('tauri/Tank')).toEqual({ rank: 0, value: 0, isNew: true });
    });
  });
});

describe('roleMetric', () => {
  it('measures the damage dealers and the tanks on DPS, and the healers on HPS', () => {
    expect((['dps', 'tank', 'healer'] as const).map(roleMetric)).toEqual(['dps', 'dps', 'hps']);
  });
});

describe('leaderboardRole', () => {
  const [fire, holy, protection] = [63, 65, 66].map(id => index.specs.get(id)!);

  it('scores healing on the Healer list', () => {
    expect(leaderboardRole('hps', [protection, protection, fire])).toBe('healer');
  });

  it('scores damage on the list of the damage or tank spec played most, the latest on a tie', () => {
    expect(leaderboardRole('dps', [protection, fire, protection, holy, holy, holy])).toBe('tank');
    expect(leaderboardRole('dps', [fire, protection])).toBe('dps');
    expect(leaderboardRole('dps', [protection, fire])).toBe('tank');
    expect(leaderboardRole('dps', [holy])).toBe('dps');
    expect(leaderboardRole('dps', [])).toBe('dps');
  });
});

describe('performanceQuality', () => {
  it('knows the parse colours', () => {
    expect([1, .97, .8, .6, .3, .1].map(performanceQuality)).toEqual([6, 5, 4, 3, 2, 0]);
  });
});
