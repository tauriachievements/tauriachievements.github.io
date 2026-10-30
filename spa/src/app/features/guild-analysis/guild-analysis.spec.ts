import { describe, expect, it } from 'vitest';
import { GUILD_PAGES, guildPagePath } from './guild-analysis';

const RANDOM_GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function guidOf(page: (typeof GUILD_PAGES)[number]): string {
  return guildPagePath(page).slice(page.key.length + 1);
}

describe('guildPagePath', () => {
  it('is the guild key, a hyphen and a random lowercase GUID', () => {
    for (const page of GUILD_PAGES) {
      expect(guildPagePath(page).startsWith(`${page.key}-`)).toBe(true);
      expect(guidOf(page)).toMatch(RANDOM_GUID);
    }
  });

  it('gives every guild page its own GUID', () => {
    const guids = GUILD_PAGES.map(guidOf);

    expect(new Set(guids).size).toBe(guids.length);
  });
});
