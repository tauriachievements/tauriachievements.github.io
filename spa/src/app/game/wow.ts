import { getClassIconPath } from './classIconHelper';
import { getClassColor } from './class-colors';
import { FilterDropdownOption } from '../shared/filter-dropdown.types';

export type Role = 'tank' | 'healer' | 'dps';

export type DamageRange = 'melee' | 'ranged';

export type Realm = 'Evermoon' | 'Tauri' | 'WoD';

export const REALMS: readonly Realm[] = ['Evermoon', 'Tauri', 'WoD'];

export function realmSlug(realm: string): string {
  return realm.toLowerCase();
}

export const REALM_FILTER_OPTIONS: ReadonlyArray<FilterDropdownOption> = [
  { value: undefined, label: 'All realms' },
  ...REALMS.map(realm => ({ value: realmSlug(realm), label: realm }))
];

export function parseRealmSlug(value: string | null): string | undefined {
  const slug = value?.toLowerCase();
  return REALMS.some(realm => realmSlug(realm) === slug) ? slug : undefined;
}

export const CLASS_NAMES: Readonly<Record<number, string>> = {
  1: 'Warrior', 2: 'Paladin', 3: 'Hunter', 4: 'Rogue',
  5: 'Priest', 6: 'Death Knight', 7: 'Shaman', 8: 'Mage',
  9: 'Warlock', 10: 'Monk', 11: 'Druid', 12: 'Demon Hunter'
};

export const CLASSES_BY_NAME: ReadonlyArray<{ readonly id: number; readonly name: string }> = Object.entries(CLASS_NAMES)
  .map(([id, name]) => ({ id: Number(id), name }))
  .sort((a, b) => a.name.localeCompare(b.name));

export const CLASS_FILTER_OPTIONS: ReadonlyArray<FilterDropdownOption> = [
  { value: undefined, label: 'All classes' },
  ...CLASSES_BY_NAME.map(({ id, name }) => ({
    value: id,
    label: name,
    icon: getClassIconPath(id),
    color: getClassColor(id)
  }))
];

export const RACE_NAMES: Readonly<Record<number, string>> = {
  1: 'Human', 2: 'Orc', 3: 'Dwarf', 4: 'Night Elf',
  5: 'Undead', 6: 'Tauren', 7: 'Gnome', 8: 'Troll',
  9: 'Goblin', 10: 'Blood Elf', 11: 'Draenei', 22: 'Worgen',
  24: 'Pandaren', 25: 'Pandaren', 26: 'Pandaren'
};

const ALLIANCE_RACES: ReadonlySet<number> = new Set([1, 3, 4, 7, 11, 22, 25]);
const HORDE_RACES: ReadonlySet<number> = new Set([2, 5, 6, 8, 9, 10, 26]);

export function raceFaction(race: number): number | undefined {
  return ALLIANCE_RACES.has(race) ? 0 : HORDE_RACES.has(race) ? 1 : undefined;
}

export type RoleFilter = Role | DamageRange;

export const ROLE_FILTERS: readonly RoleFilter[] = ['tank', 'healer', 'dps', 'melee', 'ranged'];

export const ROLE_FILTER_LABELS: Readonly<Record<RoleFilter, string>> = {
  tank: 'Tank', healer: 'Healer', dps: 'DPS', melee: 'Melee DPS', ranged: 'Ranged DPS'
};

const ROLE_GLYPHS: Readonly<Record<Role, { path: string; color: string }>> = {
  tank: { path: 'M12 2 4 5v6.1c0 5 3.4 9.6 8 10.9 4.6-1.3 8-5.9 8-10.9V5l-8-3z', color: '#6ea8ff' },
  healer: { path: 'M9.5 3h5v6.5H21v5h-6.5V21h-5v-6.5H3v-5h6.5z', color: '#3ecf5e' },
  dps: {
    path: 'M21 3l-7.5 1.6-7.8 7.8-1.9-1.9-1.4 1.4 2.6 2.6-2.4 2.4a1.5 1.5 0 1 0 2.1 2.1l2.4-2.4 2.6 2.6 1.4-1.4-1.9-1.9 7.8-7.8z',
    color: '#e5484d'
  }
};

function roleIcon(role: Role): string {
  const { path, color } = ROLE_GLYPHS[role];
  return 'data:image/svg+xml,' + encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="${color}" d="${path}"/></svg>`
  );
}

export const ROLE_FILTER_ICONS: Readonly<Record<RoleFilter, string>> = {
  tank: roleIcon('tank'), healer: roleIcon('healer'), dps: roleIcon('dps'), melee: roleIcon('dps'), ranged: roleIcon('dps')
};

export function parseRoleFilter(value: string | null | undefined): RoleFilter | undefined {
  return ROLE_FILTERS.find(role => role === value);
}

export function matchesRoleFilter(subject: { role: Role; range?: DamageRange }, filter: RoleFilter | undefined): boolean {
  if (filter === undefined) {
    return true;
  }

  return filter === 'melee' || filter === 'ranged' ? subject.range === filter : subject.role === filter;
}

export function roleFiltersFor(specs: ReadonlyArray<{ role: Role; range?: DamageRange }>): RoleFilter[] {
  return ROLE_FILTERS.filter(filter => specs.some(spec => matchesRoleFilter(spec, filter)));
}

export function parseClassId(value: string | null): number | undefined {
  const classId = Number(value);
  return value && CLASS_NAMES[classId] ? classId : undefined;
}
