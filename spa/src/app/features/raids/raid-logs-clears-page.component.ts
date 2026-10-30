import { DatePipe, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FilterDropdownComponent } from '../../shared/filter-dropdown.component';
import { FilterDropdownCoordinatorService } from '../../shared/filter-dropdown-coordinator.service';
import { FilterDropdownOption, FilterDropdownValue } from '../../shared/filter-dropdown.types';
import { RaidDifficultySwitchComponent } from './raid-difficulty-switch.component';
import { RaidPickupIconComponent } from './raid-pickup-icon.component';
import { ClearGroups, ClearSplit, RankedClear, clearSplits, rankClears } from './raid-clears';
import { RaidLogsIndex } from './raid-logs.types';
import { defaultDifficulty } from './raid-logs';
import { FACTION_FILTERS, RAID_PAGE_SIZE, formatFightTime, raidGuildLink, raidLogLink } from './raid-display';
import { RaidLogsDataService } from './raid-logs-data.service';
import { REALM_FILTER_OPTIONS, parseRealmSlug } from '../../game/wow';
import { injectReplaceUrl, parsePage } from '../../core/url-state';
import { LoadStateComponent } from '../../shared/load-state.component';
import { PagerComponent } from '../../shared/pager.component';
import { pageCount, pageSlice } from '../../shared/pager';
import { setPageHeader } from '../../core/page-header';
import { GlideDirective } from '../../shared/motion/glide.directive';

interface ClearRow extends RankedClear {
  splits: ClearSplit[];
}

@Component({
  selector: 'app-raid-logs-clears-page',
  imports: [
    RouterLink,
    NgTemplateOutlet,
    RaidDifficultySwitchComponent,
    RaidPickupIconComponent,
    FilterDropdownComponent,
    DatePipe,
    DecimalPipe,
    LoadStateComponent,
    GlideDirective,
    PagerComponent
  ],
  templateUrl: './raid-logs-clears-page.component.html',
  styleUrl: './raid-logs-clears-page.component.scss',
  providers: [FilterDropdownCoordinatorService],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RaidLogsClearsPageComponent implements OnInit {
  private readonly data = inject(RaidLogsDataService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly replaceUrl = injectReplaceUrl();

  readonly index = signal<RaidLogsIndex | undefined>(undefined);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | undefined>(undefined);
  readonly lastEdited = computed(() => this.index()?.generatedAt);

  private readonly query = this.route.snapshot.queryParamMap;
  private readonly requestedDifficulty = signal(this.query.get('difficulty') ?? this.data.lastDifficulty());
  readonly factionFilter = signal(FACTION_FILTERS.find(faction => faction.slug === this.query.get('faction'))?.slug);
  readonly realmFilter = signal(parseRealmSlug(this.query.get('realm')));
  readonly groups = signal<ClearGroups>(this.query.get('groups') === 'all' ? 'all' : 'guilds');
  readonly page = signal(parsePage(this.query.get('page')));
  readonly hasFilters = computed(() =>
    this.factionFilter() !== undefined || this.realmFilter() !== undefined || this.groups() === 'all');

  readonly factionOptions: ReadonlyArray<FilterDropdownOption> = [
    { value: undefined, label: 'All factions' },
    ...FACTION_FILTERS.map(faction => ({ value: faction.slug, label: faction.label }))
  ];
  readonly realmOptions = REALM_FILTER_OPTIONS;
  readonly factionWidthLabels = this.factionOptions.map(option => option.label);
  readonly realmWidthLabels = this.realmOptions.map(option => option.label);

  readonly difficulty = computed(() => {
    const difficulties = this.index()?.difficulties ?? [];
    return difficulties.find(difficulty => difficulty.slug === this.requestedDifficulty() && difficulty.kills > 0)
      ?? defaultDifficulty(difficulties);
  });

  readonly clears = computed<RankedClear[]>(() => {
    const difficulty = this.difficulty();
    return difficulty ? rankClears(this.index()?.clears ?? [], difficulty, {
      groups: this.groups(),
      faction: FACTION_FILTERS.find(faction => faction.slug === this.factionFilter())?.id,
      realm: this.realmFilter()
    }) : [];
  });

  readonly total = computed(() => this.clears().length);
  readonly pages = computed(() => pageCount(this.total(), RAID_PAGE_SIZE));
  readonly currentPage = computed(() => Math.min(this.page(), this.pages()));
  readonly pageRows = computed<ClearRow[]>(() =>
    pageSlice(this.clears(), this.currentPage(), RAID_PAGE_SIZE).map(run => ({ ...run, splits: clearSplits(run) })));
  readonly rowNoun = computed(() => this.groups() === 'all' ? 'clear' : 'guild');
  readonly note = computed(() => {
    const bosses = `all ${this.index()?.bosses.length ?? 0} bosses in one raid, from the first boss pull to the last boss kill`;
    return this.groups() === 'all'
      ? `Each guild's fastest clear and every pickup group's clear: ${bosses}.`
      : `Each guild's fastest clear: ${bosses}.`;
  });

  readonly allGroupsTitle = 'Also rank the pickup groups: every clear without a guild counts on its own';
  readonly formatFightTime = formatFightTime;
  readonly guildLink = raidGuildLink;
  readonly logLink = raidLogLink;

  constructor() {
    setPageHeader(() => ({ lastEdited: this.lastEdited() }));
  }

  ngOnInit(): void {
    this.data.lastDifficulty.set(this.requestedDifficulty());
    this.loadData();
  }

  loadData(): void {
    this.isLoading.set(true);
    this.loadError.set(undefined);
    this.data.index()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: index => {
          this.index.set(index);
          this.isLoading.set(false);
        },
        error: error => {
          console.error('Failed to load the raid logs:', error);
          this.loadError.set('The raid logs could not be loaded.');
          this.isLoading.set(false);
        }
      });
  }

  setDifficulty(slug: string): void {
    if (slug === this.difficulty()?.slug) {
      return;
    }

    this.requestedDifficulty.set(slug);
    this.data.lastDifficulty.set(slug);
    this.page.set(1);
    this.writeUrl();
  }

  setGroups(groups: ClearGroups): void {
    if (groups === this.groups()) {
      return;
    }

    this.groups.set(groups);
    this.page.set(1);
    this.writeUrl();
  }

  resetFilters(): void {
    this.factionFilter.set(undefined);
    this.realmFilter.set(undefined);
    this.groups.set('guilds');
    this.page.set(1);
    this.writeUrl();
  }

  setFactionFilter(value: FilterDropdownValue): void {
    this.factionFilter.set(typeof value === 'string' ? value : undefined);
    this.page.set(1);
    this.writeUrl();
  }

  setRealmFilter(value: FilterDropdownValue): void {
    this.realmFilter.set(typeof value === 'string' ? value : undefined);
    this.page.set(1);
    this.writeUrl();
  }

  goToPage(page: number): void {
    this.page.set(page);
    this.writeUrl();
  }

  splitLabel(split: ClearSplit, row: ClearRow): string {
    const pulledAfter = split.kill.killedAt - split.kill.fightMs - row.startedAt;
    return `${split.kill.boss.shortName}: ${formatFightTime(split.kill.fightMs)} fight, pulled ${formatFightTime(pulledAfter)} into the clear`;
  }

  private writeUrl(): void {
    this.replaceUrl({
      difficulty: this.difficulty()?.slug ?? null,
      faction: this.factionFilter() ?? null,
      realm: this.realmFilter() ?? null,
      groups: this.groups() === 'all' ? 'all' : null,
      page: this.currentPage() > 1 ? this.currentPage() : null
    });
  }
}
