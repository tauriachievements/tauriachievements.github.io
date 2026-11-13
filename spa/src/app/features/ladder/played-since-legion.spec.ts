import { describe, expect, it } from 'vitest';
import {
  PlayedSinceLegionEntry,
  PlayedSinceLegionFile,
  launchLabel,
  playedSinceLegionRows,
  playedSinceLegionUrlParams
} from './played-since-legion';

const HOUR = 3600;
const DAY = 24 * HOUR;

function entry(name: string, playedHours: number, extra: Partial<PlayedSinceLegionEntry> = {}): PlayedSinceLegionEntry {
  return { name, realm: 'Evermoon', faction: 'Alliance', race: 1, gender: 0, class: 1, guild: '', played: playedHours * HOUR, ...extra };
}

function file(players: PlayedSinceLegionEntry[]): PlayedSinceLegionFile {
  return {
    v: 1,
    launch: '2026-07-15T07:00:00.000Z',
    launchScan: '2026-07-14T17:18:23.000Z',
    generatedAt: '2026-07-25T07:00:00.000Z',
    players
  };
}

describe('playedSinceLegionRows', () => {
  it('numbers the characters in the order of the file and averages their time over the days since launch', () => {
    const rows = playedSinceLegionRows(file([entry('Vemos', 150), entry('Plost', 20)]), {});

    expect(rows.map(row => [row.rank, row.name, row.perDay])).toEqual([
      [1, 'Vemos', 15 * HOUR],
      [2, 'Plost', 2 * HOUR]
    ]);
  });

  it('numbers again inside a realm or class filter', () => {
    const players = [
      entry('Hunter', 100, { class: 3 }),
      entry('TauriWarrior', 90, { realm: 'Tauri' }),
      entry('Warrior', 80),
      entry('TauriHunter', 70, { realm: 'Tauri', class: 3 })
    ];

    expect(playedSinceLegionRows(file(players), { realm: 'tauri' }).map(row => [row.rank, row.name])).toEqual([
      [1, 'TauriWarrior'],
      [2, 'TauriHunter']
    ]);
    expect(playedSinceLegionRows(file(players), { classId: 3 }).map(row => [row.rank, row.name])).toEqual([
      [1, 'Hunter'],
      [2, 'TauriHunter']
    ]);
  });

  it('finds characters by name or guild, ignoring case and accents, and keeps their places', () => {
    const players = [
      entry('Aësar', 100),
      entry('Plost', 90, { guild: 'Aesir Guard' }),
      entry('Vemos', 80)
    ];

    expect(playedSinceLegionRows(file(players), { search: ' aes ' }).map(row => [row.rank, row.name])).toEqual([
      [1, 'Aësar'],
      [2, 'Plost']
    ]);
  });

  it('gives no daily average before the current scan is known', () => {
    const [row] = playedSinceLegionRows({ ...file([entry('Vemos', 150)]), generatedAt: null }, {});

    expect(row.perDay).toBe(0);
    expect(row.played).toBe(150 * HOUR);
  });

  it('averages a partial day too', () => {
    const halfDayAfterLaunch = { ...file([entry('Vemos', 6)]), generatedAt: '2026-07-15T19:00:00.000Z' };

    expect(playedSinceLegionRows(halfDayAfterLaunch, {})[0].perDay).toBe(DAY / 2);
  });
});

describe('launchLabel', () => {
  it('shows the launch in server time', () => {
    expect(launchLabel('2026-07-15T07:00:00.000Z')).toBe('15 July 2026, 09:00');
  });
});

describe('playedSinceLegionUrlParams', () => {
  it('leaves the defaults out of the URL', () => {
    expect(playedSinceLegionUrlParams({ page: 1 })).toEqual({ realm: null, class: null, q: null, page: null });
    expect(playedSinceLegionUrlParams({ realm: 'tauri', classId: 3, search: ' Vemos ', page: 2 })).toEqual({
      realm: 'tauri',
      class: '3',
      q: 'Vemos',
      page: '2'
    });
  });
});
