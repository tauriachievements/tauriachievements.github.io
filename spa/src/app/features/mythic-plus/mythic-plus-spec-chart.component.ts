import { ChangeDetectionStrategy, Component, computed, input, model, output, signal } from '@angular/core';
import { getClassIconPath } from '../../game/classIconHelper';
import { injectCompactViewport } from '../../shared/compact-viewport';
import { MythicPlusRun } from './mythic-plus';
import { ClassShare, SpecShare, formatShare, shareTicks, specPopularity } from '../../shared/spec-charts/spec-popularity';
import { FlipDirective } from '../../shared/motion/flip.directive';
import { GlideDirective } from '../../shared/motion/glide.directive';
import { MYTHIC_PLUS_CARDS_QUERY } from './mythic-plus-views';
import { RevealDirective } from '../../shared/motion/reveal.directive';
import { TapTooltipDirective } from '../../shared/tap-tooltip.directive';
import { RoleFilterComponent } from '../../shared/role-filter.component';
import { ROLE_FILTER_LABELS, RoleFilter } from '../../game/wow';

type CountMode = 'runs' | 'characters';

interface SpecBar extends SpecShare {
  heightPercent: number;
  shareLabel: string;
  showValue: boolean;
}

interface ClassGroup extends Omit<ClassShare, 'specs'> {
  classIcon: string;
  shareLabel: string;
  specs: SpecBar[];
}

@Component({
  selector: 'app-mythic-plus-spec-chart',
  imports: [TapTooltipDirective, GlideDirective, RevealDirective, FlipDirective, RoleFilterComponent],
  templateUrl: './mythic-plus-spec-chart.component.html',
  styleUrls: ['../../shared/spec-charts/spec-chart.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MythicPlusSpecChartComponent {
  readonly runs = input.required<readonly MythicPlusRun[]>();
  readonly scopeLabel = input('All dungeons');
  readonly seasonName = input('');
  readonly selectedClassId = input<number>();
  readonly selectedSpec = input<string>();
  readonly specSelect = output<{ classId: number; spec: string }>();

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
  readonly countMode = signal<CountMode>('runs');
  readonly minLevel = signal(0);

  readonly collapsible = injectCompactViewport(MYTHIC_PLUS_CARDS_QUERY);
  readonly expanded = signal(false);
  readonly showBody = computed(() => !this.collapsible() || this.expanded());

  readonly isFiltered = computed(() =>
    this.role() !== undefined || this.minLevel() !== 0 || this.countMode() !== 'runs');

  resetFilters(): void {
    this.role.set(undefined);
    this.minLevel.set(0);
    this.countMode.set('runs');
  }

  readonly popularity = computed(() => {
    const role = this.role();
    const minLevel = this.minLevel();
    const runs = minLevel > 0 ? this.runs().filter(run => run.keyLevel >= minLevel) : this.runs();
    return specPopularity(runs, {
      role,
      uniqueCharacters: this.countMode() === 'characters'
    });
  });

  readonly ticks = computed(() => shareTicks(Math.max(0, ...this.popularity().classes
    .flatMap(group => group.specs.map(spec => spec.share)))));

  readonly gridlines = computed(() => {
    const ticks = this.ticks();
    const top = ticks[ticks.length - 1];
    return ticks.map(value => ({ value, position: (value / top) * 100 }));
  });

  readonly groups = computed<ClassGroup[]>(() => {
    const ticks = this.ticks();
    const topShare = ticks[ticks.length - 1] / 100;

    return this.popularity().classes.map(group => ({
      ...group,
      classIcon: getClassIconPath(group.classId),
      shareLabel: formatShare(group.share),
      specs: group.specs.map((spec, index) => ({
        ...spec,
        heightPercent: (spec.share / topShare) * 100,
        shareLabel: formatShare(spec.share),
        showValue: index === 0 && spec.count > 0
      }))
    }));
  });

  readonly unitLabel = computed(() => this.countMode() === 'characters' ? 'characters' : 'player slots');

  isSelectedClass(classId: number): boolean {
    return this.selectedClassId() === classId;
  }

  isSelectedSpec(classId: number, spec: string): boolean {
    return this.isSelectedClass(classId) && (!this.selectedSpec() || this.selectedSpec() === spec);
  }

  readonly subtitle = computed(() => {
    const { total, runCount } = this.popularity();
    const selected = this.role();
    const role = selected ? ROLE_FILTER_LABELS[selected] : 'All roles';
    const count = this.countMode() === 'characters' ? 'Unique characters' : 'All runs';
    const minLevel = this.minLevel();

    return [
      this.scopeLabel(),
      role,
      minLevel > 0 ? `Keys +${minLevel} and higher` : 'All keys',
      count,
      `${total} ${this.unitLabel()} from ${runCount} ${runCount === 1 ? 'run' : 'runs'}`,
      'Grouped by popularity'
    ].join(' · ');
  });
}
