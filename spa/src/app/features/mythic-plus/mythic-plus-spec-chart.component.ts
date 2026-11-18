import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, model, output, signal } from '@angular/core';
import { injectCompactViewport } from '../../shared/compact-viewport';
import { MythicPlusRun, PlayerScore, rankPlayersBySpec } from './mythic-plus';
import { SpecChart, SpecChartBar, SpecChartGroup, popularityChart, specPopularity } from '../../shared/spec-charts/spec-popularity';
import {
  CHART_VIEWS,
  ChartView,
  SPEC_TOP_SCORES,
  describeScoreSample,
  performanceChart,
  summarizeSpecScores
} from '../../shared/spec-charts/spec-performance';
import { FlipDirective } from '../../shared/motion/flip.directive';
import { GlideDirective } from '../../shared/motion/glide.directive';
import { MYTHIC_PLUS_CARDS_QUERY } from './mythic-plus-views';
import { RevealDirective } from '../../shared/motion/reveal.directive';
import { TapTooltipDirective } from '../../shared/tap-tooltip.directive';
import { RoleFilterComponent } from '../../shared/role-filter.component';
import { ROLE_FILTER_LABELS, RoleFilter } from '../../game/wow';

type CountMode = 'runs' | 'characters';

type SpecBar = SpecChartBar<PlayerScore>;

@Component({
  selector: 'app-mythic-plus-spec-chart',
  imports: [TapTooltipDirective, GlideDirective, RevealDirective, FlipDirective, RoleFilterComponent, DecimalPipe],
  templateUrl: './mythic-plus-spec-chart.component.html',
  styleUrls: ['../../shared/spec-charts/spec-chart.scss', '../../shared/spec-charts/spec-popularity-chart.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MythicPlusSpecChartComponent {
  readonly runs = input.required<readonly MythicPlusRun[]>();
  readonly scopeLabel = input('All dungeons');
  readonly seasonName = input('');
  readonly selectedClassId = input<number>();
  readonly selectedSpec = input<string>();
  readonly specSelect = output<{ classId: number; spec: string }>();

  readonly viewOptions = CHART_VIEWS;
  readonly countOptions: ReadonlyArray<{ value: CountMode; label: string }> = [
    { value: 'runs', label: 'All runs' },
    { value: 'characters', label: 'Unique characters' }
  ];
  readonly levelOptions: ReadonlyArray<{ value: number; label: string; title: string }> = [
    { value: 0, label: 'All keys', title: 'Keys of every level' },
    { value: 5, label: '+5', title: 'Keys +5 and higher' },
    { value: 10, label: '+10', title: 'Keys +10 and higher' },
    { value: 15, label: '+15', title: 'Keys +15 and higher' }
  ];

  readonly role = model<RoleFilter>();
  readonly view = signal<ChartView>('popularity');
  readonly countMode = signal<CountMode>('runs');
  readonly minLevel = signal(0);

  readonly collapsible = injectCompactViewport(MYTHIC_PLUS_CARDS_QUERY);
  readonly expanded = signal(false);
  readonly showBody = computed(() => !this.collapsible() || this.expanded());

  readonly isFiltered = computed(() =>
    this.role() !== undefined
      || this.minLevel() !== 0
      || (this.view() === 'popularity' && this.countMode() !== 'runs'));

  resetFilters(): void {
    this.role.set(undefined);
    this.minLevel.set(0);
    this.countMode.set('runs');
  }

  private readonly levelRuns = computed(() => {
    const minLevel = this.minLevel();
    return minLevel > 0 ? this.runs().filter(run => run.keyLevel >= minLevel) : this.runs();
  });

  readonly popularity = computed(() => specPopularity(this.levelRuns(), {
    role: this.role(),
    uniqueCharacters: this.countMode() === 'characters'
  }));

  private readonly specScores = computed(() => rankPlayersBySpec(this.levelRuns()));

  readonly performance = computed(() => {
    const scores = this.specScores();
    return summarizeSpecScores(definition => scores.get(definition) ?? [], player => player.key, this.role());
  });

  readonly hasData = computed(() =>
    this.view() === 'performance' ? this.performance().characterCount > 0 : this.popularity().total > 0);

  readonly plot = computed<SpecChart<SpecBar>>(() =>
    this.view() === 'performance' ? performanceChart(this.performance()) : popularityChart(this.popularity()));

  readonly title = computed(() => this.view() === 'performance' ? 'Spec Performance' : 'Spec Popularity');

  readonly unitLabel = computed(() => this.countMode() === 'characters' ? 'characters' : 'player slots');

  isSelectedClass(classId: number): boolean {
    return this.selectedClassId() === classId;
  }

  isSelectedSpec(classId: number, spec: string): boolean {
    return this.isSelectedClass(classId) && (!this.selectedSpec() || this.selectedSpec() === spec);
  }

  readonly subtitle = computed(() => {
    const selected = this.role();
    const role = selected ? ROLE_FILTER_LABELS[selected] : 'All roles';
    const minLevel = this.minLevel();
    const keys = minLevel > 0 ? `Keys +${minLevel} and higher` : 'All keys';

    if (this.view() === 'performance') {
      const { characterCount } = this.performance();
      return [
        this.scopeLabel(),
        role,
        keys,
        `${characterCount.toLocaleString('en-US')} ${characterCount === 1 ? 'character' : 'characters'}`,
        `Each spec's top ${SPEC_TOP_SCORES} scores, averaged`
      ].join(' · ');
    }

    const { total, runCount } = this.popularity();
    return [
      this.scopeLabel(),
      role,
      keys,
      this.countMode() === 'characters' ? 'Unique characters' : 'All runs',
      `${total} ${this.unitLabel()} from ${runCount} ${runCount === 1 ? 'run' : 'runs'}`,
      'Grouped by popularity'
    ].join(' · ');
  });

  scoreSample(spec: SpecBar): string {
    return describeScoreSample(spec.count);
  }

  barLabel(spec: SpecBar, group: SpecChartGroup<SpecBar>): string {
    const name = `Show ${spec.spec} ${group.className} players`;
    if (this.view() === 'performance') {
      return spec.count ? `${name}: score ${spec.valueLabel}. ${this.scoreSample(spec)}` : `${name}: nobody played it`;
    }
    return `${name}: ${spec.valueLabel}, ${spec.count} of ${this.popularity().total} ${this.unitLabel()}`;
  }
}
