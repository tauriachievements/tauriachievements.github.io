import { CLASSES_BY_NAME, DamageRange, Role } from '../../game/wow';
import { specFor } from '../../game/wow-specs';
import { foldName } from '../../shared/search-suggestions';

export const RATED_BG_ROSTER_FILE = 'rated-bg-roster.json';
export const RATED_BG_ROSTER_VERSION = 1;
export const TEAM_SIZE = 10;
export const MATCH_SIZE = 2 * TEAM_SIZE;
export const FLAG_CARRIER_COUNT = 2;
const MAX_SHUFFLES = 1000;

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
  readonly character: string;
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

  const listings = new Map<string, number>();
  for (const entry of file.players) {
    listings.set(characterOf(entry), (listings.get(characterOf(entry)) ?? 0) + 1);
  }

  return file.players.map(entry => toRosterPlayer(entry, listings.get(characterOf(entry)) ?? 0)).sort(byName);
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

const TEAM_GROUP_ORDER: readonly RosterGroupId[] = ['healers', 'ranged', 'melee'];

export function teamGroups(team: readonly RosterPlayer[]): TeamGroup[] {
  return rosterGroups(team)
    .map(({ id, label, classes }) => ({ id, label, players: classes.flatMap(rosterClass => rosterClass.players) }))
    .filter(group => group.players.length > 0)
    .sort((a, b) => TEAM_GROUP_ORDER.indexOf(a.id) - TEAM_GROUP_ORDER.indexOf(b.id));
}

export type TeamComposition = Readonly<Record<RosterGroupId, number>>;

export interface CompositionChoice {
  readonly id: RosterGroupId;
  readonly label: string;
  readonly counts: readonly number[];
}

export const COMPOSITION_CHOICES: readonly CompositionChoice[] = [
  { id: 'healers', label: 'Healers', counts: [1, 2, 3, 4] },
  { id: 'ranged', label: 'Ranged', counts: [1, 2, 3, 4, 5] },
  { id: 'melee', label: 'Melee', counts: [1, 2, 3, 4, 5] }
];

export const DEFAULT_COMPOSITION: TeamComposition = { healers: 2, ranged: 4, melee: 4 };

export function shuffleWarning(picked: readonly RosterPlayer[], composition: TeamComposition): string | undefined {
  const perTeam = COMPOSITION_CHOICES.reduce((sum, { id }) => sum + composition[id], 0);
  if (perTeam !== TEAM_SIZE) {
    return `${perTeam} per team, a team is ${TEAM_SIZE}`;
  }
  if (!picked.length) {
    return undefined;
  }

  const missing = COMPOSITION_CHOICES.flatMap(({ id }) => {
    const short = 2 * composition[id] - groupSize(picked, id);
    return short > 0 ? [`${short} more ${groupNoun(id, short)}`] : [];
  });
  return missing.length ? `tick ${listed(missing)}` : undefined;
}

export function canShuffle(picked: readonly RosterPlayer[], composition: TeamComposition): boolean {
  return picked.length > 0 && shuffleWarning(picked, composition) === undefined;
}

export function compositionOf(teams: Teams): TeamComposition | undefined {
  const [first, second] = teams.map(team => ({
    healers: groupSize(team, 'healers'),
    ranged: groupSize(team, 'ranged'),
    melee: groupSize(team, 'melee')
  }));
  return COMPOSITION_CHOICES.every(({ id, counts }) => first[id] === second[id] && counts.includes(first[id]))
    ? first
    : undefined;
}

export function togglePick(
  picked: ReadonlySet<string>,
  player: RosterPlayer,
  players: readonly RosterPlayer[]
): ReadonlySet<string> {
  const next = new Set(picked);
  if (next.delete(player.key)) {
    return next;
  }

  for (const otherSpec of players.filter(other => other.character === player.character)) {
    next.delete(otherSpec.key);
  }
  return next.add(player.key);
}

export function toggleFlagCarrier(flagCarriers: ReadonlySet<string>, key: string): ReadonlySet<string> {
  return toggleWithin(flagCarriers, key, FLAG_CARRIER_COUNT);
}

export function tickedFlagCarriers(flagCarriers: ReadonlySet<string>, picked: ReadonlySet<string>): ReadonlySet<string> {
  return new Set([...flagCarriers].filter(key => picked.has(key)));
}

export function markTeamFlagCarrier(
  flagCarriers: ReadonlySet<string>,
  team: readonly RosterPlayer[],
  key: string
): ReadonlySet<string> {
  if (flagCarriers.has(key)) {
    return toggleFlagCarrier(flagCarriers, key);
  }

  const teamKeys = new Set(team.map(player => player.key));
  return new Set([...[...flagCarriers].filter(marked => !teamKeys.has(marked)), key]);
}

export interface BenchHistory {
  readonly sitOuts: ReadonlyMap<string, number>;
  readonly lastMatch: ReadonlySet<string>;
  readonly sitOutStreaks: ReadonlyMap<string, number>;
}

export const NO_BENCH_HISTORY: BenchHistory = { sitOuts: new Map(), lastMatch: new Set(), sitOutStreaks: new Map() };

export interface Match {
  readonly teams: Teams;
  readonly bench: readonly RosterPlayer[];
  readonly backFromBench: ReadonlySet<string>;
}

export interface MatchResult {
  readonly match: Match;
  readonly history: BenchHistory;
}

export function playMatch(
  picked: readonly RosterPlayer[],
  composition: TeamComposition,
  history: BenchHistory,
  flagCarriers: ReadonlySet<string>,
  random: () => number = Math.random
): MatchResult {
  const bench = COMPOSITION_CHOICES.flatMap(({ id }) => benchFrom(
    picked.filter(player => rosterGroupOf(player) === id),
    2 * composition[id],
    history,
    flagCarriers,
    random
  ));
  const benchKeys = new Set(bench.map(player => player.key));
  const playing = picked.filter(player => !benchKeys.has(player.key));

  return {
    match: {
      teams: shuffleTeams(playing, random, flagCarriers),
      bench: inTeamOrder(bench),
      backFromBench: new Set(playing.filter(player => history.sitOutStreaks.has(player.character)).map(player => player.key))
    },
    history: {
      sitOuts: new Map([
        ...history.sitOuts,
        ...bench.map(player => [player.character, sitOutsOf(history, player) + 1] as const)
      ]),
      lastMatch: new Set(playing.map(player => player.character)),
      sitOutStreaks: new Map(bench.map(player => [player.character, sitOutStreakOf(history, player) + 1]))
    }
  };
}

export function linkedMatch(teams: Teams): MatchResult {
  return {
    match: { teams, bench: [], backFromBench: new Set() },
    history: { ...NO_BENCH_HISTORY, lastMatch: new Set([...teams[0], ...teams[1]].map(player => player.character)) }
  };
}

export function shuffleTeams(
  players: readonly RosterPlayer[],
  random: () => number = Math.random,
  flagCarriers: ReadonlySet<string> = new Set()
): Teams {
  let teams = balancedTeams(players, random);
  for (let attempt = 1; attempt < MAX_SHUFFLES && !splitsFlagCarriers(teams, flagCarriers); attempt++) {
    teams = balancedTeams(players, random);
  }
  return teams;
}

function benchFrom(
  group: readonly RosterPlayer[],
  playing: number,
  history: BenchHistory,
  flagCarriers: ReadonlySet<string>,
  random: () => number
): RosterPlayer[] {
  const seats = Math.max(0, group.length - playing);
  const classSizes = classSizesOf(group);
  const candidates = shuffled(group.filter(player => !flagCarriers.has(player.key)), random)
    .sort((a, b) => compareCosts(sitOutCost(history, a), sitOutCost(history, b)));
  const least = leastBenchCost(classSizes, [], candidates, seats, history);
  const bench: RosterPlayer[] = [];

  candidates.forEach((player, index) => {
    const rest = candidates.slice(index + 1);
    if (bench.length < seats && sameCost(leastBenchCost(classSizes, [...bench, player], rest, seats, history), least)) {
      bench.push(player);
    }
  });
  return bench;
}

type BenchCost = readonly [
  sitOutStreaks: number,
  stackedSplits: number,
  oneSidedSplits: number,
  sitOuts: number,
  missedLastMatch: number
];

const NO_COST: BenchCost = [0, 0, 0, 0, 0];
const STACKED_SPLIT: BenchCost = [0, 1, 0, 0, 0];
const ONE_SIDED_SPLIT: BenchCost = [0, 0, 1, 0, 0];

function leastBenchCost(
  classSizes: ReadonlyMap<string, number>,
  bench: readonly RosterPlayer[],
  rest: readonly RosterPlayer[],
  seats: number,
  history: BenchHistory
): BenchCost | undefined {
  const toFill = seats - bench.length;
  let least: (BenchCost | undefined)[] = [NO_COST];

  for (const [classKey, size] of classSizes) {
    const benched = bench.filter(player => classKeyOf(player) === classKey);
    const choices = rest.filter(player => classKeyOf(player) === classKey);
    const options = Array.from({ length: choices.length + 1 }, (_, extra) => {
      const sitting = [...benched, ...choices.slice(0, extra)];
      return sitting.reduce((sum, player) => addCosts(sum, sitOutCost(history, player)), splitCost(size, size - sitting.length));
    });
    least = cheapestCombinations(least, options, toFill);
  }
  return toFill < 0 ? undefined : least[toFill];
}

function cheapestCombinations(
  least: readonly (BenchCost | undefined)[],
  options: readonly BenchCost[],
  limit: number
): (BenchCost | undefined)[] {
  const next: (BenchCost | undefined)[] = [];
  least.forEach((cost, filled) => {
    options.forEach((option, extra) => {
      const current = next[filled + extra];
      const combined = cost && filled + extra <= limit ? addCosts(cost, option) : undefined;
      if (combined && (!current || compareCosts(combined, current) < 0)) {
        next[filled + extra] = combined;
      }
    });
  });
  return next;
}

function sitOutCost(history: BenchHistory, player: RosterPlayer): BenchCost {
  return [
    sitOutStreakOf(history, player),
    0,
    0,
    sitOutsOf(history, player),
    Number(!history.lastMatch.has(player.character))
  ];
}

function splitCost(classSize: number, playing: number): BenchCost {
  if (classSize < 2 || playing % 2 === 0) {
    return NO_COST;
  }
  return playing === 1 ? ONE_SIDED_SPLIT : STACKED_SPLIT;
}

function addCosts(a: BenchCost, b: BenchCost): BenchCost {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2], a[3] + b[3], a[4] + b[4]];
}

function compareCosts(a: BenchCost, b: BenchCost): number {
  const index = a.findIndex((value, position) => value !== b[position]);
  return index === -1 ? 0 : a[index] - b[index];
}

function sameCost(a: BenchCost | undefined, b: BenchCost | undefined): boolean {
  return a === undefined || b === undefined ? a === b : compareCosts(a, b) === 0;
}

function classSizesOf(players: readonly RosterPlayer[]): Map<string, number> {
  const sizes = new Map<string, number>();
  for (const player of players) {
    sizes.set(classKeyOf(player), (sizes.get(classKeyOf(player)) ?? 0) + 1);
  }
  return sizes;
}

function sitOutsOf(history: BenchHistory, player: RosterPlayer): number {
  return history.sitOuts.get(player.character) ?? 0;
}

function sitOutStreakOf(history: BenchHistory, player: RosterPlayer): number {
  return history.sitOutStreaks.get(player.character) ?? 0;
}

function balancedTeams(players: readonly RosterPlayer[], random: () => number): Teams {
  const firstTeamSize = Math.floor(players.length / 2) + (players.length % 2 === 1 && random() < 0.5 ? 1 : 0);
  const [first, second] = splitEvenly(players, firstTeamSize, random, GROUP_THEN_CLASS_THEN_SPEC);
  return [inTeamOrder(first), inTeamOrder(second)];
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

  const distinct = new Set([...first, ...second].map(player => player.character));
  return distinct.size === MATCH_SIZE ? [first, second] : undefined;
}

export function teamSummary(team: readonly RosterPlayer[]): TeamSummary {
  const itemLevels = team.flatMap(player => player.itemLevel === undefined ? [] : [player.itemLevel]);
  return {
    healers: groupSize(team, 'healers'),
    averageItemLevel: itemLevels.length
      ? itemLevels.reduce((sum, itemLevel) => sum + itemLevel, 0) / itemLevels.length
      : undefined
  };
}

function toRosterPlayer(entry: RatedBgRosterEntry, listings: number): RosterPlayer {
  const classId = entry.class ?? 0;
  const spec = entry.spec ? specFor(classId, entry.spec) : undefined;
  const character = characterOf(entry);
  return {
    key: listings > 1 ? `${character}-${entry.spec ?? ''}` : character,
    character,
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

function characterOf(entry: RatedBgRosterEntry): string {
  return `${entry.name}-${entry.realm}`;
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

function toggleWithin(keys: ReadonlySet<string>, key: string, limit: number): ReadonlySet<string> {
  if (!keys.has(key) && keys.size >= limit) {
    return keys;
  }

  const next = new Set(keys);
  if (!next.delete(key)) {
    next.add(key);
  }
  return next;
}

function splitsFlagCarriers(teams: Teams, flagCarriers: ReadonlySet<string>): boolean {
  const carriersIn = (team: readonly RosterPlayer[]) => team.filter(player => flagCarriers.has(player.key)).length;
  return carriersIn([...teams[0], ...teams[1]]) < FLAG_CARRIER_COUNT || teams.every(team => carriersIn(team) === 1);
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

function groupSize(players: readonly RosterPlayer[], id: RosterGroupId): number {
  return players.filter(player => rosterGroupOf(player) === id).length;
}

function groupNoun(id: RosterGroupId, count: number): string {
  if (id !== 'healers') {
    return id;
  }
  return count === 1 ? 'healer' : 'healers';
}

function listed(items: readonly string[]): string {
  return items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
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

function classKeyOf(player: RosterPlayer): string {
  return player.classId ? `${player.classId}` : `unknown:${player.key}`;
}

const GROUP_THEN_CLASS_THEN_SPEC: readonly SplitKey[] = [
  rosterGroupOf,
  classKeyOf,
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
