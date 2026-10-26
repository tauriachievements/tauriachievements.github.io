import { CLASS_NAMES, parseClassId, parseRealmSlug, realmSlug } from '../../game/wow';
import { parseInteger } from '../../core/url-state';
import { FilterDropdownOption, FilterDropdownValue } from '../../shared/filter-dropdown.types';

export interface RareItem {
  readonly id: number;
  readonly name: string;
}

export interface RareItemCharacter {
  readonly name: string;
  readonly realm: string;
  readonly race: number;
  readonly gender: number;
  readonly class: number;
  readonly guild: string;
  readonly items: ReadonlyArray<RareItem>;
}

export interface RareItemsDataset {
  readonly generatedAt: string;
  readonly items: ReadonlyArray<RareItem>;
  readonly characters: ReadonlyArray<RareItemCharacter>;
}

export const ELITE_PVP_ITEMS_VERSION = 1;

export interface ElitePvpItemsFile {
  readonly version: number;
  readonly seasons: ReadonlyArray<readonly [key: string, name: string, label: string]>;
  readonly items: ReadonlyArray<readonly [id: number, season: string, classes: ReadonlyArray<number>, slot: string, name: string]>;
}

export interface EliteSeason {
  readonly key: string;
  readonly name: string;
  readonly label: string;
}

export interface EliteItem {
  readonly id: number;
  readonly season: EliteSeason;
  readonly classes: ReadonlyArray<number>;
  readonly slot: string;
  readonly name: string;
  readonly isWeapon: boolean;
}

export interface EliteCatalog {
  readonly seasons: ReadonlyArray<EliteSeason>;
  readonly items: ReadonlyMap<number, EliteItem>;
}

export type OtherPick =
  | { readonly kind: 'item'; readonly id: number }
  | { readonly kind: 'weapons'; readonly season: string };

export interface OwnerQuery {
  readonly classId?: number;
  readonly realm?: string;
  readonly season?: string;
  readonly other?: OtherPick;
}

export interface OwnerRow {
  readonly key: string;
  readonly character: RareItemCharacter;
  readonly pieces: number;
  readonly detail: string;
}

export const ARMOR_SLOTS: ReadonlyArray<string> = ['Head', 'Shoulder', 'Chest', 'Hands', 'Legs', 'Waist', 'Feet', 'Wrist', 'Back'];

export function decodeEliteCatalog(file: ElitePvpItemsFile): EliteCatalog {
  if (file.version !== ELITE_PVP_ITEMS_VERSION) {
    throw new Error(`Unsupported elite PvP item list version ${file.version}.`);
  }

  const seasons = file.seasons.map(([key, name, label]) => ({ key, name, label }));
  const seasonsByKey = new Map(seasons.map(season => [season.key, season]));
  const items = new Map<number, EliteItem>();
  for (const [id, seasonKey, classes, slot, name] of file.items) {
    const season = seasonsByKey.get(seasonKey);
    if (season) {
      items.set(id, { id, season, classes, slot, name, isWeapon: !ARMOR_SLOTS.includes(slot) });
    }
  }

  return { seasons, items };
}

export function seasonLabel(season: EliteSeason): string {
  return `${season.name} (${season.label})`;
}

export function weaponsLabel(season: EliteSeason): string {
  return `${season.name} elite weapons (${season.label})`;
}

export const ALL_SEASONS_OPTION: FilterDropdownOption = { value: undefined, label: 'All seasons' };

export const NO_OTHER_ITEM_OPTION: FilterDropdownOption = { value: undefined, label: 'Choose an item' };

export function eliteSeasonOptions(catalog: EliteCatalog, classId?: number): FilterDropdownOption[] {
  const offered = new Set<string>();
  for (const item of catalog.items.values()) {
    if (!item.isWeapon && (classId === undefined || item.classes.includes(classId))) {
      offered.add(item.season.key);
    }
  }

  return [
    ALL_SEASONS_OPTION,
    ...catalog.seasons.filter(season => offered.has(season.key)).map(season => ({ value: season.key, label: seasonLabel(season) }))
  ];
}

export function otherItemOptions(dataset: RareItemsDataset, catalog: EliteCatalog): FilterDropdownOption[] {
  const weaponSeasons = new Set([...catalog.items.values()].filter(item => item.isWeapon).map(item => item.season.key));
  return [
    NO_OTHER_ITEM_OPTION,
    ...dataset.items.filter(item => !catalog.items.has(item.id)).map(item => ({ value: item.id, label: item.name })),
    ...catalog.seasons.filter(season => weaponSeasons.has(season.key)).map(season => ({ value: season.key, label: weaponsLabel(season) }))
  ];
}

export function otherPickFromValue(value: FilterDropdownValue): OtherPick | undefined {
  if (typeof value === 'number') {
    return { kind: 'item', id: value };
  }

  return typeof value === 'string' ? { kind: 'weapons', season: value } : undefined;
}

export function otherPickValue(pick: OtherPick | undefined): FilterDropdownValue {
  return pick?.kind === 'item' ? pick.id : pick?.season;
}

export function parseOwnerQuery(param: (name: string) => string | null): OwnerQuery {
  const itemId = parseInteger(param('item'));
  const weapons = param('weapons');
  const other: OtherPick | undefined = itemId !== undefined
    ? { kind: 'item', id: itemId }
    : weapons ? { kind: 'weapons', season: weapons } : undefined;

  return {
    classId: parseClassId(param('class')),
    realm: parseRealmSlug(param('realm')),
    season: other ? undefined : param('season') ?? undefined,
    other
  };
}

export function fitOwnerQuery(query: OwnerQuery, dataset: RareItemsDataset, catalog: EliteCatalog): OwnerQuery {
  const otherValue = otherPickValue(query.other);
  const other = otherItemOptions(dataset, catalog).some(option => option.value !== undefined && option.value === otherValue)
    ? query.other
    : undefined;
  const season = !other && eliteSeasonOptions(catalog, query.classId).some(option => option.value !== undefined && option.value === query.season)
    ? query.season
    : undefined;

  return { classId: query.classId, realm: query.realm, season, other };
}

export type OwnerUrlParams = {
  readonly class: number | null;
  readonly season: string | null;
  readonly item: number | null;
  readonly weapons: string | null;
  readonly realm: string | null;
  readonly page: number | null;
};

export function ownerUrlParams(query: OwnerQuery, page: number): OwnerUrlParams {
  return {
    class: query.classId ?? null,
    season: query.season ?? null,
    item: query.other?.kind === 'item' ? query.other.id : null,
    weapons: query.other?.kind === 'weapons' ? query.other.season : null,
    realm: query.realm ?? null,
    page: page > 1 ? page : null
  };
}

export function findOwners(dataset: RareItemsDataset, catalog: EliteCatalog, query: OwnerQuery): OwnerRow[] {
  const rows: OwnerRow[] = [];
  for (const character of dataset.characters) {
    if ((query.classId !== undefined && character.class !== query.classId)
      || (query.realm !== undefined && realmSlug(character.realm) !== query.realm)) {
      continue;
    }

    const row = ownerRow(character, catalog, query);
    if (row) {
      rows.push(row);
    }
  }

  return rows.sort((left, right) => right.pieces - left.pieces
    || left.character.name.localeCompare(right.character.name)
    || left.character.realm.localeCompare(right.character.realm));
}

function ownerRow(character: RareItemCharacter, catalog: EliteCatalog, query: OwnerQuery): OwnerRow | undefined {
  const key = `${character.realm}::${character.name}`;
  const other = query.other;
  if (other?.kind === 'item') {
    return character.items.some(item => item.id === other.id) ? { key, character, pieces: 1, detail: '' } : undefined;
  }

  const wanted = (item: EliteItem) => other
    ? item.isWeapon && item.season.key === other.season
    : !item.isWeapon && (query.season === undefined || item.season.key === query.season);
  const pieces = distinctPieces(character.items
    .map(item => catalog.items.get(item.id))
    .filter((item): item is EliteItem => item !== undefined && wanted(item)));
  if (!pieces.length) {
    return undefined;
  }

  return { key, character, pieces: pieces.length, detail: pieceDetail(pieces, catalog, query) };
}

function distinctPieces(items: ReadonlyArray<EliteItem>): EliteItem[] {
  const seen = new Map<string, EliteItem>();
  for (const item of items) {
    const piece = `${item.season.key}|${item.slot}|${item.name}`;
    if (!seen.has(piece)) {
      seen.set(piece, item);
    }
  }

  return [...seen.values()];
}

function pieceDetail(pieces: ReadonlyArray<EliteItem>, catalog: EliteCatalog, query: OwnerQuery): string {
  if (query.other) {
    return pieces.map(piece => pieceName(piece.name)).sort((left, right) => left.localeCompare(right)).join(' · ');
  }

  if (query.season === undefined) {
    return catalog.seasons
      .map(season => ({ season, count: pieces.filter(piece => piece.season === season).length }))
      .filter(entry => entry.count > 0)
      .map(entry => `${entry.season.name} ${entry.count}`)
      .join(' · ');
  }

  return ARMOR_SLOTS
    .map(slot => ({ slot, count: pieces.filter(piece => piece.slot === slot).length }))
    .filter(entry => entry.count > 0)
    .map(entry => entry.count > 1 ? `${entry.slot} ×${entry.count}` : entry.slot)
    .join(' · ');
}

function pieceName(name: string): string {
  const marker = "Gladiator's ";
  const at = name.indexOf(marker);
  return at === -1 ? name : name.slice(at + marker.length);
}

export function characterCount(count: number): string {
  return `${count.toLocaleString('en-US')} ${count === 1 ? 'character' : 'characters'}`;
}

export function emptyOwnersMessage(query: OwnerQuery): string {
  return query.classId !== undefined || query.realm !== undefined
    ? 'Nobody of this class or realm owns these yet.'
    : 'Nobody in the archive owns these yet.';
}

export function ownersHeading(dataset: RareItemsDataset, catalog: EliteCatalog, query: OwnerQuery): { eyebrow: string; title: string } {
  const other = query.other;
  if (other?.kind === 'item') {
    return { eyebrow: 'Rare item', title: dataset.items.find(item => item.id === other.id)?.name ?? '' };
  }

  if (other?.kind === 'weapons') {
    const season = catalog.seasons.find(entry => entry.key === other.season);
    return { eyebrow: 'Elite weapons', title: season ? weaponsLabel(season) : '' };
  }

  const season = catalog.seasons.find(entry => entry.key === query.season);
  const className = query.classId === undefined ? 'All classes' : CLASS_NAMES[query.classId];
  return { eyebrow: 'Elite PvP set', title: `${className} · ${season ? seasonLabel(season) : 'All seasons'}` };
}
