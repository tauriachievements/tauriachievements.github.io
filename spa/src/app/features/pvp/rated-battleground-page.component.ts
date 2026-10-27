import { DecimalPipe, PercentPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { forkJoin } from 'rxjs';
import { getClassIconPath } from '../../game/classIconHelper';
import { FilterDropdownCoordinatorService } from '../../shared/filter-dropdown-coordinator.service';
import { FilterDropdownComponent } from '../../shared/filter-dropdown.component';
import { FilterDropdownValue } from '../../shared/filter-dropdown.types';
import { PagerComponent } from '../../shared/pager.component';
import { pageCount, pageSlice } from '../../shared/pager';
import { ScrollToEndDirective } from '../../shared/motion/scroll-to-end.directive';
import {
  RatedBattlegroundMatch,
  RatedLeaderboardMetric,
  RatedNewMatches,
  RatedPlayerMatchHistoryEntry,
  RatedPlayerSummary,
  RatedTeamSummary,
  buildRatedBattlegroundAnalytics,
  buildTeamSummary,
  formatCompact,
  formatDuration,
  formatMetricAmount,
  formatMetricChange,
  formatUnixDateTime,
  getClassColor,
  getClassName,
  getFactionLabel,
  getObjectives,
  getSpec,
  getWinningSide,
  matchesBeforeScan,
  metricValue,
  rankRatedPlayers,
  ratedPlayerChanges
} from './rated-battleground-stats';
import { RatedBattlegroundsService } from './rated-battlegrounds.service';
import { RatedBattlegroundPlayerHistoryComponent } from './rated-battleground-player-history.component';
import {
  RatedBattlegroundContentView,
  RatedBattlegroundViewSwitcherComponent
} from './rated-battleground-view-switcher.component';
import { injectReplaceUrl, parsePage } from '../../core/url-state';
import { setPageHeader } from '../../core/page-header';
import { SkeletonComponent } from '../../shared/skeleton.component';
import { ScanChange, rankChangeLabel, valueChangeLabel } from '../../shared/scan-change';

const METRIC_OPTIONS: ReadonlyArray<{ value: RatedLeaderboardMetric; label: string; unit: string }> = [
  { value: 'rating', label: 'Net rating change', unit: 'rating' },
  { value: 'damage', label: 'Total damage', unit: 'damage' },
  { value: 'healing', label: 'Total healing', unit: 'healing' },
  { value: 'kills', label: 'Killing blows', unit: 'killing blows' },
  { value: 'honor', label: 'Honor earned', unit: 'honor' },
  { value: 'mmr', label: 'Peak MMR', unit: 'peak MMR' },
  { value: 'games', label: 'Games played', unit: 'games' },
  { value: 'wins', label: 'Wins', unit: 'wins' }
];

const METRIC_LABELS: Readonly<Record<RatedLeaderboardMetric, string>> = Object.fromEntries(
  METRIC_OPTIONS.map(option => [option.value, option.label])
) as Record<RatedLeaderboardMetric, string>;

const METRIC_UNITS: Readonly<Record<RatedLeaderboardMetric, string>> = Object.fromEntries(
  METRIC_OPTIONS.map(option => [option.value, option.unit])
) as Record<RatedLeaderboardMetric, string>;

const LEADERBOARD_PAGE_SIZE = 25;

@Component({
  selector: 'app-rated-battleground-page',
  templateUrl: './rated-battleground-page.component.html',
  styleUrls: ['./rated-battleground-page.component.scss', './rated-battleground-page.component.phone.scss'],
  imports: [
    FilterDropdownComponent,
    RatedBattlegroundPlayerHistoryComponent,
    RatedBattlegroundViewSwitcherComponent,
    PagerComponent,
    ScrollToEndDirective,
    DecimalPipe,
    PercentPipe,
    SkeletonComponent
  ],
  providers: [FilterDropdownCoordinatorService],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RatedBattlegroundPageComponent implements OnInit {
  private readonly service = inject(RatedBattlegroundsService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly replaceUrl = injectReplaceUrl();

  readonly matches = signal<RatedBattlegroundMatch[]>([]);
  readonly newMatches = signal<RatedNewMatches | undefined>(undefined);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | undefined>(undefined);
  readonly selectedMap = signal('all');
  readonly selectedMetric = signal<RatedLeaderboardMetric>('rating');
  readonly selectedMatchId = signal<number | undefined>(undefined);
  readonly selectedPlayer = signal<RatedPlayerSummary | undefined>(undefined);
  readonly selectedView = signal<RatedBattlegroundContentView>('players');
  readonly leaderboardPage = signal(1);

  readonly metricOptions = METRIC_OPTIONS;
  readonly allAnalytics = computed(() => buildRatedBattlegroundAnalytics(this.matches()));
  readonly mapOptions = computed(() => [
    { value: 'all', label: 'All battlegrounds' },
    ...this.allAnalytics().maps.map(map => ({ value: map.name, label: map.name }))
  ]);
  readonly filteredMatches = computed(() => {
    const selectedMap = this.selectedMap();
    return this.matches().filter(match => selectedMap === 'all' || match.mapname === selectedMap);
  });
  readonly analytics = computed(() => buildRatedBattlegroundAnalytics(this.filteredMatches()));
  readonly rankedPlayers = computed(() => rankRatedPlayers(this.analytics().players, this.selectedMetric()));
  private readonly previousMatches = computed(() => matchesBeforeScan(this.filteredMatches(), this.newMatches()));
  private readonly changes = computed(() => {
    const previous = this.previousMatches();
    return previous
      ? ratedPlayerChanges(this.rankedPlayers(), previous, this.selectedMetric())
      : new Map<string, ScanChange>();
  });
  readonly hasChanges = computed(() => this.changes().size > 0);
  readonly changesSince = computed(() => {
    const since = this.hasChanges() ? this.newMatches()?.since : undefined;
    return since ? formatUnixDateTime(Date.parse(since) / 1000) : undefined;
  });
  readonly newGamesInView = computed(() => this.filteredMatches().length - (this.previousMatches()?.length ?? 0));
  readonly leaderboardTotalPages = computed(() => pageCount(this.rankedPlayers().length, LEADERBOARD_PAGE_SIZE));
  readonly currentLeaderboardPage = computed(() => Math.min(this.leaderboardPage(), this.leaderboardTotalPages()));
  readonly paginatedPlayers = computed(() =>
    pageSlice(this.rankedPlayers(), this.currentLeaderboardPage(), LEADERBOARD_PAGE_SIZE));
  readonly matchArchive = computed(() => [...this.filteredMatches()].sort((left, right) => right.starttime - left.starttime));
  readonly selectedMatch = computed(() => {
    const archive = this.matchArchive();
    return archive.find(match => match.matchid === this.selectedMatchId()) ?? archive[0];
  });
  readonly selectedTeams = computed(() => {
    const match = this.selectedMatch();
    if (!match) {
      return [];
    }
    const winningSide = getWinningSide(match);
    return [buildTeamSummary(match, winningSide), buildTeamSummary(match, winningSide === 0 ? 1 : 0)];
  });
  readonly selectedPlayerHistory = computed<RatedPlayerMatchHistoryEntry[]>(() => {
    const player = this.selectedPlayer();
    if (!player) {
      return [];
    }

    return this.matches()
      .flatMap(match => match.members
        .filter(member => member.guid === player.guid && member.realmid === player.realmId)
        .map(member => ({ match, member, won: member.side === getWinningSide(match) })))
      .sort((left, right) => left.match.starttime - right.match.starttime || left.match.matchid - right.match.matchid);
  });
  readonly lastEdited = computed(() => {
    const latest = this.matches().at(-1)?.starttime;
    return latest ? new Date(latest * 1000) : undefined;
  });
  readonly hasData = computed(() => this.matches().length > 0);
  readonly showLoading = computed(() => this.isLoading() && !this.hasData());
  readonly showError = computed(() => !this.isLoading() && !!this.loadError() && !this.hasData());
  readonly showContent = computed(() => !this.showLoading() && !this.showError() && this.hasData());

  readonly getClassIconPath = getClassIconPath;
  readonly getClassColor = getClassColor;
  readonly getClassName = getClassName;
  readonly getFactionLabel = getFactionLabel;
  readonly getSpec = getSpec;
  readonly getObjectives = getObjectives;
  readonly getWinningSide = getWinningSide;
  readonly formatCompact = formatCompact;
  readonly formatDuration = formatDuration;
  readonly formatUnixDateTime = formatUnixDateTime;

  constructor() {
    setPageHeader(() => ({ lastEdited: this.lastEdited(), label: 'Latest match:' }));
  }

  ngOnInit(): void {
    this.route.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        this.selectedView.set(params.get('view') === 'matches' ? 'matches' : 'players');
        this.leaderboardPage.set(parsePage(params.get('page')));
      });
    this.loadMatches();
  }

  retryLoad(): void {
    this.loadMatches();
  }

  setMap(value: FilterDropdownValue): void {
    if (typeof value !== 'string' || !this.mapOptions().some(option => option.value === value)) {
      return;
    }
    this.selectedMap.set(value);
    this.selectedMatchId.set(undefined);
    this.leaderboardPage.set(1);
    this.writeUrl();
  }

  setMetric(value: FilterDropdownValue): void {
    if (typeof value !== 'string' || !METRIC_OPTIONS.some(option => option.value === value)) {
      return;
    }
    this.selectedMetric.set(value as RatedLeaderboardMetric);
    this.leaderboardPage.set(1);
    this.writeUrl();
  }

  setView(view: RatedBattlegroundContentView): void {
    this.selectedView.set(view);
    this.writeUrl();
  }

  setLeaderboardPage(page: number): void {
    this.leaderboardPage.set(page);
    this.writeUrl();
  }

  playerRank(index: number): number {
    return (this.currentLeaderboardPage() - 1) * LEADERBOARD_PAGE_SIZE + index + 1;
  }

  selectMatch(matchId: number): void {
    this.selectedMatchId.set(matchId);
  }

  openPlayerHistory(player: RatedPlayerSummary): void {
    this.selectedPlayer.set(player);
  }

  closePlayerHistory(): void {
    this.selectedPlayer.set(undefined);
  }

  metricLabel(): string {
    return METRIC_LABELS[this.selectedMetric()];
  }

  playerMetric(player: RatedPlayerSummary): string {
    const metric = this.selectedMetric();
    const value = metricValue(player, metric);
    if (metric === 'rating') {
      return `${value > 0 ? '+' : ''}${value.toLocaleString()}`;
    }
    return formatMetricAmount(value, metric);
  }

  change(player: RatedPlayerSummary): ScanChange | undefined {
    return this.changes().get(player.key);
  }

  rankChangeLabel(change: number): string {
    return rankChangeLabel(change, `since ${this.changesSince()}`);
  }

  metricChange(change: number): string {
    return formatMetricChange(change, this.selectedMetric());
  }

  metricChangeLabel(change: number): string {
    const metric = this.selectedMetric();
    return valueChangeLabel(change, METRIC_UNITS[metric], `since ${this.changesSince()}`, magnitude =>
      formatMetricAmount(magnitude, metric));
  }

  teamName(team: RatedTeamSummary): string {
    return team.won ? 'Winning team' : 'Challenging team';
  }

  private loadMatches(): void {
    this.isLoading.set(true);
    this.loadError.set(undefined);
    forkJoin({ matches: this.service.getMatches(), newMatches: this.service.getNewMatches() }).subscribe({
      next: ({ matches, newMatches }) => {
        this.matches.set(matches);
        this.newMatches.set(newMatches);
        this.selectedMatchId.set(matches.at(-1)?.matchid);
        this.isLoading.set(false);
      },
      error: (error: unknown) => {
        console.error('Failed to load rated battleground data:', error);
        this.matches.set([]);
        this.loadError.set('We could not load the rated battleground archive. Please try again.');
        this.isLoading.set(false);
      }
    });
  }

  private writeUrl(): void {
    const players = this.selectedView() === 'players';
    const page = this.leaderboardPage();
    this.replaceUrl({
      view: players ? null : 'matches',
      page: players && page > 1 ? page : null
    }, { merge: true });
  }
}
