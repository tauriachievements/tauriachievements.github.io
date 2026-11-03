import { describe, expect, it } from 'vitest';
import {
  ARENA_TITLES,
  ArenaPlayer,
  ArenaPlayerRow,
  MIN_GAMES_FILTER_OPTIONS,
  TitleCutoff,
  arenaGroupHeadings,
  arenaRatingChanges,
  arenaUrlParams,
  formatTitleShare,
  getArenaLadderFile,
  getArenaSpec,
  getTitle,
  getTitleCutoffs,
  parseArenaBracket,
  parseMinGames,
  sortArenaRows,
  toArenaRows
} from './arena-games';

function player(name: string, wins: number, losses: number, rating: number): ArenaPlayer {
  return {
    guid: 1,
    realm: 'Evermoon',
    name,
    class: 1,
    race: 1,
    gender: 0,
    faction: 0,
    guild: '',
    spec: 71,
    games: wins + losses,
    wins,
    weekGames: 0,
    weekWins: 0,
    rating,
    peakRating: rating,
    weekPeakRating: 0
  };
}

describe('parseArenaBracket', () => {
  it('reads a known bracket and falls back to 2v2', () => {
    expect(parseArenaBracket('3v3')).toBe('3v3');
    expect(parseArenaBracket('2v2')).toBe('2v2');
    expect(parseArenaBracket('5v5')).toBe('2v2');
    expect(parseArenaBracket(null)).toBe('2v2');
  });

  it('names the data file of each bracket', () => {
    expect(getArenaLadderFile('2v2')).toBe('arena-ladder-2v2.json');
    expect(getArenaLadderFile('3v3')).toBe('arena-ladder-3v3.json');
  });
});

describe('parseMinGames', () => {
  it('reads an offered minimum and falls back to 50', () => {
    expect(parseMinGames('30')).toBe(30);
    expect(parseMinGames(45)).toBe(45);
    expect(parseMinGames('20')).toBe(50);
    expect(parseMinGames('forty')).toBe(50);
    expect(parseMinGames(null)).toBe(50);
  });

  it('offers 50 down to 30 games in steps of 5', () => {
    expect(MIN_GAMES_FILTER_OPTIONS.map(option => [option.value, option.label])).toEqual([
      [50, '50+ games'],
      [45, '45+ games'],
      [40, '40+ games'],
      [35, '35+ games'],
      [30, '30+ games']
    ]);
  });
});

describe('arenaUrlParams', () => {
  it('leaves the defaults out of the URL', () => {
    expect(arenaUrlParams('2v2', 50, 1)).toEqual({ bracket: null, games: null, page: null });
    expect(arenaUrlParams('3v3', 35, 4)).toEqual({ bracket: '3v3', games: '35', page: '4' });
  });
});

describe('getArenaSpec', () => {
  it('names the spec of the latest game with its icon', () => {
    const spec = getArenaSpec({ class: 11, spec: 105 });

    expect(spec?.name).toBe('Restoration');
    expect(spec?.icon).toContain('spell_nature_healingtouch');
  });

  it('gives no spec when there is none or it belongs to another class', () => {
    expect(getArenaSpec({ class: 11, spec: 0 })).toBeUndefined();
    expect(getArenaSpec({ class: 4, spec: 105 })).toBeUndefined();
  });
});

describe('toArenaRows', () => {
  it('keeps every ladder player, marks those with the minimum games active and adds losses and win rate', () => {
    const rows = toArenaRows(
      [player('FortyNine', 25, 24, 1500), player('Fifty', 25, 25, 1500), player('Sixty', 45, 15, 1800)],
      50
    );

    expect(rows.map(row => [row.name, row.isActive, row.losses, row.winRate])).toEqual([
      ['FortyNine', false, 24, 25 / 49],
      ['Fifty', true, 25, 0.5],
      ['Sixty', true, 15, 0.75]
    ]);
    expect(rows[0].lastSpec?.name).toBe('Arms');
  });

  it('lets a lower minimum bring more players into the cutoffs', () => {
    const players = [
      player('Top', 40, 20, 2100),
      player('Second', 30, 20, 2000),
      player('ThirtyFive', 20, 15, 1900),
      player('Thirty', 15, 15, 1800)
    ];
    const titles = [{ name: 'Gladiator', slug: 'gladiator', topPerMille: 500 }];

    expect(getTitleCutoffs(toArenaRows(players, 50), titles)[0]).toMatchObject({ places: 1, rating: 2100 });
    expect(getTitleCutoffs(toArenaRows(players, 30), titles)[0]).toMatchObject({ places: 2, rating: 2000 });
  });
});

describe('sortArenaRows', () => {
  const rows = toArenaRows(
    [
      player('Bravo', 40, 20, 2100),
      player('Alpha', 30, 30, 2100),
      player('Delta', 60, 40, 1700),
      player('Charlie', 31, 29, 1900)
    ],
    50
  );
  const names = (key: Parameters<typeof sortArenaRows>[1], direction: 'asc' | 'desc') =>
    sortArenaRows(rows, key, direction).map(row => row.name);

  it('sorts by any column, most first or least first', () => {
    expect(names('games', 'desc')).toEqual(['Delta', 'Alpha', 'Bravo', 'Charlie']);
    expect(names('losses', 'asc')).toEqual(['Bravo', 'Charlie', 'Alpha', 'Delta']);
    expect(names('winRate', 'desc')).toEqual(['Bravo', 'Delta', 'Charlie', 'Alpha']);
  });

  it('breaks ties by most games, then name', () => {
    expect(names('rating', 'desc')).toEqual(['Alpha', 'Bravo', 'Charlie', 'Delta']);
    expect(names('rating', 'asc')).toEqual(['Delta', 'Charlie', 'Alpha', 'Bravo']);
  });

  it('leaves the input order alone', () => {
    sortArenaRows(rows, 'rating', 'asc');

    expect(rows.map(row => row.name)).toEqual(['Bravo', 'Alpha', 'Delta', 'Charlie']);
  });

  it('puts the active players first in every order', () => {
    const mixed = toArenaRows(
      [player('Newcomer', 12, 0, 2400), player('Active', 40, 20, 1800), player('Other', 30, 25, 2000)],
      50
    );
    const order = (key: Parameters<typeof sortArenaRows>[1], direction: 'asc' | 'desc') =>
      sortArenaRows(mixed, key, direction).map(row => row.name);

    expect(order('rating', 'desc')).toEqual(['Other', 'Active', 'Newcomer']);
    expect(order('rating', 'asc')).toEqual(['Active', 'Other', 'Newcomer']);
    expect(order('winRate', 'desc')).toEqual(['Active', 'Other', 'Newcomer']);
    expect(order('games', 'asc')).toEqual(['Other', 'Active', 'Newcomer']);
  });
});

describe('getTitleCutoffs', () => {
  const field = (ratings: number[]) =>
    toArenaRows(ratings.map((rating, index) => player(`P${index}`, 30, 30, rating)), 50);
  const summary = (bracket: '2v2' | '3v3', ratings: number[]) =>
    getTitleCutoffs(field(ratings), ARENA_TITLES[bracket]).map(cutoff => [cutoff.title.name, cutoff.places, cutoff.rating]);

  it('covers the share of the active players each title names', () => {
    const ratings = Array.from({ length: 500 }, (_, index) => 3000 - index);

    expect(summary('2v2', ratings)).toEqual([
      ['Gladiator', 3, 2998],
      ['Duelist', 15, 2986],
      ['Rival', 50, 2951],
      ['Challenger', 175, 2826]
    ]);
  });

  it('rounds every share up, so 3.03 places are 4', () => {
    const ratings = Array.from({ length: 101 }, (_, index) => 3000 - index);

    expect(summary('2v2', ratings)).toEqual([
      ['Gladiator', 1, 3000],
      ['Duelist', 4, 2997],
      ['Rival', 11, 2990],
      ['Challenger', 36, 2965]
    ]);
  });

  it('leaves a title empty while its share rounds to no more than the better titles cover', () => {
    const ratings = Array.from({ length: 15 }, (_, index) => 2000 - index * 10);

    expect(summary('3v3', ratings)).toEqual([
      ['Season Gladiator', 1, 2000],
      ['Gladiator', 1, undefined],
      ['Duelist', 2, 1990],
      ['Rival', 6, 1950],
      ['Challenger', 7, 1940]
    ]);
  });

  it('gives a rating one place, so everyone on it is in and the line reaches further down', () => {
    const ratings = [2700, 2600, 2600, 2600, 2500, ...Array.from({ length: 95 }, (_, index) => 2400 - index)];
    const cutoffs = getTitleCutoffs(field(ratings), ARENA_TITLES['2v2']);

    expect(cutoffs.slice(0, 3).map(cutoff => [cutoff.title.name, cutoff.places, cutoff.rating, cutoff.ties])).toEqual([
      ['Gladiator', 1, 2700, 0],
      ['Duelist', 3, 2500, 2],
      ['Rival', 10, 2394, 0]
    ]);
  });

  it('has no places without players', () => {
    expect(summary('2v2', []).every(([, places, rating]) => places === 0 && rating === undefined)).toBe(true);
  });

  it('leaves the players under the minimum games out of the places', () => {
    const rows = toArenaRows(
      [player('Newcomer', 12, 0, 2900), ...[2400, 2300].map((rating, index) => player(`P${index}`, 30, 30, rating))],
      50
    );
    const titles = [{ name: 'Top', slug: 'top', topPerMille: 500 }];

    expect(getTitleCutoffs(rows, titles)[0]).toMatchObject({ places: 1, rating: 2400, ties: 0 });
  });
});

describe('getTitle', () => {
  const cutoffs = getTitleCutoffs(
    toArenaRows([2400, 2300, 2300, 2100, 1900].map((rating, index) => player(`P${index}`, 30, 30, rating)), 50),
    [
      { name: 'Top', slug: 'top', topPerMille: 200 },
      { name: 'Next', slug: 'next', topPerMille: 400 }
    ]
  );

  it('gives the best title a rating reaches, ties on a cutoff included', () => {
    expect(getTitle(2400, cutoffs)?.title.name).toBe('Top');
    expect(getTitle(2300, cutoffs)?.title.name).toBe('Next');
    expect(getTitle(2100, cutoffs)).toBeUndefined();
  });
});

describe('formatTitleShare', () => {
  it('writes the share as a percentage', () => {
    expect(ARENA_TITLES['2v2'].map(formatTitleShare)).toEqual(['0.6%', '3%', '10%', '35%']);
    expect(ARENA_TITLES['3v3'].map(formatTitleShare)).toEqual(['0.5%', '3%', '10%', '35%', '45%']);
  });
});

describe('arenaRatingChanges', () => {
  const scanned = (base: ArenaPlayer, guid: number, previousRating?: number, previousGames?: number): ArenaPlayer =>
    ({ ...base, guid, previousRating, previousGames });
  const changes = (players: ArenaPlayer[]) =>
    [...arenaRatingChanges({ players, previousGeneratedAt: '2026-10-26T23:10:46Z' }, 50)];

  it("compares each active player's rank and rating with the previous scan", () => {
    const players = [
      scanned(player('Climber', 40, 20, 2100), 1, 1900, 55),
      scanned(player('Steady', 30, 30, 2000), 2, 2000, 60),
      scanned(player('Faller', 25, 35, 1950), 3, 2050, 58)
    ];

    expect(changes(players)).toEqual([
      ['Evermoon::1', { rank: 2, value: 200, isNew: false }],
      ['Evermoon::3', { rank: -2, value: -100, isNew: false }]
    ]);
  });

  it('marks a player new who was short of the minimum games or not on the ladder', () => {
    const players = [
      scanned(player('Fresh', 40, 15, 2200), 1, 2150, 45),
      scanned(player('Unseen', 30, 25, 2100), 2),
      scanned(player('Kept', 30, 30, 2000), 3, 2000, 60)
    ];

    expect(changes(players)).toEqual([
      ['Evermoon::1', { rank: 0, value: 0, isNew: true }],
      ['Evermoon::2', { rank: 0, value: 0, isNew: true }],
      ['Evermoon::3', { rank: -2, value: 0, isNew: false }]
    ]);
  });

  it('orders the previous ladder like the table: rating, then more games', () => {
    const players = [
      scanned(player('Alpha', 30, 30, 2000), 1, 1800, 60),
      scanned(player('Bravo', 30, 40, 1990), 2, 1800, 70)
    ];

    expect(changes(players)).toEqual([
      ['Evermoon::1', { rank: 1, value: 200, isNew: false }],
      ['Evermoon::2', { rank: -1, value: 190, isNew: false }]
    ]);
  });

  it('shows no changes when the file has no previous scan', () => {
    expect(arenaRatingChanges({ players: [player('Alpha', 30, 30, 2000)] }, 50).size).toBe(0);
  });

  it('ranks the players under the minimum after the active ones, as the table does', () => {
    const players = [
      scanned(player('Rising', 10, 10, 1900), 1, 1700, 15),
      scanned(player('Active', 30, 30, 1500), 2, 1500, 60),
      scanned(player('Waiting', 15, 15, 1800), 3, 1800, 25)
    ];

    expect(changes(players)).toEqual([
      ['Evermoon::1', { rank: 1, value: 200, isNew: false }],
      ['Evermoon::3', { rank: -1, value: 0, isNew: false }]
    ]);
  });

  it('marks a player under the minimum new only when they were not on the ladder', () => {
    const players = [
      scanned(player('Active', 30, 30, 1500), 1, 1500, 60),
      scanned(player('Unseen', 5, 5, 1600), 2),
      scanned(player('Known', 4, 4, 1550), 3, 1550, 6)
    ];

    expect(changes(players)).toEqual([
      ['Evermoon::2', { rank: 0, value: 0, isNew: true }],
      ['Evermoon::3', { rank: -1, value: 0, isNew: false }]
    ]);
  });
});

describe('arenaGroupHeadings', () => {
  const [gladiator, duelist] = getTitleCutoffs(
    toArenaRows([2400, 2300, 2200, 2100].map((rating, index) => player(`P${index}`, 30, 30, rating)), 50),
    [
      { name: 'Gladiator', slug: 'gladiator', topPerMille: 250 },
      { name: 'Duelist', slug: 'duelist', topPerMille: 750 }
    ]
  );
  const rows = toArenaRows(
    [
      player('Glad', 30, 30, 2400),
      player('Duel', 30, 30, 2300),
      player('Duel2', 30, 30, 2200),
      player('Plain', 30, 30, 2100),
      player('Newcomer', 10, 0, 2500),
      player('Newcomer2', 5, 5, 1500)
    ],
    50
  );
  const titles = new Map<ArenaPlayerRow, TitleCutoff>([[rows[0], gladiator], [rows[1], duelist], [rows[2], duelist]]);
  const headings = (slice: readonly ArenaPlayerRow[], byTitle: boolean) =>
    [...arenaGroupHeadings(slice, row => titles.get(row), byTitle)].map(([index, group]) => [
      index,
      group.kind === 'title' ? group.cutoff.title.name : group.kind
    ]);

  it('heads each title, then the untitled active players, then the players under the minimum', () => {
    expect(headings(rows, true)).toEqual([[0, 'Gladiator'], [1, 'Duelist'], [3, 'untitled'], [4, 'inactive']]);
  });

  it('starts a page that opens inside a group with that group heading', () => {
    expect(headings(rows.slice(2, 5), true)).toEqual([[0, 'Duelist'], [1, 'untitled'], [2, 'inactive']]);
  });

  it('heads only the players under the minimum outside the title order', () => {
    expect(headings(rows, false)).toEqual([[4, 'inactive']]);
    expect(headings(rows.slice(0, 4), false)).toEqual([]);
  });
});
