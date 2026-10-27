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
  trend?: KillTrend;
}

export interface KillTrend {
  from: number;
  start: number;
  next: number;
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

export interface KillChartPrediction {
  value: number;
  bottom: number;
  relative: number;
  quality: number;
  line: string;
  trend: string;
}

export interface KillChart {
  points: KillChartPoint[];
  columns: number;
  prediction?: KillChartPrediction;
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
const PREDICTION_MIN_KILLS = 3;
const PREDICTION_WINDOW = 6;

export function killHistory(appearances: readonly KillAppearance[], metric: RaidMetric, specId?: number): KillHistory {
  const kills = appearances
    .filter(({ member }) => countsFor(metric, member.spec) && (specId === undefined || member.spec?.id === specId))
    .map(appearance => ({ ...appearance, value: appearance.member[metric] }))
    .sort((a, b) => a.kill.killedAt - b.kill.killedAt);
  const latest = kills[kills.length - 1];
  const record = bestOf(kills.slice(0, -1));
  return {
    kills,
    best: bestOf(kills),
    check: latest && record && record.value > 0 ? { latest, record, change: latest.value / record.value - 1 } : undefined,
    trend: trendOf(kills.map(kill => kill.value))
  };
}

function trendOf(values: readonly number[]): KillTrend | undefined {
  if (values.length < PREDICTION_MIN_KILLS) {
    return undefined;
  }

  const from = Math.max(0, values.length - PREDICTION_WINDOW);
  const recent = values.slice(from);
  const middle = (recent.length - 1) / 2;
  const mean = recent.reduce((sum, value) => sum + value, 0) / recent.length;
  const spread = recent.reduce((sum, _, index) => sum + (index - middle) ** 2, 0);
  const slope = recent.reduce((sum, value, index) => sum + (index - middle) * (value - mean), 0) / spread;
  const at = (index: number) => Math.max(0, mean + slope * (index - middle));
  return { from, start: at(0), next: at(recent.length) };
}

export function predictedChange({ trend, best }: KillHistory): number | undefined {
  return trend && best && best.value > 0 ? trend.next / best.value - 1 : undefined;
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

export function killChart(
  history: KillHistory,
  top: number,
  mainSpecId: number | undefined,
  maxLabels: number,
  predict = false
): KillChart | undefined {
  const count = history.kills.length;
  if (!count) {
    return undefined;
  }

  const trend = predict ? history.trend : undefined;
  const columns = trend ? count + 1 : count;
  const max = Math.max(top, trend?.start ?? 0, trend?.next ?? 0, ...history.kills.map(kill => kill.value)) * HEADROOM || 1;
  const bottomOf = (value: number) => value / max * 100;
  const relativeOf = (value: number) => top > 0 ? value / top : 0;
  const labelled = labelledColumns(count, maxLabels);
  const points = history.kills.map<KillChartPoint>((kill, index) => {
    const relative = relativeOf(kill.value);
    return {
      kill,
      bottom: bottomOf(kill.value),
      relative,
      quality: performanceQuality(relative),
      best: kill === history.best,
      offSpec: mainSpecId !== undefined && kill.member.spec?.id !== mainSpecId,
      showLabel: labelled.has(index),
      edge: columns > 1 && index === 0 ? 'start' : columns > 1 && index === columns - 1 ? 'end' : undefined,
      flip: columns > 1 && index >= columns / 2
    };
  });

  const line = count > 1 ? points.map((point, index) => `${index + .5},${yOf(point.bottom)}`).join(' ') : '';
  const prediction = trend && {
    value: trend.next,
    bottom: bottomOf(trend.next),
    relative: relativeOf(trend.next),
    quality: performanceQuality(relativeOf(trend.next)),
    line: `${count - .5},${yOf(points[count - 1].bottom)} ${count + .5},${yOf(bottomOf(trend.next))}`,
    trend: `${trend.from + .5},${yOf(bottomOf(trend.start))} ${count + .5},${yOf(bottomOf(trend.next))}`
  };
  const topBottom = bottomOf(top);
  return {
    points,
    columns,
    prediction,
    viewBox: `0 0 ${columns} 100`,
    line,
    area: line ? `0.5,100 ${line} ${count - .5},100` : '',
    topBottom,
    referenceSide: referenceSide([...points, ...prediction ? [prediction] : []], topBottom),
    record: history.check && recordLine(history.check, history.kills, bottomOf)
  };
}

function yOf(bottom: number): string {
  return (100 - bottom).toFixed(2);
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

function referenceSide(points: readonly { bottom: number }[], topBottom: number): ReferenceSide {
  const crowded = (point: { bottom: number }) => Math.abs(point.bottom - topBottom) < REFERENCE_CLEARANCE;
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
