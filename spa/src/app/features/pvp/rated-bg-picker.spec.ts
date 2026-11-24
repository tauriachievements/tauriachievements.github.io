import { describe, expect, it } from 'vitest';
import {
  PICK_COUNT,
  RatedBgRosterEntry,
  RatedBgRosterFile,
  RosterGroup,
  RosterPlayer,
  TEAM_SIZE,
  canShuffle,
  countHealers,
  healerWarning,
  parseTeams,
  rosterGroups,
  rosterPlayers,
  shuffleTeams,
  teamSummary,
  teamsParams,
  togglePick
} from './rated-bg-picker';

function entry(name: string, overrides: Partial<RatedBgRosterEntry> = {}): RatedBgRosterEntry {
  return { name, realm: 'Evermoon', race: 1, gender: 0, class: 1, spec: 'Arms', traits: 40, itemLevel: 885, ...overrides };
}

function roster(players: RatedBgRosterEntry[], version = 1): RatedBgRosterFile {
  return { version, generatedAt: '2026-11-24T12:29:26Z', players };
}

function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function twenty(healers: number): RosterPlayer[] {
  return rosterPlayers(roster(Array.from({ length: PICK_COUNT }, (_, index) =>
    index < healers
      ? entry(`Healer${index}`, { class: 5, spec: 'Holy' })
      : entry(`Player${index}`)
  )));
}

const healerCount = (team: readonly RosterPlayer[]) => team.filter(player => player.role === 'healer').length;

const groupNames = (group: RosterGroup) =>
  group.classes.flatMap(rosterClass => rosterClass.players.map(player => player.name));

describe('rosterPlayers', () => {
  it('lists every player by name, ignoring case and accents', () => {
    const players = rosterPlayers(roster([entry('Bob'), entry('alice'), entry('Ádám')]));

    expect(players.map(player => player.name)).toEqual(['Ádám', 'alice', 'Bob']);
  });

  it('keys each player by name and realm', () => {
    expect(rosterPlayers(roster([entry('Morron', { realm: 'Tauri' })]))[0].key).toBe('Morron-Tauri');
  });

  it("gives each player the role and range of its spec", () => {
    const players = rosterPlayers(roster([
      entry('Lythus', { class: 2, spec: 'Holy' }),
      entry('Xyhop', { class: 5, spec: 'Shadow' }),
      entry('Pesi', { class: 1, spec: 'Arms' }),
      entry('Zowy', { class: 1, spec: 'Protection' }),
      entry('Nospec', { spec: undefined })
    ]));

    expect(players.map(player => [player.name, player.role, player.range])).toEqual([
      ['Lythus', 'healer', undefined],
      ['Nospec', undefined, undefined],
      ['Pesi', 'dps', 'melee'],
      ['Xyhop', 'dps', 'ranged'],
      ['Zowy', 'tank', undefined]
    ]);
  });

  it('keeps a character the armory does not know, without details', () => {
    const [player] = rosterPlayers(roster([{ name: 'Typo', realm: 'Evermoon', notFound: true }]));

    expect(player).toMatchObject({ name: 'Typo', found: false, role: undefined, traits: undefined, itemLevel: undefined });
  });

  it('refuses a file of another version', () => {
    expect(() => rosterPlayers(roster([entry('Xyhop')], 2))).toThrow();
  });
});

describe('rosterGroups', () => {
  it('lists the melee with the tanks and unknown specs, then the ranged, then the healers', () => {
    const groups = rosterGroups(rosterPlayers(roster([
      entry('Zowy'),
      entry('Xyhop', { class: 5, spec: 'Shadow' }),
      entry('Lythus', { class: 2, spec: 'Holy' }),
      entry('Guardian', { class: 11, spec: 'Guardian' }),
      entry('Bomboclats', { class: 3, spec: 'Marksmanship' }),
      entry('Lakmir', { class: 10, spec: 'Mistweaver' }),
      entry('Nospec', { spec: undefined }),
      { name: 'Typo', realm: 'Evermoon', notFound: true }
    ])));

    expect(groups.map(group => [group.label, groupNames(group)])).toEqual([
      ['Melee', ['Guardian', 'Zowy', 'Nospec', 'Typo']],
      ['Ranged', ['Bomboclats', 'Xyhop']],
      ['Healers', ['Lakmir', 'Lythus']]
    ]);
  });

  it('groups each list by class, classes in alphabetical order and an unknown class last', () => {
    const [melee] = rosterGroups(rosterPlayers(roster([
      entry('Pesi', { class: 1, spec: 'Arms' }),
      { name: 'Typo', realm: 'Evermoon', notFound: true },
      entry('Dom', { class: 2, spec: 'Retribution' }),
      entry('Keilalt', { class: 12, spec: 'Havoc' }),
      entry('Dkügli', { class: 6, spec: 'Unholy' }),
      entry('Zowy', { class: 1, spec: 'Protection' }),
      entry('Heaven', { class: 11, spec: 'Feral' }),
      entry('Allisa', { class: 6, spec: 'Frost' })
    ])));

    expect(melee.classes.map(rosterClass => [rosterClass.classId, rosterClass.players.map(player => player.name)])).toEqual([
      [6, ['Allisa', 'Dkügli']],
      [12, ['Keilalt']],
      [11, ['Heaven']],
      [2, ['Dom']],
      [1, ['Pesi', 'Zowy']],
      [0, ['Typo']]
    ]);
  });

  it('sorts each class by spec in alphabetical order, with an unknown spec last', () => {
    const [melee] = rosterGroups(rosterPlayers(roster([
      entry('Zowy', { spec: 'Protection', traits: 54 }),
      entry('Nospec', { spec: undefined, traits: 60 }),
      entry('Demifae', { spec: 'Fury', traits: 50 }),
      entry('Pesi', { spec: 'Arms', traits: 43 }),
      entry('Rcodio', { class: 6, spec: 'Unholy', traits: 54 }),
      entry('Zerololq', { class: 6, spec: 'Frost', traits: 38 })
    ])));

    expect(melee.classes.map(rosterClass => rosterClass.players.map(player => player.name))).toEqual([
      ['Zerololq', 'Rcodio'],
      ['Pesi', 'Demifae', 'Zowy', 'Nospec']
    ]);
  });

  it('sorts each spec by traits, highest first, then by name, with unknown traits last', () => {
    const [melee] = rosterGroups(rosterPlayers(roster([
      entry('Allisa', { traits: 38 }),
      entry('Morron', { spec: 'Fury', traits: 36 }),
      entry('Dkügli', { traits: 54 }),
      entry('Trelhy', { spec: 'Fury', traits: 49 }),
      entry('Demifae', { traits: 54 }),
      entry('Noartifact', { traits: undefined }),
      entry('Pesi', { traits: 43 })
    ])));

    expect(groupNames(melee)).toEqual(['Demifae', 'Dkügli', 'Pesi', 'Allisa', 'Noartifact', 'Trelhy', 'Morron']);
  });

  it('keeps all three groups when one has nobody in it', () => {
    expect(rosterGroups(rosterPlayers(roster([entry('Zowy')]))).map(group => [group.label, group.classes.length]))
      .toEqual([['Melee', 1], ['Ranged', 0], ['Healers', 0]]);
  });
});

describe('canShuffle', () => {
  it(`needs ${PICK_COUNT} players with an even number of healers`, () => {
    expect([0, 2, 4, 6].map(healers => canShuffle(twenty(healers)))).toEqual([true, true, true, true]);
    expect([1, 3, 5].map(healers => canShuffle(twenty(healers)))).toEqual([false, false, false]);
    expect(canShuffle(twenty(2).slice(1))).toBe(false);
  });

  it('counts the healers among the players', () => {
    expect(countHealers(twenty(3))).toBe(3);
  });
});

describe('healerWarning', () => {
  it('asks for an even number of healers while an odd number is ticked', () => {
    expect(healerWarning(3)).toBe('Tick an even number of healers to shuffle: 3 healers are ticked.');
    expect(healerWarning(1)).toBe('Tick an even number of healers to shuffle: 1 healer is ticked.');
  });

  it('says nothing for an even number', () => {
    expect([0, 2, 4].map(healerWarning)).toEqual([undefined, undefined, undefined]);
  });
});

describe('togglePick', () => {
  it('ticks a player and unticks a ticked one', () => {
    const ticked = togglePick(new Set(), 'Xyhop-Evermoon');

    expect([...ticked]).toEqual(['Xyhop-Evermoon']);
    expect([...togglePick(ticked, 'Xyhop-Evermoon')]).toEqual([]);
  });

  it(`never ticks more than ${PICK_COUNT} players`, () => {
    const full = new Set(Array.from({ length: PICK_COUNT }, (_, index) => `Player${index}-Evermoon`));

    expect(togglePick(full, 'Extra-Evermoon').size).toBe(PICK_COUNT);
    expect(togglePick(full, 'Player0-Evermoon').size).toBe(PICK_COUNT - 1);
  });
});

describe('shuffleTeams', () => {
  it(`makes two teams of ${TEAM_SIZE} out of the ${PICK_COUNT} ticked players`, () => {
    const players = twenty(3);
    const [first, second] = shuffleTeams(players, seeded(1));

    expect([first.length, second.length]).toEqual([TEAM_SIZE, TEAM_SIZE]);
    expect([...first, ...second].map(player => player.key).sort()).toEqual(players.map(player => player.key).sort());
  });

  it('splits the healers as evenly as it can', () => {
    for (const healers of [0, 1, 2, 3, 4, 5, 12]) {
      for (let seed = 0; seed < 50; seed++) {
        const [first, second] = shuffleTeams(twenty(healers), seeded(seed));

        expect(healerCount(first) + healerCount(second)).toBe(healers);
        expect(Math.abs(healerCount(first) - healerCount(second))).toBeLessThanOrEqual(1);
      }
    }
  });

  it('gives each team exactly half of an even number of healers, at random', () => {
    for (const healers of [2, 4, 6]) {
      const healersOfTeamOne = new Set<string>();
      for (let seed = 0; seed < 50; seed++) {
        const [first, second] = shuffleTeams(twenty(healers), seeded(seed));

        expect([healerCount(first), healerCount(second)]).toEqual([healers / 2, healers / 2]);
        healersOfTeamOne.add(first.filter(player => player.role === 'healer').map(player => player.name).join());
      }
      expect(healersOfTeamOne.size).toBeGreaterThan(1);
    }
  });

  it('splits every known class and spec as evenly as possible', () => {
    const players = rosterPlayers(roster([
      entry('Holy1', { class: 5, spec: 'Holy' }),
      entry('Holy2', { class: 5, spec: 'Holy' }),
      entry('Marks1', { class: 3, spec: 'Marksmanship' }),
      entry('Marks2', { class: 3, spec: 'Marksmanship' }),
      entry('Marks3', { class: 3, spec: 'Marksmanship' }),
      ...Array.from({ length: 5 }, (_, index) => entry(`Arms${index + 1}`)),
      ...Array.from({ length: 4 }, (_, index) => entry(`Shadow${index + 1}`, { class: 5, spec: 'Shadow' })),
      ...Array.from({ length: 6 }, (_, index) => entry(`Havoc${index + 1}`, { class: 12, spec: 'Havoc' }))
    ]));

    for (let seed = 0; seed < 50; seed++) {
      const teams = shuffleTeams(players, seeded(seed));
      const classSpecs = new Set(players.map(player => `${player.classId}:${player.spec}`));

      expect(teams.map(team => team.length)).toEqual([TEAM_SIZE, TEAM_SIZE]);
      expect(teams.map(healerCount)).toEqual([1, 1]);
      for (const classSpec of classSpecs) {
        const count = (team: readonly RosterPlayer[]) =>
          team.filter(player => `${player.classId}:${player.spec}` === classSpec).length;
        expect(Math.abs(count(teams[0]) - count(teams[1]))).toBeLessThanOrEqual(1);
      }
    }
  });

  it('leaves to chance which team gets the odd healer and who plays on which team', () => {
    const extraHealerTeams = new Set<number>();
    const firstTeamOfPlayer19 = new Set<boolean>();
    for (let seed = 0; seed < 50; seed++) {
      const [first, second] = shuffleTeams(twenty(3), seeded(seed));
      extraHealerTeams.add(healerCount(first) > healerCount(second) ? 0 : 1);
      firstTeamOfPlayer19.add(first.some(player => player.name === 'Player19'));
    }

    expect([...extraHealerTeams].sort()).toEqual([0, 1]);
    expect([...firstTeamOfPlayer19].sort()).toEqual([false, true]);
  });

  it('lists each team tanks first, then healers, then the rest, each by name', () => {
    const players = rosterPlayers(roster([
      entry('Zed'), entry('Amy'),
      entry('Tank', { class: 11, spec: 'Guardian' }),
      entry('Heal', { class: 5, spec: 'Holy' }),
      entry('Unknown', { spec: undefined })
    ]));
    const [first, second] = shuffleTeams(players, seeded(3));
    const order = (team: readonly RosterPlayer[]) => [...team].map(player => player.name);
    const expected = ['Tank', 'Heal', 'Amy', 'Zed', 'Unknown'];

    expect(first.length + second.length).toBe(expected.length);
    for (const team of [first, second]) {
      expect(order(team)).toEqual(expected.filter(name => order(team).includes(name)));
    }
  });
});

describe('teamsParams and parseTeams', () => {
  it('writes each team as its players joined by commas, and reads them back', () => {
    const players = twenty(3);
    const teams = shuffleTeams(players, seeded(7));
    const params = teamsParams(teams);

    expect(params.a?.split(',')).toEqual(teams[0].map(player => player.key));
    expect(parseTeams(params.a, params.b, players)).toEqual(teams);
  });

  it('leaves both parameters out without teams', () => {
    expect(teamsParams(undefined)).toEqual({ a: null, b: null });
  });

  it(`ignores a link unless each team is ${TEAM_SIZE} different players from the list`, () => {
    const players = twenty(3);
    const keys = players.map(player => player.key);
    const a = keys.slice(0, TEAM_SIZE);
    const b = keys.slice(TEAM_SIZE);

    expect(parseTeams(null, b.join(','), players)).toBeUndefined();
    expect(parseTeams(a.slice(1).join(','), b.join(','), players)).toBeUndefined();
    expect(parseTeams([...a.slice(1), 'Gone-Evermoon'].join(','), b.join(','), players)).toBeUndefined();
    expect(parseTeams([...a.slice(1), b[0]].join(','), b.join(','), players)).toBeUndefined();
    expect(parseTeams([...a.slice(1), a[1]].join(','), b.join(','), players)).toBeUndefined();
  });
});

describe('teamSummary', () => {
  it("counts a team's healers and averages the item levels it knows", () => {
    const team = rosterPlayers(roster([
      entry('Heal', { class: 5, spec: 'Holy', itemLevel: 886 }),
      entry('Dps', { itemLevel: 883 }),
      { name: 'Typo', realm: 'Evermoon', notFound: true }
    ]));

    expect(teamSummary(team)).toEqual({ healers: 1, averageItemLevel: 884.5 });
  });

  it('has no average item level when it knows none', () => {
    expect(teamSummary([])).toEqual({ healers: 0, averageItemLevel: undefined });
  });
});
