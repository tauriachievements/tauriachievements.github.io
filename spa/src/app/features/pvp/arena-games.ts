import { specById } from '../../game/wow-specs';
import { ScanChange, scanChanges } from '../../shared/scan-change';

export type ArenaBracket = '2v2' | '3v3';
export const ARENA_BRACKETS: readonly ArenaBracket[] = ['2v2', '3v3'];

export function parseArenaBracket(value: string | null): ArenaBracket {
  return ARENA_BRACKETS.find(bracket => bracket === value) ?? '2v2';
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

export interface ArenaPlayerRow extends ArenaPlayer {
  readonly losses: number;
  readonly winRate: number;
  readonly lastSpec: ArenaSpec | undefined;
}

export function getArenaSpec(player: Pick<ArenaPlayer, 'class' | 'spec'>): ArenaSpec | undefined {
  const spec = specById(player.spec);
  return spec?.classId === player.class && spec.icon ? { name: spec.spec, icon: spec.icon } : undefined;
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
  const ratings = rows.map(row => row.rating).sort((left, right) => right - left);
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

export function toArenaRows(players: readonly ArenaPlayer[], minGames: number): ArenaPlayerRow[] {
  return players
    .filter(player => player.games >= minGames)
    .map(player => ({
      ...player,
      losses: player.games - player.wins,
      winRate: player.wins / player.games,
      lastSpec: getArenaSpec(player)
    }));
}

export function sortArenaRows<K extends ArenaSortKey, T extends Pick<ArenaPlayerRow, K | 'games' | 'name'>>(
  rows: readonly T[],
  key: K,
  direction: SortDirection
): T[] {
  const sign = direction === 'asc' ? 1 : -1;

  return [...rows].sort((left, right) =>
    sign * (left[key] - right[key])
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
  return scanChanges(current, previous, arenaPlayerKey, player => player.rating);
}

function previousLadder(
  players: readonly ArenaPlayer[],
  minGames: number
): Array<Pick<ArenaPlayer, 'realm' | 'guid' | 'name' | 'rating' | 'games'>> {
  return players.flatMap(({ realm, guid, name, previousRating, previousGames }) =>
    previousRating !== undefined && previousGames !== undefined && previousGames >= minGames
      ? [{ realm, guid, name, rating: previousRating, games: previousGames }]
      : []
  );
}
