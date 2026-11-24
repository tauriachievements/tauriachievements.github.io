import { describe, expect, it } from 'vitest';
import {
  PICK_COUNT,
  RatedBgRosterEntry,
  RatedBgRosterFile,
  RosterGroup,
  RosterPlayer,
  TEAM_SIZE,
  FLAG_CARRIER_COUNT,
  canShuffle,
  countHealers,
  healerWarning,
  markTeamFlagCarrier,
  parseTeams,
  rosterGroups,
  rosterPlayers,
  shuffleTeams,
  teamGroups,
  teamSummary,
  teamsParams,
  tickedFlagCarriers,
  toggleFlagCarrier,
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

function groupOfTwenty(): RosterPlayer[] {
  return rosterPlayers(roster([
    entry('Llýnch', { class: 5, spec: 'Holy' }),
    entry('Widuxgodx', { class: 10, spec: 'Mistweaver' }),
    entry('Wxz', { class: 11, spec: 'Restoration' }),
    entry('Lakmir', { class: 10, spec: 'Mistweaver' }),
    entry('Lythus', { class: 2, spec: 'Holy' }),
    entry('Spuky', { class: 7, spec: 'Restoration' }),
    entry('Allisa', { class: 6, spec: 'Unholy' }),
    entry('Dkügli', { class: 6, spec: 'Unholy' }),
    entry('Rcodio', { class: 6, spec: 'Unholy' }),
    entry('Zerololq', { class: 6, spec: 'Frost' }),
    entry('Morron', { class: 1, spec: 'Arms' }),
    entry('Zowy', { class: 1, spec: 'Fury' }),
    entry('Majä', { class: 10, spec: 'Windwalker' }),
    entry('Zsozé', { class: 10, spec: 'Windwalker' }),
    entry('Cicámqu', { class: 11, spec: 'Feral' }),
    entry('Dnx', { class: 9, spec: 'Affliction' }),
    entry('Maviellian', { class: 3, spec: 'Marksmanship' }),
    entry('Sósa', { class: 8, spec: 'Frost' }),
    entry('Xyhop', { class: 5, spec: 'Shadow' }),
    entry('Trelhy', { class: 4, spec: 'Assassination' })
  ]));
}

function expectEvenSplit(players: readonly RosterPlayer[], teams: readonly (readonly RosterPlayer[])[]): void {
  const count = (team: readonly RosterPlayer[], healers: boolean, key: (player: RosterPlayer) => string, value: string) =>
    team.filter(player => (player.role === 'healer') === healers && key(player) === value).length;
  const byClass = (player: RosterPlayer) => `${player.classId}`;
  const bySpec = (player: RosterPlayer) => `${player.classId}:${player.spec}`;

  expect(teams.map(team => team.length)).toEqual([TEAM_SIZE, TEAM_SIZE]);
  expect(teams.map(healerCount)).toEqual([healerCount(players) / 2, healerCount(players) / 2]);
  for (const healers of [true, false]) {
    for (const key of [byClass, bySpec]) {
      for (const value of new Set(players.map(key))) {
        expect(Math.abs(count(teams[0], healers, key, value) - count(teams[1], healers, key, value))).toBeLessThanOrEqual(1);
      }
    }
  }
}

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
    expect(healerWarning(3)).toBe('tick an even number');
    expect(healerWarning(1)).toBe('tick an even number');
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

describe('toggleFlagCarrier', () => {
  it('marks a player and unmarks a marked one', () => {
    const marked = toggleFlagCarrier(new Set(), 'Cicámqu-Evermoon');

    expect([...marked]).toEqual(['Cicámqu-Evermoon']);
    expect([...toggleFlagCarrier(marked, 'Cicámqu-Evermoon')]).toEqual([]);
  });

  it(`never marks more than ${FLAG_CARRIER_COUNT} players`, () => {
    const full = new Set(['Cicámqu-Evermoon', 'Zowy-Evermoon']);

    expect([...toggleFlagCarrier(full, 'Heaven-Tauri')]).toEqual(['Cicámqu-Evermoon', 'Zowy-Evermoon']);
    expect([...toggleFlagCarrier(full, 'Zowy-Evermoon')]).toEqual(['Cicámqu-Evermoon']);
  });
});

describe('tickedFlagCarriers', () => {
  it('drops the mark of a player who is no longer ticked', () => {
    const marked = new Set(['Cicámqu-Evermoon', 'Zowy-Evermoon']);

    expect([...tickedFlagCarriers(marked, new Set(['Zowy-Evermoon', 'Heaven-Tauri']))]).toEqual(['Zowy-Evermoon']);
  });
});

describe('markTeamFlagCarrier', () => {
  const team = twenty(2).slice(0, TEAM_SIZE);
  const [first, second] = team.map(player => player.key);

  it("moves the team's mark to the player and keeps the other team's", () => {
    const marked = markTeamFlagCarrier(new Set([first, 'Other-Evermoon']), team, second);

    expect([...marked].sort()).toEqual(['Other-Evermoon', second].sort());
  });

  it('unmarks a marked player', () => {
    expect([...markTeamFlagCarrier(new Set([first, 'Other-Evermoon']), team, first)]).toEqual(['Other-Evermoon']);
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

  it('splits each class as evenly as possible before its specs', () => {
    const players = groupOfTwenty();

    for (let seed = 0; seed < 50; seed++) {
      expectEvenSplit(players, shuffleTeams(players, seeded(seed)));
    }
  });

  it('puts one of two flag carriers on each team, every split as even as without them', () => {
    const players = groupOfTwenty();
    const pairs = [
      ['Cicámqu', 'Trelhy'],
      ['Llýnch', 'Dnx'],
      ['Allisa', 'Dkügli'],
      ['Zerololq', 'Rcodio'],
      ['Lythus', 'Spuky'],
      ['Morron', 'Zowy']
    ];

    for (const pair of pairs) {
      const flagCarriers = new Set(pair.map(name => `${name}-Evermoon`));
      const teamsOfFirst = new Set<number>();
      for (let seed = 0; seed < 50; seed++) {
        const teams = shuffleTeams(players, seeded(seed), flagCarriers);

        expect(teams.map(team => team.filter(player => flagCarriers.has(player.key)).length)).toEqual([1, 1]);
        expectEvenSplit(players, teams);
        teamsOfFirst.add(teams[0].some(player => player.name === pair[0]) ? 0 : 1);
      }
      expect([...teamsOfFirst].sort()).toEqual([0, 1]);
    }
  });

  it('splits the ranged and so the melee as evenly as possible, keeping every class and spec split', () => {
    const players = rosterPlayers(roster([
      entry('Wxz', { class: 11, spec: 'Restoration' }),
      entry('Lythus', { class: 2, spec: 'Holy' }),
      entry('Quro', { class: 5, spec: 'Holy' }),
      entry('Lakmir', { class: 10, spec: 'Mistweaver' }),
      entry('Holyrose', { class: 2, spec: 'Holy' }),
      entry('Spuky', { class: 7, spec: 'Restoration' }),
      entry('Bomboclats', { class: 3, spec: 'Marksmanship' }),
      entry('Nimphel', { class: 3, spec: 'Marksmanship' }),
      entry('Sósa', { class: 8, spec: 'Frost' }),
      entry('Harqu', { class: 8, spec: 'Fire' }),
      entry('Xyhop', { class: 5, spec: 'Shadow' }),
      entry('Dnx', { class: 9, spec: 'Affliction' }),
      entry('Zerololq', { class: 6, spec: 'Frost' }),
      entry('Dkügli', { class: 6, spec: 'Unholy' }),
      entry('Heaven', { class: 11, spec: 'Feral' }),
      entry('Zsozé', { class: 10, spec: 'Windwalker' }),
      entry('Majä', { class: 10, spec: 'Windwalker' }),
      entry('Trelhy', { class: 4, spec: 'Assassination' }),
      entry('Zowy', { class: 1, spec: 'Fury' }),
      entry('Morron', { class: 1, spec: 'Arms' })
    ]));
    const rangedIn = (team: readonly RosterPlayer[]) => team.filter(player => player.range === 'ranged').length;

    for (const flagCarriers of [new Set<string>(), new Set(['Zsozé-Evermoon', 'Majä-Evermoon'])]) {
      const rangedOfTeamOne = new Set<string>();
      for (let seed = 0; seed < 50; seed++) {
        const teams = shuffleTeams(players, seeded(seed), flagCarriers);

        expect(teams.map(rangedIn)).toEqual([3, 3]);
        expectEvenSplit(players, teams);
        rangedOfTeamOne.add(teams[0].filter(player => player.range === 'ranged').map(player => player.name).sort().join());
      }
      expect(rangedOfTeamOne.size).toBeGreaterThan(1);
    }
  });

  it('shuffles as usual around a single flag carrier', () => {
    const players = groupOfTwenty();

    for (let seed = 0; seed < 20; seed++) {
      expect(shuffleTeams(players, seeded(seed), new Set(['Cicámqu-Evermoon'])))
        .toEqual(shuffleTeams(players, seeded(seed)));
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

  it('lists each team as its healers, ranged and melee, each by class as in the list', () => {
    const players = rosterPlayers(roster([
      entry('Zed'), entry('Amy'),
      entry('Tank', { class: 11, spec: 'Guardian' }),
      entry('Heal', { class: 5, spec: 'Holy' }),
      entry('Shadow', { class: 5, spec: 'Shadow' }),
      entry('Unknown', { spec: undefined })
    ]));

    for (let seed = 0; seed < 20; seed++) {
      for (const team of shuffleTeams(players, seeded(seed))) {
        expect(team.map(player => player.name))
          .toEqual(teamGroups(team).flatMap(group => group.players.map(player => player.name)));
      }
    }
  });
});

describe('teamGroups', () => {
  it("splits a team into its healers, ranged and melee, each by class, spec and traits as in the list", () => {
    const team = rosterPlayers(roster([
      entry('Lythus', { class: 2, spec: 'Holy' }),
      entry('Zowy', { class: 1, spec: 'Fury' }),
      entry('Xyhop', { class: 5, spec: 'Shadow' }),
      entry('Lakmir', { class: 10, spec: 'Mistweaver' }),
      entry('Rcodio', { class: 6, spec: 'Unholy', traits: 37 }),
      entry('Sósa', { class: 8, spec: 'Frost' }),
      entry('Trelhy', { class: 4, spec: 'Assassination' }),
      entry('Cicámqu', { class: 11, spec: 'Feral' }),
      entry('Zerololq', { class: 6, spec: 'Unholy', traits: 38 }),
      entry('Spuky', { class: 7, spec: 'Restoration' })
    ]));

    expect(teamGroups(team).map(group => [group.label, group.players.map(player => player.name)])).toEqual([
      ['Healers', ['Lakmir', 'Lythus', 'Spuky']],
      ['Ranged', ['Sósa', 'Xyhop']],
      ['Melee', ['Zerololq', 'Rcodio', 'Cicámqu', 'Trelhy', 'Zowy']]
    ]);
  });

  it('leaves out a group with nobody in it', () => {
    const team = rosterPlayers(roster([entry('Zowy'), entry('Lythus', { class: 2, spec: 'Holy' })]));

    expect(teamGroups(team).map(group => group.id)).toEqual(['healers', 'melee']);
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
