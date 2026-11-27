import { SpecPerformanceSummary, summarizeSpecScores } from '../../shared/spec-charts/spec-performance';
import { matchesRoleFilter, raceFaction, realmSlug, Role, RoleFilter } from '../../game/wow';
import { ClassAndSpec, classOptionsFor, fitClassAndSpecTo } from '../../game/wow-specs';
import { FilterDropdownOption } from '../../shared/filter-dropdown.types';
import { ScanChange, scanChanges } from '../../shared/scan-change';
import { RaidBoss, RaidSpec, RaidCharacter, RaidMember, RaidKillDetails } from './raid-logs.types';
import { characterKey, logKey } from './raid-logs';

export type RaidMetric = 'dps' | 'hps';

export interface RankingFilter {
  classId?: number;
  specId?: number;
  realm?: string;
  role?: RoleFilter;
}

export interface RankedPerformance {
  rank: number;
  member: RaidMember;
  kill: RaidKillDetails;
  value: number;
}

export function countsFor(metric: RaidMetric, spec: RaidSpec | undefined): boolean {
  if (!spec) {
    return false;
  }

  return metric === 'hps' ? spec.role === 'healer' || spec.role === 'tank' : spec.role !== 'healer';
}

function ranks(spec: RaidSpec, metric: RaidMetric, role: RoleFilter | undefined): boolean {
  return countsFor(metric, spec) && matchesRoleFilter(spec, role);
}

function rankingSpecs(specs: ReadonlyMap<number, RaidSpec>, metric: RaidMetric, role: RoleFilter | undefined): RaidSpec[] {
  return [...specs.values()].filter(spec => ranks(spec, metric, role));
}

export function rankedSpecs(
  specs: ReadonlyMap<number, RaidSpec>,
  classId: number | undefined,
  metric: RaidMetric,
  role?: RoleFilter
): RaidSpec[] {
  return [...specs.values()].filter(spec => spec.classId === classId && ranks(spec, metric, role));
}

export function rankedClassOptions(
  specs: ReadonlyMap<number, RaidSpec>,
  metric: RaidMetric,
  role?: RoleFilter
): FilterDropdownOption[] {
  return classOptionsFor(rankingSpecs(specs, metric, role));
}

export function fitClassAndSpec(
  specs: ReadonlyMap<number, RaidSpec>,
  picked: ClassAndSpec,
  metric: RaidMetric,
  role?: RoleFilter
): ClassAndSpec {
  return fitClassAndSpecTo(rankingSpecs(specs, metric, role), picked);
}

export function rankCharacters(
  kills: readonly RaidKillDetails[],
  metric: RaidMetric,
  filter: RankingFilter = {}
): RankedPerformance[] {
  const best = new Map<RaidCharacter, Omit<RankedPerformance, 'rank'>>();

  for (const kill of kills) {
    for (const member of kill.members) {
      if (member.character.former || !countsFor(metric, member.spec) || !matchesFilter(member, filter)) {
        continue;
      }

      const value = member[metric];
      const known = best.get(member.character);
      if (!known || value > known.value || (value === known.value && kill.killedAt < known.kill.killedAt)) {
        best.set(member.character, { member, kill, value });
      }
    }
  }

  return [...best.values()]
    .sort((a, b) => b.value - a.value || a.kill.killedAt - b.kill.killedAt)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function matchesFilter(member: RaidMember, filter: RankingFilter): boolean {
  return (filter.classId === undefined || member.character.classId === filter.classId)
    && (filter.specId === undefined || member.spec?.id === filter.specId)
    && (filter.role === undefined || (member.spec !== undefined && matchesRoleFilter(member.spec, filter.role)))
    && (filter.realm === undefined || realmSlug(member.character.realm) === filter.realm);
}

export interface BossStanding {
  rank?: number;
  ranked: number;
  relative: number;
}

export function bossStanding(
  kills: readonly RaidKillDetails[],
  metric: RaidMetric,
  key: string,
  filter: RankingFilter = {}
): BossStanding {
  const ranking = rankCharacters(kills, metric, filter);
  const own = ranking.find(entry => characterKey(entry.member.character) === key);
  const top = bossBest(kills, metric, filter);
  return { rank: own?.rank, ranked: ranking.length, relative: own && top > 0 ? own.value / top : 0 };
}

export function bossBest(kills: readonly RaidKillDetails[], metric: RaidMetric, filter: RankingFilter = {}): number {
  let best = 0;
  for (const kill of kills) {
    for (const member of kill.members) {
      if (countsFor(metric, member.spec) && matchesFilter(member, filter)) {
        best = Math.max(best, member[metric]);
      }
    }
  }
  return best;
}

export const MAX_SCORE = 6969;

interface Appearance {
  member: RaidMember;
  kill: RaidKillDetails;
}

const characterKeys = new WeakMap<RaidCharacter, string>();

function cachedCharacterKey(character: RaidCharacter): string {
  let key = characterKeys.get(character);
  if (key === undefined) {
    key = characterKey(character);
    characterKeys.set(character, key);
  }
  return key;
}

export interface BossPerformance {
  boss: RaidBoss;
  best?: Appearance;
  value: number;
  relative: number;
}

export interface CharacterScore {
  character: RaidCharacter;
  spec?: RaidSpec;
  faction: number;
  itemLevel: number;
  bosses: BossPerformance[];
  killed: number;
  performance: number;
  score: number;
}

export interface RankedScore extends CharacterScore {
  rank: number;
}

export function roleMetric(role: Role): RaidMetric {
  return role === 'healer' ? 'hps' : 'dps';
}

export function leaderboardRole(metric: RaidMetric, specsLatestFirst: readonly RaidSpec[]): Role {
  if (metric === 'hps') {
    return 'healer';
  }

  const kills = new Map<Role, number>();
  for (const spec of specsLatestFirst) {
    if (spec.role !== 'healer') {
      kills.set(spec.role, (kills.get(spec.role) ?? 0) + 1);
    }
  }
  return [...kills].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'dps';
}

export function scoreCharacters(
  bosses: readonly RaidBoss[],
  bossKills: ReadonlyArray<readonly RaidKillDetails[]>,
  role: Role,
  specId?: number
): CharacterScore[] {
  const metric = roleMetric(role);

  interface Tally {
    latest: Appearance;
    specs: Map<RaidSpec, { count: number; at: number }>;
    bests: Array<Appearance | undefined>;
  }

  const tallies = new Map<string, Tally>();
  const tops = bosses.map(() => 0);

  bosses.forEach((boss, bossIndex) => {
    for (const kill of bossKills[bossIndex] ?? []) {
      for (const member of kill.members) {
        if (member.spec?.role !== role) {
          continue;
        }

        const value = member[metric];
        tops[bossIndex] = Math.max(tops[bossIndex], value);
        if (member.character.former || (specId !== undefined && member.spec.id !== specId)) {
          continue;
        }

        const key = cachedCharacterKey(member.character);
        let tally = tallies.get(key);
        if (!tally) {
          tally = { latest: { member, kill }, specs: new Map(), bests: bosses.map(() => undefined) };
          tallies.set(key, tally);
        }

        if (kill.killedAt > tally.latest.kill.killedAt) {
          tally.latest = { member, kill };
        }

        const spec = tally.specs.get(member.spec) ?? { count: 0, at: 0 };
        tally.specs.set(member.spec, { count: spec.count + 1, at: Math.max(spec.at, kill.killedAt) });

        const best = tally.bests[bossIndex];
        if (!best || value > best.member[metric] || (value === best.member[metric] && kill.killedAt < best.kill.killedAt)) {
          tally.bests[bossIndex] = { member, kill };
        }
      }
    }
  });

  const scoredBosses = tops.filter(top => top > 0).length;
  if (!scoredBosses) {
    return [];
  }

  const scores = [...tallies.values()].map((tally): CharacterScore => {
    const performances = bosses.map((boss, bossIndex): BossPerformance => {
      const best = tally.bests[bossIndex];
      const value = best ? best.member[metric] : 0;
      return { boss, best, value, relative: tops[bossIndex] > 0 ? value / tops[bossIndex] : 0 };
    });
    const performance = performances.reduce((sum, entry) => sum + entry.relative, 0) / scoredBosses;
    const { member, kill } = tally.latest;
    const spec = [...tally.specs.entries()].sort((a, b) => b[1].count - a[1].count || b[1].at - a[1].at)[0]?.[0];

    return {
      character: member.character,
      spec,
      faction: raceFaction(member.character.race) ?? kill.faction,
      itemLevel: member.itemLevel,
      bosses: performances,
      killed: performances.filter(entry => entry.best).length,
      performance,
      score: toScore(performance)
    };
  });

  return scores.sort((a, b) =>
    b.performance - a.performance || b.killed - a.killed || a.character.name.localeCompare(b.character.name));
}

function toScore(performance: number): number {
  return Math.floor(MAX_SCORE * performance + 1e-9);
}

export function specMetric(spec: RaidSpec): RaidMetric {
  return roleMetric(spec.role);
}

export interface SpecCharacterScore {
  character: RaidCharacter;
  score: number;
}

export function scoresBySpec(
  bosses: readonly RaidBoss[],
  bossKills: ReadonlyArray<readonly RaidKillDetails[]>
): Map<RaidSpec, SpecCharacterScore[]> {
  const tops: Record<Role, number[]> = { dps: bosses.map(() => 0), tank: bosses.map(() => 0), healer: bosses.map(() => 0) };
  const bests = new Map<RaidSpec, Map<string, { character: RaidCharacter; values: number[] }>>();

  bosses.forEach((boss, bossIndex) => {
    for (const kill of bossKills[bossIndex] ?? []) {
      for (const member of kill.members) {
        if (!member.spec) {
          continue;
        }

        const value = member[specMetric(member.spec)];
        const roleTops = tops[member.spec.role];
        roleTops[bossIndex] = Math.max(roleTops[bossIndex], value);
        if (member.character.former) {
          continue;
        }

        let characters = bests.get(member.spec);
        if (!characters) {
          characters = new Map();
          bests.set(member.spec, characters);
        }

        const key = cachedCharacterKey(member.character);
        let entry = characters.get(key);
        if (!entry) {
          entry = { character: member.character, values: bosses.map(() => 0) };
          characters.set(key, entry);
        }
        entry.values[bossIndex] = Math.max(entry.values[bossIndex], value);
      }
    }
  });

  const scores = new Map<RaidSpec, SpecCharacterScore[]>();
  for (const [spec, characters] of bests) {
    const top = tops[spec.role];
    const scoredBosses = top.filter(best => best > 0).length;
    if (!scoredBosses) {
      continue;
    }

    scores.set(spec, [...characters.values()]
      .map(({ character, values }) => ({
        character,
        score: toScore(values.reduce((sum, value, bossIndex) => sum + (top[bossIndex] > 0 ? value / top[bossIndex] : 0), 0) / scoredBosses)
      }))
      .sort((a, b) => b.score - a.score || a.character.name.localeCompare(b.character.name)));
  }

  return scores;
}

export function scoresBySpecForKills(
  bosses: readonly RaidBoss[],
  kills: readonly RaidKillDetails[]
): Map<RaidSpec, SpecCharacterScore[]> {
  return scoresBySpec(bosses, bosses.map(boss => kills.filter(kill => kill.boss.slug === boss.slug)));
}

export function specPerformance(
  scores: ReadonlyMap<RaidSpec, readonly SpecCharacterScore[]>,
  role?: RoleFilter
): SpecPerformanceSummary<SpecCharacterScore> {
  const bySpec = new Map([...scores].map(([spec, entries]) => [`${spec.classId}|${spec.name}`, entries]));
  return summarizeSpecScores(
    definition => bySpec.get(`${definition.classId}|${definition.spec}`) ?? [],
    entry => cachedCharacterKey(entry.character),
    role);
}

export interface ScoreFilter {
  classId?: number;
  realm?: string;
}

export function rankScores(scores: readonly CharacterScore[], filter: ScoreFilter = {}): RankedScore[] {
  return scores
    .filter(entry => (filter.classId === undefined || entry.character.classId === filter.classId)
      && (filter.realm === undefined || realmSlug(entry.character.realm) === filter.realm))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export function killsBefore(
  bossKills: ReadonlyArray<readonly RaidKillDetails[]>,
  newLogs: ReadonlySet<string>
): RaidKillDetails[][] {
  return bossKills.map(kills => kills.filter(kill => !newLogs.has(logKey(kill))));
}

export function scoreChanges(current: readonly RankedScore[], previous: readonly RankedScore[]): Map<string, ScanChange> {
  return scanChanges(current, previous, entry => cachedCharacterKey(entry.character), entry => entry.score);
}

export function performanceQuality(relative: number): number {
  if (relative >= 1) {
    return 6;
  }
  if (relative >= .95) {
    return 5;
  }
  if (relative >= .75) {
    return 4;
  }
  if (relative >= .5) {
    return 3;
  }
  return relative >= .25 ? 2 : 0;
}
