import { getRaceIconPath } from '../../game/raceIconHelper';
import { RACE_NAMES } from '../../game/wow';
import { specById } from '../../game/wow-specs';
import { FilterDropdownOption, FilterDropdownValue } from '../../shared/filter-dropdown.types';
import { ScanChange, scanChanges } from '../../shared/scan-change';

export type ArenaBracket = '2v2' | '3v3';
export const ARENA_BRACKETS: readonly ArenaBracket[] = ['2v2', '3v3'];

export function parseArenaBracket(value: string | null): ArenaBracket {
  return ARENA_BRACKETS.find(bracket => bracket === value) ?? '2v2';
}

export const MIN_GAMES_OPTIONS = [50, 45, 40, 35, 30] as const;
export const DEFAULT_MIN_GAMES = 50;

export const MIN_GAMES_FILTER_OPTIONS: ReadonlyArray<FilterDropdownOption> = MIN_GAMES_OPTIONS.map(games => ({
  value: games,
  label: `${games}+ games`
}));

export function parseMinGames(value: FilterDropdownValue | null): number {
  return MIN_GAMES_OPTIONS.find(games => String(games) === String(value)) ?? DEFAULT_MIN_GAMES;
}

export const ARENA_PAGE_SIZE = 50;

export function arenaUrlParams(
  bracket: ArenaBracket,
  minGames: number,
  page: number
): { bracket: string | null; games: string | null; page: string | null } {
  return {
    bracket: bracket === '2v2' ? null : bracket,
    games: minGames === DEFAULT_MIN_GAMES ? null : String(minGames),
    page: page > 1 ? String(page) : null
  };
}

export function getArenaLadderFile(bracket: ArenaBracket): string {
  return `arena-ladder-${bracket}.json`;
}

export interface ArenaPlayer {
  guid: number;
  realm: string;
  name: string;
  class: number;
  race: number;
  gender: number;
  faction: number;
  guild: string;
  spec: number;
  games: number;
  wins: number;
  weekGames: number;
  weekWins: number;
  rating: number;
  peakRating: number;
  weekPeakRating: number;
  previousRating?: number;
  previousGames?: number;
}

export interface ArenaLadderFile {
  version: number;
  bracket: ArenaBracket;
  seasonStart: string;
  generatedAt: string;
  previousGeneratedAt?: string;
  players: ReadonlyArray<ArenaPlayer>;
}

export interface ArenaSpec {
  readonly name: string;
  readonly icon: string;
}

export interface ArenaRace {
  readonly name: string;
  readonly icon: string;
}

export interface ArenaPlayerRow extends ArenaPlayer {
  readonly isActive: boolean;
  readonly losses: number;
  readonly winRate: number;
  readonly lastSpec: ArenaSpec | undefined;
  readonly raceInfo: ArenaRace | undefined;
}

export function getArenaSpec(player: Pick<ArenaPlayer, 'class' | 'spec'>): ArenaSpec | undefined {
  const spec = specById(player.spec);
  return spec?.classId === player.class && spec.icon ? { name: spec.spec, icon: spec.icon } : undefined;
}

export function getArenaRace(player: Pick<ArenaPlayer, 'race' | 'gender'>): ArenaRace | undefined {
  const name = RACE_NAMES[player.race];
  return name ? { name, icon: getRaceIconPath(player.race, player.gender) } : undefined;
}

export type ArenaSortKey = 'games' | 'wins' | 'losses' | 'winRate' | 'rating';
export type SortDirection = 'asc' | 'desc';

export const REWARD_MIN_WINS = 50;

export interface ArenaTitle {
  readonly name: string;
  readonly slug: string;
  readonly topPerMille: number;
}

function title(name: string, topPerMille: number): ArenaTitle {
  return { name, slug: name.toLowerCase().replace(/\s+/g, '-'), topPerMille };
}

export const ARENA_TITLES: Readonly<Record<ArenaBracket, readonly ArenaTitle[]>> = {
  '2v2': [title('Gladiator', 6), title('Duelist', 30), title('Rival', 100), title('Challenger', 350)],
  '3v3': [
    title('Season Gladiator', 5),
    title('Gladiator', 30),
    title('Duelist', 100),
    title('Rival', 350),
    title('Challenger', 450)
  ]
};

export function formatTitleShare(arenaTitle: ArenaTitle): string {
  return `${arenaTitle.topPerMille / 10}%`;
}

export interface TitleCutoff {
  readonly title: ArenaTitle;
  readonly places: number;
  readonly rating: number | undefined;
  readonly ties: number;
}

export function getTitleCutoffs(rows: readonly ArenaPlayerRow[], titles: readonly ArenaTitle[]): TitleCutoff[] {
  const ratings = rows.filter(row => row.isActive).map(row => row.rating).sort((left, right) => right - left);
  const placeRatings = [...new Set(ratings)];
  let coveredPlaces = 0;
  let coveredPlayers = 0;

  return titles.map(arenaTitle => {
    const places = Math.min(ratings.length, Math.ceil((ratings.length * arenaTitle.topPerMille) / 1000));
    const reached = Math.min(places, placeRatings.length);
    if (reached <= coveredPlaces) {
      return { title: arenaTitle, places, rating: undefined, ties: 0 };
    }

    const rating = placeRatings[reached - 1];
    const players = ratings.filter(other => other >= rating).length;
    const ties = (players - coveredPlayers) - (reached - coveredPlaces);
    coveredPlaces = reached;
    coveredPlayers = players;

    return { title: arenaTitle, places, rating, ties };
  });
}

export function getTitle(rating: number, cutoffs: readonly TitleCutoff[]): TitleCutoff | undefined {
  return cutoffs.find(cutoff => cutoff.rating !== undefined && rating >= cutoff.rating);
}

export type ArenaGroup =
  | { readonly kind: 'title'; readonly cutoff: TitleCutoff }
  | { readonly kind: 'untitled' }
  | { readonly kind: 'inactive' };

export function arenaGroupHeadings(
  rows: readonly ArenaPlayerRow[],
  titleOf: (row: ArenaPlayerRow) => TitleCutoff | undefined,
  byTitle: boolean
): Map<number, ArenaGroup> {
  const headings = new Map<number, ArenaGroup>();
  let previousKey: string | undefined;

  rows.forEach((row, index) => {
    const group = rowGroup(row, titleOf, byTitle);
    const key = group?.kind === 'title' ? group.cutoff.title.slug : group?.kind;
    if (group && key !== previousKey) {
      headings.set(index, group);
    }
    previousKey = key;
  });

  return headings;
}

function rowGroup(
  row: ArenaPlayerRow,
  titleOf: (row: ArenaPlayerRow) => TitleCutoff | undefined,
  byTitle: boolean
): ArenaGroup | undefined {
  if (!row.isActive) {
    return { kind: 'inactive' };
  }
  if (!byTitle) {
    return undefined;
  }

  const cutoff = titleOf(row);
  return cutoff ? { kind: 'title', cutoff } : { kind: 'untitled' };
}

export function toArenaRows(players: readonly ArenaPlayer[], minGames: number): ArenaPlayerRow[] {
  return players.map(player => ({
    ...player,
    isActive: player.games >= minGames,
    losses: player.games - player.wins,
    winRate: player.wins / player.games,
    lastSpec: getArenaSpec(player),
    raceInfo: getArenaRace(player)
  }));
}

export function sortArenaRows<
  K extends ArenaSortKey,
  T extends Pick<ArenaPlayerRow, K | 'games' | 'name' | 'isActive'>
>(rows: readonly T[], key: K, direction: SortDirection): T[] {
  const sign = direction === 'asc' ? 1 : -1;

  return [...rows].sort((left, right) =>
    Number(right.isActive) - Number(left.isActive)
    || sign * (left[key] - right[key])
    || right.games - left.games
    || left.name.localeCompare(right.name)
  );
}

export function arenaPlayerKey(player: Pick<ArenaPlayer, 'realm' | 'guid'>): string {
  return `${player.realm}::${player.guid}`;
}

export function arenaRatingChanges(
  { players, previousGeneratedAt }: Pick<ArenaLadderFile, 'players' | 'previousGeneratedAt'>,
  minGames: number
): Map<string, ScanChange> {
  if (!previousGeneratedAt) {
    return new Map();
  }

  const current = sortArenaRows(toArenaRows(players, minGames), 'rating', 'desc');
  const previous = sortArenaRows(previousLadder(players, minGames), 'rating', 'desc');
  const changes = scanChanges(current, previous, arenaPlayerKey, player => player.rating);
  const wasInactive = new Set(previous.filter(player => !player.isActive).map(arenaPlayerKey));

  for (const player of current) {
    if (player.isActive && wasInactive.has(arenaPlayerKey(player))) {
      changes.set(arenaPlayerKey(player), { rank: 0, value: 0, isNew: true });
    }
  }

  return changes;
}

function previousLadder(
  players: readonly ArenaPlayer[],
  minGames: number
): Array<Pick<ArenaPlayerRow, 'realm' | 'guid' | 'name' | 'rating' | 'games' | 'isActive'>> {
  return players.flatMap(({ realm, guid, name, previousRating, previousGames }) =>
    previousRating !== undefined && previousGames !== undefined
      ? [{ realm, guid, name, rating: previousRating, games: previousGames, isActive: previousGames >= minGames }]
      : []
  );
}
