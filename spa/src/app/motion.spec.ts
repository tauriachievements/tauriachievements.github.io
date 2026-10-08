import { describe, expect, it } from 'vitest';
import { characterTransitionName } from './motion';

describe('characterTransitionName', () => {
  it('is the same for the same character on every page', () => {
    expect(characterTransitionName('Pretz|Evermoon')).toBe(characterTransitionName('Pretz|Evermoon'));
  });

  it('tells apart one name on two realms', () => {
    expect(characterTransitionName('Pretz|Evermoon')).not.toBe(characterTransitionName('Pretz|Tauri'));
  });

  it('makes a valid CSS name out of any character name', () => {
    for (const key of ['M#2124685|Evermoon', 'Хранитель|Tauri', 'Straße|WoD']) {
      expect(characterTransitionName(key)).toMatch(/^mplus-character-[0-9a-z]+$/);
    }
  });
});
