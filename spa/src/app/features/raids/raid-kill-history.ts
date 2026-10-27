import { RaidKillDetails, RaidMember } from './raid-logs.types';
import { RaidMetric, countsFor, performanceQuality } from './raid-scores';

export interface KillAppearance {
  kill: RaidKillDetails;
  member: RaidMember;
}

export interface HistoryKill extends KillAppearance {
  value: number;
}

export interface RecordCheck {
  latest: HistoryKill;
  record: HistoryKill;
  change: number;
}

export interface KillHistory {
  kills: HistoryKill[];
  best?: HistoryKill;
  check?: RecordCheck;
}

export type RecordTrend = 'up' | 'down' | 'flat';

export interface RecordChange {
  trend: RecordTrend;
  label: string;
  amount: string;
}

export type ReferenceSide = 'left' | 'right' | 'below';

export interface KillChartPoint {
  kill: HistoryKill;
  bottom: number;
  relative: number;
  quality: number;
  best: boolean;
  invalid: boolean;
  offSpec: boolean;
  showLabel: boolean;
  edge?: 'start' | 'end';
  flip: boolean;
}

export interface KillChartRecord {
  from: number;
  to: number;
  y: number;
  latest: number;
  below: boolean;
}

export interface KillChart {
  points: KillChartPoint[];
  viewBox: string;
  line: string;
  area: string;
  topBottom: number;
  referenceSide: ReferenceSide;
  record?: KillChartRecord;
}

const HEADROOM = 1.1;
const REFERENCE_CLEARANCE = 16;
const LABEL_UNDER_FLOOR = 22;

export function killHistory(appearances: readonly KillAppearance[], metric: RaidMetric, specId?: number): KillHistory {
  const kills = appearances
    .filter(({ member }) => countsFor(metric, member.spec) && (specId === undefined || member.spec?.id === specId))
    .map(appearance => ({ ...appearance, value: appearance.member[metric] }))
    .sort((a, b) => a.kill.killedAt - b.kill.killedAt);
  const counted = kills.filter(({ kill }) => kill.invalid === undefined);
  const latest = counted[counted.length - 1];
  const record = bestOf(counted.slice(0, -1));
  return {
    kills,
    best: bestOf(counted),
    check: latest && record && record.value > 0 ? { latest, record, change: latest.value / record.value - 1 } : undefined
  };
}

export function recordChange(change: number): RecordChange {
  const percent = Math.round(Math.abs(change) * 100);
  if (change === 0) {
    return { trend: 'flat', label: '±0%', amount: '0%' };
  }

  const trend = change > 0 ? 'up' : 'down';
  const amount = percent ? `${percent}%` : 'less than 1%';
  return { trend, label: `${trend === 'up' ? '▲' : '▼'} ${percent ? amount : '<1%'}`, amount };
}

export function killChart(history: KillHistory, top: number, mainSpecId: number | undefined, maxLabels: number): KillChart | undefined {
  const count = history.kills.length;
  if (!count) {
    return undefined;
  }

  const max = Math.max(top, ...history.kills.map(kill => kill.value)) * HEADROOM || 1;
  const bottomOf = (value: number) => value / max * 100;
  const labelled = labelledColumns(count, maxLabels);
  const points = history.kills.map<KillChartPoint>((kill, index) => {
    const relative = top > 0 ? kill.value / top : 0;
    return {
      kill,
      bottom: bottomOf(kill.value),
      relative,
      quality: performanceQuality(relative),
      best: kill === history.best,
      invalid: kill.kill.invalid !== undefined,
      offSpec: mainSpecId !== undefined && kill.member.spec?.id !== mainSpecId,
      showLabel: labelled.has(index),
      edge: count > 1 && index === 0 ? 'start' : count > 1 && index === count - 1 ? 'end' : undefined,
      flip: count > 1 && index >= count / 2
    };
  });

  const counted = points.flatMap((point, index) => point.invalid ? [] : [{ x: index + .5, y: (100 - point.bottom).toFixed(2) }]);
  const line = counted.length > 1 ? counted.map(({ x, y }) => `${x},${y}`).join(' ') : '';
  const topBottom = bottomOf(top);
  return {
    points,
    viewBox: `0 0 ${count} 100`,
    line,
    area: line ? `${counted[0].x},100 ${line} ${counted[counted.length - 1].x},100` : '',
    topBottom,
    referenceSide: referenceSide(points, topBottom),
    record: history.check && recordLine(history.check, history.kills, bottomOf)
  };
}

function bestOf(kills: readonly HistoryKill[]): HistoryKill | undefined {
  return kills.reduce<HistoryKill | undefined>((best, kill) => !best || kill.value > best.value ? kill : best, undefined);
}

function labelledColumns(count: number, maxLabels: number): Set<number> {
  if (count <= maxLabels) {
    return new Set(Array.from({ length: count }, (_, index) => index));
  }

  const slots = Math.max(2, maxLabels);
  return new Set(Array.from({ length: slots }, (_, slot) => Math.round(slot * (count - 1) / (slots - 1))));
}

function referenceSide(points: readonly KillChartPoint[], topBottom: number): ReferenceSide {
  const crowded = (point: KillChartPoint) => Math.abs(point.bottom - topBottom) < REFERENCE_CLEARANCE;
  if (points.length < 2 || !crowded(points[points.length - 1])) {
    return 'right';
  }

  return crowded(points[0]) ? 'below' : 'left';
}

function recordLine(check: RecordCheck, kills: readonly HistoryKill[], bottomOf: (value: number) => number): KillChartRecord {
  const latest = kills.indexOf(check.latest);
  return {
    from: kills.indexOf(check.record) + .5,
    to: latest + .5,
    y: 100 - bottomOf(check.record.value),
    latest,
    below: check.change <= 0 && bottomOf(check.latest.value) >= LABEL_UNDER_FLOOR
  };
}
