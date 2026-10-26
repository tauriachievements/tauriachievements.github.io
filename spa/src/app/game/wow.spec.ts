import { describe, expect, it } from 'vitest';
import { REALM_FILTER_OPTIONS, parseRealmSlug, raceFaction, realmSlug } from './wow';

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
