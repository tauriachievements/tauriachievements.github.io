import { getClassColor } from '../../game/class-colors';
import { getClassIconPath } from '../../game/classIconHelper';
import { getRaceIconPath } from '../../game/raceIconHelper';
import { CLASS_NAMES, RACE_NAMES, raceFaction } from '../../game/wow';
import { formatShare } from '../../shared/spec-charts/spec-popularity';
import {
  ServerStatsClass,
  ServerStatsDistribution,
  ServerStatsDistributions,
  ServerStatsSnapshot
} from './server-stats.service';

export const HORDE_COLOR = '#e83a5a';
export const ALLIANCE_COLOR = '#4472e8';
export const NEUTRAL_COLOR = '#8a8a8a';
export const FEMALE_COLOR = '#d985c9';
export const MALE_COLOR = '#7d8796';
const GOLD = '#f7b500';
const UNKNOWN_CLASS_COLOR = '#888';

const HOURS_PER_DAY = 24;
const HOURS_PER_YEAR = 8766;
const FEMALE = 1;
const MALE = 0;
const PANDAREN_FACTION_LABELS: Readonly<Record<number, string>> = { 25: 'Pandaren (A)', 26: 'Pandaren (H)' };
const COMBO_LIST_LENGTH = 10;
const SHORT_YEAR_COLUMNS = 12;
const SMALLEST_SHOWN_SHARE = 0.0005;

const MATRIX_CLASS_IDS = Object.keys(CLASS_NAMES).map(Number).sort((left, right) => left - right);
const RACE_IDS = Object.keys(RACE_NAMES).map(Number).sort((left, right) => left - right);
const MATRIX_FACTIONS: ReadonlyArray<{ name: string; id: number | undefined; color: string }> = [
  { name: 'Alliance', id: 0, color: ALLIANCE_COLOR },
  { name: 'Horde', id: 1, color: HORDE_COLOR },
  { name: 'Neutral', id: undefined, color: NEUTRAL_COLOR }
];

export interface StatsTile {
  label: string;
  value: string;
}

export interface StatsBarRow {
  key: string;
  rank?: number;
  icons: string[];
  prefix?: string;
  label: string;
  color?: string;
  note?: string;
  value: string;
  detail?: string;
  percent: number;
  barColor: string;
}

export interface StatsColumn {
  label: string;
  tick: string;
  count: number;
  countText: string;
  compactText: string;
  shareText: string;
  percent: number;
  highlight: boolean;
}

export interface StatsSplitRow {
  key: string;
  icons: string[];
  label: string;
  color?: string;
  count: number;
  left: number;
  leftText: string;
  rightText: string;
}

export interface StatsSplit {
  total: StatsSplitRow;
  rows: StatsSplitRow[];
}

export type GenderView = 'race' | 'class';
export type ClassMetric = 'itemLevel' | 'played' | 'points';

export interface ClassAverages {
  rows: StatsBarRow[];
  baseline: number;
}

export type MatrixMode = 'count' | 'class' | 'race';

export interface MatrixClass {
  id: number;
  name: string;
  color: string;
  icon: string;
  total: number;
}

export interface MatrixCell {
  key: string;
  raceId: number;
  classId: number;
  count: number;
  female: number;
  ofAll: number;
  ofClass: number;
  ofRace: number;
}

export interface MatrixRace {
  id: number;
  label: string;
  icon: string;
  total: number;
  cells: MatrixCell[];
}

export interface MatrixGroup {
  name: string;
  color: string;
  races: MatrixRace[];
}

export interface ClassRaceMatrix {
  classes: MatrixClass[];
  groups: MatrixGroup[];
  max: Record<MatrixMode, number>;
}

export interface MatrixReadout {
  icons: string[];
  race: string;
  className: string;
  color: string;
  count: string;
  facts: string[];
}

export interface RealmShare {
  name: string;
  count: string;
  share: number;
  label: string;
}

export type StatsColumns = Record<keyof ServerStatsDistributions, StatsColumn[]>;

export interface StatsPageView {
  tiles: StatsTile[];
  realms: RealmShare[];
  matrix: ClassRaceMatrix;
  popularCombos: StatsBarRow[];
  rareCombos: StatsBarRow[];
  classes: StatsBarRow[];
  races: StatsBarRow[];
  faction: StatsSplit;
  columns: StatsColumns;
  guilds: StatsBarRow[];
  medianItemLevel: string;
  medianPlayed: string;
  avgAchievementPoints: string;
  avgHonorableKills: string;
  guildCount: string;
}

export function formatCount(value: number): string {
  return value.toLocaleString('en-GB');
}

export function formatRowShare(value: number): string {
  return value > 0 && value < SMALLEST_SHOWN_SHARE ? '<0.1%' : formatShare(value);
}

export function formatCompact(value: number): string {
  if (value < 1000) {
    return String(value);
  }

  return value < 10000 ? `${(value / 1000).toFixed(1).replace(/\.0$/, '')}k` : `${Math.round(value / 1000)}k`;
}

export function formatDays(hours: number): string {
  const days = hours / HOURS_PER_DAY;
  return `${days < 10 ? days.toFixed(1) : formatCount(Math.round(days))} days`;
}

export function formatPlayedTotal(hours: number): string {
  const years = Math.round(hours / HOURS_PER_YEAR);
  if (years >= 1) {
    return `${formatCount(years)} ${years === 1 ? 'year' : 'years'}`;
  }

  const days = Math.round(hours / HOURS_PER_DAY);
  return `${formatCount(days)} ${days === 1 ? 'day' : 'days'}`;
}

export function raceLabel(id: number): string {
  return PANDAREN_FACTION_LABELS[id] ?? RACE_NAMES[id] ?? `Race ${id}`;
}

export function className(id: number): string {
  return CLASS_NAMES[id] ?? `Class ${id}`;
}

function classColor(id: number): string {
  return getClassColor(id) ?? UNKNOWN_CLASS_COLOR;
}

function factionColor(faction: number | undefined): string {
  return faction === 0 ? ALLIANCE_COLOR : faction === 1 ? HORDE_COLOR : NEUTRAL_COLOR;
}

function majorityGender(female: number, count: number): number {
  return count > 0 && female * 2 >= count ? FEMALE : MALE;
}

function share(part: number, whole: number): number {
  return whole > 0 ? part / whole : 0;
}

function percentOf(value: number, max: number): number {
  return max > 0 ? (value / max) * 100 : 0;
}

function largest(values: readonly number[]): number {
  return values.reduce((max, value) => Math.max(max, value), 0);
}

function sum(values: readonly number[]): number {
  return values.reduce((total, value) => total + value, 0);
}

export function summaryTiles(stats: ServerStatsSnapshot): StatsTile[] {
  return [
    { label: 'Characters', value: formatCount(stats.totalPlayers) },
    { label: 'Guilds', value: formatCount(stats.uniqueGuilds) },
    { label: 'In a guild', value: formatShare(share(stats.guildedPlayers, stats.totalPlayers)) },
    { label: 'Median item level', value: formatCount(stats.medianItemLevel) },
    { label: 'Female characters', value: formatShare(share(stats.femalePlayers, stats.totalPlayers)) },
    { label: 'Played in total', value: formatPlayedTotal(stats.totalPlayedHours) }
  ];
}

export function realmShares(stats: ServerStatsSnapshot): RealmShare[] {
  return stats.realms.map(realm => {
    const realmShare = share(realm.count, stats.totalPlayers);
    return { name: realm.name, count: formatCount(realm.count), share: realmShare, label: formatShare(realmShare) };
  });
}

export function classRows(stats: ServerStatsSnapshot): StatsBarRow[] {
  const max = largest(stats.classes.map(entry => entry.count));
  return stats.classes.map(entry => ({
    key: String(entry.id),
    icons: [getClassIconPath(entry.id)],
    label: className(entry.id),
    color: classColor(entry.id),
    value: formatCount(entry.count),
    detail: formatRowShare(share(entry.count, stats.totalPlayers)),
    percent: percentOf(entry.count, max),
    barColor: classColor(entry.id)
  }));
}

export function raceRows(stats: ServerStatsSnapshot): StatsBarRow[] {
  const max = largest(stats.races.map(entry => entry.count));
  return stats.races.map(entry => ({
    key: String(entry.id),
    icons: [getRaceIconPath(entry.id, majorityGender(entry.female, entry.count))],
    label: raceLabel(entry.id),
    value: formatCount(entry.count),
    detail: formatRowShare(share(entry.count, stats.totalPlayers)),
    percent: percentOf(entry.count, max),
    barColor: factionColor(raceFaction(entry.id))
  }));
}

export function comboRows(stats: ServerStatsSnapshot, order: 'popular' | 'rare', limit: number): StatsBarRow[] {
  const popular = stats.combos.slice(0, limit);
  const popularKeys = new Set(popular.map(combo => `${combo.race}:${combo.class}`));
  const picked = order === 'popular'
    ? popular
    : stats.combos
      .filter(combo => !popularKeys.has(`${combo.race}:${combo.class}`))
      .sort((left, right) => left.count - right.count || left.race - right.race || left.class - right.class)
      .slice(0, limit);
  const max = largest(picked.map(combo => combo.count));

  return picked.map((combo, index) => ({
    key: `${combo.race}:${combo.class}`,
    rank: index + 1,
    icons: [getRaceIconPath(combo.race, majorityGender(combo.female, combo.count)), getClassIconPath(combo.class)],
    prefix: raceLabel(combo.race),
    label: className(combo.class),
    color: classColor(combo.class),
    value: formatCount(combo.count),
    detail: formatRowShare(share(combo.count, stats.totalPlayers)),
    percent: percentOf(combo.count, max),
    barColor: classColor(combo.class)
  }));
}

export function classRaceMatrix(stats: ServerStatsSnapshot): ClassRaceMatrix {
  const classTotals = new Map(stats.classes.map(entry => [entry.id, entry.count]));
  const races = new Map(stats.races.map(entry => [entry.id, entry]));
  const combos = new Map(stats.combos.map(combo => [`${combo.race}:${combo.class}`, combo]));
  const max: Record<MatrixMode, number> = { count: 0, class: 0, race: 0 };

  const classes: MatrixClass[] = MATRIX_CLASS_IDS.map(id => ({
    id,
    name: className(id),
    color: classColor(id),
    icon: getClassIconPath(id),
    total: classTotals.get(id) ?? 0
  }));

  const groups = MATRIX_FACTIONS.map(faction => ({
    name: faction.name,
    color: faction.color,
    races: RACE_IDS.filter(id => raceFaction(id) === faction.id).map(id => {
      const total = races.get(id)?.count ?? 0;
      const cells = classes.map(entry => {
        const key = `${id}:${entry.id}`;
        const combo = combos.get(key);
        const count = combo?.count ?? 0;
        const cell: MatrixCell = {
          key,
          raceId: id,
          classId: entry.id,
          count,
          female: combo?.female ?? 0,
          ofAll: share(count, stats.totalPlayers),
          ofClass: share(count, entry.total),
          ofRace: share(count, total)
        };
        max.count = Math.max(max.count, cell.count);
        max.class = Math.max(max.class, cell.ofClass);
        max.race = Math.max(max.race, cell.ofRace);
        return cell;
      });

      return {
        id,
        label: raceLabel(id),
        icon: getRaceIconPath(id, majorityGender(races.get(id)?.female ?? 0, total)),
        total,
        cells
      };
    })
  })).filter(group => group.races.some(race => race.total > 0));

  return { classes, groups, max };
}

export function matrixCellValue(cell: MatrixCell, mode: MatrixMode): number {
  return mode === 'count' ? cell.count : mode === 'class' ? cell.ofClass : cell.ofRace;
}

export function matrixHeat(cell: MatrixCell, mode: MatrixMode, matrix: ClassRaceMatrix): number {
  const max = matrix.max[mode];
  return max > 0 ? Math.sqrt(matrixCellValue(cell, mode) / max) : 0;
}

export function matrixCellText(cell: MatrixCell, mode: MatrixMode): string {
  if (cell.count === 0) {
    return '';
  }

  if (mode === 'count') {
    return formatCount(cell.count);
  }

  const percent = Math.round(matrixCellValue(cell, mode) * 100);
  return percent < 1 ? '<1%' : `${percent}%`;
}

export function matrixTopCell(matrix: ClassRaceMatrix): MatrixCell | undefined {
  let top: MatrixCell | undefined;
  for (const group of matrix.groups) {
    for (const race of group.races) {
      for (const cell of race.cells) {
        if (!top || cell.count > top.count) {
          top = cell;
        }
      }
    }
  }
  return top && top.count > 0 ? top : undefined;
}

export function matrixReadout(cell: MatrixCell): MatrixReadout {
  const race = raceLabel(cell.raceId);
  const name = className(cell.classId);
  return {
    icons: [getRaceIconPath(cell.raceId, majorityGender(cell.female, cell.count)), getClassIconPath(cell.classId)],
    race,
    className: name,
    color: classColor(cell.classId),
    count: cell.count === 0 ? 'No characters' : cell.count === 1 ? '1 character' : `${formatCount(cell.count)} characters`,
    facts: cell.count === 0 ? [] : [
      `${formatRowShare(cell.ofAll)} of all characters`,
      `${formatRowShare(cell.ofRace)} of ${race} characters`,
      `${formatRowShare(cell.ofClass)} of ${name} characters`,
      `${formatShare(share(cell.female, cell.count))} female`
    ]
  };
}

function splitRow(key: string, icons: string[], label: string, left: number, count: number, color?: string): StatsSplitRow {
  const leftPercent = Math.round(left * 100);
  return { key, icons, label, color, count, left, leftText: `${leftPercent}%`, rightText: `${100 - leftPercent}%` };
}

function byLeftShare(rows: StatsSplitRow[]): StatsSplitRow[] {
  return rows.sort((left, right) => right.left - left.left || left.label.localeCompare(right.label));
}

export function factionBalance(stats: ServerStatsSnapshot): StatsSplit {
  const horde = stats.factions.find(faction => faction.name === 'Horde')?.count ?? 0;
  const alliance = stats.factions.find(faction => faction.name === 'Alliance')?.count ?? 0;
  const rows = stats.classes
    .filter(entry => entry.horde + entry.alliance > 0)
    .map(entry => splitRow(
      String(entry.id),
      [getClassIconPath(entry.id)],
      className(entry.id),
      share(entry.horde, entry.horde + entry.alliance),
      entry.horde + entry.alliance,
      classColor(entry.id)
    ));

  return {
    total: splitRow('all', [], 'All characters', share(horde, horde + alliance), horde + alliance),
    rows: byLeftShare(rows)
  };
}

export function genderSplit(stats: ServerStatsSnapshot, view: GenderView): StatsSplit {
  const rows = view === 'race'
    ? stats.races.filter(entry => entry.count > 0).map(entry => splitRow(
      `race-${entry.id}`,
      [getRaceIconPath(entry.id, majorityGender(entry.female, entry.count))],
      raceLabel(entry.id),
      share(entry.female, entry.count),
      entry.count
    ))
    : stats.classes.filter(entry => entry.count > 0).map(entry => splitRow(
      `class-${entry.id}`,
      [getClassIconPath(entry.id)],
      className(entry.id),
      share(entry.female, entry.count),
      entry.count,
      classColor(entry.id)
    ));

  return {
    total: splitRow('all', [], 'All characters', share(stats.femalePlayers, stats.totalPlayers), stats.totalPlayers),
    rows: byLeftShare(rows)
  };
}

function classMetricValue(entry: ServerStatsClass, metric: ClassMetric): number {
  return metric === 'itemLevel' ? entry.avgItemLevel : metric === 'played' ? entry.avgPlayedHours : entry.avgAchievementPoints;
}

function formatClassMetric(value: number, metric: ClassMetric): string {
  if (metric === 'itemLevel') {
    return value.toFixed(1);
  }

  return metric === 'played' ? formatDays(value) : formatCount(value);
}

export function itemLevelBaseline(min: number, max: number): number {
  const spread = Math.max(10, max - min);
  return Math.max(0, Math.floor((min - spread) / 10) * 10);
}

export function classAverages(stats: ServerStatsSnapshot, metric: ClassMetric): ClassAverages {
  const values = stats.classes
    .map(entry => ({ id: entry.id, value: classMetricValue(entry, metric) }))
    .filter(entry => entry.value > 0)
    .sort((left, right) => right.value - left.value || left.id - right.id);
  const max = values[0]?.value ?? 0;
  const min = values.at(-1)?.value ?? 0;
  const baseline = metric === 'itemLevel' && values.length ? itemLevelBaseline(min, max) : 0;

  return {
    baseline,
    rows: values.map(({ id, value }) => ({
      key: String(id),
      icons: [getClassIconPath(id)],
      label: className(id),
      color: classColor(id),
      value: formatClassMetric(value, metric),
      percent: max > baseline ? ((value - baseline) / (max - baseline)) * 100 : 100,
      barColor: classColor(id)
    }))
  };
}

export function medianBucket(counts: readonly number[]): number {
  const total = sum(counts);
  let running = 0;
  for (let index = 0; index < counts.length; index++) {
    running += counts[index];
    if (total > 0 && running * 2 >= total) {
      return index;
    }
  }
  return -1;
}

function columnTick(label: string, columnCount: number): string {
  if (/^\d{4}$/.test(label)) {
    return columnCount > SHORT_YEAR_COLUMNS ? `’${label.slice(2)}` : label;
  }

  return label.split('–')[0];
}

export function distributionColumns(distribution: ServerStatsDistribution): StatsColumn[] {
  const total = sum(distribution.counts);
  const max = largest(distribution.counts);
  const median = medianBucket(distribution.counts);

  return distribution.labels.map((label, index) => {
    const count = distribution.counts[index] ?? 0;
    return {
      label,
      tick: columnTick(label, distribution.labels.length),
      count,
      countText: formatCount(count),
      compactText: formatCompact(count),
      shareText: formatShare(share(count, total)),
      percent: percentOf(count, max),
      highlight: index === median
    };
  });
}

export function splitGuildKey(key: string): { name: string; realm: string } {
  const match = /^(.*) \(([^()]+)\)$/.exec(key);
  return match ? { name: match[1], realm: match[2] } : { name: key, realm: '' };
}

export function guildRows(stats: ServerStatsSnapshot, showRealm: boolean): StatsBarRow[] {
  const max = largest(stats.guilds.map(guild => guild.count));
  return stats.guilds.map((guild, index) => {
    const { name, realm } = splitGuildKey(guild.name);
    return {
      key: guild.name,
      rank: index + 1,
      icons: [],
      label: name,
      note: showRealm && realm ? realm : undefined,
      value: formatCount(guild.count),
      percent: percentOf(guild.count, max),
      barColor: GOLD
    };
  });
}

export function statsPageView(stats: ServerStatsSnapshot, allRealms: boolean): StatsPageView {
  const { distributions } = stats;
  return {
    tiles: summaryTiles(stats),
    realms: allRealms ? realmShares(stats) : [],
    matrix: classRaceMatrix(stats),
    popularCombos: comboRows(stats, 'popular', COMBO_LIST_LENGTH),
    rareCombos: comboRows(stats, 'rare', COMBO_LIST_LENGTH),
    classes: classRows(stats),
    races: raceRows(stats),
    faction: factionBalance(stats),
    columns: {
      itemLevel: distributionColumns(distributions.itemLevel),
      achievementPoints: distributionColumns(distributions.achievementPoints),
      honorableKills: distributionColumns(distributions.honorableKills),
      playedDays: distributionColumns(distributions.playedDays),
      level10Year: distributionColumns(distributions.level10Year),
      guildSize: distributionColumns(distributions.guildSize)
    },
    guilds: guildRows(stats, allRealms),
    medianItemLevel: formatCount(stats.medianItemLevel),
    medianPlayed: formatDays(stats.medianPlayedHours),
    avgAchievementPoints: formatCount(stats.avgAchievementPoints),
    avgHonorableKills: formatCount(stats.avgHonorableKills),
    guildCount: formatCount(stats.uniqueGuilds)
  };
}
