import { FilterDropdownOption, FilterDropdownValue } from '../../shared/filter-dropdown.types';
import { REALMS, Realm, realmSlug } from '../../game/wow';
import { ServerStatsSnapshot, ServerStatsSnapshotCollection } from './server-stats.service';

export const STATS_LEVELS = [110, 100, 90, 80] as const;
export type StatsLevel = typeof STATS_LEVELS[number];
export type StatsLevelFilter = StatsLevel | 'all';
export const DEFAULT_STATS_LEVEL: StatsLevelFilter = 110;

const ALL_FILTER_KEY = '*';

export const STATS_REALM_OPTIONS: ReadonlyArray<FilterDropdownOption> = [
  { value: undefined, label: 'All realms' },
  ...REALMS.map(realm => ({ value: realm, label: realm }))
];

export const STATS_LEVEL_OPTIONS: ReadonlyArray<FilterDropdownOption> = [
  ...STATS_LEVELS.map(level => ({ value: level, label: `Level ${level}` })),
  { value: 'all', label: 'All levels' }
];

export function parseStatsRealm(value: FilterDropdownValue | null): Realm | undefined {
  return typeof value === 'string' ? REALMS.find(realm => realmSlug(realm) === value.toLowerCase()) : undefined;
}

export function parseStatsLevel(value: FilterDropdownValue | null): StatsLevelFilter {
  if (value === 'all') {
    return 'all';
  }

  return STATS_LEVELS.find(level => String(level) === String(value)) ?? DEFAULT_STATS_LEVEL;
}

export function statsUrlParams(realm: Realm | undefined, level: StatsLevelFilter): { realm: string | null; level: string | null } {
  return {
    realm: realm ? realmSlug(realm) : null,
    level: level === DEFAULT_STATS_LEVEL ? null : String(level)
  };
}

export function statsSnapshotKey(realm: Realm | undefined, level: StatsLevelFilter): string {
  return `${realm ?? ALL_FILTER_KEY}|${level === 'all' ? ALL_FILTER_KEY : level}`;
}

export function selectStatsSnapshot(
  collection: ServerStatsSnapshotCollection | undefined,
  realm: Realm | undefined,
  level: StatsLevelFilter
): ServerStatsSnapshot | undefined {
  const snapshot = collection?.filters[statsSnapshotKey(realm, level)];
  return snapshot && snapshot.totalPlayers > 0 ? snapshot : undefined;
}
