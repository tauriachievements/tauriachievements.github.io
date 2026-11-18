import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, model, output } from '@angular/core';
import { FlipDirective } from '../../shared/motion/flip.directive';
import { GlideDirective } from '../../shared/motion/glide.directive';
import { SpecChart, SpecChartBar, SpecChartGroup, popularityChart, specPopularity } from '../../shared/spec-charts/spec-popularity';
import { CHART_VIEWS, ChartView, SPEC_TOP_SCORES, describeScoreSample, performanceChart } from '../../shared/spec-charts/spec-performance';
import { RaidBoss, RaidDifficulty, RaidKillDetails } from './raid-logs.types';
import { ROLE_FILTER_LABELS, RoleFilter } from '../../game/wow';
import { RoleFilterComponent } from '../../shared/role-filter.component';
import { SpecCharacterScore, scoresBySpecForKills, specPerformance } from './raid-scores';
import { RevealDirective } from '../../shared/motion/reveal.directive';
import { SkeletonComponent } from '../../shared/skeleton.component';
import { TapTooltipDirective } from '../../shared/tap-tooltip.directive';

type SpecBar = SpecChartBar<SpecCharacterScore>;

@Component({
  selector: 'app-raid-spec-popularity-chart',
  imports: [TapTooltipDirective, GlideDirective, RevealDirective, FlipDirective, DecimalPipe, SkeletonComponent, RoleFilterComponent],
  templateUrl: './raid-spec-popularity-chart.component.html',
  styleUrls: [
    '../../shared/spec-charts/spec-chart.scss',
    '../../shared/spec-charts/spec-popularity-chart.component.scss',
    './raid-spec-popularity-chart.component.scss'
  ],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RaidSpecPopularityChartComponent {
  readonly kills = input.required<readonly RaidKillDetails[]>();
  readonly bosses = input<readonly RaidBoss[]>([]);
  readonly difficulties = input.required<readonly RaidDifficulty[]>();
  readonly selectedDifficulty = input.required<string>();
  readonly raidName = input('The Emerald Nightmare');
  readonly loading = input(false);
  readonly error = input<string>();

  readonly difficultyChange = output<string>();
  readonly retry = output<void>();

  readonly viewOptions = CHART_VIEWS;
  readonly view = model<ChartView>('popularity');

  readonly role = model<RoleFilter>();

  readonly shownDifficulties = computed(() => this.difficulties().filter(difficulty =>
    difficulty.kills > 0 && ['normal', 'heroic', 'mythic'].includes(difficulty.slug)));

  readonly popularity = computed(() => {
    const role = this.role();
    return specPopularity(this.kills().map(kill => ({
      roster: kill.members.flatMap(member => member.spec ? [{
        name: member.character.name,
        realm: member.character.realm,
        class: member.character.classId,
        spec: member.spec.name,
        role: member.spec.role,
        range: member.spec.range
      }] : [])
    })), { role });
  });

  private readonly specScores = computed(() => scoresBySpecForKills(this.bosses(), this.kills()));

  readonly performance = computed(() => {
    const role = this.role();
    return specPerformance(this.specScores(), role);
  });

  readonly hasData = computed(() =>
    this.view() === 'performance' ? this.performance().characterCount > 0 : this.popularity().total > 0);

  readonly plot = computed<SpecChart<SpecBar>>(() =>
    this.view() === 'performance' ? performanceChart(this.performance()) : popularityChart(this.popularity()));

  readonly selectedDifficultyName = computed(() =>
    this.difficulties().find(difficulty => difficulty.slug === this.selectedDifficulty())?.name
      ?? this.selectedDifficulty());

  readonly title = computed(() => this.view() === 'performance' ? 'Spec Performance' : 'Spec Popularity');

  readonly subtitle = computed(() => {
    const selected = this.role();
    const role = selected ? ROLE_FILTER_LABELS[selected] : 'All roles';

    if (this.view() === 'performance') {
      const { characterCount } = this.performance();
      return [
        `${this.selectedDifficultyName()} raids`,
        role,
        `${characterCount.toLocaleString('en-US')} ${characterCount === 1 ? 'character' : 'characters'}`,
        `Each spec's top ${SPEC_TOP_SCORES} ${this.scoreNoun()}, averaged`
      ].join(' · ');
    }

    const { total, runCount } = this.popularity();
    return [
      `${this.selectedDifficultyName()} raids`,
      role,
      `${total.toLocaleString('en-US')} player slots from ${runCount.toLocaleString('en-US')} ${runCount === 1 ? 'kill' : 'kills'}`,
      'Grouped by popularity'
    ].join(' · ');
  });

  private scoreNoun(): string {
    const role = this.role();
    if (role === undefined) {
      return 'leaderboard scores (DPS, Tank or Healer)';
    }
    return role === 'tank' || role === 'healer' ? `${ROLE_FILTER_LABELS[role]} scores` : 'DPS scores';
  }

  scoreKind(spec: SpecBar): string {
    return `${ROLE_FILTER_LABELS[spec.role]} score`;
  }

  scoreSample(spec: SpecBar): string {
    return describeScoreSample(spec.count);
  }

  barLabel(spec: SpecBar, group: SpecChartGroup<SpecBar>): string {
    const name = `${spec.spec} ${group.className}`;
    if (this.view() === 'performance') {
      return spec.count
        ? `${name}: ${this.scoreKind(spec)} ${spec.valueLabel}. ${this.scoreSample(spec)}`
        : `${name}: nobody scored`;
    }
    return `${name}: ${spec.valueLabel}, ${spec.count.toLocaleString('en-US')} player slots`;
  }

  difficultyLabel(difficulty: RaidDifficulty): string {
    return difficulty.slug === 'heroic' ? 'HC' : difficulty.name;
  }
}
