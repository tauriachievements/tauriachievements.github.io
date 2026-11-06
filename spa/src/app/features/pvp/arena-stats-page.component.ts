import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ParamMap } from '@angular/router';
import { Subscription } from 'rxjs';
import { DataFileService } from '../../core/data-file.service';
import { setPageHeader } from '../../core/page-header';
import { injectQueryParamMap, injectReplaceUrl } from '../../core/url-state';
import { Role, RoleFilter, parseRoleFilter } from '../../game/wow';
import { FilterDropdownCoordinatorService } from '../../shared/filter-dropdown-coordinator.service';
import { LoadStateComponent } from '../../shared/load-state.component';
import { GlideDirective } from '../../shared/motion/glide.directive';
import { RoleFilterComponent } from '../../shared/role-filter.component';
import { SkeletonComponent } from '../../shared/skeleton.component';
import { RaceBySpecComponent } from '../../shared/spec-charts/race-by-spec.component';
import { specPopularity } from '../../shared/spec-charts/spec-popularity';
import { SpecPopularityChartComponent } from '../../shared/spec-charts/spec-popularity-chart.component';
import { ARENA_BRACKETS, ArenaBracket, ArenaLadderFile, getArenaLadderFile, parseArenaBracket } from './arena-games';
import {
  ARENA_RATING_OPTIONS,
  arenaRaceContext,
  arenaSpecSamples,
  arenaStatsEmptyText,
  arenaStatsSubtitle,
  arenaStatsUrlParams,
  parseRatingFloor
} from './arena-stats';

@Component({
  selector: 'app-arena-stats-page',
  templateUrl: './arena-stats-page.component.html',
  styleUrls: ['../../shared/spec-charts/spec-chart.scss', './arena-stats-page.component.scss'],
  imports: [GlideDirective, LoadStateComponent, RaceBySpecComponent, RoleFilterComponent, SkeletonComponent, SpecPopularityChartComponent],
  providers: [FilterDropdownCoordinatorService],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ArenaStatsPageComponent {
  private readonly dataFiles = inject(DataFileService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly replaceUrl = injectReplaceUrl();
  private readonly queryParamMap = injectQueryParamMap();
  private loading?: Subscription;

  readonly brackets = ARENA_BRACKETS;
  readonly ratingOptions = ARENA_RATING_OPTIONS;
  readonly raceRoles: readonly Role[] = ['dps', 'healer', 'tank'];

  private readonly requestedBracket = signal<ArenaBracket | undefined>(undefined);
  readonly bracket = computed(() => this.requestedBracket() ?? '2v2');
  readonly ratingFloor = signal<number | undefined>(undefined);
  readonly role = signal<RoleFilter | undefined>(undefined);
  readonly dataset = signal<ArenaLadderFile | undefined>(undefined);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | undefined>(undefined);

  readonly samples = computed(() => arenaSpecSamples(this.dataset()?.players ?? [], this.ratingFloor()));
  readonly popularity = computed(() => specPopularity([{ roster: this.samples() }], { role: this.role() }));
  readonly subtitle = computed(() => arenaStatsSubtitle({
    bracket: this.bracket(),
    ratingFloor: this.ratingFloor(),
    role: this.role(),
    total: this.popularity().total
  }));
  readonly raceContext = computed(() => arenaRaceContext(this.bracket(), this.ratingFloor()));
  readonly emptyText = computed(() => arenaStatsEmptyText(this.bracket(), this.ratingFloor(), this.role()));
  readonly isFiltered = computed(() => this.ratingFloor() !== undefined || this.role() !== undefined);
  readonly lastEdited = computed(() => {
    const generatedAt = this.dataset()?.generatedAt;
    return generatedAt ? new Date(generatedAt) : undefined;
  });

  constructor() {
    setPageHeader(() => ({ lastEdited: this.lastEdited() }));
    this.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => this.applyUrl(params));
  }

  selectBracket(bracket: ArenaBracket): void {
    if (bracket === this.bracket()) {
      return;
    }

    this.requestedBracket.set(bracket);
    this.writeUrl();
    this.loadData();
  }

  setRatingFloor(ratingFloor: number | undefined): void {
    this.ratingFloor.set(ratingFloor);
    this.writeUrl();
  }

  setRole(role: RoleFilter | undefined): void {
    this.role.set(role);
    this.writeUrl();
  }

  resetFilters(): void {
    this.ratingFloor.set(undefined);
    this.role.set(undefined);
    this.writeUrl();
  }

  loadData(): void {
    const bracket = this.bracket();
    this.isLoading.set(true);
    this.loadError.set(undefined);
    this.dataset.set(undefined);

    this.loading?.unsubscribe();
    this.loading = this.dataFiles.getJson<ArenaLadderFile>(getArenaLadderFile(bracket))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: dataset => {
          this.dataset.set(dataset);
          this.isLoading.set(false);
        },
        error: error => {
          console.error(`Failed to load the rated ${bracket} arena ladder:`, error);
          this.loadError.set('The arena data could not be loaded.');
          this.isLoading.set(false);
        }
      });
  }

  private applyUrl(params: ParamMap): void {
    this.ratingFloor.set(parseRatingFloor(params.get('rating')));
    this.role.set(parseRoleFilter(params.get('role')));
    const bracket = parseArenaBracket(params.get('bracket'));
    if (bracket !== this.requestedBracket()) {
      this.requestedBracket.set(bracket);
      this.loadData();
    }
  }

  private writeUrl(): void {
    this.replaceUrl(arenaStatsUrlParams({ bracket: this.bracket(), ratingFloor: this.ratingFloor(), role: this.role() }));
  }
}
