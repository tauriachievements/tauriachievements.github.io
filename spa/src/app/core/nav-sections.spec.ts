import { describe, expect, it } from 'vitest';
import { NAV_SECTIONS, findNavLocation } from './nav-sections';

function locate(url: string): string | undefined {
  const location = findNavLocation(url);
  return location && `${location.section.label} / ${location.page.label}`;
}

describe('findNavLocation', () => {
  it('matches the home page only on the exact root', () => {
    expect(locate('/')).toBe('Ladder / Players');
    expect(locate('/?realm=tauri&sort=hk')).toBe('Ladder / Players');
    expect(locate('/#top')).toBe('Ladder / Players');
  });

  it('ignores query strings, fragments, matrix params and a trailing slash', () => {
    expect(locate('/mythic-plus?dungeon=3&page=2')).toBe('Mythic+ / Leaderboard');
    expect(locate('/mythic-plus/stats#weeks')).toBe('Mythic+ / Statistics');
    expect(locate('/guilds;realm=wod')).toBe('Ladder / Guild Rankings');
    expect(locate('/stats/')).toBe('Realm Stats / Realm Stats');
    expect(locate('/arena?x=1')).toBe('PvP / Arena');
  });

  it('files deeper routes under the page they belong to', () => {
    expect(locate('/mythic-plus/character/tauri/Arthas')).toBe('Mythic+ / Leaderboard');
    expect(locate('/mythic-plus/guild/evermoon/Skill%20Issue')).toBe('Mythic+ / Leaderboard');
    expect(locate('/raid-logs/boss/xavius-heroic')).toBe('Raids / Raid Logs');
    expect(locate('/raid-logs/log/evermoon/12345')).toBe('Raids / Raid Logs');
    expect(locate('/raid-logs/guild/tauri/Some%20Guild')).toBe('Raids / Guild Progression');
    expect(locate('/raid-logs/character/tauri/Name')).toBe('Raids / Character Rankings');
  });

  it('keeps a sibling route out of a shorter page path', () => {
    expect(locate('/raid-logs/leaderboard')).toBe('Raids / Character Rankings');
    expect(locate('/raid-logs/guilds?difficulty=heroic')).toBe('Raids / Guild Progression');
    expect(locate('/raid-logs/clears?difficulty=heroic')).toBe('Raids / Fastest Clears');
    expect(locate('/raid-logs/stats')).toBe('Raids / Raid Statistics');
    expect(locate('/raid-logs/tier-list?difficulty=normal')).toBe('Raids / Tier List');
    expect(locate('/mythic-plus/records')).toBe('Mythic+ / Records');
    expect(locate('/legion-key-history-addon')).toBe('Mythic+ / Addon');
    expect(locate('/arena/stats?bracket=3v3')).toBe('PvP / Arena Statistics');
    expect(locate('/raid-logs-old')).toBeUndefined();
  });

  it('leaves pages outside the navigation unmatched', () => {
    expect(locate('/endless-9f4c446e-5fef-4265-b4c6-2fc5d61e5e59')).toBeUndefined();
    expect(locate('/k7m2q9v4x8p3n6z')).toBeUndefined();
  });

  it('names the group a grouped page sits in', () => {
    expect(findNavLocation('/raid-logs/talents?difficulty=mythic')?.group?.label).toBe('Analytics');
    expect(findNavLocation('/raid-logs/character/tauri/Name')?.group?.label).toBe('Logs & Rankings');
    expect(findNavLocation('/emerald-nightmare')?.group?.label).toBe('Realm First Race');
    expect(findNavLocation('/trial-of-valor')?.group?.label).toBe('Realm First Race');
    expect(findNavLocation('/mythic-plus/stats')?.group).toBeUndefined();
  });

  it('lists every page path once', () => {
    const paths = NAV_SECTIONS.flatMap((section) => section.pages.map((page) => page.path));

    expect(new Set(paths).size).toBe(paths.length);
    expect(paths).toHaveLength(27);
  });
});

describe('NAV_SECTIONS groups', () => {
  const raids = NAV_SECTIONS.find((section) => section.id === 'raids')!;

  it('splits Raids into Logs & Rankings, Analytics and Realm First Race', () => {
    const groups = raids.groups?.map((group) => [group.label, group.pages.map((page) => page.label)]);

    expect(groups).toEqual([
      ['Logs & Rankings', ['Raid Logs', 'Guild Progression', 'Fastest Clears', 'Character Rankings']],
      ['Analytics', ['Raid Statistics', 'Tier List', 'Talent Analytics', 'Trinket Analytics']],
      ['Realm First Race', ['Race to Emerald Nightmare', 'Race to Trial of Valor', 'Realm First History']]
    ]);
  });

  it('lists a grouped section\'s pages group by group', () => {
    expect(raids.pages).toEqual(raids.groups!.flatMap((group) => group.pages));
  });

  it('gives every group an id no other group has', () => {
    const ids = NAV_SECTIONS.flatMap((section) => section.groups?.map((group) => group.id) ?? []);

    expect(ids).toHaveLength(3);
    expect(new Set(ids).size).toBe(3);
  });

  it('leaves the other sections as plain lists', () => {
    const grouped = NAV_SECTIONS.filter((section) => section.groups).map((section) => section.id);

    expect(grouped).toEqual(['raids']);
  });
});
