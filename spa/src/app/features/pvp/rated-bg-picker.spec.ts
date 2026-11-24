import { describe, expect, it } from 'vitest';
import {
  PICK_COUNT,
  RatedBgRosterEntry,
  RatedBgRosterFile,
  RosterPlayer,
  TEAM_SIZE,
  parseTeams,
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

describe('rosterPlayers', () => {
  it('lists every player by name, ignoring case and accents', () => {
    const players = rosterPlayers(roster([entry('Bob'), entry('alice'), entry('Ádám')]));

    expect(players.map(player => player.name)).toEqual(['Ádám', 'alice', 'Bob']);
  });

  it('keys each player by name and realm', () => {
    expect(rosterPlayers(roster([entry('Morron', { realm: 'Tauri' })]))[0].key).toBe('Morron-Tauri');
  });

  it("gives each player the role of its spec", () => {
    const players = rosterPlayers(roster([
      entry('Lythus', { class: 2, spec: 'Holy' }),
      entry('Xyhop', { class: 5, spec: 'Shadow' }),
      entry('Zowy', { class: 1, spec: 'Protection' }),
      entry('Nospec', { spec: undefined })
    ]));

    expect(players.map(player => [player.name, player.role])).toEqual([
      ['Lythus', 'healer'],
      ['Nospec', undefined],
      ['Xyhop', 'dps'],
      ['Zowy', 'tank']
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
