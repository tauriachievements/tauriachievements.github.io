import { CLASSES_BY_NAME, DamageRange, Role } from '../../game/wow';
import { specFor } from '../../game/wow-specs';
import { foldName } from '../../shared/search-suggestions';

export const RATED_BG_ROSTER_FILE = 'rated-bg-roster.json';
export const RATED_BG_ROSTER_VERSION = 1;
export const TEAM_SIZE = 10;
export const MATCH_SIZE = 2 * TEAM_SIZE;
const PLAYING_FLAG_CARRIERS = 2;
const MAX_SHUFFLES = 1000;

export interface RatedBgRosterEntry {
  readonly name: string;
  readonly realm: string;
  readonly person?: string;
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
  readonly person: string;
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
  { id: 'melee', label: 'Melee', counts: [1, 2, 3, 4, 5] },
  { id: 'ranged', label: 'Ranged', counts: [1, 2, 3, 4, 5] },
  { id: 'healers', label: 'Healers', counts: [1, 2, 3, 4] }
];

export const DEFAULT_COMPOSITION: TeamComposition = { healers: 3, ranged: 3, melee: 4 };

export function shuffleWarning(picked: readonly RosterPlayer[], composition: TeamComposition): string | undefined {
  const perTeam = COMPOSITION_CHOICES.reduce((sum, { id }) => sum + composition[id], 0);
  if (perTeam !== TEAM_SIZE) {
    return `${perTeam} per team, a team is ${TEAM_SIZE}`;
  }
  if (!picked.length) {
    return undefined;
  }

  const missing = fewestMissing(lineupsOf(picked), composition)
    .flatMap(({ id, short }) => short > 0 ? [`${short} more ${groupNoun(id, short)}`] : []);
  return missing.length ? `tick ${listed(missing)}` : undefined;
}

interface Shortfall {
  readonly id: RosterGroupId;
  readonly short: number;
}

function missingFrom(lineup: readonly RosterPlayer[], composition: TeamComposition): Shortfall[] {
  return COMPOSITION_CHOICES.map(({ id }) => ({ id, short: Math.max(0, 2 * composition[id] - groupSize(lineup, id)) }));
}

function fewestMissing(lineups: readonly (readonly RosterPlayer[])[], composition: TeamComposition): Shortfall[] {
  return lineups
    .map(lineup => missingFrom(lineup, composition))
    .reduce((fewest, missing) => totalShort(missing) < totalShort(fewest) ? missing : fewest);
}

function totalShort(missing: readonly Shortfall[]): number {
  return missing.reduce((sum, { short }) => sum + short, 0);
}

function lineupsOf(picked: readonly RosterPlayer[]): RosterPlayer[][] {
  const charactersByPerson = new Map<string, RosterPlayer[]>();
  for (const player of picked) {
    charactersByPerson.set(player.person, [...charactersByPerson.get(player.person) ?? [], player]);
  }

  const alternatives = [...charactersByPerson.values()].filter(characters => characters.length > 1);
  const alternativeKeys = new Set(alternatives.flat().map(player => player.key));
  return alternatives
    .reduce<RosterPlayer[][]>(
      (partials, characters) => partials.flatMap(chosen => characters.map(character => [...chosen, character])),
      [[]]
    )
    .map(chosen => {
      const chosenKeys = new Set(chosen.map(player => player.key));
      return picked.filter(player => !alternativeKeys.has(player.key) || chosenKeys.has(player.key));
    });
}

export function benchSize(picked: readonly RosterPlayer[]): number {
  return Math.max(0, new Set(picked.map(player => player.person)).size - MATCH_SIZE);
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
  const next = new Set(flagCarriers);
  if (!next.delete(key)) {
    next.add(key);
  }
  return next;
}

export function tickedFlagCarriers(flagCarriers: ReadonlySet<string>, picked: ReadonlySet<string>): ReadonlySet<string> {
  return new Set([...flagCarriers].filter(key => picked.has(key)));
}

export interface BenchHistory {
  readonly sitOuts: ReadonlyMap<string, number>;
  readonly lastMatch: ReadonlySet<string>;
  readonly sitOutStreaks: ReadonlyMap<string, number>;
}

export const NO_BENCH_HISTORY: BenchHistory = { sitOuts: new Map(), lastMatch: new Set(), sitOutStreaks: new Map() };

export interface Match {
  readonly teams: Teams;
  readonly leaders: ReadonlySet<string>;
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
  const lineup = lineupOf(picked, composition, history, flagCarriers, random);
  const bench = benchOf(lineup, composition, history, flagCarriers, random);
  const benchKeys = new Set(bench.map(player => player.key));
  const playing = lineup.filter(player => !benchKeys.has(player.key));
  const teams = shuffleTeams(playing, random, flagCarriers);

  return {
    match: {
      teams,
      leaders: teamLeaders(teams),
      bench: inTeamOrder(bench),
      backFromBench: new Set(playing.filter(player => history.sitOutStreaks.has(player.person)).map(player => player.key))
    },
    history: {
      sitOuts: new Map([
        ...history.sitOuts,
        ...bench.map(player => [player.person, sitOutsOf(history, player) + 1] as const)
      ]),
      lastMatch: new Set(playing.map(player => player.person)),
      sitOutStreaks: new Map(bench.map(player => [player.person, sitOutStreakOf(history, player) + 1]))
    }
  };
}

export function linkedMatch(teams: Teams, leaders: ReadonlySet<string> = teamLeaders(teams)): MatchResult {
  return {
    match: { teams, leaders, bench: [], backFromBench: new Set() },
    history: { ...NO_BENCH_HISTORY, lastMatch: new Set([...teams[0], ...teams[1]].map(player => player.person)) }
  };
}

export function withLeader(match: Match, key: string): Match {
  const playing = match.teams.some(team => team.some(player => player.key === key));
  return playing ? { ...match, leaders: teamLeaders(match.teams, [key, ...match.leaders]) } : match;
}

export function parseLeaders(value: string | null, teams: Teams): ReadonlySet<string> {
  return teamLeaders(teams, value ? value.split(',') : []);
}

function teamLeaders(teams: Teams, named: readonly string[] = []): ReadonlySet<string> {
  return new Set(teams.flatMap(team => {
    const keys = inTeamOrder(team).map(player => player.key);
    const leader = named.find(key => keys.includes(key)) ?? keys[0];
    return leader === undefined ? [] : [leader];
  }));
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

interface BenchGroup {
  readonly candidates: readonly RosterPlayer[];
  readonly classSizes: ReadonlyMap<string, number>;
  readonly seats: number;
}

function lineupOf(
  picked: readonly RosterPlayer[],
  composition: TeamComposition,
  history: BenchHistory,
  flagCarriers: ReadonlySet<string>,
  random: () => number
): readonly RosterPlayer[] {
  const lineups = lineupsOf(picked);
  if (lineups.length === 1) {
    return lineups[0];
  }

  const filling = lineups.filter(lineup => totalShort(missingFrom(lineup, composition)) === 0);
  const candidates = filling.length ? filling : lineups;
  const costs = candidates.map(lineup => lineupCost(lineup, composition, history, flagCarriers));
  const least = costs.reduce((best, cost) => compareCosts(cost, best) < 0 ? cost : best);
  return atRandom(candidates.filter((_, index) => compareCosts(costs[index], least) === 0), random);
}

function lineupCost(
  lineup: readonly RosterPlayer[],
  composition: TeamComposition,
  history: BenchHistory,
  flagCarriers: ReadonlySet<string>
): readonly number[] {
  const groups = benchGroups(lineup, composition, history, players => [...players]);
  const carriers = flagCarriersIn(lineup, flagCarriers);
  const [cheapest] = cheapestSplits(groups, carriers, history, flagCarriers);
  return [PLAYING_FLAG_CARRIERS - Math.min(carriers, PLAYING_FLAG_CARRIERS), ...cheapest.cost];
}

function benchOf(
  lineup: readonly RosterPlayer[],
  composition: TeamComposition,
  history: BenchHistory,
  flagCarriers: ReadonlySet<string>,
  random: () => number
): RosterPlayer[] {
  const groups = benchGroups(lineup, composition, history, players => shuffled(players, random));
  const { counts } = atRandom(cheapestSplits(groups, flagCarriersIn(lineup, flagCarriers), history, flagCarriers), random);
  return groups.flatMap((group, index) => benchFrom(group, counts[index], history, flagCarriers));
}

function flagCarriersIn(players: readonly RosterPlayer[], flagCarriers: ReadonlySet<string>): number {
  return players.filter(player => flagCarriers.has(player.key)).length;
}

function benchGroups(
  lineup: readonly RosterPlayer[],
  composition: TeamComposition,
  history: BenchHistory,
  order: (players: readonly RosterPlayer[]) => RosterPlayer[]
): BenchGroup[] {
  return COMPOSITION_CHOICES.map(({ id }) => {
    const players = lineup.filter(player => rosterGroupOf(player) === id);
    return {
      candidates: order(players).sort((a, b) => compareCosts(sitOutCost(history, a), sitOutCost(history, b))),
      classSizes: classSizesOf(players),
      seats: Math.max(0, players.length - 2 * composition[id])
    };
  });
}

interface BenchSplit {
  readonly counts: readonly number[];
  readonly benched: number;
  readonly cost: BenchCost;
}

function cheapestSplits(
  groups: readonly BenchGroup[],
  carriers: number,
  history: BenchHistory,
  flagCarriers: ReadonlySet<string>
): BenchSplit[] {
  const most = carriers - Math.min(carriers, PLAYING_FLAG_CARRIERS);
  const splits = groups
    .map(group => leastBenchCosts(group, [], group.candidates, history, flagCarriers))
    .reduce<BenchSplit[]>(
      (partials, costs) => partials.flatMap(({ counts, benched, cost }) => costs.flatMap((groupCost, groupCarriers) =>
        groupCost && benched + groupCarriers <= most
          ? [{ counts: [...counts, groupCarriers], benched: benched + groupCarriers, cost: addCosts(cost, groupCost) }]
          : [])),
      [{ counts: [], benched: 0, cost: NO_COST }]
    );
  const least = splits.reduce((best, split) => compareCosts(split.cost, best) < 0 ? split.cost : best, splits[0].cost);
  return splits.filter(split => sameCost(split.cost, least));
}

function atRandom<T>(items: readonly T[], random: () => number): T {
  return items[items.length > 1 ? Math.floor(random() * items.length) : 0];
}

function benchFrom(
  group: BenchGroup,
  carriers: number,
  history: BenchHistory,
  flagCarriers: ReadonlySet<string>
): RosterPlayer[] {
  const least = leastBenchCosts(group, [], group.candidates, history, flagCarriers)[carriers];
  const bench: RosterPlayer[] = [];

  group.candidates.forEach((player, index) => {
    const rest = group.candidates.slice(index + 1);
    if (
      bench.length < group.seats
      && sameCost(leastBenchCosts(group, [...bench, player], rest, history, flagCarriers)[carriers], least)
    ) {
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

type BenchCosts = (BenchCost | undefined)[];

interface BenchOption {
  readonly seats: number;
  readonly carriers: number;
  readonly cost: BenchCost;
}

function leastBenchCosts(
  group: BenchGroup,
  bench: readonly RosterPlayer[],
  rest: readonly RosterPlayer[],
  history: BenchHistory,
  flagCarriers: ReadonlySet<string>
): BenchCosts {
  const toFill = group.seats - bench.length;
  if (toFill < 0) {
    return [];
  }

  const isCarrier = (player: RosterPlayer) => flagCarriers.has(player.key);
  let least: BenchCosts[] = [[]];
  least[0][bench.filter(isCarrier).length] = NO_COST;

  for (const [classKey, size] of group.classSizes) {
    const benched = bench.filter(player => classKeyOf(player) === classKey);
    const choices = rest.filter(player => classKeyOf(player) === classKey);
    const options = benchOptions(benched, choices.filter(player => !isCarrier(player)), choices.filter(isCarrier), size, history);
    least = cheapestCombinations(least, options, toFill);
  }
  return least[toFill] ?? [];
}

function benchOptions(
  benched: readonly RosterPlayer[],
  others: readonly RosterPlayer[],
  carriers: readonly RosterPlayer[],
  classSize: number,
  history: BenchHistory
): BenchOption[] {
  return Array.from({ length: others.length + 1 }, (_, otherCount) =>
    Array.from({ length: carriers.length + 1 }, (_, carrierCount) => {
      const sitting = [...benched, ...others.slice(0, otherCount), ...carriers.slice(0, carrierCount)];
      return {
        seats: otherCount + carrierCount,
        carriers: carrierCount,
        cost: sitting.reduce(
          (sum, player) => addCosts(sum, sitOutCost(history, player)),
          splitCost(classSize, classSize - sitting.length)
        )
      };
    })).flat();
}

function cheapestCombinations(
  least: readonly BenchCosts[],
  options: readonly BenchOption[],
  limit: number
): BenchCosts[] {
  const next: BenchCosts[] = [];
  least.forEach((costs, filled) => costs.forEach((cost, carriers) => {
    for (const option of options) {
      const seats = filled + option.seats;
      if (cost && seats <= limit) {
        const combined = addCosts(cost, option.cost);
        const row = next[seats] ??= [];
        const current = row[carriers + option.carriers];
        if (!current || compareCosts(combined, current) < 0) {
          row[carriers + option.carriers] = combined;
        }
      }
    }
  }));
  return next;
}

function sitOutCost(history: BenchHistory, player: RosterPlayer): BenchCost {
  return [
    sitOutStreakOf(history, player),
    0,
    0,
    sitOutsOf(history, player),
    Number(!history.lastMatch.has(player.person))
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

function compareCosts(a: readonly number[], b: readonly number[]): number {
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
  return history.sitOuts.get(player.person) ?? 0;
}

function sitOutStreakOf(history: BenchHistory, player: RosterPlayer): number {
  return history.sitOutStreaks.get(player.person) ?? 0;
}

function balancedTeams(players: readonly RosterPlayer[], random: () => number): Teams {
  const firstTeamSize = Math.floor(players.length / 2) + (players.length % 2 === 1 && random() < 0.5 ? 1 : 0);
  const [first, second] = splitEvenly(players, firstTeamSize, random, GROUP_THEN_CLASS_THEN_SPEC);
  return [inTeamOrder(first), inTeamOrder(second)];
}

export function matchParams(match: Match | undefined): { a: string | null; b: string | null; leaders: string | null } {
  if (!match) {
    return { a: null, b: null, leaders: null };
  }

  const [first, second] = match.teams.map(team => team.map(player => player.key));
  return {
    a: first.join(','),
    b: second.join(','),
    leaders: [...first, ...second].filter(key => match.leaders.has(key)).join(',')
  };
}

export function parseTeams(a: string | null, b: string | null, players: readonly RosterPlayer[]): Teams | undefined {
  const playersByKey = new Map(players.map(player => [player.key, player]));
  const first = teamFromParam(a, playersByKey);
  const second = teamFromParam(b, playersByKey);
  if (!first || !second) {
    return undefined;
  }

  const distinct = new Set([...first, ...second].map(player => player.person));
  return distinct.size === MATCH_SIZE ? [first, second] : undefined;
}

export function averageItemLevel(team: readonly RosterPlayer[]): number | undefined {
  const itemLevels = team.flatMap(player => player.itemLevel === undefined ? [] : [player.itemLevel]);
  return itemLevels.length ? itemLevels.reduce((sum, itemLevel) => sum + itemLevel, 0) / itemLevels.length : undefined;
}

function toRosterPlayer(entry: RatedBgRosterEntry, listings: number): RosterPlayer {
  const classId = entry.class ?? 0;
  const spec = entry.spec ? specFor(classId, entry.spec) : undefined;
  const character = characterOf(entry);
  return {
    key: listings > 1 ? `${character}-${entry.spec ?? ''}` : character,
    character,
    person: entry.person ?? character,
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

function splitsFlagCarriers(teams: Teams, flagCarriers: ReadonlySet<string>): boolean {
  const [first, second] = teams.map(team => team.filter(player => flagCarriers.has(player.key)).length);
  return Math.abs(first - second) <= 1;
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
