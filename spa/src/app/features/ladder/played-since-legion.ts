import { realmSlug } from '../../game/wow';
import { foldName } from '../../shared/search-suggestions';

export const PLAYED_SINCE_LEGION_FILE = 'assets/data/played-since-legion.snapshot.json';
export const PLAYED_SINCE_LEGION_PAGE_SIZE = 50;

export interface PlayedSinceLegionEntry {
  readonly name: string;
  readonly realm: string;
  readonly faction: string;
  readonly race: number;
  readonly gender: number;
  readonly class: number;
  readonly guild: string;
  readonly played: number;
}

export interface PlayedSinceLegionFile {
  readonly v: number;
  readonly launch: string;
  readonly launchScan: string | null;
  readonly generatedAt: string | null;
  readonly players: readonly PlayedSinceLegionEntry[];
}

export interface PlayedSinceLegionRow extends PlayedSinceLegionEntry {
  readonly rank: number;
  readonly perDay: number;
}

export interface PlayedSinceLegionFilters {
  readonly realm?: string;
  readonly classId?: number;
  readonly search?: string;
}

export interface PlayedSinceLegionUrlState extends PlayedSinceLegionFilters {
  readonly page: number;
}

export interface PlayedSinceLegionUrlParams {
  readonly realm: string | null;
  readonly class: string | null;
  readonly q: string | null;
  readonly page: string | null;
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const SERVER_DATE_TIME = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Europe/Budapest',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
});

export function playedSinceLegionRows(
  file: PlayedSinceLegionFile,
  { realm, classId, search }: PlayedSinceLegionFilters
): PlayedSinceLegionRow[] {
  const days = daysSinceLaunch(file);
  const needle = foldName(search?.trim() ?? '');

  return file.players
    .filter(player => (!realm || realmSlug(player.realm) === realm) && (classId === undefined || player.class === classId))
    .map((player, index) => ({ ...player, rank: index + 1, perDay: days > 0 ? player.played / days : 0 }))
    .filter(row => !needle || foldName(row.name).includes(needle) || foldName(row.guild).includes(needle));
}

export function launchLabel(launch: string): string {
  return SERVER_DATE_TIME.format(new Date(launch)).replace(' at ', ', ');
}

export function playedSinceLegionUrlParams({ realm, classId, search, page }: PlayedSinceLegionUrlState): PlayedSinceLegionUrlParams {
  const query = search?.trim();
  return {
    realm: realm ?? null,
    class: classId === undefined ? null : String(classId),
    q: query ? query : null,
    page: page > 1 ? String(page) : null
  };
}

function daysSinceLaunch({ launch, generatedAt }: PlayedSinceLegionFile): number {
  return generatedAt ? (Date.parse(generatedAt) - Date.parse(launch)) / MS_PER_DAY : 0;
}
