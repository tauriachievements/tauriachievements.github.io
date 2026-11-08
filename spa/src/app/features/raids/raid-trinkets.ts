import { RaidBoss, RaidKillDetails, RaidSpec } from './raid-logs.types';
import { EDGE_MIN_TOP_PICKS, EDGE_POINTS, NOTABLE_DIFFERENCE, NOTABLE_MIN_PICKS, PickSample, pickSamples } from './raid-analytics';

export interface TrinketItem {
  id: number;
  name: string;
  icon: string;
  quality: number;
}

export interface TrinketSample extends PickSample {
  trinkets: readonly string[];
  standing?: number;
}

export interface TrinketUse {
  item: TrinketItem;
  count: number;
  characters: number;
  share: number;
  topCount: number;
  topShare: number;
  standing?: number;
  best: TrinketSample;
}

export interface TrinketSummary {
  picks: number;
  topPicks: number;
  characters: number;
  trinkets: TrinketUse[];
}

export interface TrinketPair {
  key: string;
  items: readonly [TrinketItem, TrinketItem];
  count: number;
  share: number;
  topCount: number;
  topShare: number;
}

export interface BossTrinketShares {
  boss: RaidBoss;
  picks: number;
  shares: number[];
  elsewhere: number[];
  elsewherePicks: number;
}

export interface NotableTrinket {
  index: number;
  share: number;
  elsewhere: number;
  difference: number;
}

export interface TrinketEdge {
  use: TrinketUse;
  difference: number;
}

export interface SpecTrinketSummary {
  spec: RaidSpec;
  summary: TrinketSummary;
}

export function trinketSamples(kills: readonly RaidKillDetails[]): TrinketSample[] {
  const samples = pickSamples(kills, member => member.trinkets.length > 0);
  const ranked = new Map<string, number>();
  for (const sample of samples) {
    const group = rankingKey(sample);
    ranked.set(group, (ranked.get(group) ?? 0) + 1);
  }

  return samples.map(sample => {
    const size = ranked.get(rankingKey(sample)) ?? 1;
    return {
      ...sample,
      trinkets: [...new Set(sample.member.trinkets.map(trinket => trinket.name))],
      standing: size > 1 ? (size - sample.rank) / (size - 1) : undefined
    };
  });
}

function rankingKey(sample: PickSample): string {
  return `${sample.boss.index}|${sample.spec.id}`;
}

export function trinketItems(samples: readonly TrinketSample[]): ReadonlyMap<string, TrinketItem> {
  const worn = new Map<string, Map<number, { item: TrinketItem; count: number }>>();
  for (const sample of samples) {
    for (const trinket of new Map(sample.member.trinkets.map(entry => [entry.id, entry])).values()) {
      let versions = worn.get(trinket.name);
      if (!versions) {
        versions = new Map();
        worn.set(trinket.name, versions);
      }
      const version = versions.get(trinket.id);
      if (version) {
        version.count++;
      } else {
        versions.set(trinket.id, { item: { id: trinket.id, name: trinket.name, icon: trinket.icon, quality: trinket.quality }, count: 1 });
      }
    }
  }

  return new Map([...worn].map(([name, versions]) => {
    const [most] = [...versions.values()].sort((a, b) => b.count - a.count || a.item.id - b.item.id);
    return [name, most.item];
  }));
}

export function trinketUses(samples: readonly TrinketSample[], items: ReadonlyMap<string, TrinketItem>): TrinketSummary {
  const uses = new Map<string, { count: number; topCount: number; characters: Set<string>; standings: number[]; best: TrinketSample }>();
  let topPicks = 0;

  for (const sample of samples) {
    if (sample.isTop) {
      topPicks++;
    }
    for (const name of sample.trinkets) {
      const use = uses.get(name);
      if (!use) {
        uses.set(name, { count: 1, topCount: sample.isTop ? 1 : 0, characters: new Set([sample.key]), standings: standingOf(sample), best: sample });
        continue;
      }
      use.count++;
      use.topCount += sample.isTop ? 1 : 0;
      use.characters.add(sample.key);
      use.standings.push(...standingOf(sample));
      if (sample.relative > use.best.relative || (sample.relative === use.best.relative && sample.value > use.best.value)) {
        use.best = sample;
      }
    }
  }

  const picks = samples.length;
  return {
    picks,
    topPicks,
    characters: new Set(samples.map(sample => sample.key)).size,
    trinkets: [...uses]
      .flatMap(([name, use]): TrinketUse[] => {
        const item = items.get(name);
        return item ? [{
          item,
          count: use.count,
          characters: use.characters.size,
          share: picks ? use.count / picks : 0,
          topCount: use.topCount,
          topShare: topPicks ? use.topCount / topPicks : 0,
          standing: use.standings.length ? use.standings.reduce((sum, standing) => sum + standing, 0) / use.standings.length : undefined,
          best: use.best
        }] : [];
      })
      .sort((a, b) => b.count - a.count || b.topCount - a.topCount || a.item.name.localeCompare(b.item.name))
  };
}

function standingOf(sample: TrinketSample): number[] {
  return sample.standing === undefined ? [] : [sample.standing];
}

export function trinketPairs(samples: readonly TrinketSample[], items: ReadonlyMap<string, TrinketItem>): TrinketPair[] {
  const pairs = new Map<string, { names: [string, string]; count: number; topCount: number }>();
  let topPicks = 0;

  for (const sample of samples) {
    if (sample.isTop) {
      topPicks++;
    }
    if (sample.trinkets.length !== 2) {
      continue;
    }
    const names = [...sample.trinkets].sort((a, b) => a.localeCompare(b)) as [string, string];
    const key = names.join('|');
    const pair = pairs.get(key);
    if (pair) {
      pair.count++;
      pair.topCount += sample.isTop ? 1 : 0;
    } else {
      pairs.set(key, { names, count: 1, topCount: sample.isTop ? 1 : 0 });
    }
  }

  return [...pairs]
    .flatMap(([key, pair]): TrinketPair[] => {
      const first = items.get(pair.names[0]);
      const second = items.get(pair.names[1]);
      return first && second ? [{
        key,
        items: [first, second],
        count: pair.count,
        share: samples.length ? pair.count / samples.length : 0,
        topCount: pair.topCount,
        topShare: topPicks ? pair.topCount / topPicks : 0
      }] : [];
    })
    .sort((a, b) => b.count - a.count || b.topCount - a.topCount || a.key.localeCompare(b.key));
}

export function bossTrinketShares(samples: readonly TrinketSample[], bosses: readonly RaidBoss[], names: readonly string[]): BossTrinketShares[] {
  const column = new Map(names.map((name, index) => [name, index]));
  const counts = bosses.map(() => ({ picks: 0, worn: new Array<number>(names.length).fill(0) }));
  const totals = { picks: 0, worn: new Array<number>(names.length).fill(0) };

  for (const sample of samples) {
    const tally = counts[bosses.indexOf(sample.boss)];
    if (!tally) {
      continue;
    }
    tally.picks++;
    totals.picks++;
    for (const name of sample.trinkets) {
      const index = column.get(name);
      if (index !== undefined) {
        tally.worn[index]++;
        totals.worn[index]++;
      }
    }
  }

  return bosses.map((boss, bossIndex) => {
    const { picks, worn } = counts[bossIndex];
    const elsewherePicks = totals.picks - picks;
    return {
      boss,
      picks,
      shares: worn.map(count => picks ? count / picks : 0),
      elsewhere: worn.map((count, index) => elsewherePicks ? (totals.worn[index] - count) / elsewherePicks : 0),
      elsewherePicks
    };
  });
}

export function notableTrinkets(shares: BossTrinketShares): NotableTrinket[] {
  if (shares.picks < NOTABLE_MIN_PICKS || shares.elsewherePicks < NOTABLE_MIN_PICKS) {
    return [];
  }

  return shares.shares
    .map((share, index): NotableTrinket => ({ index, share, elsewhere: shares.elsewhere[index], difference: share - shares.elsewhere[index] }))
    .filter(entry => entry.difference >= NOTABLE_DIFFERENCE - 1e-9)
    .sort((a, b) => b.difference - a.difference || a.index - b.index);
}

export function topPlayerTrinketEdge(summary: TrinketSummary, direction: 'more' | 'less'): TrinketEdge | undefined {
  if (summary.topPicks < EDGE_MIN_TOP_PICKS) {
    return undefined;
  }

  const sign = direction === 'more' ? 1 : -1;
  let edge: TrinketEdge | undefined;
  for (const use of summary.trinkets) {
    const difference = use.topShare - use.share;
    if (sign * difference >= EDGE_POINTS && (!edge || sign * difference > sign * edge.difference)) {
      edge = { use, difference };
    }
  }
  return edge;
}

export function strongestShowing(summary: TrinketSummary): TrinketUse | undefined {
  return summary.trinkets.reduce<TrinketUse | undefined>((strongest, use) =>
    use.characters >= NOTABLE_MIN_PICKS && use.standing !== undefined && use.standing > .5 && use.standing > (strongest?.standing ?? 0)
      ? use
      : strongest, undefined);
}

export function specTrinketSummaries(
  samples: readonly TrinketSample[],
  specs: readonly RaidSpec[],
  items: ReadonlyMap<string, TrinketItem>
): SpecTrinketSummary[] {
  const bySpec = new Map<RaidSpec, TrinketSample[]>();
  for (const sample of samples) {
    const own = bySpec.get(sample.spec);
    if (own) {
      own.push(sample);
    } else {
      bySpec.set(sample.spec, [sample]);
    }
  }

  return specs.map(spec => ({ spec, summary: trinketUses(bySpec.get(spec) ?? [], items) }));
}
