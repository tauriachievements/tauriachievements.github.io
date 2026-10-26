import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { getArmoryUrl } from '../../game/armory';
import { DataFileService } from '../../core/data-file.service';
import { getClassColor } from '../../game/class-colors';
import { CLASS_FILTER_OPTIONS, REALM_FILTER_OPTIONS } from '../../game/wow';
import { injectReplaceUrl, parsePage } from '../../core/url-state';
import { FilterDropdownCoordinatorService } from '../../shared/filter-dropdown-coordinator.service';
import { FilterDropdownComponent } from '../../shared/filter-dropdown.component';
import { FilterDropdownValue } from '../../shared/filter-dropdown.types';
import { PagerComponent } from '../../shared/pager.component';
import { pageCount, pageSlice } from '../../shared/pager';
import { SkeletonComponent } from '../../shared/skeleton.component';
import {
  ALL_SEASONS_OPTION,
  EliteCatalog,
  ElitePvpItemsFile,
  NO_OTHER_ITEM_OPTION,
  OwnerQuery,
  OwnerRow,
  RareItemsDataset,
  characterCount,
  decodeEliteCatalog,
  emptyOwnersMessage,
  eliteSeasonOptions,
  findOwners,
  fitOwnerQuery,
  hasOwnerFilters,
  otherItemOptions,
  otherPickFromValue,
  otherPickValue,
  ownerUrlParams,
  ownersHeading,
  parseOwnerQuery
} from './rare-items';

const PAGE_SIZE = 50;

@Component({
  selector: 'app-rare-items-page',
  templateUrl: './rare-items-page.component.html',
  styleUrls: ['./rare-items-page.component.scss'],
  imports: [FilterDropdownComponent, PagerComponent, SkeletonComponent],
  providers: [FilterDropdownCoordinatorService],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RareItemsPageComponent implements OnInit {
  private readonly dataFiles = inject(DataFileService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly replaceUrl = injectReplaceUrl();

  readonly dataset = signal<RareItemsDataset | undefined>(undefined);
  readonly catalog = signal<EliteCatalog | undefined>(undefined);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | undefined>(undefined);

  private readonly requestedQuery = signal<OwnerQuery>(parseOwnerQuery(name => this.route.snapshot.queryParamMap.get(name)));
  private readonly requestedPage = signal(parsePage(this.route.snapshot.queryParamMap.get('page')));

  readonly classOptions = CLASS_FILTER_OPTIONS;
  readonly realmOptions = REALM_FILTER_OPTIONS;

  readonly query = computed(() => {
    const dataset = this.dataset();
    const catalog = this.catalog();
    return dataset && catalog ? fitOwnerQuery(this.requestedQuery(), dataset, catalog) : this.requestedQuery();
  });
  readonly seasonOptions = computed(() => {
    const catalog = this.catalog();
    return catalog ? eliteSeasonOptions(catalog, this.query().classId) : [ALL_SEASONS_OPTION];
  });
  readonly otherOptions = computed(() => {
    const dataset = this.dataset();
    const catalog = this.catalog();
    return dataset && catalog ? otherItemOptions(dataset, catalog) : [NO_OTHER_ITEM_OPTION];
  });
  readonly otherValue = computed(() => otherPickValue(this.query().other));
  readonly owners = computed<OwnerRow[]>(() => {
    const dataset = this.dataset();
    const catalog = this.catalog();
    return dataset && catalog ? findOwners(dataset, catalog, this.query()) : [];
  });
  readonly heading = computed(() => {
    const dataset = this.dataset();
    const catalog = this.catalog();
    return dataset && catalog ? ownersHeading(dataset, catalog, this.query()) : undefined;
  });
  readonly ownerCount = computed(() => characterCount(this.owners().length));
  readonly emptyMessage = computed(() => emptyOwnersMessage(this.query()));
  readonly showPieces = computed(() => this.query().other?.kind !== 'item');
  readonly pages = computed(() => pageCount(this.owners().length, PAGE_SIZE));
  readonly page = computed(() => Math.min(this.requestedPage(), this.pages()));
  readonly pageRows = computed(() => pageSlice(this.owners(), this.page(), PAGE_SIZE));
  readonly canReset = computed(() => hasOwnerFilters(this.query()) || this.page() > 1);

  ngOnInit(): void {
    this.loadData();
  }

  selectClass(value: FilterDropdownValue): void {
    this.setQuery({ ...this.query(), classId: typeof value === 'number' ? value : undefined });
  }

  selectSeason(value: FilterDropdownValue): void {
    this.setQuery({ ...this.query(), season: typeof value === 'string' ? value : undefined, other: undefined });
  }

  selectOther(value: FilterDropdownValue): void {
    this.setQuery({ ...this.query(), season: undefined, other: otherPickFromValue(value) });
  }

  selectRealm(value: FilterDropdownValue): void {
    this.setQuery({ ...this.query(), realm: typeof value === 'string' ? value : undefined });
  }

  resetFilters(): void {
    this.setQuery({});
  }

  goToPage(page: number): void {
    this.requestedPage.set(page);
    this.writeUrl();
  }

  retryLoad(): void {
    this.loadData();
  }

  armoryUrl(row: OwnerRow): string {
    return getArmoryUrl(row.character.name, row.character.realm);
  }

  classColor(row: OwnerRow): string {
    return getClassColor(row.character.class) ?? '#b7df86';
  }

  private setQuery(query: OwnerQuery): void {
    this.requestedQuery.set(query);
    this.requestedPage.set(1);
    this.writeUrl();
  }

  private writeUrl(): void {
    this.replaceUrl(ownerUrlParams(this.query(), this.page()));
  }

  private loadData(): void {
    this.isLoading.set(true);
    this.loadError.set(undefined);

    forkJoin({
      dataset: this.dataFiles.getJson<RareItemsDataset>('RareItems.json'),
      catalog: this.dataFiles.getJson<ElitePvpItemsFile>('elite-pvp-items.json')
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ dataset, catalog }) => {
          try {
            this.catalog.set(decodeEliteCatalog(catalog));
            this.dataset.set(dataset);
          } catch (error) {
            this.fail(error);
            return;
          }
          this.isLoading.set(false);
        },
        error: error => this.fail(error)
      });
  }

  private fail(error: unknown): void {
    console.error('Failed to load rare items:', error);
    this.loadError.set('The rare-item data could not be loaded. Please try again.');
    this.isLoading.set(false);
  }
}
