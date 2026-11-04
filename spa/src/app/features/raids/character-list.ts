import { LegionSpec, specFor } from '../../game/wow-specs';
import { RoleTierList, SpecTier } from './raid-tier-list';

export const CHARACTER_LIST_FILE = 'character-lists/xyhop.json';
export const CHARACTER_LIST_VERSION = 1;
export const TIER_LIST_DIFFICULTY = 'mythic';
export const MAX_LEVEL = 110;
export const ORDER_HALL_UPGRADES = 6;

export interface CharacterListEntry {
  name: string;
  class: number;
  spec: string;
  level: number;
  itemLevel: number | null;
  traits: number;
  artifactKnowledge: number;
  campaign: boolean;
  orderHall: number;
}

export interface CharacterListFile {
  version: number;
  realm: string;
  generatedAt: string;
  characters: CharacterListEntry[];
}

export interface CharacterList {
  realm: string;
  generatedAt: Date;
  characters: CharacterListEntry[];
}

export interface CharacterTier {
  tier: SpecTier;
  percentOfBest: number;
}

export interface CharacterListRow {
  character: CharacterListEntry;
  spec?: LegionSpec;
  tier?: CharacterTier;
}

interface Placement extends CharacterTier {
  position: number;
}

export function decodeCharacterList(file: CharacterListFile): CharacterList {
  if (file.version !== CHARACTER_LIST_VERSION) {
    throw new Error(`The character list is format version ${file.version}; this page reads version ${CHARACTER_LIST_VERSION}.`);
  }

  return { realm: file.realm, generatedAt: new Date(file.generatedAt), characters: file.characters };
}

export function characterListRows(
  characters: readonly CharacterListEntry[],
  tierLists: readonly RoleTierList[]
): CharacterListRow[] {
  const placements = specPlacements(tierLists);
  return characters
    .map(character => {
      const spec = specFor(character.class, character.spec);
      return { character, spec, placement: spec ? placements.get(spec.id) : undefined };
    })
    .sort((a, b) => comparePlacements(a.placement, b.placement) || a.character.name.localeCompare(b.character.name))
    .map(({ character, spec, placement }) => ({
      character,
      spec,
      tier: placement ? { tier: placement.tier, percentOfBest: placement.percentOfBest } : undefined
    }));
}

function specPlacements(tierLists: readonly RoleTierList[]): Map<number, Placement> {
  const specs = tierLists.flatMap(list => list.rows.flatMap(row => row.specs.map(spec => ({ spec, tier: row.tier }))));
  return new Map(specs.map(({ spec, tier }, position) => [spec.id, { tier, percentOfBest: spec.percentOfBest, position }]));
}

function comparePlacements(a: Placement | undefined, b: Placement | undefined): number {
  if (!a || !b) {
    return (a ? 0 : 1) - (b ? 0 : 1);
  }

  return b.percentOfBest - a.percentOfBest || a.position - b.position;
}
