import { describe, expect, it } from 'vitest';
import {
  BenchHistory,
  COMPOSITION_CHOICES,
  DEFAULT_COMPOSITION,
  MATCH_SIZE,
  MatchResult,
  NO_BENCH_HISTORY,
  RatedBgRosterEntry,
  RatedBgRosterFile,
  RosterGroup,
  RosterPlayer,
  TEAM_SIZE,
  TeamComposition,
  Teams,
  benchSize,
  canShuffle,
  compositionOf,
  linkedMatch,
  parseTeams,
  rosterGroups,
  playMatch,
  rosterPlayers,
  shuffleTeams,
  shuffleWarning,
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
  return rosterPlayers(roster(Array.from({ length: MATCH_SIZE }, (_, index) =>
    index < healers
      ? entry(`Healer${index}`, { class: 5, spec: 'Holy' })
      : entry(`Player${index}`)
  )));
}

const healerCount = (team: readonly RosterPlayer[]) => team.filter(player => player.role === 'healer').length;

function tickedEntries(healers: number, ranged: number, melee: number): RatedBgRosterEntry[] {
  return [
    ...Array.from({ length: healers }, (_, index) => entry(`Healer${index}`, { class: 5, spec: 'Holy' })),
    ...Array.from({ length: ranged }, (_, index) => entry(`Ranged${index}`, { class: 8, spec: 'Fire' })),
    ...Array.from({ length: melee }, (_, index) => entry(`Melee${index}`))
  ];
}

function ticked(healers: number, ranged: number, melee: number): RosterPlayer[] {
  return rosterPlayers(roster(tickedEntries(healers, ranged, melee)));
}

const ALT_PERSON = 'Alt1-Evermoon';

const FIRE_ALTS: RatedBgRosterEntry[] = ['Alt1', 'Alt2'].map(name => entry(name, { class: 8, spec: 'Fire', person: ALT_PERSON }));

const TICHO_AND_ZBAFROMTEMU: RatedBgRosterEntry[] = [
  entry('Ticho', { realm: 'Tauri', class: 4, spec: 'Subtlety', person: 'Ticho-Tauri' }),
  entry('Zbafromtemu', { class: 5, spec: 'Holy', person: 'Ticho-Tauri' })
];

function withAlts(healers: number, ranged: number, melee: number, alts: readonly RatedBgRosterEntry[]): RosterPlayer[] {
  return rosterPlayers(roster([...tickedEntries(healers, ranged, melee), ...alts]));
}

const altsIn = (players: readonly RosterPlayer[]) =>
  players.filter(player => player.person === ALT_PERSON).map(player => player.name).sort();

const groupCounts = (players: readonly RosterPlayer[]) =>
  Object.fromEntries(teamGroups(players).map(group => [group.id, group.players.length]));

const keysOf = (players: readonly RosterPlayer[]) => players.map(player => player.key).sort();

const namesOf = (players: readonly RosterPlayer[]) => players.map(player => player.name).sort();

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

const SCREENSHOT_HEALERS: RatedBgRosterEntry[] = [
  entry('Lakmir', { class: 10, spec: 'Mistweaver' }),
  entry('Widuxgodx', { class: 10, spec: 'Mistweaver' }),
  entry('Shake', { class: 2, spec: 'Holy' }),
  entry('Lythus', { class: 2, spec: 'Holy' }),
  entry('Holyrose', { class: 2, spec: 'Holy' }),
  entry('Spuky', { class: 7, spec: 'Restoration' }),
  entry('Yodadru', { class: 11, spec: 'Restoration' }),
  entry('Wxz', { class: 11, spec: 'Restoration' }),
  entry('Quro', { class: 5, spec: 'Holy' }),
  entry('Llýnch', { class: 5, spec: 'Holy' })
];

const SCREENSHOT_HUNTERS: RatedBgRosterEntry[] = ['Bomboclats', 'Maviellian', 'Nimphel', 'Lyantha']
  .map(name => entry(name, { class: 3, spec: 'Marksmanship' }));

const SCREENSHOT_OTHER_RANGED: RatedBgRosterEntry[] = [
  entry('Sósa', { class: 8, spec: 'Frost' }),
  entry('Doelen', { class: 5, spec: 'Shadow' }),
  entry('Xyhop', { class: 5, spec: 'Shadow' }),
  entry('Dnx', { class: 9, spec: 'Affliction' })
];

const SCREENSHOT_MELEE: RatedBgRosterEntry[] = [
  entry('Majä', { class: 10, spec: 'Windwalker' }),
  entry('Zsozé', { class: 10, spec: 'Brewmaster' }),
  entry('Solaureus', { class: 2, spec: 'Retribution' }),
  entry('Trelhy', { class: 4, spec: 'Assassination' }),
  entry('Ticho', { class: 4, spec: 'Subtlety' }),
  entry('Morron', { class: 1, spec: 'Arms' }),
  entry('Zowy', { class: 1, spec: 'Fury' }),
  entry('Rcodio', { class: 6, spec: 'Unholy' }),
  entry('Allisa', { class: 6, spec: 'Unholy' }),
  entry('Dkügli', { class: 6, spec: 'Unholy' }),
  entry('Zerololq', { class: 6, spec: 'Frost' }),
  entry('Cicámqu', { class: 11, spec: 'Feral' })
];

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

  it('keys a character listed for more than one spec by name, realm and spec, one row per spec', () => {
    const players = rosterPlayers(roster([
      entry('Keilalt', { realm: 'Tauri', class: 12, spec: 'Vengeance' }),
      entry('Morron', { realm: 'Tauri' }),
      entry('Keilalt', { realm: 'Tauri', class: 12, spec: 'Havoc' })
    ]));

    expect(players.map(player => [player.key, player.character, player.role])).toEqual([
      ['Keilalt-Tauri-Vengeance', 'Keilalt-Tauri', 'tank'],
      ['Keilalt-Tauri-Havoc', 'Keilalt-Tauri', 'dps'],
      ['Morron-Tauri', 'Morron-Tauri', 'dps']
    ]);
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

  it('gives each player the person the file links them to, else their own character', () => {
    const players = rosterPlayers(roster([
      entry('Zerololq', { class: 8, spec: 'Frost', person: 'Zerololq-Evermoon' }),
      entry('Xyhop', { class: 5, spec: 'Shadow' }),
      entry('Zerolul', { class: 5, spec: 'Shadow', person: 'Zerololq-Evermoon' })
    ]));

    expect(players.map(player => [player.key, player.person])).toEqual([
      ['Xyhop-Evermoon', 'Xyhop-Evermoon'],
      ['Zerololq-Evermoon', 'Zerololq-Evermoon'],
      ['Zerolul-Evermoon', 'Zerololq-Evermoon']
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

describe('COMPOSITION_CHOICES', () => {
  it('offers 1 to 4 healers and 1 to 5 ranged and melee per team, 2, 4 and 4 at first', () => {
    expect(COMPOSITION_CHOICES.map(choice => [choice.id, choice.label, choice.counts])).toEqual([
      ['healers', 'Healers', [1, 2, 3, 4]],
      ['ranged', 'Ranged', [1, 2, 3, 4, 5]],
      ['melee', 'Melee', [1, 2, 3, 4, 5]]
    ]);
    expect(DEFAULT_COMPOSITION).toEqual({ healers: 2, ranged: 4, melee: 4 });
  });
});

describe('shuffleWarning and canShuffle', () => {
  it(`needs the healers, ranged and melee per team to add up to a team of ${TEAM_SIZE}`, () => {
    const picked = ticked(6, 10, 10);

    expect(shuffleWarning(picked, { healers: 3, ranged: 4, melee: 4 })).toBe('11 per team, a team is 10');
    expect(shuffleWarning(picked, { healers: 2, ranged: 3, melee: 4 })).toBe('9 per team, a team is 10');
    expect(canShuffle(picked, { healers: 3, ranged: 4, melee: 4 })).toBe(false);
    expect(shuffleWarning(picked, { healers: 3, ranged: 3, melee: 4 })).toBeUndefined();
    expect(canShuffle(picked, { healers: 3, ranged: 3, melee: 4 })).toBe(true);
  });

  it('names each group with too few ticked for both teams', () => {
    expect(shuffleWarning(ticked(3, 8, 8), DEFAULT_COMPOSITION)).toBe('tick 1 more healer');
    expect(shuffleWarning(ticked(2, 7, 8), DEFAULT_COMPOSITION)).toBe('tick 2 more healers and 1 more ranged');
    expect(shuffleWarning(ticked(3, 6, 5), DEFAULT_COMPOSITION)).toBe('tick 1 more healer, 2 more ranged and 3 more melee');
    expect([ticked(3, 8, 8), ticked(2, 7, 8), ticked(4, 8, 7)].map(picked => canShuffle(picked, DEFAULT_COMPOSITION)))
      .toEqual([false, false, false]);
  });

  it(`shuffles any number of ticked players from ${MATCH_SIZE} up once every group has enough`, () => {
    expect(canShuffle(ticked(4, 8, 8), DEFAULT_COMPOSITION)).toBe(true);
    expect(canShuffle(ticked(5, 10, 11), DEFAULT_COMPOSITION)).toBe(true);
    expect(shuffleWarning(ticked(5, 10, 11), DEFAULT_COMPOSITION)).toBeUndefined();
  });

  it('counts tanks and characters without a known spec as melee', () => {
    const picked = rosterPlayers(roster([
      ...ticked(4, 8, 6).map(player => entry(player.name, { class: player.classId, spec: player.spec })),
      entry('Guardian', { class: 11, spec: 'Guardian' }),
      entry('Nospec', { spec: undefined })
    ]));

    expect(canShuffle(picked, DEFAULT_COMPOSITION)).toBe(true);
  });

  it('counts two ticked characters of one person as one player', () => {
    expect(canShuffle(withAlts(4, 7, 8, FIRE_ALTS), DEFAULT_COMPOSITION)).toBe(true);
    expect(shuffleWarning(withAlts(4, 6, 8, FIRE_ALTS), DEFAULT_COMPOSITION)).toBe('tick 1 more ranged');
    expect(canShuffle(withAlts(4, 6, 8, FIRE_ALTS), DEFAULT_COMPOSITION)).toBe(false);
  });

  it('counts a person in the group their characters fill best', () => {
    expect(canShuffle(withAlts(3, 8, 8, TICHO_AND_ZBAFROMTEMU), DEFAULT_COMPOSITION)).toBe(true);
    expect(canShuffle(withAlts(4, 8, 7, TICHO_AND_ZBAFROMTEMU), DEFAULT_COMPOSITION)).toBe(true);
    expect(canShuffle(withAlts(3, 8, 7, TICHO_AND_ZBAFROMTEMU), DEFAULT_COMPOSITION)).toBe(false);
    expect(shuffleWarning(withAlts(2, 8, 8, TICHO_AND_ZBAFROMTEMU), DEFAULT_COMPOSITION)).toBe('tick 1 more healer');
  });

  it('asks for no players while nobody is ticked, but still checks the team size', () => {
    expect(shuffleWarning([], DEFAULT_COMPOSITION)).toBeUndefined();
    expect(canShuffle([], DEFAULT_COMPOSITION)).toBe(false);
    expect(shuffleWarning([], { healers: 3, ranged: 4, melee: 4 })).toBe('11 per team, a team is 10');
  });
});

describe('benchSize', () => {
  it(`counts who sits out beyond the ${MATCH_SIZE} who play, two characters of one person as one`, () => {
    expect(benchSize(ticked(5, 10, 11))).toBe(6);
    expect(benchSize(withAlts(4, 8, 8, FIRE_ALTS))).toBe(1);
    expect(benchSize(ticked(4, 8, 7))).toBe(0);
  });
});

describe('togglePick', () => {
  it('ticks both characters of one person', () => {
    const players = rosterPlayers(roster(FIRE_ALTS));

    expect([...togglePick(togglePick(new Set(), players[0], players), players[1], players)].sort())
      .toEqual(['Alt1-Evermoon', 'Alt2-Evermoon']);
  });


  it('ticks a player and unticks a ticked one', () => {
    const players = rosterPlayers(roster([entry('Xyhop')]));
    const ticked = togglePick(new Set(), players[0], players);

    expect([...ticked]).toEqual(['Xyhop-Evermoon']);
    expect([...togglePick(ticked, players[0], players)]).toEqual([]);
  });

  it('ticks any number of players', () => {
    const players = rosterPlayers(roster(Array.from({ length: 31 }, (_, index) => entry(`Player${index}`))));
    const many = new Set(players.slice(0, 30).map(player => player.key));

    expect(togglePick(many, players[30], players).size).toBe(31);
    expect(togglePick(many, players[0], players).size).toBe(29);
  });

  it('ticks one spec of a character at a time: ticking another spec unticks the first', () => {
    const players = rosterPlayers(roster([
      entry('Keilalt', { realm: 'Tauri', class: 12, spec: 'Vengeance' }),
      entry('Keilalt', { realm: 'Tauri', class: 12, spec: 'Havoc' }),
      entry('Xyhop', { class: 5, spec: 'Shadow' })
    ]));
    const [vengeance, havoc, xyhop] = players;
    const switched = togglePick(togglePick(togglePick(new Set(), vengeance, players), xyhop, players), havoc, players);

    expect([...switched].sort()).toEqual(['Keilalt-Tauri-Havoc', 'Xyhop-Evermoon']);
    expect([...togglePick(switched, havoc, players)]).toEqual(['Xyhop-Evermoon']);
  });
});

describe('toggleFlagCarrier', () => {
  it('marks a player and unmarks a marked one', () => {
    const marked = toggleFlagCarrier(new Set(), 'Cicámqu-Evermoon');

    expect([...marked]).toEqual(['Cicámqu-Evermoon']);
    expect([...toggleFlagCarrier(marked, 'Cicámqu-Evermoon')]).toEqual([]);
  });

  it('marks any number of players', () => {
    const keys = ['Cicámqu-Evermoon', 'Zowy-Evermoon', 'Heaven-Tauri', 'Majä-Evermoon', 'Trelhy-Evermoon'];
    const marked = keys.reduce<ReadonlySet<string>>((flagCarriers, key) => toggleFlagCarrier(flagCarriers, key), new Set());

    expect([...marked]).toEqual(keys);
    expect([...toggleFlagCarrier(marked, 'Zowy-Evermoon')]).toEqual(keys.filter(key => key !== 'Zowy-Evermoon'));
  });
});

describe('tickedFlagCarriers', () => {
  it('drops the mark of a player who is no longer ticked', () => {
    const marked = new Set(['Cicámqu-Evermoon', 'Zowy-Evermoon']);

    expect([...tickedFlagCarriers(marked, new Set(['Zowy-Evermoon', 'Heaven-Tauri']))]).toEqual(['Zowy-Evermoon']);
  });
});

describe('shuffleTeams', () => {
  it(`makes two teams of ${TEAM_SIZE} out of ${MATCH_SIZE} players`, () => {
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

  it('splits three or more flag carriers as evenly as it can, every split as even as without them', () => {
    const players = groupOfTwenty();
    const pools = [
      ['Cicámqu', 'Trelhy', 'Zowy'],
      ['Cicámqu', 'Trelhy', 'Zowy', 'Morron'],
      ['Allisa', 'Dkügli', 'Rcodio', 'Zerololq', 'Majä'],
      ['Llýnch', 'Spuky', 'Cicámqu', 'Majä', 'Zsozé', 'Dnx']
    ];

    for (const pool of pools) {
      const flagCarriers = new Set(pool.map(name => `${name}-Evermoon`));
      for (let seed = 0; seed < 50; seed++) {
        const teams = shuffleTeams(players, seeded(seed), flagCarriers);
        const [first, second] = teams.map(team => team.filter(player => flagCarriers.has(player.key)).length);

        expect({ pool, seed, gap: Math.abs(first - second) <= 1 }).toEqual({ pool, seed, gap: true });
        expectEvenSplit(players, teams);
      }
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

describe('playMatch', () => {
  const noFlagCarriers: ReadonlySet<string> = new Set();
  const play = (picked: readonly RosterPlayer[], history = NO_BENCH_HISTORY, seed = 1, flagCarriers = noFlagCarriers) =>
    playMatch(picked, DEFAULT_COMPOSITION, history, flagCarriers, seeded(seed));

  it('fills each team with the healers, ranged and melee the dropdowns ask for, and benches the rest', () => {
    const picked = ticked(5, 10, 11);

    for (let seed = 0; seed < 30; seed++) {
      const { match } = play(picked, NO_BENCH_HISTORY, seed);

      expect(match.teams.map(groupCounts)).toEqual([
        { healers: 2, ranged: 4, melee: 4 },
        { healers: 2, ranged: 4, melee: 4 }
      ]);
      expect(groupCounts(match.bench)).toEqual({ healers: 1, ranged: 2, melee: 3 });
      expect(keysOf([...match.teams[0], ...match.teams[1], ...match.bench])).toEqual(keysOf(picked));
    }
  });

  it('follows any composition that adds up to a team', () => {
    const { match } = playMatch(ticked(6, 8, 8), { healers: 3, ranged: 3, melee: 4 }, NO_BENCH_HISTORY, noFlagCarriers, seeded(4));

    expect(match.teams.map(groupCounts)).toEqual([
      { healers: 3, ranged: 3, melee: 4 },
      { healers: 3, ranged: 3, melee: 4 }
    ]);
    expect(groupCounts(match.bench)).toEqual({ ranged: 2 });
  });

  it('lists the bench as its healers, ranged and melee, each by class as in the list', () => {
    const { match } = play(ticked(6, 10, 11));

    expect(match.bench.map(player => player.name))
      .toEqual(teamGroups(match.bench).flatMap(group => group.players.map(player => player.name)));
  });

  it('benches nobody when the ticked players fill both teams exactly', () => {
    const { match } = play(ticked(4, 8, 8));

    expect(match.bench).toEqual([]);
    expect(match.teams.map(team => team.length)).toEqual([TEAM_SIZE, TEAM_SIZE]);
  });

  it('leaves to chance who sits out the first match', () => {
    const benches = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      benches.add(namesOf(play(ticked(4, 8, 11), NO_BENCH_HISTORY, seed).match.bench).join());
    }

    expect(benches.size).toBeGreaterThan(1);
  });

  it('never benches one or two flag carriers, and puts two on different teams', () => {
    const picked = ticked(5, 10, 11);

    for (const pool of [['Melee0'], ['Healer0', 'Melee0'], ['Melee0', 'Melee1']]) {
      const flagCarriers = new Set(pool.map(name => `${name}-Evermoon`));
      for (let seed = 0; seed < 30; seed++) {
        const { match } = play(picked, NO_BENCH_HISTORY, seed, flagCarriers);
        const carriersIn = match.teams.map(team => team.filter(player => flagCarriers.has(player.key)).length);

        expect(match.bench.filter(player => flagCarriers.has(player.key))).toEqual([]);
        expect(carriersIn.sort()).toEqual(pool.length === 1 ? [0, 1] : [1, 1]);
      }
    }
  });

  it("plays the last match's bench first, marked as back from the bench, and benches players who played it", () => {
    const picked = ticked(5, 10, 11);

    for (let seed = 0; seed < 20; seed++) {
      const first = play(picked, NO_BENCH_HISTORY, seed);
      const second = play(picked, first.history, seed + 100);
      const firstBench = keysOf(first.match.bench);

      expect(first.match.backFromBench.size).toBe(0);
      expect([...second.match.backFromBench].sort()).toEqual(firstBench);
      expect(second.match.bench.filter(player => firstBench.includes(player.key))).toEqual([]);
    }
  });

  function playMatches(
    picked: readonly RosterPlayer[],
    composition: TeamComposition,
    seed: number,
    count: number,
    history = NO_BENCH_HISTORY,
    flagCarriers = noFlagCarriers
  ): MatchResult[] {
    const results: MatchResult[] = [];
    for (let match = 0; match < count; match++) {
      const result = playMatch(picked, composition, results.at(-1)?.history ?? history, flagCarriers, seeded(seed * 100 + match));
      results.push(result);
    }
    return results;
  }

  const carriersPlaying = (match: MatchResult['match'], flagCarriers: ReadonlySet<string>) =>
    match.teams.map(team => team.filter(player => flagCarriers.has(player.key)).length);

  it('benches three or more flag carriers in turn like everyone else, keeping two playing, one on each team', () => {
    const picked = ticked(4, 8, 11);

    for (const pool of [['Melee0', 'Melee1', 'Melee2'], ['Melee0', 'Melee1', 'Melee2', 'Melee3', 'Melee4']]) {
      const flagCarriers = new Set(pool.map(name => `${name}-Evermoon`));
      for (let seed = 0; seed < 10; seed++) {
        const results = playMatches(picked, DEFAULT_COMPOSITION, seed, 11, NO_BENCH_HISTORY, flagCarriers);
        const sitOuts = (key: string) => results.filter(({ match }) => match.bench.some(player => player.key === key)).length;

        for (const { match } of results) {
          const [first, second] = carriersPlaying(match, flagCarriers);
          expect(first + second).toBeGreaterThanOrEqual(2);
          expect(Math.abs(first - second)).toBeLessThanOrEqual(1);
        }
        for (const key of flagCarriers) {
          expect({ key, sitOuts: sitOuts(key) >= 2 }).toEqual({ key, sitOuts: true });
        }
        results.slice(1).forEach(({ match }, index) => {
          const lastBench = keysOf(results[index].match.bench);
          expect(match.bench.filter(player => lastBench.includes(player.key))).toEqual([]);
        });
      }
    }
  });

  it('keeps two flag carriers playing across the healers, ranged and melee together', () => {
    const picked = ticked(5, 9, 11);
    const flagCarriers = new Set(['Healer0-Evermoon', 'Ranged0-Evermoon', 'Melee0-Evermoon']);

    for (let seed = 0; seed < 20; seed++) {
      const results = playMatches(picked, DEFAULT_COMPOSITION, seed, 12, NO_BENCH_HISTORY, flagCarriers);

      for (const { match } of results) {
        const [first, second] = carriersPlaying(match, flagCarriers);
        expect(first + second).toBeGreaterThanOrEqual(2);
        expect(Math.abs(first - second)).toBeLessThanOrEqual(1);
      }
      expect(results.filter(({ match }) => match.bench.some(player => flagCarriers.has(player.key))).length).toBeGreaterThan(0);
    }
  });

  const groupOf = (player: RosterPlayer) => teamGroups([player])[0].id;

  const classCount = (team: readonly RosterPlayer[], group: string, classId: number) =>
    team.filter(player => groupOf(player) === group && player.classId === classId).length;

  it('never splits the four hunters 2–1: when one hunter sits out, a second does too', () => {
    const picked = rosterPlayers(roster([...SCREENSHOT_HEALERS, ...SCREENSHOT_HUNTERS, ...SCREENSHOT_OTHER_RANGED, ...SCREENSHOT_MELEE]));
    const classesWithSecondPlayer = (['ranged', 'melee'] as const).flatMap(group => {
      const classIds = picked.filter(player => groupOf(player) === group).map(player => player.classId);
      return [...new Set(classIds.filter((classId, index) => classIds.indexOf(classId) !== index))]
        .map(classId => ({ group, classId }));
    });

    for (let seed = 0; seed < 20; seed++) {
      for (const { match } of playMatches(picked, { healers: 3, ranged: 3, melee: 4 }, seed, 12)) {
        for (const { group, classId } of classesWithSecondPlayer) {
          const [first, second] = match.teams.map(team => classCount(team, group, classId));
          expect({ group, classId, first }).toEqual({ group, classId, first: second });
        }
      }
    }
  });

  it('plays two of three hunters, one on each team, and benches the third, every match', () => {
    const picked = rosterPlayers(roster([
      ...SCREENSHOT_HEALERS.slice(0, 6),
      ...SCREENSHOT_HUNTERS.slice(0, 3),
      ...SCREENSHOT_OTHER_RANGED,
      ...SCREENSHOT_MELEE.slice(0, 8)
    ]));

    for (let seed = 0; seed < 10; seed++) {
      for (const { match } of playMatches(picked, { healers: 3, ranged: 3, melee: 4 }, seed, 12)) {
        expect(match.teams.map(team => classCount(team, 'ranged', 3))).toEqual([1, 1]);
        expect(match.bench.map(player => player.classId)).toEqual([3]);
      }
    }
  });

  it('splits a class 1–0 rather than 2–1 when the bench cannot keep every class even', () => {
    const picked = rosterPlayers(roster([
      entry('Spuky', { class: 7, spec: 'Restoration' }),
      ...SCREENSHOT_HEALERS.filter(({ class: classId }) => classId === 2 || classId === 5),
      ...SCREENSHOT_HUNTERS, ...SCREENSHOT_OTHER_RANGED,
      ...SCREENSHOT_MELEE.slice(0, 8)
    ]));
    const spukySatOut: BenchHistory = {
      sitOuts: new Map([['Spuky-Evermoon', 1]]),
      lastMatch: new Set(picked.filter(player => player.name !== 'Spuky').map(player => player.key)),
      sitOutStreaks: new Map([['Spuky-Evermoon', 1]])
    };

    for (let seed = 0; seed < 40; seed++) {
      const { match } = playMatch(picked, DEFAULT_COMPOSITION, spukySatOut, noFlagCarriers, seeded(seed));

      expect(namesOf(match.bench)).not.toContain('Spuky');
      expect(match.teams.map(team => classCount(team, 'healers', 2))).not.toContain(2);
    }
  });

  it('never benches anyone two matches in a row to even a class, so a lone class still plays every other match', () => {
    const picked = rosterPlayers(roster([...SCREENSHOT_HEALERS, ...SCREENSHOT_HUNTERS, ...SCREENSHOT_OTHER_RANGED, ...SCREENSHOT_MELEE]));

    for (let seed = 0; seed < 20; seed++) {
      const results = playMatches(picked, { healers: 3, ranged: 3, melee: 4 }, seed, 12);
      results.slice(1).forEach(({ match }, index) => {
        const lastBench = keysOf(results[index].match.bench);
        expect(match.bench.filter(player => lastBench.includes(player.key))).toEqual([]);
      });
      expect(results.filter(({ match }) => !namesOf(match.bench).includes('Spuky')).length).toBeGreaterThanOrEqual(6);
    }
  });

  it('plays the longest-benched first when most of a group sits out, so a lone class still takes its turns', () => {
    const picked = rosterPlayers(roster([
      ...SCREENSHOT_HEALERS.filter(({ class: classId }) => classId !== 11),
      ...SCREENSHOT_HUNTERS, ...SCREENSHOT_OTHER_RANGED,
      ...SCREENSHOT_MELEE.slice(0, 10)
    ]));

    for (let seed = 0; seed < 20; seed++) {
      const results = playMatches(picked, { healers: 1, ranged: 4, melee: 5 }, seed, 12);
      const plays = (name: string) => results.filter(({ match }) => !namesOf(match.bench).includes(name)).length;

      for (const name of ['Spuky', 'Shake', 'Quro', 'Lakmir']) {
        expect({ name, plays: plays(name) >= 2 }).toEqual({ name, plays: true });
      }
    }
  });

  it('rotates the bench of a one-class group, so nobody sits out twice before everyone in it has once', () => {
    const picked = ticked(4, 8, 11);
    const melee = picked.filter(player => player.name.startsWith('Melee'));

    for (let seed = 0; seed < 10; seed++) {
      const sitOuts = new Map(picked.map(player => [player.key, 0]));
      let history = NO_BENCH_HISTORY;
      let lastBench: string[] = [];
      for (let match = 0; match < 8; match++) {
        const result = play(picked, history, seed * 10 + match);
        const bench = keysOf(result.match.bench);
        bench.forEach(key => sitOuts.set(key, (sitOuts.get(key) ?? 0) + 1));
        const meleeSitOuts = melee.map(player => sitOuts.get(player.key) ?? 0);

        expect(bench).toHaveLength(3);
        expect(bench.filter(key => lastBench.includes(key))).toEqual([]);
        expect(Math.max(...meleeSitOuts) - Math.min(...meleeSitOuts)).toBeLessThanOrEqual(1);
        history = result.history;
        lastBench = bench;
      }
    }
  });

  it('keeps the turns of a player who switches spec: benched as Havoc, they play the next match as Vengeance', () => {
    const players = rosterPlayers(roster([
      ...Array.from({ length: 4 }, (_, index) => entry(`Healer${index}`, { class: 5, spec: 'Holy' })),
      ...Array.from({ length: 8 }, (_, index) => entry(`Ranged${index}`, { class: 8, spec: 'Fire' })),
      ...Array.from({ length: 8 }, (_, index) => entry(`Melee${index}`)),
      entry('Keilalt', { realm: 'Tauri', class: 12, spec: 'Havoc' }),
      entry('Keilalt', { realm: 'Tauri', class: 12, spec: 'Vengeance' })
    ]));
    const asHavoc = players.filter(player => player.key !== 'Keilalt-Tauri-Vengeance');
    const asVengeance = players.filter(player => player.key !== 'Keilalt-Tauri-Havoc');

    for (let seed = 0; seed < 10; seed++) {
      const first = play(asHavoc, NO_BENCH_HISTORY, seed);
      const second = play(asVengeance, first.history, seed + 100);

      expect(keysOf(first.match.bench)).toEqual(['Keilalt-Tauri-Havoc']);
      expect(keysOf(second.match.bench)).not.toContain('Keilalt-Tauri-Vengeance');
      expect([...second.match.backFromBench]).toEqual(['Keilalt-Tauri-Vengeance']);
    }
  });

  it('never plays two characters of one person, and leaves the other one out of the match', () => {
    const picked = withAlts(4, 8, 8, FIRE_ALTS);

    for (let seed = 0; seed < 30; seed++) {
      const { match } = play(picked, NO_BENCH_HISTORY, seed);

      expect(altsIn([...match.teams[0], ...match.teams[1], ...match.bench])).toHaveLength(1);
      expect(match.teams.map(team => team.length)).toEqual([TEAM_SIZE, TEAM_SIZE]);
      expect(match.bench).toHaveLength(1);
    }
  });

  it('plays either character of a person at random when both fit, and sometimes neither', () => {
    const picked = withAlts(4, 8, 8, FIRE_ALTS);
    const outcomes = new Set<string>();

    for (let seed = 0; seed < 60; seed++) {
      const { match } = play(picked, NO_BENCH_HISTORY, seed);
      outcomes.add(altsIn(match.bench).length ? 'bench' : altsIn([...match.teams[0], ...match.teams[1]]).join());
    }

    expect([...outcomes].sort()).toEqual(['Alt1', 'Alt2', 'bench']);
  });

  it('plays the character the teams need: the healer when the healers are one short', () => {
    const picked = withAlts(3, 8, 8, TICHO_AND_ZBAFROMTEMU);

    for (let seed = 0; seed < 20; seed++) {
      const { match } = play(picked, NO_BENCH_HISTORY, seed);
      const playing = namesOf([...match.teams[0], ...match.teams[1]]);

      expect(playing).toContain('Zbafromtemu');
      expect(playing).not.toContain('Ticho');
      expect(match.bench).toEqual([]);
    }
  });

  it('counts bench turns per person, whichever character sat out or comes back', () => {
    const picked = withAlts(4, 8, 8, FIRE_ALTS);
    const personSatOut: BenchHistory = {
      sitOuts: new Map([[ALT_PERSON, 1]]),
      lastMatch: new Set(picked.filter(player => player.person !== ALT_PERSON).map(player => player.person)),
      sitOutStreaks: new Map([[ALT_PERSON, 1]])
    };
    const backAs = new Set<string>();

    for (let seed = 0; seed < 30; seed++) {
      const { match, history } = play(picked, personSatOut, seed);
      const [playingAs] = altsIn([...match.teams[0], ...match.teams[1]]);

      expect(altsIn(match.bench)).toEqual([]);
      expect([...match.backFromBench]).toEqual([`${playingAs}-Evermoon`]);
      expect(history.lastMatch.has(ALT_PERSON)).toBe(true);
      backAs.add(playingAs);
    }
    expect([...backAs].sort()).toEqual(['Alt1', 'Alt2']);

    const benchedPeople = new Set<string>();
    for (let seed = 0; seed < 60; seed++) {
      const { match, history } = play(picked, NO_BENCH_HISTORY, seed);
      if (altsIn(match.bench).length) {
        benchedPeople.add([...history.sitOutStreaks.keys(), ...history.sitOuts.keys()].join());
      }
    }
    expect([...benchedPeople]).toEqual([`${ALT_PERSON},${ALT_PERSON}`]);
  });

  it('counts two marked characters of one person as one flag carrier', () => {
    const picked = withAlts(4, 8, 8, FIRE_ALTS);
    const flagCarriers = new Set(['Alt1-Evermoon', 'Alt2-Evermoon', 'Melee0-Evermoon']);

    for (let seed = 0; seed < 30; seed++) {
      const { match } = play(picked, NO_BENCH_HISTORY, seed, flagCarriers);

      expect(altsIn(match.bench)).toEqual([]);
      expect(carriersPlaying(match, flagCarriers).sort()).toEqual([1, 1]);
    }
  });

  it("plays a person's marked character when it takes that to keep two flag carriers playing", () => {
    const picked = withAlts(4, 8, 8, FIRE_ALTS);
    const flagCarriers = new Set(['Alt2-Evermoon', 'Melee0-Evermoon']);

    for (let seed = 0; seed < 30; seed++) {
      const { match } = play(picked, NO_BENCH_HISTORY, seed, flagCarriers);

      expect(altsIn([...match.teams[0], ...match.teams[1]])).toEqual(['Alt2']);
    }
  });

  it('plays a player ticked since the last match before those who played it', () => {
    const everyone = ticked(4, 8, 11);
    const first = play(everyone.filter(player => player.name !== 'Melee10'), NO_BENCH_HISTORY, 3);

    for (let seed = 0; seed < 20; seed++) {
      const second = play(everyone, first.history, seed);

      expect(namesOf(second.match.bench)).not.toContain('Melee10');
      expect(second.match.backFromBench.has('Melee10-Evermoon')).toBe(false);
    }
  });
});

describe('linkedMatch', () => {
  it("opens a link's teams with nobody on the bench, and counts its players as having played", () => {
    const linked = ticked(4, 8, 8);
    const teams = shuffleTeams(linked, seeded(5));
    const latecomers = ticked(4, 8, 10).filter(player => ['Melee8', 'Melee9'].includes(player.name));
    const { match, history } = linkedMatch(teams);

    expect(match).toEqual({ teams, bench: [], backFromBench: new Set() });
    for (let seed = 0; seed < 20; seed++) {
      const next = playMatch([...linked, ...latecomers], DEFAULT_COMPOSITION, history, new Set(), seeded(seed));

      expect(next.match.bench).toHaveLength(2);
      expect(namesOf(next.match.bench).filter(name => ['Melee8', 'Melee9'].includes(name))).toEqual([]);
    }
  });
});

describe('compositionOf', () => {
  it('reads the healers, ranged and melee per team when both teams have the same', () => {
    const { match } = playMatch(ticked(6, 6, 8), { healers: 3, ranged: 3, melee: 4 }, NO_BENCH_HISTORY, new Set(), seeded(2));

    expect(compositionOf(match.teams)).toEqual({ healers: 3, ranged: 3, melee: 4 });
  });

  it('has none when the teams differ, or a count is not on its dropdown', () => {
    const split = (players: readonly RosterPlayer[], firstNames: readonly string[]): Teams => [
      players.filter(player => firstNames.includes(player.name)),
      players.filter(player => !firstNames.includes(player.name))
    ];
    const uneven = split(ticked(4, 8, 8), ['Healer0', 'Ranged0', 'Ranged1', 'Ranged2', 'Ranged3', 'Melee0', 'Melee1', 'Melee2', 'Melee3', 'Melee4']);
    const noHealers = split(ticked(0, 10, 10), ['Ranged0', 'Ranged1', 'Ranged2', 'Ranged3', 'Ranged4', 'Melee0', 'Melee1', 'Melee2', 'Melee3', 'Melee4']);
    const sixMelee = split(ticked(2, 6, 12), ['Healer0', 'Ranged0', 'Ranged1', 'Ranged2', 'Melee0', 'Melee1', 'Melee2', 'Melee3', 'Melee4', 'Melee5']);

    expect([uneven, noHealers, sixMelee].map(compositionOf)).toEqual([undefined, undefined, undefined]);
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

describe('parseTeams with two characters of one person', () => {
  it('ignores a link that puts both on the field', () => {
    const players = rosterPlayers(roster([...Array.from({ length: 18 }, (_, index) => entry(`Player${index}`)), ...FIRE_ALTS]));
    const others = players.filter(player => player.person !== ALT_PERSON).map(player => player.key);

    expect(parseTeams([...others.slice(0, 9), 'Alt1-Evermoon'].join(','), [...others.slice(9), 'Alt2-Evermoon'].join(','), players))
      .toBeUndefined();
  });
});

describe('parseTeams with a character listed for two specs', () => {
  it('ignores a link that puts one character on the field twice', () => {
    const players = rosterPlayers(roster([
      ...Array.from({ length: 19 }, (_, index) => entry(`Player${index}`)),
      entry('Keilalt', { realm: 'Tauri', class: 12, spec: 'Vengeance' }),
      entry('Keilalt', { realm: 'Tauri', class: 12, spec: 'Havoc' })
    ]));
    const others = players.filter(player => player.character !== 'Keilalt-Tauri').map(player => player.key);
    const a = [...others.slice(0, 9), 'Keilalt-Tauri-Vengeance'].join(',');

    expect(parseTeams(a, [...others.slice(9, 18), 'Keilalt-Tauri-Havoc'].join(','), players)).toBeUndefined();
    expect(parseTeams(a, others.slice(9, 19).join(','), players)?.[0].map(player => player.key))
      .toContain('Keilalt-Tauri-Vengeance');
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
