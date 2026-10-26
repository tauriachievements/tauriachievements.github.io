import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ParamMap } from '@angular/router';
import { LadderLastUpdatedService } from '../../players/ladder-last-updated.service';
import { Realm } from '../../game/wow';
import { setPageHeader } from '../../core/page-header';
import { injectQueryParamMap, injectReplaceUrl } from '../../core/url-state';
import { FilterDropdownComponent } from '../../shared/filter-dropdown.component';
import { FilterDropdownCoordinatorService } from '../../shared/filter-dropdown-coordinator.service';
import { FilterDropdownValue } from '../../shared/filter-dropdown.types';
import { LoadStateComponent } from '../../shared/load-state.component';
import { CountUpDirective } from '../../shared/motion/count-up.directive';
import { GlideDirective } from '../../shared/motion/glide.directive';
import { ServerStatsService, ServerStatsSnapshotCollection } from './server-stats.service';
import {
  DEFAULT_STATS_LEVEL,
  STATS_LEVEL_OPTIONS,
  STATS_REALM_OPTIONS,
  StatsLevelFilter,
  parseStatsLevel,
  parseStatsRealm,
  selectStatsSnapshot,
  statsUrlParams
} from './realm-stats';
import {
  ALLIANCE_COLOR,
  ClassMetric,
  FEMALE_COLOR,
  GenderView,
  HORDE_COLOR,
  MALE_COLOR,
  MatrixMode,
  classAverages,
  genderSplit,
  statsPageView
} from './realm-stats-views';
import { ClassRaceMatrixComponent } from './class-race-matrix.component';
import { StatsBarListComponent } from './stats-bar-list.component';
import { StatsColumnChartComponent } from './stats-column-chart.component';
import { StatsSplitBarsComponent } from './stats-split-bars.component';

@Component({
  selector: 'app-stats-page',
  templateUrl: './stats-page.component.html',
  styleUrls: ['./stats-page.component.scss'],
  imports: [
    ClassRaceMatrixComponent,
    CountUpDirective,
    FilterDropdownComponent,
    GlideDirective,
    LoadStateComponent,
    StatsBarListComponent,
    StatsColumnChartComponent,
    StatsSplitBarsComponent
  ],
  providers: [FilterDropdownCoordinatorService],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatsPageComponent {
  private readonly serverStatsService = inject(ServerStatsService);
  private readonly ladderLastUpdatedService = inject(LadderLastUpdatedService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly replaceUrl = injectReplaceUrl();
  private readonly queryParamMap = injectQueryParamMap();

  readonly realmOptions = STATS_REALM_OPTIONS;
  readonly levelOptions = STATS_LEVEL_OPTIONS;
  readonly realmWidthLabels = STATS_REALM_OPTIONS.map(option => option.label);
  readonly levelWidthLabels = STATS_LEVEL_OPTIONS.map(option => option.label);
  readonly hordeColor = HORDE_COLOR;
  readonly allianceColor = ALLIANCE_COLOR;
  readonly femaleColor = FEMALE_COLOR;
  readonly maleColor = MALE_COLOR;

  readonly lastEdited = signal<Date | undefined>(undefined);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | undefined>(undefined);
  private readonly collection = signal<ServerStatsSnapshotCollection | undefined>(undefined);

  readonly realm = signal<Realm | undefined>(undefined);
  readonly level = signal<StatsLevelFilter>(DEFAULT_STATS_LEVEL);
  readonly filtersActive = computed(() => this.realm() !== undefined || this.level() !== DEFAULT_STATS_LEVEL);

  readonly matrixMode = signal<MatrixMode>('count');
  readonly genderView = signal<GenderView>('race');
  readonly classMetric = signal<ClassMetric>('itemLevel');

  private readonly stats = computed(() => selectStatsSnapshot(this.collection(), this.realm(), this.level()));
  readonly view = computed(() => {
    const stats = this.stats();
    return stats ? statsPageView(stats, this.realm() === undefined) : undefined;
  });
  readonly gender = computed(() => {
    const stats = this.stats();
    return stats ? genderSplit(stats, this.genderView()) : undefined;
  });
  readonly classAverage = computed(() => {
    const stats = this.stats();
    return stats ? classAverages(stats, this.classMetric()) : undefined;
  });

  constructor() {
    setPageHeader(() => ({ lastEdited: this.lastEdited() }));
    this.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => this.applyUrl(params));
    this.loadLastUpdated();
    this.loadData();
  }

  loadData(): void {
    this.isLoading.set(true);
    this.loadError.set(undefined);
    this.serverStatsService.getServerStats()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: collection => {
          this.collection.set(collection);
          this.isLoading.set(false);
        },
        error: error => {
          console.error('Failed to load server statistics:', error);
          this.loadError.set('The statistics could not be loaded.');
          this.isLoading.set(false);
        }
      });
  }

  setRealm(value: FilterDropdownValue): void {
    this.realm.set(parseStatsRealm(value));
    this.writeUrl();
  }

  setLevel(value: FilterDropdownValue): void {
    this.level.set(parseStatsLevel(value));
    this.writeUrl();
  }

  resetFilters(): void {
    this.realm.set(undefined);
    this.level.set(DEFAULT_STATS_LEVEL);
    this.writeUrl();
  }

  private applyUrl(params: ParamMap): void {
    this.realm.set(parseStatsRealm(params.get('realm')));
    this.level.set(parseStatsLevel(params.get('level')));
  }

  private writeUrl(): void {
    this.replaceUrl(statsUrlParams(this.realm(), this.level()));
  }

  private loadLastUpdated(): void {
    this.ladderLastUpdatedService.getLastUpdated()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(lastUpdated => {
        if (lastUpdated) {
          this.lastEdited.set(lastUpdated.date);
        }
      });
  }
}
