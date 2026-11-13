import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Subscription } from 'rxjs';
import { DataFileService } from '../../core/data-file.service';
import { setPageHeader } from '../../core/page-header';
import { injectQueryParamMap, injectReplaceUrl, parsePage } from '../../core/url-state';
import { getArmoryUrl, getGuildArmoryUrl } from '../../game/armory';
import { getClassColor } from '../../game/class-colors';
import { getClassIconPath } from '../../game/classIconHelper';
import { getRaceIconPath } from '../../game/raceIconHelper';
import { CLASS_FILTER_OPTIONS, CLASS_NAMES, RACE_NAMES, REALM_FILTER_OPTIONS, parseClassId, parseRealmSlug } from '../../game/wow';
import { FilterDropdownCoordinatorService } from '../../shared/filter-dropdown-coordinator.service';
import { FilterDropdownComponent } from '../../shared/filter-dropdown.component';
import { FilterDropdownValue } from '../../shared/filter-dropdown.types';
import { LoadStateComponent } from '../../shared/load-state.component';
import { PagerComponent } from '../../shared/pager.component';
import { pageCount, pageSlice } from '../../shared/pager';
import { formatPlayedTime } from './played-time';
import {
  PLAYED_SINCE_LEGION_FILE,
  PLAYED_SINCE_LEGION_PAGE_SIZE,
  PlayedSinceLegionFile,
  PlayedSinceLegionRow,
  launchLabel,
  playedSinceLegionRows,
  playedSinceLegionUrlParams
} from './played-since-legion';

@Component({
  selector: 'app-played-since-legion-page',
  templateUrl: './played-since-legion-page.component.html',
  styleUrls: ['./played-since-legion-page.component.scss'],
  imports: [DecimalPipe, FilterDropdownComponent, LoadStateComponent, PagerComponent],
  providers: [FilterDropdownCoordinatorService],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlayedSinceLegionPageComponent implements OnInit {
  private readonly dataFiles = inject(DataFileService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly replaceUrl = injectReplaceUrl();
  private readonly queryParamMap = injectQueryParamMap();
  private loading?: Subscription;

  readonly realmOptions = REALM_FILTER_OPTIONS;
  readonly classOptions = CLASS_FILTER_OPTIONS;
  readonly realmWidthLabels = REALM_FILTER_OPTIONS.map(option => option.label);
  readonly classWidthLabels = CLASS_FILTER_OPTIONS.map(option => option.label);

  readonly data = signal<PlayedSinceLegionFile | undefined>(undefined);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | undefined>(undefined);
  readonly realm = signal<string | undefined>(undefined);
  readonly classId = signal<number | undefined>(undefined);
  readonly search = signal('');
  readonly page = signal(1);

  readonly rows = computed(() => {
    const data = this.data();
    return data ? playedSinceLegionRows(data, { realm: this.realm(), classId: this.classId(), search: this.search() }) : [];
  });
  readonly pages = computed(() => pageCount(this.rows().length, PLAYED_SINCE_LEGION_PAGE_SIZE));
  readonly currentPage = computed(() => Math.min(this.page(), this.pages()));
  readonly pageRows = computed(() => pageSlice(this.rows(), this.currentPage(), PLAYED_SINCE_LEGION_PAGE_SIZE));
  readonly listed = computed(() => this.data()?.players.length ?? 0);
  readonly launch = computed(() => {
    const launch = this.data()?.launch;
    return launch ? launchLabel(launch) : '';
  });
  readonly filtersActive = computed(() =>
    this.realm() !== undefined || this.classId() !== undefined || this.search().trim() !== ''
  );
  readonly lastEdited = computed(() => {
    const generatedAt = this.data()?.generatedAt;
    return generatedAt ? new Date(generatedAt) : undefined;
  });

  readonly getArmoryUrl = getArmoryUrl;
  readonly getGuildArmoryUrl = getGuildArmoryUrl;
  readonly getClassIconPath = getClassIconPath;
  readonly getRaceIconPath = getRaceIconPath;
  readonly formatPlayedTime = formatPlayedTime;

  constructor() {
    setPageHeader(() => ({ lastEdited: this.lastEdited() }));
  }

  ngOnInit(): void {
    this.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        this.realm.set(parseRealmSlug(params.get('realm')));
        this.classId.set(parseClassId(params.get('class')));
        this.search.set(params.get('q') ?? '');
        this.page.set(parsePage(params.get('page')));
      });

    this.loadData();
  }

  setRealm(value: FilterDropdownValue): void {
    this.realm.set(typeof value === 'string' ? value : undefined);
    this.goToPage(1);
  }

  setClass(value: FilterDropdownValue): void {
    this.classId.set(typeof value === 'number' ? value : undefined);
    this.goToPage(1);
  }

  setSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
    this.goToPage(1);
  }

  resetFilters(): void {
    this.realm.set(undefined);
    this.classId.set(undefined);
    this.search.set('');
    this.goToPage(1);
  }

  goToPage(page: number): void {
    this.page.set(page);
    this.replaceUrl(playedSinceLegionUrlParams({
      realm: this.realm(),
      classId: this.classId(),
      search: this.search(),
      page: this.page()
    }));
  }

  classColor(row: PlayedSinceLegionRow): string {
    return getClassColor(row.class) ?? '#e0e0e0';
  }

  raceAndClass(row: PlayedSinceLegionRow): string {
    return `${RACE_NAMES[row.race] ?? 'Unknown race'} ${CLASS_NAMES[row.class] ?? 'Unknown class'}`;
  }

  loadData(): void {
    this.isLoading.set(true);
    this.loadError.set(undefined);

    this.loading?.unsubscribe();
    this.loading = this.dataFiles.getJson<PlayedSinceLegionFile>(PLAYED_SINCE_LEGION_FILE)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: data => {
          this.data.set(data);
          this.isLoading.set(false);
        },
        error: (error: unknown) => {
          console.error('Failed to load played time since Legion:', error);
          this.loadError.set('The played time could not be loaded. Please try again.');
          this.isLoading.set(false);
        }
      });
  }
}
