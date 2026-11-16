import { describe, expect, it } from 'vitest';
import { RareItemFinding, RareItemFindingsFile, findingScans } from './rare-item-findings';
import { ElitePvpItemsFile, decodeEliteCatalog } from './rare-items';

const CATALOG_FILE: ElitePvpItemsFile = {
  version: 1,
  seasons: [
    ['cataclysmic', 'Cataclysmic', 'Season 11'],
    ['malevolent', 'Malevolent', 'Season 12'],
    ['vindictive', 'Vindictive', 'Legion Season 1']
  ],
  items: [
    [73740, 'cataclysmic', [6], 'Head', "Cataclysmic Gladiator's Dreadplate Helm"],
    [85046, 'malevolent', [6], 'Head', "Malevolent Gladiator's Dreadplate Helm"],
    [85086, 'malevolent', [6], 'Shoulder', "Malevolent Gladiator's Dreadplate Shoulders"],
    [85090, 'malevolent', [6], 'Two-hand', "Malevolent Gladiator's Decapitator"],
    [136046, 'vindictive', [6], 'Head', "Vindictive Gladiator's Dreadplate Helm"],
    [136159, 'vindictive', [6], 'Head', "Vindictive Gladiator's Dreadplate Helm"]
  ]
};

const catalog = decodeEliteCatalog(CATALOG_FILE);

const TONIGHT = '2026-11-16T01:34:28.8498678+00:00';
const LAST_NIGHT = '2026-11-15T02:35:11.7834473+00:00';
const BEFORE = '2026-11-14T02:31:47.5228886+00:00';

const ITEM_NAMES: Record<number, string> = {
  22818: 'The Plague Bearer',
  98162: "Tyrannical Gladiator's Tabard"
};

function finding(name: string, scan: string, itemIds: number[], isNew = true, realm = 'Evermoon'): RareItemFinding {
  return {
    scan,
    name,
    realm,
    race: 1,
    gender: 0,
    class: 6,
    guild: '',
    isNew,
    items: itemIds.map(id => ({ id, name: ITEM_NAMES[id] ?? catalog.items.get(id)?.name ?? `Item ${id}` }))
  };
}

function file(characters: RareItemFinding[]): RareItemFindingsFile {
  return {
    version: 1,
    scans: [
      { generatedAt: TONIGHT, previousGeneratedAt: LAST_NIGHT },
      { generatedAt: LAST_NIGHT, previousGeneratedAt: BEFORE }
    ],
    characters
  };
}

describe('findingScans', () => {
  it('lists every scan newest first, each with its own findings', () => {
    const scans = findingScans(file([finding('Hsbgd', TONIGHT, [22818]), finding('Dynos', LAST_NIGHT, [73740])]), catalog);

    expect(scans.map(scan => scan.key)).toEqual([TONIGHT, LAST_NIGHT]);
    expect(scans.map(scan => scan.isLatest)).toEqual([true, false]);
    expect(scans[0].scannedAt.toISOString()).toBe('2026-11-16T01:34:28.849Z');
    expect(scans.map(scan => scan.rows.map(row => row.character.name))).toEqual([['Hsbgd'], ['Dynos']]);
    expect(scans.map(scan => scan.count)).toEqual(['1 character', '1 character']);
  });

  it('keeps a scan that found nothing, with no rows', () => {
    const scans = findingScans(file([finding('Hsbgd', TONIGHT, [22818])]), catalog);

    expect(scans[1].rows).toEqual([]);
    expect(scans[1].count).toBe('0 characters');
  });

  it('puts new characters first, then the most items, then the name', () => {
    const scans = findingScans(file([
      finding('Known', TONIGHT, [73740, 85046, 85086], false),
      finding('Zed', TONIGHT, [22818]),
      finding('Abby', TONIGHT, [22818]),
      finding('Most', TONIGHT, [85046, 85086])
    ]), catalog);

    expect(scans[0].rows.map(row => row.character.name)).toEqual(['Most', 'Abby', 'Zed', 'Known']);
  });

  it('counts a piece once however many of its ids were found, and every other item once', () => {
    const [scan] = findingScans(file([finding('Legion', TONIGHT, [136046, 136159, 85090, 22818, 98162])]), catalog);

    expect(scan.rows[0].found).toBe(4);
  });

  it('sums up the pieces by season, oldest first, then names the other items', () => {
    const [scan] = findingScans(file([finding('Mixed', TONIGHT, [98162, 136046, 136159, 85046, 85090, 73740, 22818])]), catalog);

    expect(scan.rows[0].detail).toBe("Cataclysmic 1 · Malevolent 2 · Vindictive 1 · Tyrannical Gladiator's Tabard · The Plague Bearer");
  });

  it('gives each row its icons, names and key', () => {
    const [scan] = findingScans(file([finding('Hsbgd', TONIGHT, [22818], true, 'Tauri')]), catalog);

    expect(scan.rows[0]).toMatchObject({
      key: 'Tauri::Hsbgd',
      raceName: 'Human',
      className: 'Death Knight',
      raceIcon: expect.stringContaining('/'),
      classIcon: expect.stringContaining('/')
    });
  });

  it('refuses another version of the file', () => {
    expect(() => findingScans({ ...file([]), version: 2 }, catalog)).toThrow();
  });
});
