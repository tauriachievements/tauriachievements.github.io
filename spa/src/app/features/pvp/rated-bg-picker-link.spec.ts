import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  BenchHistory,
  DEFAULT_COMPOSITION,
  Match,
  NO_BENCH_HISTORY,
  RATED_BG_ROSTER_FILE,
  RatedBgRosterEntry,
  RatedBgRosterFile,
  RosterPlayer,
  TeamComposition,
  linkedMatch,
  parseLeaders,
  playMatch,
  rosterPlayers,
  withLeader
} from './rated-bg-picker';
import { OpenedLink, PickerState, linkNote, openLegacyLink, openPickerLink, pickerLink, playerCode } from './rated-bg-picker-link';
import { entry, roster, seeded, ticked, tickedEntries } from './rated-bg-picker.fixture';

const keysOf = (players: readonly RosterPlayer[]) => new Set(players.map(player => player.key));

function fresh(composition: TeamComposition = DEFAULT_COMPOSITION): PickerState {
  return { picked: new Set(), composition, flagCarriers: new Set(), match: undefined, history: NO_BENCH_HISTORY };
}

function shuffled(
  picked: readonly RosterPlayer[],
  times: number,
  flagCarriers: ReadonlySet<string> = new Set(),
  history: BenchHistory = NO_BENCH_HISTORY
): { match: Match; history: BenchHistory } {
  let result = playMatch(picked, DEFAULT_COMPOSITION, history, flagCarriers, seeded(1));
  for (let seed = 2; seed <= times; seed++) {
    result = playMatch(picked, DEFAULT_COMPOSITION, result.history, flagCarriers, seeded(seed));
  }
  return result;
}

const opened = (state: PickerState, gone = 0, teamsDropped = false): OpenedLink => ({ state, gone, teamsDropped });

const ALTS: RatedBgRosterEntry[] = ['Alt1', 'Alt2'].map(name => entry(name, { class: 8, spec: 'Fire', person: 'Alt1-Evermoon' }));

describe('playerCode', () => {
  it('gives each player the same 4-character code every time, so old links keep opening', () => {
    expect(playerCode('Majä-Evermoon')).toBe('bApw');
    expect(playerCode('Llýnch-Evermoon-Holy')).toBe('zK4k');
    expect(playerCode('Keilalt-Tauri-Havoc')).toBe('GDpV');
    expect(playerCode('Keilalt-Tauri-Vengeance')).toBe('aRSY');
  });

  it('uses only characters an address keeps as they are', () => {
    for (const player of ticked(5, 5, 5)) {
      const code = playerCode(player.key);

      expect(code).toMatch(/^[A-Za-z0-9_-]{4}$/);
      expect(encodeURIComponent(code)).toBe(code);
    }
  });

  it('gives every row on the real player list its own code', () => {
    const file = JSON.parse(readFileSync(resolve('src', RATED_BG_ROSTER_FILE), 'utf8')) as RatedBgRosterFile;
    const codes = rosterPlayers(file).map(player => playerCode(player.key));

    expect(codes.length).toBeGreaterThan(0);
    expect(new Set(codes).size).toBe(codes.length);
  });
});

describe('pickerLink', () => {
  it('leaves the address empty on a fresh page', () => {
    expect(pickerLink(fresh(), ticked(6, 6, 8))).toBeNull();
  });

  it('writes the version, the mode and the Each team numbers, melee first, before anything is ticked', () => {
    expect(pickerLink(fresh({ melee: 5, ranged: 3, healers: 2 }), ticked(6, 6, 8))).toBe('1P532');
  });

  it('takes 5 characters per ticked player, and 2 more for each person who has sat out', () => {
    const players = ticked(9, 9, 12);
    const { match, history } = shuffled(players, 1);

    expect(match.bench).toHaveLength(10);
    expect(pickerLink({ ...fresh(), picked: keysOf(players), match, history }, players)).toHaveLength(5 + 30 * 5 + 10 * 2);
  });
});

describe('openPickerLink', () => {
  it('opens the ticks, flag carriers, Each team numbers and bench turns while players are being changed', () => {
    const players = ticked(9, 9, 13);
    const firstPicked = players.slice(0, 30);
    const { history } = shuffled(firstPicked, 2);
    const satOut = firstPicked.find(player => history.sitOuts.has(player.person)) as RosterPlayer;
    const picked = keysOf([...firstPicked.filter(player => player !== satOut), players[30]]);
    const state: PickerState = {
      picked,
      composition: { melee: 5, ranged: 2, healers: 3 },
      flagCarriers: new Set([...picked].slice(0, 2)),
      match: undefined,
      history
    };

    const link = pickerLink(state, players) as string;

    expect(link.startsWith('1P523')).toBe(true);
    expect(openPickerLink(link, players)).toEqual(opened(state));
  });

  it('opens the teams, leaders, bench, flag carriers and back-from-bench marks after a shuffle', () => {
    const players = rosterPlayers(roster([...tickedEntries(9, 9, 12), ...ALTS]));
    const first = shuffled(players.filter(player => player.name !== 'Alt2'), 1);
    const leftAfterOne = first.match.bench[0];
    const picked = players.filter(player => player !== leftAfterOne);
    const flagCarriers = keysOf(picked.slice(3, 6));
    const { match, history } = shuffled(picked, 2, flagCarriers, first.history);
    const state: PickerState = {
      picked: keysOf(picked),
      composition: DEFAULT_COMPOSITION,
      flagCarriers,
      match: withLeader(match, match.teams[1][7].key),
      history
    };

    expect(match.bench.length).toBeGreaterThan(0);
    expect(match.backFromBench.size).toBeGreaterThan(0);
    expect(history.sitOuts.has(leftAfterOne.person)).toBe(true);
    const link = pickerLink(state, players) as string;

    expect(link.startsWith('1T433')).toBe(true);
    expect(openPickerLink(link, players)).toEqual(opened(state));
  });

  it('opens a link from a list that has since dropped a benched player, without them', () => {
    const players = ticked(9, 9, 12);
    const { match, history } = shuffled(players, 1);
    const gone = match.bench[0];
    const state: PickerState = { ...fresh(), picked: keysOf(players), match, history };
    const shorterList = players.filter(player => player !== gone);

    const link = openPickerLink(pickerLink(state, players) as string, shorterList);

    expect(link?.gone).toBe(1);
    expect(link?.teamsDropped).toBe(false);
    expect(link?.state.match?.teams).toEqual(match.teams);
    expect(link?.state.match?.bench).toEqual(match.bench.filter(player => player !== gone));
    expect(link?.state.picked).toEqual(keysOf(shorterList));
  });

  it('keeps the ticks but not the teams when the list has since dropped a player who was playing', () => {
    const players = ticked(9, 9, 12);
    const flagCarriers = keysOf(players.slice(0, 2));
    const { match, history } = shuffled(players, 1, flagCarriers);
    const gone = match.teams[0][4];
    const state: PickerState = { ...fresh(), picked: keysOf(players), flagCarriers, match, history };
    const shorterList = players.filter(player => player !== gone);

    const link = openPickerLink(pickerLink(state, players) as string, shorterList);

    expect(link?.gone).toBe(1);
    expect(link?.teamsDropped).toBe(true);
    expect(link?.state.match).toBeUndefined();
    expect(link?.state.picked).toEqual(keysOf(shorterList));
    expect(link?.state.flagCarriers).toEqual(new Set([...flagCarriers].filter(key => key !== gone.key)));
    expect(link?.state.history.lastMatch).toEqual(new Set([...history.lastMatch].filter(person => person !== gone.person)));
    expect(link?.state.history.sitOuts).toEqual(history.sitOuts);
  });

  it('counts a code two players on the list share as gone, rather than open the wrong player', () => {
    const players = rosterPlayers(roster([...tickedEntries(6, 6, 8), entry('Clash575'), entry('Clash952')]));
    const clashing = players.find(player => player.name === 'Clash575') as RosterPlayer;
    const healer = players.find(player => player.name === 'Healer0') as RosterPlayer;

    expect(playerCode('Clash575-Evermoon')).toBe(playerCode('Clash952-Evermoon'));
    const link = openPickerLink(pickerLink({ ...fresh(), picked: keysOf([clashing, healer]) }, players) as string, players);

    expect(link?.gone).toBe(1);
    expect(link?.state.picked).toEqual(keysOf([healer]));
  });

  it('reads nothing from a link it cannot read', () => {
    const players = ticked(6, 6, 8);

    for (const value of ['', '1', '2P433', '1X433', '1P633', '1P43', '1P433lPpN', '1P433lPp*B', '1P433lPpNh', '1P433lPpNhB']) {
      expect(openPickerLink(value, players)).toBeUndefined();
    }
  });
});

describe('openLegacyLink', () => {
  it("opens an old link's teams, its leaders and, when both teams have the same, its Each team numbers", () => {
    const players = ticked(6, 6, 8);
    const { match } = shuffled(players, 1);
    const [first, second] = match.teams.map(team => team.map(player => player.key).join(','));
    const leaders = `${match.teams[1][3].key},${match.teams[0][5].key}`;
    const expected = linkedMatch(match.teams, parseLeaders(leaders, match.teams));

    expect(openLegacyLink(first, second, leaders, players)).toEqual(opened({
      picked: keysOf(players),
      composition: DEFAULT_COMPOSITION,
      flagCarriers: new Set(),
      match: expected.match,
      history: expected.history
    }));
  });

  it('ticks the players an old link still matches when its teams no longer do', () => {
    const players = ticked(6, 6, 8);
    const { match } = shuffled(players, 1);
    const [first, second] = match.teams.map(team => team.map(player => player.key));
    const kept = players.filter(player => player.key !== first[0]);

    expect(openLegacyLink(['Gone-Evermoon', ...first.slice(1)].join(','), second.join(','), null, players)).toEqual(opened({
      picked: keysOf(kept),
      composition: DEFAULT_COMPOSITION,
      flagCarriers: new Set(),
      match: undefined,
      history: { ...NO_BENCH_HISTORY, lastMatch: new Set(kept.map(player => player.person)) }
    }, 1, true));
    expect(openLegacyLink([second[0], ...first.slice(1)].join(','), second.join(','), null, players)).toEqual(opened({
      picked: keysOf(kept),
      composition: DEFAULT_COMPOSITION,
      flagCarriers: new Set(),
      match: undefined,
      history: { ...NO_BENCH_HISTORY, lastMatch: new Set(kept.map(player => player.person)) }
    }, 0, true));
  });
});

describe('linkNote', () => {
  it('says nothing when the whole link opened', () => {
    expect(linkNote(opened(fresh()))).toBeUndefined();
  });

  it("says so when a link can't be read", () => {
    expect(linkNote(undefined)).toBe("That link can't be read. Tick today's players and shuffle again.");
  });

  it('counts the players the list no longer has', () => {
    expect(linkNote(opened(fresh(), 1))).toBe('1 player in that link is no longer on the player list and is left out.');
    expect(linkNote(opened(fresh(), 2))).toBe('2 players in that link are no longer on the player list and are left out.');
  });

  it("says when the link's teams didn't open", () => {
    expect(linkNote(opened(fresh(), 1, true)))
      .toBe("1 player in that link is no longer on the player list, so its teams didn't open. Shuffle for new teams.");
    expect(linkNote(opened(fresh(), 0, true)))
      .toBe('The teams in that link no longer match the player list. Shuffle for new teams.');
  });
});
