import { DatePipe, DecimalPipe, NgTemplateOutlet, PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { getArmoryUrl } from '../../game/armory';
import {
  ARENA_BRACKETS,
  ARENA_PAGE_SIZE,
  ARENA_TITLES,
  ArenaBracket,
  ArenaGroup,
  ArenaLadderFile,
  ArenaPlayerRow,
  ArenaSortKey,
  DEFAULT_MIN_GAMES,
  MIN_GAMES_FILTER_OPTIONS,
  REWARD_MIN_WINS,
  SortDirection,
  TitleCutoff,
  arenaGroupHeadings,
  arenaPlayerKey,
  arenaRatingChanges,
  arenaUrlParams,
  formatTitleShare,
  getArenaLadderFile,
  getTitle,
  getTitleCutoffs,
  parseArenaBracket,
  parseMinGames,
  sortArenaRows,
  toArenaRows
} from './arena-games';
import { GlideDirective } from '../../shared/motion/glide.directive';
import { DataFileService } from '../../core/data-file.service';
import { injectQueryParamMap, injectReplaceUrl, parsePage } from '../../core/url-state';
import { PagerComponent } from '../../shared/pager.component';
import { pageCount, pageSlice } from '../../shared/pager';
import { getClassColor } from '../../game/class-colors';
import { setPageHeader } from '../../core/page-header';
import { FilterDropdownComponent } from '../../shared/filter-dropdown.component';
import { FilterDropdownCoordinatorService } from '../../shared/filter-dropdown-coordinator.service';
import { FilterDropdownValue } from '../../shared/filter-dropdown.types';
import { SkeletonComponent } from '../../shared/skeleton.component';
import { ScanChange, rankChangeLabel, signedChange, valueChangeLabel } from '../../shared/scan-change';

interface SortColumn {
  readonly key: ArenaSortKey;
  readonly label: string;
  readonly shortLabel: string;
}

const SORT_COLUMNS: readonly SortColumn[] = [
  { key: 'games', label: 'Games', shortLabel: 'Games' },
  { key: 'wins', label: 'Wins', shortLabel: 'W' },
  { key: 'losses', label: 'Losses', shortLabel: 'L' },
  { key: 'winRate', label: 'Win rate', shortLabel: 'Win%' },
  { key: 'rating', label: 'Rating', shortLabel: 'Rating' }
];

@Component({
  selector: 'app-arena-games-page',
  templateUrl: './arena-games-page.component.html',
  styleUrls: ['./arena-games-page.component.scss'],
  imports: [
    GlideDirective,
    DatePipe,
    DecimalPipe,
    FilterDropdownComponent,
    NgTemplateOutlet,
    PagerComponent,
    PercentPipe,
    SkeletonComponent
  ],
  providers: [FilterDropdownCoordinatorService],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class ArenaGamesPageComponent implements OnInit {
  private readonly dataFiles = inject(DataFileService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly replaceUrl = injectReplaceUrl();
  private readonly queryParamMap = injectQueryParamMap();
  private loading?: Subscription;

  readonly minWins = REWARD_MIN_WINS;
  readonly minGamesOptions = MIN_GAMES_FILTER_OPTIONS;
  readonly minGamesWidthLabels = MIN_GAMES_FILTER_OPTIONS.map(option => option.label);
  readonly sortColumns = SORT_COLUMNS;
  readonly brackets = ARENA_BRACKETS;
  readonly minGames = signal(DEFAULT_MIN_GAMES);
  readonly bracket = signal<ArenaBracket | undefined>(undefined);
  readonly dataset = signal<ArenaLadderFile | undefined>(undefined);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | undefined>(undefined);
  readonly sortKey = signal<ArenaSortKey>('rating');
  readonly sortDirection = signal<SortDirection>('desc');
  readonly page = signal(1);

  private readonly rows = computed(() => toArenaRows(this.dataset()?.players ?? [], this.minGames()));
  readonly activeRows = computed(() => this.rows().filter(row => row.isActive));
  readonly inactiveCount = computed(() => this.rows().length - this.activeRows().length);
  readonly players = computed(() => sortArenaRows(this.rows(), this.sortKey(), this.sortDirection()));
  readonly pages = computed(() => pageCount(this.players().length, ARENA_PAGE_SIZE));
  readonly currentPage = computed(() => Math.min(this.page(), this.pages()));
  readonly pageRows = computed(() => pageSlice(this.players(), this.currentPage(), ARENA_PAGE_SIZE));
  readonly eligibleCount = computed(() => this.activeRows().filter(row => row.wins >= REWARD_MIN_WINS).length);
  readonly cutoffs = computed(() => getTitleCutoffs(this.rows(), ARENA_TITLES[this.bracket() ?? '2v2']));
  readonly hasSeasonGladiator = computed(() =>
    this.cutoffs().some(cutoff => cutoff.title.slug === 'season-gladiator')
  );
  private readonly titles = computed(() => {
    const cutoffs = this.cutoffs();
    return new Map(this.activeRows().map(row => [row, getTitle(row.rating, cutoffs)]));
  });
  readonly titleCounts = computed(() => {
    const counts = new Map<TitleCutoff, number>();
    for (const cutoff of this.titles().values()) {
      if (cutoff) {
        counts.set(cutoff, (counts.get(cutoff) ?? 0) + 1);
      }
    }
    return counts;
  });
  readonly untitledCount = computed(() =>
    [...this.titles().values()].filter(cutoff => !cutoff).length
  );
  readonly groupHeadings = computed(() =>
    arenaGroupHeadings(this.pageRows(), row => this.titleOf(row), this.sortKey() === 'rating')
  );
  private readonly changes = computed(() => {
    const dataset = this.dataset();
    return dataset ? arenaRatingChanges(dataset, this.minGames()) : new Map<string, ScanChange>();
  });
  readonly hasChanges = computed(() => this.changes().size > 0);
  readonly changesSince = computed(() => this.hasChanges() ? this.dataset()?.previousGeneratedAt : undefined);
  readonly showRankChanges = computed(() =>
    this.hasChanges() && this.sortKey() === 'rating' && this.sortDirection() === 'desc'
  );
  readonly lastEdited = computed(() => {
    const generatedAt = this.dataset()?.generatedAt;
    return generatedAt ? new Date(generatedAt) : undefined;
  });

  readonly getArmoryUrl = getArmoryUrl;
  readonly formatTitleShare = formatTitleShare;
  readonly signed = signedChange;
  readonly rankChangeLabel = rankChangeLabel;

  constructor() {
    setPageHeader(() => ({ lastEdited: this.lastEdited() }));
  }

  ngOnInit(): void {
    this.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        this.minGames.set(parseMinGames(params.get('games')));
        this.page.set(parsePage(params.get('page')));
        const bracket = parseArenaBracket(params.get('bracket'));
        if (bracket !== this.bracket()) {
          this.bracket.set(bracket);
          this.loadData();
        }
      });
  }

  selectBracket(bracket: ArenaBracket): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: arenaUrlParams(bracket, this.minGames(), 1),
      queryParamsHandling: 'merge',
      replaceUrl: true
    });
  }

  setMinGames(value: FilterDropdownValue): void {
    this.minGames.set(parseMinGames(value ?? null));
    this.goToPage(1);
  }

  goToPage(page: number): void {
    this.page.set(page);
    this.replaceUrl(arenaUrlParams(this.bracket() ?? '2v2', this.minGames(), page), { merge: true });
  }

  retryLoad(): void {
    this.loadData();
  }

  sortBy(key: ArenaSortKey): void {
    if (this.sortKey() === key) {
      this.sortDirection.update(direction => direction === 'desc' ? 'asc' : 'desc');
    } else {
      this.sortKey.set(key);
      this.sortDirection.set('desc');
    }
    this.goToPage(1);
  }

  rank(index: number): number {
    return (this.currentPage() - 1) * ARENA_PAGE_SIZE + index + 1;
  }

  ariaSort(key: ArenaSortKey): string | null {
    if (this.sortKey() !== key) {
      return null;
    }

    return this.sortDirection() === 'desc' ? 'descending' : 'ascending';
  }

  exactSpots(cutoff: TitleCutoff): number {
    return (this.activeRows().length * cutoff.title.topPerMille) / 1000;
  }

  tiesHint(cutoff: TitleCutoff): string {
    return `${cutoff.ties} more ${cutoff.ties === 1 ? 'holder' : 'holders'}: players on the same rating share one spot`;
  }

  titleOf(player: ArenaPlayerRow): TitleCutoff | undefined {
    return this.titles().get(player);
  }

  groupClasses(group: ArenaGroup): string {
    return group.kind === 'title' ? `title-group tier-${group.cutoff.title.slug}` : `title-group is-${group.kind}`;
  }

  isRewardEligible(player: ArenaPlayerRow): boolean {
    return player.wins >= REWARD_MIN_WINS;
  }

  change(player: ArenaPlayerRow): ScanChange | undefined {
    return this.changes().get(arenaPlayerKey(player));
  }

  ratingChangeLabel(change: number): string {
    return valueChangeLabel(change, 'rating');
  }

  getPlayerClassColor(player: ArenaPlayerRow): string {
    return getClassColor(player.class) ?? '#e0e0e0';
  }

  private loadData(): void {
    const bracket = this.bracket() ?? '2v2';
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
          this.loadError.set('The arena data could not be loaded. Please try again.');
          this.isLoading.set(false);
        }
      });
  }
}
