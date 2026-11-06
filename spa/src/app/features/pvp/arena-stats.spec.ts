import { describe, expect, it } from 'vitest';
import { ArenaPlayer } from './arena-games';
import {
  ARENA_RATING_OPTIONS,
  arenaRaceContext,
  arenaSpecSamples,
  arenaStatsEmptyText,
  arenaStatsSubtitle,
  arenaStatsUrlParams,
  parseRatingFloor
} from './arena-stats';

function player(name: string, overrides: Partial<ArenaPlayer> = {}): ArenaPlayer {
  return {
    guid: 1,
    realm: 'Evermoon',
    name,
    class: 8,
    race: 1,
    gender: 0,
    faction: 0,
    guild: '',
    spec: 64,
    games: 60,
    wins: 30,
    weekGames: 0,
    weekWins: 0,
    rating: 1600,
    peakRating: 1600,
    weekPeakRating: 0,
    ...overrides
  };
}

describe('ARENA_RATING_OPTIONS', () => {
  it('offers every player, then each rating floor from 1500 to 2500', () => {
    expect(ARENA_RATING_OPTIONS.map(option => option.label))
      .toEqual(['All', '1500+', '1750+', '2000+', '2200+', '2500+']);
    expect(ARENA_RATING_OPTIONS.map(option => option.value))
      .toEqual([undefined, 1500, 1750, 2000, 2200, 2500]);
  });
});

describe('parseRatingFloor', () => {
  it('reads a listed rating floor', () => {
    expect(parseRatingFloor('2000')).toBe(2000);
    expect(parseRatingFloor('2500')).toBe(2500);
  });

  it('drops a floor the page does not offer, so the page shows every player', () => {
    expect(parseRatingFloor('1600')).toBeUndefined();
    expect(parseRatingFloor('abc')).toBeUndefined();
    expect(parseRatingFloor(null)).toBeUndefined();
  });
});

describe('arenaStatsUrlParams', () => {
  it('leaves the defaults out of the URL', () => {
    expect(arenaStatsUrlParams({ bracket: '2v2' })).toEqual({ bracket: null, rating: null, role: null });
  });

  it('writes the bracket, the rating floor and the role', () => {
    expect(arenaStatsUrlParams({ bracket: '3v3', ratingFloor: 2200, role: 'healer' }))
      .toEqual({ bracket: '3v3', rating: '2200', role: 'healer' });
  });
});

describe('arenaSpecSamples', () => {
  it('keeps the characters whose current rating reaches the floor', () => {
    const samples = arenaSpecSamples([
      player('Exa', { rating: 2000 }),
      player('Sosa', { rating: 1999, peakRating: 2400 }),
      player('Maja', { rating: 2310 })
    ], 2000);

    expect(samples.map(sample => sample.name)).toEqual(['Exa', 'Maja']);
  });

  it('keeps every character when no floor is set', () => {
    const samples = arenaSpecSamples([player('Exa', { rating: 95 }), player('Sosa', { rating: 2600 })]);

    expect(samples.map(sample => sample.name)).toEqual(['Exa', 'Sosa']);
  });

  it('leaves out a character with no spec, or a spec of another class', () => {
    const samples = arenaSpecSamples([
      player('Exa', { spec: 0 }),
      player('Sosa', { spec: 71 }),
      player('Maja', { spec: 64 })
    ]);

    expect(samples.map(sample => sample.name)).toEqual(['Maja']);
  });

  it('describes each character by the spec of their latest game', () => {
    const [restoration, frost] = arenaSpecSamples([
      player('Wxz', { realm: 'Tauri', class: 11, spec: 105, race: 6 }),
      player('Exa', { class: 8, spec: 64, race: 10 })
    ]);

    expect(restoration).toEqual({ name: 'Wxz', realm: 'Tauri', class: 11, spec: 'Restoration', role: 'healer', range: undefined, race: 6 });
    expect(frost).toEqual({ name: 'Exa', realm: 'Evermoon', class: 8, spec: 'Frost', role: 'dps', range: 'ranged', race: 10 });
  });
});

describe('arenaStatsSubtitle', () => {
  it('names the bracket, role, rating and character count', () => {
    expect(arenaStatsSubtitle({ bracket: '2v2', total: 844 }))
      .toBe('Rated 2v2 arena · All roles · All ratings · 844 characters · Grouped by popularity');
    expect(arenaStatsSubtitle({ bracket: '3v3', ratingFloor: 2000, role: 'healer', total: 1 }))
      .toBe('Rated 3v3 arena · Healer · Current rating 2000+ · 1 character · Grouped by popularity');
  });
});

describe('arenaRaceContext', () => {
  it('names the bracket, and the rating floor when one is set', () => {
    expect(arenaRaceContext('2v2')).toBe('Rated 2v2 arena');
    expect(arenaRaceContext('3v3', 1750)).toBe('Rated 3v3 arena · Current rating 1750+');
  });
});

describe('arenaStatsEmptyText', () => {
  it('says nobody holds the rating yet', () => {
    expect(arenaStatsEmptyText('3v3', 2500)).toBe('Nobody in 3v3 is rated 2500 or higher right now.');
  });

  it('names the role when one is picked', () => {
    expect(arenaStatsEmptyText('3v3', 2200, 'tank')).toBe('No Tank players in 3v3 are rated 2200 or higher right now.');
    expect(arenaStatsEmptyText('2v2', undefined, 'melee')).toBe('No Melee DPS players are on the 2v2 ladder yet.');
  });

  it('says the ladder is empty when nothing is filtered', () => {
    expect(arenaStatsEmptyText('3v3')).toBe('Nobody is on the 3v3 ladder yet.');
  });
});
