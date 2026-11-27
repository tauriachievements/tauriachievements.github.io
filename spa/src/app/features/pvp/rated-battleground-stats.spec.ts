import { describe, expect, it } from 'vitest';
import {
  buildRatedBattlegroundAnalytics,
  buildTeamSummary,
  formatMetricChange,
  getObjectives,
  matchesBeforeScan,
  normalizeRatedBattlegrounds,
  rankRatedPlayers,
  ratedPlayerChanges,
  readNewMatches
} from './rated-battleground-stats';
import { match, member } from './rated-battleground-stats.fixture';

describe('normalizeRatedBattlegrounds', () => {
  it('keeps complete ranked matches and orders them chronologically', () => {
    const later = match({ matchid: 12, starttime: 1_789_600_500 });
    const earlier = match({ matchid: 11, starttime: 1_789_600_100 });
    const unranked = match({ matchid: 13, isranked: false });

    expect(normalizeRatedBattlegrounds([later, unranked, earlier]).map(entry => entry.matchid))
      .toEqual([11, 12]);
  });
});

describe('buildRatedBattlegroundAnalytics', () => {
  it('aggregates repeat players, records, throughput, maps and durations', () => {
    const first = match();
    const second = match({
      matchid: 11,
      mapid: 998,
      mapname: 'Temple of Kotmogu',
      winner: 0,
      starttime: first.starttime + 86_400,
      length: 900_000,
      members: [member({ damage_done: 300 }), member({ guid: 3, side: 1 })]
    });

    const analytics = buildRatedBattlegroundAnalytics([first, second]);
    const repeatPlayer = analytics.players.find(player => player.guid === 1);

    expect(analytics.matches).toBe(2);
    expect(analytics.uniquePlayers).toBe(3);
    expect(analytics.maps).toHaveLength(2);
    expect(analytics.activity).toHaveLength(2);
    expect(analytics.averageDurationMs).toBe(750_000);
    expect(repeatPlayer).toMatchObject({ games: 2, wins: 1, losses: 1, damageDone: 400 });
  });
});

describe('match details', () => {
  it('maps winner-specific averages and named objective columns', () => {
    const source = match();
    const winner = buildTeamSummary(source, 0);
    const loser = buildTeamSummary(source, 1);

    expect(winner).toMatchObject({ won: true, averageMmr: 1500, averagePersonalRating: 1000 });
    expect(loser).toMatchObject({ won: false, averageMmr: 1400, averagePersonalRating: 900 });
    expect(getObjectives(source, source.members[0])).toEqual([
      { label: 'Flags captured', value: 1 },
      { label: 'Flags returned', value: 2 }
    ]);
  });
});

describe('changes since the latest rated games', () => {
  const named = (guid: number, name: string, ratingChange: number, side = 0) => member({
    guid,
    side,
    personal_rating_change: ratingChange,
    'character-minimal-data': { ...member()['character-minimal-data'], charname: name }
  });
  const earlier = match({ matchid: 20, members: [named(1, 'Alpha', 50), named(2, 'Bravo', 40, 1)] });
  const latest = match({ matchid: 21, members: [named(2, 'Bravo', 30), named(3, 'Charlie', 100, 1)] });
  const newMatches = readNewMatches({ newRatedMatchesSince: '2026-10-26T23:10:45+00:00', newRatedMatchIds: [21] });

  it("reads the latest scan's new games from the collector state", () => {
    expect(newMatches).toEqual({ since: '2026-10-26T23:10:45+00:00', matchIds: new Set([21]) });
    expect(readNewMatches({ newRatedMatchesSince: null, newRatedMatchIds: [21] })).toBeUndefined();
    expect(readNewMatches({ newRatedMatchesSince: '2026-10-26T23:10:45+00:00', newRatedMatchIds: [] })).toBeUndefined();
    expect(readNewMatches(undefined)).toBeUndefined();
  });

  it('leaves out the new games, and has no earlier view when none of them is in it', () => {
    expect(matchesBeforeScan([earlier, latest], newMatches)?.map(entry => entry.matchid)).toEqual([20]);
    expect(matchesBeforeScan([earlier], newMatches)).toBeUndefined();
    expect(matchesBeforeScan([earlier, latest], undefined)).toBeUndefined();
  });

  it('compares the ranking with the one before the new games', () => {
    const ranked = rankRatedPlayers(buildRatedBattlegroundAnalytics([earlier, latest]).players, 'rating');

    expect(ranked.map(player => [player.name, player.netRatingChange])).toEqual([['Charlie', 100], ['Bravo', 70], ['Alpha', 50]]);
    expect([...ratedPlayerChanges(ranked, [earlier], 'rating')]).toEqual([
      ['9:3', { rank: 0, value: 0, isNew: true }],
      ['9:2', { rank: 0, value: 30, isNew: false }],
      ['9:1', { rank: -2, value: 0, isNew: false }]
    ]);
  });

  it("measures the picked metric's change", () => {
    const ranked = rankRatedPlayers(buildRatedBattlegroundAnalytics([earlier, latest]).players, 'games');

    expect(ratedPlayerChanges(ranked, [earlier], 'games').get('9:2')).toEqual({ rank: 1, value: 1, isNew: false });
  });

  it('signs a metric change', () => {
    expect(formatMetricChange(-3, 'rating')).toBe('−3');
    expect(formatMetricChange(12.4, 'mmr')).toBe('+12');
  });
});
