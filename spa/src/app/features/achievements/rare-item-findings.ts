import { EliteCatalog, EliteItem, OwnerIdentity, RareItem, RareItemCharacter, characterCount, distinctPieces, ownerIdentity } from './rare-items';

export const RARE_ITEM_FINDINGS_VERSION = 1;

export interface RareItemFindingsScan {
  readonly generatedAt: string;
  readonly previousGeneratedAt: string;
}

export interface RareItemFinding extends RareItemCharacter {
  readonly scan: string;
  readonly isNew: boolean;
}

export interface RareItemFindingsFile {
  readonly version: number;
  readonly scans: ReadonlyArray<RareItemFindingsScan>;
  readonly characters: ReadonlyArray<RareItemFinding>;
}

export interface FindingRow extends OwnerIdentity {
  readonly character: RareItemFinding;
  readonly found: number;
  readonly detail: string;
}

export interface FindingsScan {
  readonly key: string;
  readonly scannedAt: Date;
  readonly isLatest: boolean;
  readonly count: string;
  readonly rows: ReadonlyArray<FindingRow>;
}

export function findingScans(file: RareItemFindingsFile, catalog: EliteCatalog): FindingsScan[] {
  if (file.version !== RARE_ITEM_FINDINGS_VERSION) {
    throw new Error(`Unsupported rare item findings version ${file.version}.`);
  }

  return file.scans.map((scan, index) => {
    const rows = file.characters
      .filter(character => character.scan === scan.generatedAt)
      .map(character => findingRow(character, catalog))
      .sort(compareRows);

    return {
      key: scan.generatedAt,
      scannedAt: new Date(scan.generatedAt),
      isLatest: index === 0,
      count: characterCount(rows.length),
      rows
    };
  });
}

function findingRow(character: RareItemFinding, catalog: EliteCatalog): FindingRow {
  const pieces = distinctPieces(character.items
    .map(item => catalog.items.get(item.id))
    .filter((item): item is EliteItem => item !== undefined));
  const others = distinctItems(character.items.filter(item => !catalog.items.has(item.id)));
  const seasons = catalog.seasons
    .map(season => ({ season, count: pieces.filter(piece => piece.season === season).length }))
    .filter(entry => entry.count > 0)
    .map(entry => `${entry.season.name} ${entry.count}`);

  return {
    ...ownerIdentity(character),
    character,
    found: pieces.length + others.length,
    detail: [...seasons, ...others.map(item => item.name)].join(' · ')
  };
}

function distinctItems(items: ReadonlyArray<RareItem>): RareItem[] {
  return [...new Map(items.map(item => [item.id, item])).values()];
}

function compareRows(left: FindingRow, right: FindingRow): number {
  return Number(right.character.isNew) - Number(left.character.isNew)
    || right.found - left.found
    || left.character.name.localeCompare(right.character.name)
    || left.character.realm.localeCompare(right.character.realm);
}
