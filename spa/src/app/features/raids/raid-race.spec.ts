import { describe, expect, it } from 'vitest';
import {
  RaceDataset,
  formatKillDate,
  formatRaceDuration,
  formatSplit,
  guildTimelines,
  nextPlaybackMinute,
  playbackClock,
  raceBossViews,
  raceDay,
  raceDuration,
  raceGuildRealm,
  raceSlots,
  timelineHours
} from './raid-race';
import { EMERALD_NIGHTMARE_RACE, RaidRace, TRIAL_OF_VALOR_RACE } from './raid-races';

const race: RaidRace = {
  ...TRIAL_OF_VALOR_RACE,
  timelineExcludedGuilds: ['late']
};

const raceNight: RaceDataset = {
  odyn: [
    { guild: 'Miracle', realm: 'Evermoon', date: '2026-11-18', time: '18:20' },
    { guild: 'Endless', date: '2026-11-18', time: '18:30' },
    { guild: 'Late', date: '2026-11-18', time: '21:00' },
    { guild: 'Outlaws', date: '2026-11-19', time: '19:00' }
  ],
  guarm: [
    { guild: 'Endless', date: '2026-11-18', time: '19:00' },
    { guild: 'Miracle', date: '2026-11-18', time: '19:05' }
  ],
  helya: [
    { guild: 'Miracle', date: '2026-11-18', time: '21:30' }
  ]
};

describe('race settings', () => {
  it('races Trial of Valor over Odyn, Guarm and Helya from 18:00 to 22:00', () => {
    expect(TRIAL_OF_VALOR_RACE.bosses.map(boss => boss.name)).toEqual(['Odyn', 'Guarm', 'Helya']);
    expect([TRIAL_OF_VALOR_RACE.startHour, TRIAL_OF_VALOR_RACE.endHour]).toEqual([18, 22]);
    expect(TRIAL_OF_VALOR_RACE.dataFile).toBe('TrialOfValor.json');
  });

  it('keeps the Emerald Nightmare bosses in their timeline order', () => {
    expect(EMERALD_NIGHTMARE_RACE.bosses.map(boss => boss.key)).toEqual([
      'nythendra', 'ursoc', 'dragons-of-nightmare', 'elerethe-renferal', 'ilgynoth', 'cenarius', 'xavius'
    ]);
    expect(EMERALD_NIGHTMARE_RACE.dataFile).toBe('EmeraldNightmare.json');
  });
});

describe('raceSlots', () => {
  it('fills the top five with empty slots after the recorded kills', () => {
    const slots = raceSlots([{ guild: ' Miracle ', realm: 'Evermoon', date: '2026-11-18', time: '18:20' }]);

    expect(slots).toHaveLength(5);
    expect(slots[0]).toEqual({ guild: 'Miracle', realm: 'Evermoon', date: '2026-11-18', time: '18:20' });
    expect(slots.slice(1).map(slot => slot.guild)).toEqual(['', '', '', '']);
  });

  it('reads the older entries whose realm holds the date and date the time', () => {
    const [slot] = raceSlots([{ guild: 'Endless', realm: '23-Sep-2026', date: '18:13', youtubeUrl: 'https://youtu.be/x' }]);

    expect(slot).toEqual({ guild: 'Endless', date: '2026-09-23', time: '18:13', youtubeUrl: 'https://youtu.be/x' });
  });

  it('treats blank fields as missing', () => {
    expect(raceSlots([{ guild: '', realm: '', date: '' }])[0]).toEqual({ guild: '' });
  });
});

describe('raceBossViews', () => {
  it('shows every boss with five open slots before the first kill', () => {
    const bosses = raceBossViews(TRIAL_OF_VALOR_RACE, {});

    expect(bosses.map(boss => boss.name)).toEqual(['Odyn', 'Guarm', 'Helya']);
    expect(bosses.every(boss => boss.guilds.length === 5 && boss.guilds.every(kill => !kill.guild))).toBe(true);
  });
});

describe('raceDay', () => {
  it('is the date of the earliest kill', () => {
    expect(raceDay(raceBossViews(race, raceNight))).toBe('2026-11-18');
  });

  it('is unknown before the first kill', () => {
    expect(raceDay(raceBossViews(race, {}))).toBeUndefined();
  });
});

describe('guildTimelines', () => {
  it('draws a lane for each guild that killed a boss on race day, leaving out the excluded guilds', () => {
    const lanes = guildTimelines(raceBossViews(race, raceNight), race, raceDuration(race));

    expect(lanes.map(lane => [lane.guild, lane.color, lane.completed, lane.totalMinutes, lane.isLeader])).toEqual([
      ['Miracle', '#ffb347', 3, 190, true],
      ['Endless', '#8ce6ff', 2, 30, false]
    ]);
  });

  it('places each kill on the 18:00 to 22:00 line with its split from the boss before', () => {
    const [miracle] = guildTimelines(raceBossViews(race, raceNight), race, raceDuration(race));

    expect(miracle.checkpoints.map(checkpoint => [
      checkpoint.boss.key,
      checkpoint.positionPercent,
      checkpoint.splitMinutes,
      checkpoint.isFirstKill
    ])).toEqual([
      ['odyn', 20 / 240 * 100, undefined, true],
      ['guarm', 65 / 240 * 100, 45, false],
      ['helya', 87.5, 145, true]
    ]);
    expect(miracle.progressStart).toBe(20 / 240 * 100);
    expect(miracle.progressWidth).toBeCloseTo(190 / 240 * 100);
    expect(miracle.realm).toBe('Evermoon');
  });

  it('shows only the kills up to the playback time and leads with the guild ahead at that time', () => {
    const lanes = guildTimelines(raceBossViews(race, raceNight), race, 62);

    expect(lanes.map(lane => [lane.guild, lane.completed, lane.totalMinutes, lane.isLeader])).toEqual([
      ['Miracle', 1, undefined, false],
      ['Endless', 2, 30, true]
    ]);
    expect(lanes[0].checkpoints.map(checkpoint => checkpoint.isVisible)).toEqual([true, false, false]);
  });

  it('draws no lane before the first kill', () => {
    expect(guildTimelines(raceBossViews(race, {}), race, raceDuration(race))).toEqual([]);
  });
});

describe('the race clock', () => {
  it('marks every hour from the start to the end of the race', () => {
    expect(timelineHours(TRIAL_OF_VALOR_RACE)).toEqual([
      { label: '18:00', position: 0 },
      { label: '19:00', position: 25 },
      { label: '20:00', position: 50 },
      { label: '21:00', position: 75 },
      { label: '22:00', position: 100 }
    ]);
    expect(raceDuration(TRIAL_OF_VALOR_RACE)).toBe(240);
  });

  it('reads the playback minute as a time of day', () => {
    expect(playbackClock(TRIAL_OF_VALOR_RACE, 0)).toBe('18:00');
    expect(playbackClock(TRIAL_OF_VALOR_RACE, 125)).toBe('20:05');
  });

  it('plays the first hour a minute at a time, then three minutes at a time', () => {
    expect([10, 59, 60, 61].map(nextPlaybackMinute)).toEqual([11, 60, 63, 64]);
  });
});

describe('raceGuildRealm', () => {
  it("uses the kill's own realm, then the guild's known realm, then Evermoon", () => {
    expect(raceGuildRealm('Outlaws', 'Evermoon')).toBe('Evermoon');
    expect(raceGuildRealm('Outlaws')).toBe('Tauri');
    expect(raceGuildRealm('Miracle')).toBe('Evermoon');
  });
});

describe('formatting', () => {
  it('writes durations, splits and kill dates', () => {
    expect([formatRaceDuration(190), formatRaceDuration(30), formatRaceDuration(undefined)]).toEqual(['3h 10m', '30m', '']);
    expect([formatSplit(45), formatSplit(undefined)]).toEqual(['+45 min', '']);
    expect([formatKillDate('2026-11-18'), formatKillDate(undefined)]).toEqual(['18 Nov 2026', '']);
  });
});
