import { describe, expect, it } from 'vitest';
import {
  ARENA_TITLES,
  ArenaPlayer,
  arenaRatingChanges,
  formatTitleShare,
  getArenaLadderFile,
  getArenaSpec,
  getTitle,
  getTitleCutoffs,
  parseArenaBracket,
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
  it('keeps characters with at least the threshold of games and adds their losses and win rate', () => {
    const rows = toArenaRows(
      [player('FortyNine', 25, 24, 1500), player('Fifty', 25, 25, 1500), player('Sixty', 45, 15, 1800)],
      50
    );

    expect(rows.map(row => [row.name, row.losses, row.winRate])).toEqual([['Fifty', 25, 0.5], ['Sixty', 15, 0.75]]);
    expect(rows[0].lastSpec?.name).toBe('Arms');
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
});
