import { CLASS_NAMES } from '../../game/wow';
import { RaidBoss, RaidSpec } from './raid-logs.types';
import { EDGE_MIN_TOP_PICKS, EDGE_POINTS, NOTABLE_MIN_PICKS, formatPoints, formatShare } from './raid-analytics';
import {
  BossTrinketShares,
  TrinketItem,
  TrinketPair,
  TrinketSummary,
  TrinketUse,
  notableTrinkets,
  strongestShowing,
  topPlayerTrinketEdge
} from './raid-trinkets';

const SHOWN_TRINKETS = 10;

const SHOWN_PAIRS = 5;

const PAIR_MIN_TOP_COUNT = 2;

export interface TrinketStatTile {
  label: string;
  value: string;
  note: string;
}

export interface TrinketRow extends TrinketUse {
  rank: number;
  meter: number;
  beats: string;
  edge?: string;
  edgeTone?: 'up' | 'down';
}

export interface TrinketPairRow extends TrinketPair {
  rank: number;
  meter: number;
}

export interface TrinketInsight {
  id: string;
  label: string;
  title: string;
  text: string;
  items: readonly TrinketItem[];
  tone?: 'up' | 'down';
}

export interface TrinketInsightSources {
  summary: TrinketSummary;
  pairs: readonly TrinketPair[];
  spec: RaidSpec | undefined;
  boss: RaidBoss | undefined;
  bossShares: readonly BossTrinketShares[];
  names: readonly string[];
}

export interface TrinketHeatCell {
  share: number;
  label: string;
  notable: boolean;
  thin: boolean;
  tip: string;
  tipNote: string;
}

export interface TrinketHeatRow {
  key: string;
  item: TrinketItem;
  cells: TrinketHeatCell[];
}

export function trinketMetaTitle(difficulty: string, boss: string | undefined): string {
  return `Trinket meta · ${difficulty} · ${boss ?? 'All bosses'}`;
}

export function trinketStats(summary: TrinketSummary, pairs: readonly TrinketPair[], boss: RaidBoss | undefined): TrinketStatTile[] {
  return [
    {
      label: 'Characters',
      value: summary.characters.toLocaleString('en-US'),
      note: boss ? `killed ${boss.shortName}` : `${summary.picks.toLocaleString('en-US')} boss kills counted`
    },
    {
      label: 'Trinkets seen',
      value: summary.trinkets.length.toLocaleString('en-US'),
      note: summary.trinkets[0] ? `most worn: ${formatShare(summary.trinkets[0].share)}` : '-'
    },
    {
      label: 'Pairs seen',
      value: pairs.length.toLocaleString('en-US'),
      note: pairs[0] ? `most worn: ${formatShare(pairs[0].share)}` : '-'
    },
    {
      label: 'Top 10%',
      value: summary.topPicks.toLocaleString('en-US'),
      note: boss ? `best of the ${boss.shortName} ranking` : 'best of each boss ranking'
    }
  ];
}

export function trinketRows(summary: TrinketSummary): TrinketRow[] {
  const most = summary.trinkets[0]?.share ?? 0;
  const showEdges = summary.topPicks >= EDGE_MIN_TOP_PICKS;
  return summary.trinkets.slice(0, SHOWN_TRINKETS).map((use, index) => {
    const difference = use.topShare - use.share;
    const isEdge = showEdges && Math.abs(difference) >= EDGE_POINTS;
    return {
      ...use,
      rank: index + 1,
      meter: most ? use.share / most : 0,
      beats: use.standing === undefined ? '-' : formatShare(use.standing),
      edge: isEdge ? formatPoints(difference) : undefined,
      edgeTone: isEdge ? (difference > 0 ? 'up' : 'down') : undefined
    };
  });
}

export function trinketPairRows(pairs: readonly TrinketPair[]): TrinketPairRow[] {
  const most = pairs[0]?.share ?? 0;
  return pairs.slice(0, SHOWN_PAIRS).map((pair, index) => ({ ...pair, rank: index + 1, meter: most ? pair.share / most : 0 }));
}

export function trinketInsights({ summary, pairs, spec, boss, bossShares, names }: TrinketInsightSources): TrinketInsight[] {
  if (!spec || !summary.picks) {
    return [];
  }

  const insights: TrinketInsight[] = [];
  const plural = `${spec.name} ${CLASS_NAMES[spec.classId] ?? ''}s`;

  const favoured = topPlayerTrinketEdge(summary, 'more');
  if (favoured) {
    insights.push({
      id: 'favoured',
      label: 'Top players favour',
      title: favoured.use.item.name,
      items: [favoured.use.item],
      tone: 'up',
      text: `${formatShare(favoured.use.topShare)} of the top 10% wear it, against ${formatShare(favoured.use.share)} of everyone.`
    });
  }

  const avoided = topPlayerTrinketEdge(summary, 'less');
  if (avoided) {
    insights.push({
      id: 'avoided',
      label: 'Top players avoid',
      title: avoided.use.item.name,
      items: [avoided.use.item],
      tone: 'down',
      text: `Only ${formatShare(avoided.use.topShare)} of the top 10% wear it, against ${formatShare(avoided.use.share)} of everyone.`
    });
  }

  const strongest = strongestShowing(summary);
  if (strongest?.standing !== undefined) {
    insights.push({
      id: 'strongest',
      label: 'Strongest showing',
      title: strongest.item.name,
      items: [strongest.item],
      text: `On average its wearers beat ${formatShare(strongest.standing)} of the ${plural} on the same boss. The middle of a ranking beats 50%.`
    });
  }

  const topPair = summary.topPicks >= EDGE_MIN_TOP_PICKS
    ? pairs.reduce<TrinketPair | undefined>((best, pair) => pair.topCount > (best?.topCount ?? 0) ? pair : best, undefined)
    : undefined;
  if (topPair && topPair.topCount >= PAIR_MIN_TOP_COUNT) {
    insights.push({
      id: 'pair',
      label: 'Top players\' pair',
      title: topPair.items.map(item => item.name).join(' + '),
      items: topPair.items,
      text: `${formatShare(topPair.topShare)} of the top 10% wear both, against ${formatShare(topPair.share)} of everyone.`
    });
  }

  const shares = boss ? bossShares.find(entry => entry.boss === boss) : undefined;
  const notable = shares ? notableTrinkets(shares)[0] : undefined;
  const item = notable ? summary.trinkets.find(use => use.item.name === names[notable.index])?.item : undefined;
  if (boss && notable && item) {
    insights.push({
      id: 'boss',
      label: `Worn for ${boss.shortName}`,
      title: item.name,
      items: [item],
      tone: 'up',
      text: `${formatShare(notable.share)} wear it on ${boss.shortName}, against ${formatShare(notable.elsewhere)} on the other bosses.`
    });
  }

  return insights;
}

export function trinketHeatRows(shares: readonly BossTrinketShares[], names: readonly string[], shown: readonly TrinketUse[]): TrinketHeatRow[] {
  const column = new Map(names.map((name, index) => [name, index]));
  const notable = shares.map(entry => new Set(notableTrinkets(entry).map(pick => pick.index)));

  return shown.map(use => {
    const index = column.get(use.item.name) ?? -1;
    return {
      key: use.item.name,
      item: use.item,
      cells: shares.map((entry, bossIndex): TrinketHeatCell => {
        const share = entry.shares[index] ?? 0;
        const elsewhere = entry.elsewhere[index] ?? 0;
        return {
          share,
          label: entry.picks ? formatShare(share) : '-',
          notable: notable[bossIndex].has(index),
          thin: entry.picks < NOTABLE_MIN_PICKS,
          tip: `${use.item.name} on ${entry.boss.shortName}`,
          tipNote: entry.picks
            ? `${formatShare(share)} of ${entry.picks.toLocaleString('en-US')} · ${formatShare(elsewhere)} on the other bosses`
            : 'Nobody played the spec here'
        };
      })
    };
  });
}
