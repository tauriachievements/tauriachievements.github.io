import { describe, expect, it } from 'vitest';
import {
  parseStatsLevel,
  parseStatsRealm,
  selectStatsSnapshot,
  statsSnapshotKey,
  statsUrlParams
} from './realm-stats';
import { statsSnapshot } from './realm-stats.fixture';

describe('parseStatsRealm', () => {
  it('reads a realm from its URL slug, whatever the case', () => {
    expect(parseStatsRealm('evermoon')).toBe('Evermoon');
    expect(parseStatsRealm('WoD')).toBe('WoD');
  });

  it('treats a missing or unknown realm as all realms', () => {
    expect(parseStatsRealm(null)).toBeUndefined();
    expect(parseStatsRealm('Stormwind')).toBeUndefined();
    expect(parseStatsRealm(undefined)).toBeUndefined();
  });
});

describe('parseStatsLevel', () => {
  it('reads a listed level, from the URL or from the dropdown', () => {
    expect(parseStatsLevel('100')).toBe(100);
    expect(parseStatsLevel(80)).toBe(80);
    expect(parseStatsLevel('all')).toBe('all');
  });

  it('falls back to level 110 for a missing or unlisted level', () => {
    expect(parseStatsLevel(null)).toBe(110);
    expect(parseStatsLevel('85')).toBe(110);
  });
});

describe('statsUrlParams', () => {
  it('leaves the defaults out of the URL', () => {
    expect(statsUrlParams(undefined, 110)).toEqual({ realm: null, level: null });
  });

  it('writes a realm as its slug and any other level as it is', () => {
    expect(statsUrlParams('Tauri', 'all')).toEqual({ realm: 'tauri', level: 'all' });
    expect(statsUrlParams(undefined, 90)).toEqual({ realm: null, level: '90' });
  });
});

describe('selectStatsSnapshot', () => {
  const collection = {
    version: 3 as const,
    filters: {
      [statsSnapshotKey(undefined, 110)]: statsSnapshot(),
      [statsSnapshotKey('Tauri', 'all')]: statsSnapshot({ totalPlayers: 7 }),
      [statsSnapshotKey('WoD', 80)]: statsSnapshot({ totalPlayers: 0 })
    }
  };

  it('keys a snapshot by realm and level, * standing for all of either', () => {
    expect(statsSnapshotKey(undefined, 110)).toBe('*|110');
    expect(statsSnapshotKey('Tauri', 'all')).toBe('Tauri|*');
    expect(selectStatsSnapshot(collection, 'Tauri', 'all')?.totalPlayers).toBe(7);
  });

  it('finds nothing for a filter with no characters, or before the file loads', () => {
    expect(selectStatsSnapshot(collection, 'WoD', 80)).toBeUndefined();
    expect(selectStatsSnapshot(collection, 'Evermoon', 90)).toBeUndefined();
    expect(selectStatsSnapshot(undefined, undefined, 110)).toBeUndefined();
  });
});
