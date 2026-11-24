import { CLASSES_BY_NAME, DamageRange, Role } from '../../game/wow';
import { specFor } from '../../game/wow-specs';
import { foldName } from '../../shared/search-suggestions';

export const RATED_BG_ROSTER_FILE = 'rated-bg-roster.json';
export const RATED_BG_ROSTER_VERSION = 1;
export const TEAM_SIZE = 10;
export const PICK_COUNT = 2 * TEAM_SIZE;

export interface RatedBgRosterEntry {
  readonly name: string;
  readonly realm: string;
  readonly notFound?: boolean;
  readonly race?: number;
  readonly gender?: number;
  readonly class?: number;
  readonly spec?: string;
  readonly traits?: number;
  readonly itemLevel?: number;
}

export interface RatedBgRosterFile {
  readonly version: number;
  readonly generatedAt: string;
  readonly players: readonly RatedBgRosterEntry[];
}

export interface RosterPlayer {
  readonly key: string;
  readonly name: string;
  readonly realm: string;
  readonly found: boolean;
  readonly race: number;
  readonly gender: number;
  readonly classId: number;
  readonly spec?: string;
  readonly role?: Role;
  readonly range?: DamageRange;
  readonly traits?: number;
  readonly itemLevel?: number;
}

export type Teams = readonly [readonly RosterPlayer[], readonly RosterPlayer[]];

export interface TeamSummary {
  readonly healers: number;
  readonly averageItemLevel?: number;
}

export function rosterPlayers(file: RatedBgRosterFile): RosterPlayer[] {
  if (file.version !== RATED_BG_ROSTER_VERSION) {
    throw new Error(`The player list is in format ${file.version}, and this page reads format ${RATED_BG_ROSTER_VERSION}.`);
  }

  return file.players.map(toRosterPlayer).sort(byName);
}

export type RosterGroupId = 'melee' | 'ranged' | 'healers';

export interface RosterClass {
  readonly classId: number;
  readonly players: readonly RosterPlayer[];
}

export interface RosterGroup {
  readonly id: RosterGroupId;
  readonly label: string;
  readonly classes: readonly RosterClass[];
}

const ROSTER_GROUPS: readonly { readonly id: RosterGroupId; readonly label: string }[] = [
  { id: 'melee', label: 'Melee' },
  { id: 'ranged', label: 'Ranged' },
  { id: 'healers', label: 'Healers' }
];

export function rosterGroups(players: readonly RosterPlayer[]): RosterGroup[] {
  return ROSTER_GROUPS.map(group => ({
    ...group,
    classes: rosterClasses(players.filter(player => rosterGroupOf(player) === group.id))
  }));
}

export interface TeamGroup {
  readonly id: RosterGroupId;
  readonly label: string;
  readonly players: readonly RosterPlayer[];
}

export function teamGroups(team: readonly RosterPlayer[]): TeamGroup[] {
  return rosterGroups(team)
    .map(({ id, label, classes }) => ({ id, label, players: classes.flatMap(rosterClass => rosterClass.players) }))
    .filter(group => group.players.length > 0);
}

export function countHealers(players: readonly RosterPlayer[]): number {
  return players.filter(isHealer).length;
}

export function canShuffle(picked: readonly RosterPlayer[]): boolean {
  return picked.length === PICK_COUNT && countHealers(picked) % 2 === 0;
}

export function healerWarning(pickedHealers: number): string | undefined {
  if (pickedHealers % 2 === 0) {
    return undefined;
  }

  const ticked = pickedHealers === 1 ? '1 healer is' : `${pickedHealers} healers are`;
  return `Tick an even number of healers to shuffle: ${ticked} ticked.`;
}

export function togglePick(picked: ReadonlySet<string>, key: string): ReadonlySet<string> {
  if (!picked.has(key) && picked.size >= PICK_COUNT) {
    return picked;
  }

  const next = new Set(picked);
  if (!next.delete(key)) {
    next.add(key);
  }
  return next;
}

export function shuffleTeams(players: readonly RosterPlayer[], random: () => number = Math.random): Teams {
  const healers = players.filter(isHealer);
  const others = players.filter(player => !isHealer(player));
  let firstHealers = Math.floor(healers.length / 2);
  let firstOthers = Math.floor(others.length / 2);

  if (healers.length % 2 === 1 && others.length % 2 === 1) {
    if (random() < 0.5) {
      firstHealers++;
    } else {
      firstOthers++;
    }
  } else {
    firstHealers += healers.length % 2 === 1 && random() < 0.5 ? 1 : 0;
    firstOthers += others.length % 2 === 1 && random() < 0.5 ? 1 : 0;
  }

  const healerTeams = splitEvenly(healers, firstHealers, random, CLASS_THEN_SPEC);
  const otherTeams = splitEvenly(others, firstOthers, random, CLASS_THEN_SPEC);
  return [
    inTeamOrder([...healerTeams[0], ...otherTeams[0]]),
    inTeamOrder([...healerTeams[1], ...otherTeams[1]])
  ];
}

export function teamsParams(teams: Teams | undefined): { a: string | null; b: string | null } {
  return teams
    ? { a: teams[0].map(player => player.key).join(','), b: teams[1].map(player => player.key).join(',') }
    : { a: null, b: null };
}

export function parseTeams(a: string | null, b: string | null, players: readonly RosterPlayer[]): Teams | undefined {
  const playersByKey = new Map(players.map(player => [player.key, player]));
  const first = teamFromParam(a, playersByKey);
  const second = teamFromParam(b, playersByKey);
  if (!first || !second) {
    return undefined;
  }

  const distinct = new Set([...first, ...second].map(player => player.key));
  return distinct.size === PICK_COUNT ? [first, second] : undefined;
}

export function teamSummary(team: readonly RosterPlayer[]): TeamSummary {
  const itemLevels = team.flatMap(player => player.itemLevel === undefined ? [] : [player.itemLevel]);
  return {
    healers: countHealers(team),
    averageItemLevel: itemLevels.length
      ? itemLevels.reduce((sum, itemLevel) => sum + itemLevel, 0) / itemLevels.length
      : undefined
  };
}

function toRosterPlayer(entry: RatedBgRosterEntry): RosterPlayer {
  const classId = entry.class ?? 0;
  const spec = entry.spec ? specFor(classId, entry.spec) : undefined;
  return {
    key: `${entry.name}-${entry.realm}`,
    name: entry.name,
    realm: entry.realm,
    found: !entry.notFound,
    race: entry.race ?? 0,
    gender: entry.gender ?? 0,
    classId,
    spec: entry.spec,
    role: spec?.role,
    range: spec?.range,
    traits: entry.traits,
    itemLevel: entry.itemLevel
  };
}

function teamFromParam(value: string | null, playersByKey: ReadonlyMap<string, RosterPlayer>): RosterPlayer[] | undefined {
  const team = (value ? value.split(',') : []).map(key => playersByKey.get(key));
  return team.length === TEAM_SIZE && team.every(player => player !== undefined)
    ? inTeamOrder(team as RosterPlayer[])
    : undefined;
}

function inTeamOrder(team: readonly RosterPlayer[]): RosterPlayer[] {
  return teamGroups(team).flatMap(group => group.players);
}

function isHealer(player: RosterPlayer): boolean {
  return player.role === 'healer';
}

function rosterGroupOf(player: RosterPlayer): RosterGroupId {
  if (isHealer(player)) {
    return 'healers';
  }
  return player.range === 'ranged' ? 'ranged' : 'melee';
}

function rosterClasses(players: readonly RosterPlayer[]): RosterClass[] {
  const playersByClass = new Map<number, RosterPlayer[]>();
  for (const player of players) {
    const classPlayers = playersByClass.get(player.classId) ?? [];
    classPlayers.push(player);
    playersByClass.set(player.classId, classPlayers);
  }

  return [...playersByClass]
    .sort(([a], [b]) => classOrder(a) - classOrder(b))
    .map(([classId, classPlayers]) => ({ classId, players: classPlayers.sort(bySpecThenTraits) }));
}

function classOrder(classId: number): number {
  const index = CLASSES_BY_NAME.findIndex(({ id }) => id === classId);
  return index === -1 ? CLASSES_BY_NAME.length : index;
}

type SplitKey = (player: RosterPlayer) => string;

const CLASS_THEN_SPEC: readonly SplitKey[] = [
  player => player.classId ? `${player.classId}` : `unknown:${player.key}`,
  player => player.spec ?? `unknown:${player.key}`
];

function splitEvenly(
  players: readonly RosterPlayer[],
  firstTeamSize: number,
  random: () => number,
  [splitKey, ...finerKeys]: readonly SplitKey[]
): [RosterPlayer[], RosterPlayer[]] {
  if (!splitKey) {
    const playersInRandomOrder = shuffled(players, random);
    return [playersInRandomOrder.slice(0, firstTeamSize), playersInRandomOrder.slice(firstTeamSize)];
  }

  const buckets = new Map<string, RosterPlayer[]>();
  for (const player of players) {
    const key = splitKey(player);
    const bucket = buckets.get(key) ?? [];
    bucket.push(player);
    buckets.set(key, bucket);
  }

  const groups = [...buckets.values()];
  const baseFirstSize = groups.reduce((sum, group) => sum + Math.floor(group.length / 2), 0);
  const firstTeamExtras = new Set(
    shuffled(groups.filter(group => group.length % 2 === 1), random)
      .slice(0, firstTeamSize - baseFirstSize)
  );
  const teams: [RosterPlayer[], RosterPlayer[]] = [[], []];

  for (const group of groups) {
    const firstCount = Math.floor(group.length / 2) + (firstTeamExtras.has(group) ? 1 : 0);
    const [first, second] = splitEvenly(group, firstCount, random, finerKeys);
    teams[0].push(...first);
    teams[1].push(...second);
  }

  return teams;
}

function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [result[index], result[other]] = [result[other], result[index]];
  }
  return result;
}

function byName(a: RosterPlayer, b: RosterPlayer): number {
  return compareText(foldName(a.name), foldName(b.name)) || compareText(a.realm, b.realm);
}

function bySpecThenTraits(a: RosterPlayer, b: RosterPlayer): number {
  return Number(a.spec === undefined) - Number(b.spec === undefined)
    || compareText(a.spec ?? '', b.spec ?? '')
    || (b.traits ?? -1) - (a.traits ?? -1)
    || byName(a, b);
}

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
