import { describe, expect, it } from 'vitest';
import {
  ElitePvpItemsFile,
  RareItemCharacter,
  RareItemsDataset,
  characterCount,
  decodeEliteCatalog,
  emptyOwnersMessage,
  eliteSeasonOptions,
  findOwners,
  fitOwnerQuery,
  otherItemOptions,
  otherPickFromValue,
  otherPickValue,
  ownerUrlParams,
  ownersHeading,
  parseOwnerQuery
} from './rare-items';

const FILE: ElitePvpItemsFile = {
  version: 1,
  seasons: [
    ['wrathful', 'Wrathful', 'Season 8'],
    ['cataclysmic', 'Cataclysmic', 'Season 11'],
    ['malevolent', 'Malevolent', 'Season 12'],
    ['vindictive', 'Vindictive', 'Legion Season 1']
  ],
  items: [
    [51395, 'wrathful', [], 'Ranged', "Wrathful Gladiator's Recurve"],
    [51400, 'wrathful', [11], 'Two-hand', "Wrathful Gladiator's Greatstaff"],
    [73740, 'cataclysmic', [6], 'Head', "Cataclysmic Gladiator's Dreadplate Helm"],
    [85046, 'malevolent', [6], 'Head', "Malevolent Gladiator's Dreadplate Helm"],
    [85086, 'malevolent', [6], 'Shoulder', "Malevolent Gladiator's Dreadplate Shoulders"],
    [85032, 'malevolent', [1], 'Head', "Malevolent Gladiator's Plate Helm"],
    [85100, 'malevolent', [1, 2, 6], 'Feet', "Malevolent Gladiator's Warboots of Cruelty"],
    [85101, 'malevolent', [1, 2, 6], 'Feet', "Malevolent Gladiator's Warboots of Alacrity"],
    [136046, 'vindictive', [6], 'Head', "Vindictive Gladiator's Dreadplate Helm"],
    [136159, 'vindictive', [6], 'Head', "Vindictive Gladiator's Dreadplate Helm"],
    [136136, 'vindictive', [10], 'Back', "Vindictive Gladiator's Ironskin Cloak"],
    [140000, 'vindictive', [12], 'Head', "Vindictive Gladiator's Felskin Helm"]
  ]
};

const catalog = decodeEliteCatalog(FILE);

function character(name: string, classId: number, itemIds: number[], realm = 'Tauri'): RareItemCharacter {
  return { name, realm, race: 1, gender: 0, class: classId, guild: '', items: itemIds.map(id => ({ id, name: `Item ${id}` })) };
}

const dataset: RareItemsDataset = {
  generatedAt: '2026-10-26T01:35:25Z',
  items: [{ id: 22818, name: 'The Plague Bearer' }, { id: 85046, name: 'DK Malev elite head' }, { id: 45983, name: "Furious Gladiator's Tabard" }],
  characters: [
    character('Zed', 6, [85046, 85086, 85100, 85101, 136046, 136159, 73740]),
    character('Abby', 6, [85046], 'Evermoon'),
    character('Brakk', 1, [85032, 51395, 22818]),
    character('Kai', 10, [136136]),
    character('Nobody', 8, [22818])
  ]
};

const names = (rows: ReturnType<typeof findOwners>) => rows.map(row => row.character.name);

describe('decodeEliteCatalog', () => {
  it('keeps every season in order and tells weapons from armour by slot', () => {
    expect(catalog.seasons.map(season => season.key)).toEqual(['wrathful', 'cataclysmic', 'malevolent', 'vindictive']);
    expect(catalog.items.get(51400)?.isWeapon).toBe(true);
    expect(catalog.items.get(136136)?.isWeapon).toBe(false);
  });

  it('refuses another version of the file', () => {
    expect(() => decodeEliteCatalog({ ...FILE, version: 2 })).toThrow();
  });
});

describe('eliteSeasonOptions', () => {
  it('lists the seasons with armour, leaving out weapon-only seasons', () => {
    expect(eliteSeasonOptions(catalog).map(option => option.label))
      .toEqual(['All seasons', 'Cataclysmic (Season 11)', 'Malevolent (Season 12)', 'Vindictive (Legion Season 1)']);
  });

  it('lists only the seasons with a piece for the picked class', () => {
    expect(eliteSeasonOptions(catalog, 12).map(option => option.value)).toEqual([undefined, 'vindictive']);
    expect(eliteSeasonOptions(catalog, 2).map(option => option.value)).toEqual([undefined, 'malevolent']);
  });
});

describe('otherItemOptions', () => {
  it('lists the rare items that are not elite pieces, then each season\'s elite weapons', () => {
    expect(otherItemOptions(dataset, catalog).map(option => [option.value, option.label])).toEqual([
      [undefined, 'Choose an item'],
      [22818, 'The Plague Bearer'],
      [45983, "Furious Gladiator's Tabard"],
      ['wrathful', 'Wrathful elite weapons (Season 8)']
    ]);
  });

  it('round-trips a pick through the dropdown value', () => {
    expect(otherPickFromValue(22818)).toEqual({ kind: 'item', id: 22818 });
    expect(otherPickFromValue('wrathful')).toEqual({ kind: 'weapons', season: 'wrathful' });
    expect(otherPickFromValue(undefined)).toBeUndefined();
    expect(otherPickValue({ kind: 'weapons', season: 'wrathful' })).toBe('wrathful');
  });
});

describe('findOwners', () => {
  it('lists every elite armour owner, most pieces first, then by name', () => {
    const rows = findOwners(dataset, catalog, {});
    expect(names(rows)).toEqual(['Zed', 'Abby', 'Brakk', 'Kai']);
    expect(rows[0].pieces).toBe(6);
    expect(rows[0].detail).toBe('Cataclysmic 1 · Malevolent 4 · Vindictive 1');
  });

  it('counts the two Legion ids of one piece once', () => {
    const rows = findOwners(dataset, catalog, { season: 'vindictive' });
    expect(rows.map(row => [row.character.name, row.pieces, row.detail])).toEqual([['Kai', 1, 'Back'], ['Zed', 1, 'Head']]);
  });

  it('names the slots of one season, with a count where a slot holds two pieces', () => {
    const [zed] = findOwners(dataset, catalog, { classId: 6, season: 'malevolent' });
    expect(zed.detail).toBe('Head · Shoulder · Feet ×2');
  });

  it('filters by the character\'s class and realm', () => {
    expect(names(findOwners(dataset, catalog, { classId: 6 }))).toEqual(['Zed', 'Abby']);
    expect(names(findOwners(dataset, catalog, { realm: 'evermoon' }))).toEqual(['Abby']);
  });

  it('lists a season\'s elite weapon owners with the weapons they have', () => {
    const rows = findOwners(dataset, catalog, { other: { kind: 'weapons', season: 'wrathful' } });
    expect(rows.map(row => [row.character.name, row.detail])).toEqual([['Brakk', 'Recurve']]);
  });

  it('lists a rare item\'s owners by name', () => {
    expect(names(findOwners(dataset, catalog, { other: { kind: 'item', id: 22818 } }))).toEqual(['Brakk', 'Nobody']);
  });
});

describe('the URL', () => {
  const params = (values: Record<string, string>) => (name: string) => values[name] ?? null;

  it('reads class, season, realm and the other pick', () => {
    expect(parseOwnerQuery(params({ class: '6', season: 'malevolent', realm: 'Tauri' })))
      .toEqual({ classId: 6, realm: 'tauri', season: 'malevolent', other: undefined });
    expect(parseOwnerQuery(params({ item: '22818', season: 'malevolent' })))
      .toEqual({ classId: undefined, realm: undefined, season: undefined, other: { kind: 'item', id: 22818 } });
    expect(parseOwnerQuery(params({ weapons: 'wrathful', class: '99' })).other).toEqual({ kind: 'weapons', season: 'wrathful' });
  });

  it('drops a season the class has no pieces in, and picks the data doesn\'t know', () => {
    expect(fitOwnerQuery({ classId: 12, season: 'malevolent' }, dataset, catalog).season).toBeUndefined();
    expect(fitOwnerQuery({ other: { kind: 'item', id: 85046 } }, dataset, catalog).other).toBeUndefined();
    expect(fitOwnerQuery({ other: { kind: 'weapons', season: 'malevolent' } }, dataset, catalog).other).toBeUndefined();
    expect(fitOwnerQuery({ season: 'wrathful' }, dataset, catalog).season).toBeUndefined();
    expect(fitOwnerQuery({ classId: 6, season: 'malevolent' }, dataset, catalog)).toEqual({ classId: 6, realm: undefined, season: 'malevolent', other: undefined });
  });

  it('writes only what differs from the defaults', () => {
    expect(ownerUrlParams({}, 1)).toEqual({ class: null, season: null, item: null, weapons: null, realm: null, page: null });
    expect(ownerUrlParams({ classId: 6, season: 'malevolent', realm: 'tauri' }, 3))
      .toEqual({ class: 6, season: 'malevolent', item: null, weapons: null, realm: 'tauri', page: 3 });
    expect(ownerUrlParams({ other: { kind: 'weapons', season: 'wrathful' } }, 1).weapons).toBe('wrathful');
  });
});

describe('characterCount', () => {
  it('counts in the singular for one and groups thousands', () => {
    expect([characterCount(1), characterCount(0), characterCount(1234)]).toEqual(['1 character', '0 characters', '1,234 characters']);
  });
});

describe('emptyOwnersMessage', () => {
  it('blames the filters only when a class or realm is picked', () => {
    expect(emptyOwnersMessage({ season: 'malevolent' })).toBe('Nobody in the archive owns these yet.');
    expect(emptyOwnersMessage({ classId: 6 })).toBe('Nobody of this class or realm owns these yet.');
    expect(emptyOwnersMessage({ realm: 'wod' })).toBe('Nobody of this class or realm owns these yet.');
  });
});

describe('ownersHeading', () => {
  it('names what the list shows', () => {
    expect(ownersHeading(dataset, catalog, {})).toEqual({ eyebrow: 'Elite PvP set', title: 'All classes · All seasons' });
    expect(ownersHeading(dataset, catalog, { classId: 6, season: 'malevolent' }).title).toBe('Death Knight · Malevolent (Season 12)');
    expect(ownersHeading(dataset, catalog, { other: { kind: 'item', id: 22818 } })).toEqual({ eyebrow: 'Rare item', title: 'The Plague Bearer' });
    expect(ownersHeading(dataset, catalog, { other: { kind: 'weapons', season: 'wrathful' } }).title).toBe('Wrathful elite weapons (Season 8)');
  });
});
