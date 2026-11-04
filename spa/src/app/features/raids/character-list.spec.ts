import { describe, expect, it } from 'vitest';
import { Role } from '../../game/wow';
import { specById } from '../../game/wow-specs';
import { CharacterListEntry, CharacterListFile, characterListRows, decodeCharacterList } from './character-list';
import { RoleTierList, SPEC_TIERS, TierSpec, tierFor } from './raid-tier-list';

const WINDWALKER = 269;
const DESTRUCTION = 267;
const SHADOW = 258;
const DISCIPLINE = 256;
const BLOOD = 250;

function character(name: string, classId: number, spec: string): CharacterListEntry {
  return {
    name,
    class: classId,
    spec,
    level: 110,
    itemLevel: 850,
    traits: 20,
    artifactKnowledge: 15,
    campaign: false,
    orderHall: 2
  };
}

function tierSpec(id: number, percentOfBest: number): TierSpec {
  const spec = specById(id)!;
  return {
    id,
    classId: spec.classId,
    name: spec.spec,
    color: '',
    art: '',
    score: percentOfBest * 50,
    count: 20,
    percentOfBest,
    fewPlayers: false,
    note: '',
    label: '',
    rankingsQuery: {}
  };
}

function tierList(role: Role, ...specs: TierSpec[]): RoleTierList {
  return {
    role,
    title: role,
    characterCount: 100,
    rows: SPEC_TIERS.map(tier => ({ tier, specs: specs.filter(spec => tierFor(spec.percentOfBest) === tier) })),
    unplayed: []
  };
}

const mythicTiers = [
  tierList('dps', tierSpec(WINDWALKER, 100), tierSpec(DESTRUCTION, 94), tierSpec(SHADOW, 68)),
  tierList('healer', tierSpec(DISCIPLINE, 100)),
  tierList('tank', tierSpec(BLOOD, 100))
];

describe('decodeCharacterList', () => {
  const file: CharacterListFile = {
    version: 1,
    realm: 'Evermoon',
    generatedAt: '2026-11-04T21:05:20Z',
    characters: [character('Xyhop', 5, 'Shadow')]
  };

  it('reads the realm, the characters and when they were read', () => {
    const list = decodeCharacterList(file);

    expect(list.realm).toBe('Evermoon');
    expect(list.generatedAt.toISOString()).toBe('2026-11-04T21:05:20.000Z');
    expect(list.characters.map(entry => entry.name)).toEqual(['Xyhop']);
  });

  it('refuses a file of another format version rather than misreading it', () => {
    expect(() => decodeCharacterList({ ...file, version: 2 })).toThrow(/version 2/);
  });
});

describe('characterListRows', () => {
  it("orders the characters by their current spec's share of the best spec in its role", () => {
    const rows = characterListRows([
      character('Xyhop', 5, 'Shadow'),
      character('Xyhopwarlock', 9, 'Destruction'),
      character('Xyhopdk', 6, 'Blood'),
      character('Xyhopmonk', 10, 'Windwalker')
    ], mythicTiers);

    expect(rows.map(row => row.character.name)).toEqual(['Xyhopmonk', 'Xyhopdk', 'Xyhopwarlock', 'Xyhop']);
  });

  it('gives each character its spec and the tier and share that spec has', () => {
    const rows = characterListRows([character('Xyhop', 5, 'Shadow')], mythicTiers);

    expect(rows).toHaveLength(1);
    const [row] = rows;
    expect(row.spec?.id).toBe(SHADOW);
    expect(row.tier?.tier.label).toBe('C');
    expect(row.tier?.percentOfBest).toBe(68);
  });

  it('puts a spec without logs, or one the class does not have, last, by name', () => {
    const rows = characterListRows([
      character('Xyhopshaman', 7, 'Elemental'),
      character('Broken', 5, 'Brewmaster'),
      character('Xyhop', 5, 'Shadow')
    ], mythicTiers);

    expect(rows.map(row => row.character.name)).toEqual(['Xyhop', 'Broken', 'Xyhopshaman']);
    expect(rows[1].spec).toBeUndefined();
    expect(rows[2].spec?.spec).toBe('Elemental');
    expect(rows[2].tier).toBeUndefined();
  });

  it('keeps every character in name order while the tier list is still empty', () => {
    const rows = characterListRows([
      character('Xyhopwarlock', 9, 'Destruction'),
      character('Xyhop', 5, 'Shadow')
    ], []);

    expect(rows.map(row => row.character.name)).toEqual(['Xyhop', 'Xyhopwarlock']);
  });
});
