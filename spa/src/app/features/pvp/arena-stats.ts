import { DamageRange, ROLE_FILTER_LABELS, RoleFilter } from '../../game/wow';
import { specById } from '../../game/wow-specs';
import { RaceSample } from '../../shared/spec-charts/race-popularity';
import { ArenaBracket, ArenaPlayer } from './arena-games';

const RATING_FLOORS = [1500, 1750, 2000, 2200, 2500] as const;

export interface ArenaRatingOption {
  readonly value: number | undefined;
  readonly label: string;
  readonly title: string;
}

export const ARENA_RATING_OPTIONS: readonly ArenaRatingOption[] = [
  { value: undefined, label: 'All', title: 'Every character on the ladder' },
  ...RATING_FLOORS.map(floor => ({ value: floor, label: `${floor}+`, title: `Current rating ${floor} and higher` }))
];

export function parseRatingFloor(value: string | null): number | undefined {
  return RATING_FLOORS.find(floor => String(floor) === value);
}

export interface ArenaStatsUrlState {
  readonly bracket: ArenaBracket;
  readonly ratingFloor?: number;
  readonly role?: RoleFilter;
}

export interface ArenaStatsUrlParams {
  readonly bracket: string | null;
  readonly rating: string | null;
  readonly role: string | null;
}

export function arenaStatsUrlParams({ bracket, ratingFloor, role }: ArenaStatsUrlState): ArenaStatsUrlParams {
  return {
    bracket: bracket === '2v2' ? null : bracket,
    rating: ratingFloor === undefined ? null : String(ratingFloor),
    role: role ?? null
  };
}

export interface ArenaSpecSample extends RaceSample {
  readonly range: DamageRange | undefined;
}

export function arenaSpecSamples(players: readonly ArenaPlayer[], ratingFloor = 0): ArenaSpecSample[] {
  return players.flatMap(player => {
    const spec = specById(player.spec);
    if (!spec || spec.classId !== player.class || player.rating < ratingFloor) {
      return [];
    }

    return [{
      name: player.name,
      realm: player.realm,
      class: player.class,
      spec: spec.spec,
      role: spec.role,
      range: spec.range,
      race: player.race
    }];
  });
}

function ratingLabel(ratingFloor: number | undefined): string {
  return ratingFloor === undefined ? 'All ratings' : `Current rating ${ratingFloor}+`;
}

export interface ArenaStatsSubtitle extends ArenaStatsUrlState {
  readonly total: number;
}

export function arenaStatsSubtitle({ bracket, ratingFloor, role, total }: ArenaStatsSubtitle): string {
  return [
    `Rated ${bracket} arena`,
    role ? ROLE_FILTER_LABELS[role] : 'All roles',
    ratingLabel(ratingFloor),
    `${total.toLocaleString('en-US')} ${total === 1 ? 'character' : 'characters'}`,
    'Grouped by popularity'
  ].join(' · ');
}

export function arenaRaceContext(bracket: ArenaBracket, ratingFloor?: number): string {
  return ratingFloor === undefined ? `Rated ${bracket} arena` : `Rated ${bracket} arena · ${ratingLabel(ratingFloor)}`;
}

export function arenaStatsEmptyText(bracket: ArenaBracket, ratingFloor?: number, role?: RoleFilter): string {
  if (role === undefined) {
    return ratingFloor === undefined
      ? `Nobody is on the ${bracket} ladder yet.`
      : `Nobody in ${bracket} is rated ${ratingFloor} or higher right now.`;
  }

  const players = `No ${ROLE_FILTER_LABELS[role]} players`;
  return ratingFloor === undefined
    ? `${players} are on the ${bracket} ladder yet.`
    : `${players} in ${bracket} are rated ${ratingFloor} or higher right now.`;
}
