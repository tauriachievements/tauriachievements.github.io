import { RaidBoss, RaidKillDetails, RaidSpec, RaidTalent, RaidTalentTable } from './raid-logs.types';
import { EDGE_MIN_TOP_PICKS, EDGE_POINTS, NOTABLE_DIFFERENCE, NOTABLE_MIN_PICKS, PickSample, pickSamples } from './raid-analytics';

export function talentLevels(classId: number): number[] {
  if (classId === 6) {
    return [56, 57, 58, 60, 75, 90, 100];
  }
  if (classId === 12) {
    return [99, 100, 102, 104, 106, 108, 110];
  }
  return [15, 30, 45, 60, 75, 90, 100];
}

export interface TalentSample extends PickSample {
  talents: string;
}

export function talentSamples(kills: readonly RaidKillDetails[]): TalentSample[] {
  return pickSamples(kills, member => member.talents !== '')
    .map(sample => ({ ...sample, talents: sample.member.talents }));
}

export interface TalentChoice {
  column: number;
  talent?: RaidTalent;
  count: number;
  share: number;
  topCount: number;
  topShare: number;
}

export interface TalentTier {
  tier: number;
  level: number;
  choices: TalentChoice[];
  none: number;
  leader?: TalentChoice;
}

export interface TalentPicks {
  picks: number;
  topPicks: number;
  characters: number;
  tiers: TalentTier[];
}

export type TalentTiers = ReadonlyArray<ReadonlyArray<RaidTalent | undefined>>;

export function specTiers(table: RaidTalentTable, spec: Pick<RaidSpec, 'id'>): TalentTiers {
  return table.get(spec.id) ?? Array.from({ length: 7 }, () => [undefined, undefined, undefined]);
}

export function talentPicks(samples: readonly TalentSample[], tiers: TalentTiers, levels: readonly number[]): TalentPicks {
  const counts = tiers.map(choices => ({
    all: new Array<number>(Math.max(3, choices.length)).fill(0),
    top: new Array<number>(Math.max(3, choices.length)).fill(0),
    none: 0
  }));
  let topPicks = 0;

  for (const sample of samples) {
    if (sample.isTop) {
      topPicks++;
    }
    for (let tier = 0; tier < counts.length; tier++) {
      const column = Number(sample.talents[tier]);
      const tally = counts[tier];
      if (!Number.isInteger(column) || column >= tally.all.length) {
        tally.none++;
        continue;
      }
      tally.all[column]++;
      if (sample.isTop) {
        tally.top[column]++;
      }
    }
  }

  const picks = samples.length;
  return {
    picks,
    topPicks,
    characters: new Set(samples.map(sample => sample.key)).size,
    tiers: counts.map((tally, tier): TalentTier => {
      const choices = tally.all.map((count, column): TalentChoice => ({
        column,
        talent: tiers[tier][column],
        count,
        share: picks ? count / picks : 0,
        topCount: tally.top[column],
        topShare: topPicks ? tally.top[column] / topPicks : 0
      }));
      const leader = choices.reduce<TalentChoice | undefined>((best, choice) =>
        choice.count > (best?.count ?? 0) ? choice : best, undefined);
      return { tier, level: levels[tier] ?? 0, choices, none: tally.none, leader };
    })
  };
}

export function talentAgreement(picks: TalentPicks): number {
  const shares = picks.tiers.flatMap(tier => tier.leader ? [tier.leader.share] : []);
  return shares.length ? shares.reduce((sum, share) => sum + share, 0) / shares.length : 0;
}

export function agreementLabel(agreement: number): string {
  const percent = Math.round(agreement * 100);
  return percent >= 80 ? 'Settled' : percent >= 65 ? 'Mixed' : 'Wide open';
}

export interface TalentEdge {
  tier: TalentTier;
  choice: TalentChoice;
  difference: number;
}

export function topPlayerEdge(picks: TalentPicks, direction: 'more' | 'less'): TalentEdge | undefined {
  if (picks.topPicks < EDGE_MIN_TOP_PICKS) {
    return undefined;
  }

  const sign = direction === 'more' ? 1 : -1;
  let edge: TalentEdge | undefined;
  for (const tier of picks.tiers) {
    for (const choice of tier.choices) {
      const difference = choice.topShare - choice.share;
      if (sign * difference >= EDGE_POINTS &&(!edge || sign * difference > sign * edge.difference)) {
        edge = { tier, choice, difference };
      }
    }
  }
  return edge;
}

export function mostContestedTier(picks: TalentPicks): TalentTier | undefined {
  return picks.tiers.reduce<TalentTier | undefined>((found, tier) =>
    tier.leader && (!found || tier.leader.share < found.leader!.share) ? tier : found, undefined);
}

export function mostSettledTier(picks: TalentPicks): TalentTier | undefined {
  return picks.tiers.reduce<TalentTier | undefined>((found, tier) =>
    tier.leader && (!found || tier.leader.share > found.leader!.share) ? tier : found, undefined);
}

export interface TalentBuild {
  talents: string;
  count: number;
  share: number;
  topCount: number;
  topShare: number;
  characters: number;
  best: TalentSample;
}

export interface BuildSummary {
  picks: number;
  builds: TalentBuild[];
}

export function talentBuilds(samples: readonly TalentSample[]): BuildSummary {
  const builds = new Map<string, { count: number; topCount: number; characters: Set<string>; best: TalentSample }>();
  let topPicks = 0;

  for (const sample of samples) {
    if (sample.isTop) {
      topPicks++;
    }

    const build = builds.get(sample.talents);
    if (!build) {
      builds.set(sample.talents, { count: 1, topCount: sample.isTop ? 1 : 0, characters: new Set([sample.key]), best: sample });
      continue;
    }

    build.count++;
    build.topCount += sample.isTop ? 1 : 0;
    build.characters.add(sample.key);
    if (sample.relative > build.best.relative || (sample.relative === build.best.relative && sample.value > build.best.value)) {
      build.best = sample;
    }
  }

  return {
    picks: samples.length,
    builds: [...builds.entries()]
      .map(([talents, build]): TalentBuild => ({
        talents,
        count: build.count,
        share: samples.length ? build.count / samples.length : 0,
        topCount: build.topCount,
        topShare: topPicks ? build.topCount / topPicks : 0,
        characters: build.characters.size,
        best: build.best
      }))
      .sort((a, b) => b.count - a.count || b.topCount - a.topCount || a.talents.localeCompare(b.talents))
  };
}

export function buildTalents(talents: string, tiers: TalentTiers): Array<RaidTalent | undefined> {
  return tiers.map((choices, tier) => choices[Number(talents[tier])]);
}

export interface BossTalentShares {
  boss: RaidBoss;
  picks: number;
  shares: number[][];
  elsewhere: number[][];
  elsewherePicks: number;
}

export function bossTalentShares(samples: readonly TalentSample[], bosses: readonly RaidBoss[], tiers: TalentTiers): BossTalentShares[] {
  const empty = () => tiers.map(choices => new Array<number>(Math.max(3, choices.length)).fill(0));
  const counts = bosses.map(() => ({ picks: 0, columns: empty() }));
  const totals = { picks: 0, columns: empty() };

  for (const sample of samples) {
    const tally = counts[bosses.indexOf(sample.boss)];
    if (!tally) {
      continue;
    }
    tally.picks++;
    totals.picks++;
    for (let tier = 0; tier < tiers.length; tier++) {
      const column = Number(sample.talents[tier]);
      if (Number.isInteger(column) && column < tally.columns[tier].length) {
        tally.columns[tier][column]++;
        totals.columns[tier][column]++;
      }
    }
  }

  return bosses.map((boss, index) => {
    const { picks, columns } = counts[index];
    const elsewherePicks = totals.picks - picks;
    return {
      boss,
      picks,
      shares: columns.map(row => row.map(count => picks ? count / picks : 0)),
      elsewhere: columns.map((row, tier) => row.map((count, column) =>
        elsewherePicks ? (totals.columns[tier][column] - count) / elsewherePicks : 0)),
      elsewherePicks
    };
  });
}

export interface NotablePick {
  tier: number;
  column: number;
  share: number;
  elsewhere: number;
  difference: number;
}

export function notablePicks(shares: BossTalentShares): NotablePick[] {
  if (shares.picks < NOTABLE_MIN_PICKS || shares.elsewherePicks < NOTABLE_MIN_PICKS) {
    return [];
  }

  return shares.shares
    .flatMap((row, tier) => row.map((share, column): NotablePick => {
      const elsewhere = shares.elsewhere[tier][column];
      return { tier, column, share, elsewhere, difference: share - elsewhere };
    }))
    .filter(pick => pick.difference >= NOTABLE_DIFFERENCE - 1e-9)
    .sort((a, b) => b.difference - a.difference || a.tier - b.tier);
}

export interface TalentSwaps {
  characters: number;
  changed: number;
  tiers: number[];
}

export function talentSwaps(samples: readonly TalentSample[], tierCount: number, boss?: RaidBoss): TalentSwaps {
  const byCharacter = new Map<string, TalentSample[]>();
  for (const sample of samples) {
    const own = byCharacter.get(sample.key);
    if (own) {
      own.push(sample);
    } else {
      byCharacter.set(sample.key, [sample]);
    }
  }

  const result: TalentSwaps = { characters: 0, changed: 0, tiers: new Array<number>(tierCount).fill(0) };
  for (const own of byCharacter.values()) {
    const here = boss ? own.find(sample => sample.boss === boss) : undefined;
    const others = boss ? own.filter(sample => sample !== here) : own;
    if (boss ? !here || !others.length : others.length < 2) {
      continue;
    }

    result.characters++;
    let changedAny = false;
    for (let tier = 0; tier < tierCount; tier++) {
      const changed = here
        ? !usualPicks(others, tier).has(here.talents[tier])
        : new Set(others.map(sample => sample.talents[tier])).size > 1;
      if (changed) {
        result.tiers[tier]++;
        changedAny = true;
      }
    }
    if (changedAny) {
      result.changed++;
    }
  }
  return result;
}

function usualPicks(samples: readonly TalentSample[], tier: number): Set<string> {
  const counts = new Map<string, number>();
  for (const sample of samples) {
    counts.set(sample.talents[tier], (counts.get(sample.talents[tier]) ?? 0) + 1);
  }
  const most = Math.max(...counts.values());
  return new Set([...counts].filter(([, count]) => count === most).map(([pick]) => pick));
}

export interface SpecTalentSummary {
  spec: RaidSpec;
  picks: TalentPicks;
  agreement: number;
  topBuild?: TalentBuild;
  buildCount: number;
}

export function specTalentSummaries(samples: readonly TalentSample[], specs: readonly RaidSpec[], table: RaidTalentTable): SpecTalentSummary[] {
  const bySpec = new Map<RaidSpec, TalentSample[]>();
  for (const sample of samples) {
    const own = bySpec.get(sample.spec);
    if (own) {
      own.push(sample);
    } else {
      bySpec.set(sample.spec, [sample]);
    }
  }

  return specs.map(spec => {
    const own = bySpec.get(spec) ?? [];
    const picks = talentPicks(own, specTiers(table, spec), talentLevels(spec.classId));
    const builds = talentBuilds(own).builds;
    return { spec, picks, agreement: talentAgreement(picks), topBuild: builds[0], buildCount: builds.length };
  });
}
