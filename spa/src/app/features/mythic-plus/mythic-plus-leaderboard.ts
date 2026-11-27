import { FilterDropdownOption } from '../../shared/filter-dropdown.types';
import { CLASS_NAMES, RoleFilter, matchesRoleFilter, realmSlug } from '../../game/wow';
import { fitClassAndSpecTo, specById, specFor, specsForRole } from '../../game/wow-specs';
import {
  MythicPlusDungeon,
  MythicPlusMember,
  MythicPlusPlayerEntry,
  MythicPlusRun,
  rankRuns,
  runIncludesCharacter,
  runIncludesPlayer
} from './mythic-plus';

export type LeaderboardView = 'runs' | 'players';

export type LeaderboardPeriod = 'season' | 'week';

export type RunOrder = 'best' | 'latest';

export interface RankedRun {
  run: MythicPlusRun;
  rank: number;
}

export interface MemberFilters {
  realm?: string;
  classId?: number;
  spec?: string;
  role?: RoleFilter;
}

export interface EmptyLeaderboard {
  view: LeaderboardView;
  period: LeaderboardPeriod;
  query: string;
  dungeon?: Pick<MythicPlusDungeon, 'name'>;
  character?: { name: string; realm: string };
  classId?: number;
  spec?: string;
  realmName?: string;
  role?: RoleFilter;
}

export function realmFilterOptions(players: readonly MythicPlusPlayerEntry[]): FilterDropdownOption[] {
  const counts = new Map<string, number>();
  for (const [, realm] of players) {
    counts.set(realm, (counts.get(realm) ?? 0) + 1);
  }

  return [
    { value: undefined, label: 'All realms' },
    ...[...counts].sort((a, b) => b[1] - a[1]).map(([realm]) => ({ value: realmSlug(realm), label: realm }))
  ];
}

export function memberFilter({ realm, classId, spec, role }: MemberFilters): ((member: MythicPlusMember) => boolean) | undefined {
  if (realm === undefined && classId === undefined && role === undefined) {
    return undefined;
  }

  return member => (realm === undefined || realmSlug(member.realm) === realm)
    && (classId === undefined || (member.class === classId && (spec === undefined || member.spec === spec)))
    && matchesRoleFilter(member, role);
}

export interface PlayerClassFilters {
  classId?: number;
  spec?: string;
}

export function fitFiltersToRole(role: RoleFilter | undefined, { classId, spec }: PlayerClassFilters): PlayerClassFilters {
  const specId = classId === undefined || spec === undefined ? undefined : specFor(classId, spec)?.id;
  const fitted = fitClassAndSpecTo(specsForRole(role), { classId, specId });
  return { classId: fitted.classId, spec: fitted.specId === undefined ? undefined : specById(fitted.specId)?.spec };
}

const ROLE_PLAYER_NOUNS: Readonly<Record<RoleFilter, string>> = {
  tank: 'tank',
  healer: 'healer',
  dps: 'DPS player',
  melee: 'melee DPS player',
  ranged: 'ranged DPS player'
};

export function rolePlayerNoun(role: RoleFilter): string {
  return ROLE_PLAYER_NOUNS[role];
}

function playerNoun(classId: number | undefined, spec: string | undefined, role: RoleFilter | undefined): string {
  const className = classId === undefined ? undefined : CLASS_NAMES[classId];
  if (className && spec) {
    return `${spec} ${className}`;
  }

  if (role) {
    return [className, rolePlayerNoun(role)].filter(Boolean).join(' ');
  }

  return className ?? 'player';
}

export function runsInScope(
  loaded: ReadonlyMap<string, readonly MythicPlusRun[]>,
  dungeons: readonly MythicPlusDungeon[],
  selected: MythicPlusDungeon | undefined,
  since: number | undefined
): readonly MythicPlusRun[] | undefined {
  const inPeriod = (runs: readonly MythicPlusRun[]) => since === undefined
    ? runs
    : runs.filter(run => Date.parse(run.completedAt) >= since);
  if (selected) {
    const runs = loaded.get(selected.id);
    return runs && rankRuns(inPeriod(runs));
  }

  if (dungeons.some(entry => !loaded.has(entry.id))) {
    return undefined;
  }

  return rankRuns(inPeriod(dungeons.flatMap(entry => loaded.get(entry.id) ?? [])));
}

export function filterRuns(
  ranked: readonly RankedRun[],
  character: string | undefined,
  query: string,
  order: RunOrder
): readonly RankedRun[] {
  const rows = character
    ? ranked.filter(entry => runIncludesCharacter(entry.run, character))
    : query.trim() ? ranked.filter(entry => runIncludesPlayer(entry.run, query)) : ranked;
  return order === 'latest'
    ? [...rows].sort((a, b) => Date.parse(b.run.completedAt) - Date.parse(a.run.completedAt) || a.rank - b.rank)
    : rows;
}

export function emptyLeaderboardMessage(state: EmptyLeaderboard): string {
  const { view, period, dungeon, character, classId, realmName, role } = state;
  const query = state.query.trim();

  if (character && view === 'runs') {
    return `No runs with ${character.name} (${character.realm})${dungeon ? ` in ${dungeon.name}` : ''}.`;
  }

  if (query) {
    const subject = view === 'players' ? 'No players matching' : 'No runs with a player matching';
    return `${subject} "${query}"${dungeon ? ` in ${dungeon.name}` : ''}.`;
  }

  if (view === 'players' && (classId !== undefined || realmName || role)) {
    return `No ${playerNoun(classId, state.spec, role)}${realmName ? ` on ${realmName}` : ''} has a run${dungeon ? ` in ${dungeon.name}` : ''} yet.`;
  }

  if (period === 'week') {
    return dungeon ? `No ${dungeon.name} runs yet this week.` : 'No runs yet this week.';
  }

  return dungeon ? `No ${dungeon.name} runs recorded yet.` : 'No runs recorded yet this season.';
}
