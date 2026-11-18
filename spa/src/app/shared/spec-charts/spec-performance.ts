import { getClassColor } from '../../game/class-colors';
import { getClassIconPath } from '../../game/classIconHelper';
import { CLASS_NAMES, RoleFilter, matchesRoleFilter } from '../../game/wow';
import { LEGION_SPECS, LegionSpec } from '../../game/wow-specs';
import { SpecChart, SpecChartBar, compareSpecLists } from './spec-popularity';

export type ChartView = 'popularity' | 'performance';

export const CHART_VIEWS: ReadonlyArray<{ value: ChartView; label: string }> = [
  { value: 'popularity', label: 'Popularity' },
  { value: 'performance', label: 'Performance' }
];

export function parseChartView(value: string | null | undefined): ChartView {
  return value === 'performance' ? 'performance' : 'popularity';
}

export const SPEC_TOP_SCORES = 10;

export function topAverage(scores: readonly number[], count: number = SPEC_TOP_SCORES): number {
  const top = [...scores].sort((a, b) => b - a).slice(0, count);
  return top.length ? Math.round(top.reduce((sum, score) => sum + score, 0) / top.length) : 0;
}

export interface SpecPerformance<T> extends LegionSpec {
  count: number;
  score: number;
  best?: T;
}

export interface ClassPerformance<T> {
  classId: number;
  className: string;
  color: string;
  count: number;
  score: number;
  specs: SpecPerformance<T>[];
}

export interface SpecPerformanceSummary<T> {
  characterCount: number;
  classes: ClassPerformance<T>[];
}

export function summarizeSpecScores<T extends { score: number }>(
  rankedScoresFor: (definition: LegionSpec) => readonly T[],
  characterKey: (entry: T) => string,
  role?: RoleFilter
): SpecPerformanceSummary<T> {
  const groups = new Map<number, { group: ClassPerformance<T>; characters: Map<string, number> }>();
  const characters = new Set<string>();

  for (const definition of LEGION_SPECS) {
    if (!matchesRoleFilter(definition, role)) {
      continue;
    }

    let entry = groups.get(definition.classId);
    if (!entry) {
      entry = {
        group: {
          classId: definition.classId,
          className: CLASS_NAMES[definition.classId] ?? 'Unknown',
          color: getClassColor(definition.classId) ?? '#9a9a9a',
          count: 0,
          score: 0,
          specs: []
        },
        characters: new Map()
      };
      groups.set(definition.classId, entry);
    }

    const specScores = rankedScoresFor(definition);
    entry.group.specs.push({
      ...definition,
      count: specScores.length,
      score: topAverage(specScores.map(score => score.score)),
      best: specScores[0]
    });

    for (const scored of specScores) {
      const key = characterKey(scored);
      characters.add(key);
      entry.characters.set(key, Math.max(entry.characters.get(key) ?? 0, scored.score));
    }
  }

  const classes = [...groups.values()].map(({ group, characters: classCharacters }) => {
    group.count = classCharacters.size;
    group.score = topAverage([...classCharacters.values()]);
    group.specs.sort((a, b) => b.score - a.score);
    return group;
  });
  classes.sort((a, b) => compareSpecLists(a.specs, b.specs, spec => spec.score) || a.classId - b.classId);

  return { characterCount: characters.size, classes };
}

export function describeScoreSample(count: number): string {
  if (count === 1) {
    return 'Only 1 character';
  }
  return count > SPEC_TOP_SCORES
    ? `Average of the top ${SPEC_TOP_SCORES} of ${count.toLocaleString('en-US')} characters`
    : `Average of all ${count} characters`;
}

export function scoreTicks(maxScore: number): number[] {
  const step = [100, 200, 250, 500, 1000, 2000].find(candidate => maxScore / candidate <= 5) ?? 2000;
  const top = Math.max(step, Math.ceil(maxScore / step) * step);
  return Array.from({ length: top / step + 1 }, (_, index) => index * step);
}

export function formatScoreTick(score: number): string {
  return score >= 1000 ? `${score / 1000}k` : String(score);
}

export interface PerformanceBar<T> extends SpecChartBar<T> {
  score: number;
}

export function performanceChart<T>(performance: SpecPerformanceSummary<T>): SpecChart<PerformanceBar<T>> {
  const ticks = scoreTicks(Math.max(0, ...performance.classes.flatMap(group => group.specs.map(spec => spec.score))));
  const top = ticks[ticks.length - 1];

  return {
    gridlines: ticks.map(value => ({ value, position: (value / top) * 100, label: formatScoreTick(value) })),
    groups: performance.classes.map(group => ({
      classId: group.classId,
      className: group.className,
      color: group.color,
      classIcon: getClassIconPath(group.classId),
      valueLabel: group.count ? String(group.score) : '-',
      specs: group.specs.map((spec, index) => ({
        ...spec,
        heightPercent: (spec.score / top) * 100,
        valueLabel: String(spec.score),
        showValue: index === 0 && spec.count > 0
      }))
    }))
  };
}
