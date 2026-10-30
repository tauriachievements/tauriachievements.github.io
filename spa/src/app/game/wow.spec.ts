import { describe, expect, it } from 'vitest';
import {
  REALM_FILTER_OPTIONS,
  ROLE_FILTERS,
  ROLE_FILTER_ICONS,
  ROLE_FILTER_LABELS,
  RoleFilter,
  matchesRoleFilter,
  parseRealmSlug,
  parseRoleFilter,
  raceFaction,
  realmSlug,
  roleFiltersFor
} from './wow';
import { LEGION_SPECS } from './wow-specs';

describe('raceFaction', () => {
  it('knows each race\'s side, and none for the neutral Pandaren', () => {
    expect([raceFaction(1), raceFaction(10), raceFaction(25), raceFaction(26), raceFaction(24)]).toEqual([0, 1, 0, 1, undefined]);
  });
});

describe('realmSlug', () => {
  it('lowercases the realm for URLs', () => {
    expect(realmSlug('WoD')).toBe('wod');
  });
});

describe('REALM_FILTER_OPTIONS', () => {
  it('offers all realms, then each realm by its URL slug', () => {
    expect(REALM_FILTER_OPTIONS.map(option => [option.value, option.label])).toEqual([
      [undefined, 'All realms'], ['evermoon', 'Evermoon'], ['tauri', 'Tauri'], ['wod', 'WoD']
    ]);
  });
});

describe('parseRealmSlug', () => {
  it('accepts a realm slug in any case and nothing else', () => {
    expect([parseRealmSlug('WoD'), parseRealmSlug('tauri'), parseRealmSlug('gilneas'), parseRealmSlug(null)])
      .toEqual(['wod', 'tauri', undefined, undefined]);
  });
});

describe('ROLE_FILTERS', () => {
  it('lists the three roles, then the two kinds of damage spec, each with its dropdown label', () => {
    expect(ROLE_FILTERS.map(role => [role, ROLE_FILTER_LABELS[role]])).toEqual([
      ['tank', 'Tank'], ['healer', 'Healer'], ['dps', 'DPS'], ['melee', 'Melee DPS'], ['ranged', 'Ranged DPS']
    ]);
  });
});

describe('ROLE_FILTER_ICONS', () => {
  const glyphColour = (role: RoleFilter) => decodeURIComponent(ROLE_FILTER_ICONS[role]).match(/fill="(#[0-9a-f]{6})"/)?.[1];

  it('draws each role as an SVG in its colour, and Melee and Ranged DPS with the DPS sword', () => {
    expect(ROLE_FILTERS.every(role => ROLE_FILTER_ICONS[role].startsWith('data:image/svg+xml,'))).toBe(true);
    expect(ROLE_FILTERS.map(glyphColour)).toEqual(['#6ea8ff', '#3ecf5e', '#e5484d', '#e5484d', '#e5484d']);
    expect(ROLE_FILTER_ICONS.melee).toBe(ROLE_FILTER_ICONS.dps);
    expect(ROLE_FILTER_ICONS.ranged).toBe(ROLE_FILTER_ICONS.dps);
    expect(new Set(ROLE_FILTERS.map(role => ROLE_FILTER_ICONS[role])).size).toBe(3);
  });
});

describe('parseRoleFilter', () => {
  it('reads ?role=, and nothing it does not know', () => {
    expect(['tank', 'healer', 'dps', 'melee', 'ranged', 'heal', 'Tank', null].map(parseRoleFilter))
      .toEqual(['tank', 'healer', 'dps', 'melee', 'ranged', undefined, undefined, undefined]);
  });
});

describe('matchesRoleFilter', () => {
  const players = [
    { role: 'tank' as const },
    { role: 'healer' as const },
    { role: 'dps' as const, range: 'melee' as const },
    { role: 'dps' as const, range: 'ranged' as const }
  ];
  const matching = (filter: RoleFilter | undefined) => players.map(player => matchesRoleFilter(player, filter));

  it('lets everyone through without a filter', () => {
    expect(matching(undefined)).toEqual([true, true, true, true]);
  });

  it('matches a role on the role, and melee or ranged on the damage spec\'s range', () => {
    expect(matching('tank')).toEqual([true, false, false, false]);
    expect(matching('healer')).toEqual([false, true, false, false]);
    expect(matching('dps')).toEqual([false, false, true, true]);
    expect(matching('melee')).toEqual([false, false, true, false]);
    expect(matching('ranged')).toEqual([false, false, false, true]);
  });
});

describe('roleFiltersFor', () => {
  const classSpecs = (classId: number) => LEGION_SPECS.filter(spec => spec.classId === classId);

  it('offers only the roles some of the specs can fill, in the dropdown order', () => {
    expect(roleFiltersFor(classSpecs(3))).toEqual(['dps', 'melee', 'ranged']);
    expect(roleFiltersFor(classSpecs(8))).toEqual(['dps', 'ranged']);
    expect(roleFiltersFor(classSpecs(2))).toEqual(['tank', 'healer', 'dps', 'melee']);
    expect(roleFiltersFor([])).toEqual([]);
  });
});
