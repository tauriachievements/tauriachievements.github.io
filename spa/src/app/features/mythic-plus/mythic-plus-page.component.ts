import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  linkedSignal,
  signal
} from '@angular/core';
import { ActivatedRoute, ParamMap, RouterLink } from '@angular/router';
import { injectCompactViewport } from '../../shared/compact-viewport';
import { SkeletonBlock } from '../../shared/skeleton';
import {
  MythicPlusAffix,
  StandingChange,
  characterKey,
  currentAffixWeek,
  currentPlayers,
  exportedAt,
  hasScanChanges,
  invalidRunCount,
  memberNameMatches,
  PlayerScore,
  playerRanks,
  rankPlayers,
  runScoreColor,
  seasonScoreColors,
  standingChanges
} from './mythic-plus';
import { scoreColor, scoreTiers } from '../../shared/score-quality';
import { MythicPlusPlayersListComponent } from './mythic-plus-players-list.component';
import { characterParam, findCharacters, parseCharacterParam } from './mythic-plus-profile';
import { MythicPlusRunsListComponent } from './mythic-plus-runs-list.component';
import { MythicPlusSpecChartComponent } from './mythic-plus-spec-chart.component';
import {
  MYTHIC_PLUS_CARDS_PAGE_SIZE,
  MYTHIC_PLUS_CARDS_QUERY,
  MYTHIC_PLUS_PAGE_SIZE,
  PlayerRow,
  RunRow,
  bestRunCells,
  scoreGains,
  toMemberView,
  toRunView
} from './mythic-plus-views';
import { MythicPlusWeekAffixesComponent } from './mythic-plus-week-affixes.component';
import { MythicPlusSeasonSwitchComponent } from './mythic-plus-season-switch.component';
import { MythicPlusSeasonWaitingComponent } from './mythic-plus-season-waiting.component';
import { seasonParam } from './mythic-plus-seasons';
import { FilterDropdownComponent } from '../../shared/filter-dropdown.component';
import { FilterDropdownCoordinatorService } from '../../shared/filter-dropdown-coordinator.service';
import { FilterDropdownValue } from '../../shared/filter-dropdown.types';
import { MobileFilterToggleComponent } from '../../shared/mobile-filter-toggle.component';
import { MythicPlusPageStore } from './mythic-plus-page.store';
import {
  LeaderboardPeriod,
  LeaderboardView,
  PlayerClassFilters,
  RankedRun,
  RunOrder,
  emptyLeaderboardMessage,
  filterRuns,
  fitFiltersToRole,
  memberFilter,
  realmFilterOptions,
  runsInScope
} from './mythic-plus-leaderboard';
import { getClassColor } from '../../game/class-colors';
import { GlideDirective } from '../../shared/motion/glide.directive';
import { CLASS_NAMES, ROLE_FILTER_LABELS, RoleFilter, parseClassId, parseRoleFilter } from '../../game/wow';
import { RoleFilterComponent } from '../../shared/role-filter.component';
import { classOptionsFor, parseSpecName, specFilterOptions, specsForRole } from '../../game/wow-specs';
import { injectReplaceUrl, parsePage } from '../../core/url-state';
import { LoadStateComponent } from '../../shared/load-state.component';
import { PagerComponent } from '../../shared/pager.component';
import { pageCount, pageSlice } from '../../shared/pager';
import { setPageHeader } from '../../core/page-header';
import { formatClock } from '../../shared/time-format';
import { mythicPlusProfileLink } from '../../core/page-links';

interface RankedPlayer {
  player: PlayerScore;
  rank: number;
}

function linkClassFilters(query: ParamMap, role: RoleFilter | undefined): PlayerClassFilters {
  const classId = parseClassId(query.get('class'));
  return fitFiltersToRole(role, { classId, spec: parseSpecName(classId, query.get('spec')) });
}

interface CharacterFilter {
  key: string;
  name: string;
  realm: string;
  color: string;
  profileLink: string[];
}

@Component({
  selector: 'app-mythic-plus-page',
  imports: [
    RouterLink,
    MythicPlusSpecChartComponent,
    MythicPlusWeekAffixesComponent,
    MythicPlusSeasonSwitchComponent,
    MythicPlusSeasonWaitingComponent,
    MythicPlusRunsListComponent,
    MythicPlusPlayersListComponent,
    FilterDropdownComponent,
    RoleFilterComponent,
    MobileFilterToggleComponent,
    GlideDirective,
    DecimalPipe,
    LoadStateComponent,
    PagerComponent
  ],
  templateUrl: './mythic-plus-page.component.html',
  styleUrls: ['./mythic-plus-page.component.scss'],
  providers: [FilterDropdownCoordinatorService, MythicPlusPageStore],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MythicPlusPageComponent implements OnInit {
  private readonly store = inject(MythicPlusPageStore);
  private readonly route = inject(ActivatedRoute);
  private readonly replaceUrl = injectReplaceUrl();

  readonly cards = injectCompactViewport(MYTHIC_PLUS_CARDS_QUERY);
  private readonly pageSize = computed(() => this.cards() ? MYTHIC_PLUS_CARDS_PAGE_SIZE : MYTHIC_PLUS_PAGE_SIZE);
  readonly runsSkeleton = computed((): readonly SkeletonBlock[] => ['chart', 'toolbar:3', this.cards() ? 'cards:4' : 'rows:12']);
  readonly skeleton = computed((): readonly SkeletonBlock[] => ['switch:2', 'icons:10', ...this.runsSkeleton()]);
  readonly filtersOpen = signal(false);

  readonly index = this.store.index;
  readonly lastEdited = computed(() => exportedAt(this.index()));
  readonly invalidRuns = computed(() => invalidRunCount(this.index()));
  readonly runsByDungeon = this.store.runsByDungeon;
  readonly isLoading = this.store.isLoading;
  readonly loadError = this.store.loadError;
  readonly dungeons = this.store.dungeons;
  readonly selectedDungeon = this.store.selectedDungeon;
  readonly seasons = this.store.seasons;
  readonly season = this.store.season;
  readonly upcomingSeason = this.store.upcomingSeason;
  readonly page = signal(parsePage(this.route.snapshot.queryParamMap.get('page')));
  readonly search = signal('');
  private readonly characterParam = signal(parseCharacterParam(this.route.snapshot.queryParamMap.get('character')));
  readonly expandedRunId = linkedSignal<number, string | undefined>({
    source: this.store.restarts,
    computation: () => undefined
  });
  readonly view = signal<LeaderboardView>(
    this.route.snapshot.queryParamMap.get('view') === 'players' ? 'players' : 'runs');
  readonly runOrder = signal<RunOrder>(this.route.snapshot.queryParamMap.get('sort') === 'latest' ? 'latest' : 'best');
  readonly realmFilter = signal<string | undefined>(this.route.snapshot.queryParamMap.get('realm')?.toLowerCase() || undefined);
  readonly roleFilter = signal<RoleFilter | undefined>(
    this.view() === 'players' ? parseRoleFilter(this.route.snapshot.queryParamMap.get('role')) : undefined);
  private readonly linkFilters = linkClassFilters(this.route.snapshot.queryParamMap, this.roleFilter());
  readonly classFilter = signal<number | undefined>(this.linkFilters.classId);
  readonly specFilter = signal<string | undefined>(this.linkFilters.spec);
  readonly chartRole = signal<RoleFilter | undefined>(parseRoleFilter(this.route.snapshot.queryParamMap.get('chartRole')));
  readonly period = signal<LeaderboardPeriod>(
    this.route.snapshot.queryParamMap.get('period') === 'week' ? 'week' : 'season');

  readonly classOptions = computed(() => classOptionsFor(specsForRole(this.roleFilter())));

  readonly specOptions = computed(() => specFilterOptions(this.classFilter(), this.roleFilter()));

  readonly realmOptions = computed(() => realmFilterOptions(currentPlayers(this.index())));

  private readonly realmName = computed(() => {
    const realm = this.realmFilter();
    return realm && (this.realmOptions().find(option => option.value === realm)?.label ?? realm);
  });

  readonly activeFilterLabels = computed(() => {
    const classId = this.classFilter();
    const role = this.roleFilter();
    return [
      role && ROLE_FILTER_LABELS[role],
      this.realmName(),
      classId === undefined ? undefined : CLASS_NAMES[classId],
      classId === undefined ? undefined : this.specFilter()
    ].filter((label): label is string => !!label);
  });

  private readonly indexCharacters = computed(() =>
    currentPlayers(this.index()).map(([name, realm, , classId]) => ({ name, realm, classId })));

  readonly characterFilter = computed<CharacterFilter | undefined>(() => {
    const wanted = this.characterParam();
    if (!wanted) {
      return undefined;
    }

    const found = findCharacters(this.indexCharacters(), wanted.realm, wanted.name)[0];
    const character = found ?? wanted;
    return {
      key: characterKey(character),
      name: character.name,
      realm: character.realm,
      color: (found && getClassColor(found.classId)) ?? '#e0e0e0',
      profileLink: mythicPlusProfileLink(character)
    };
  });

  readonly selectedDungeonTimer = computed(() => {
    const dungeon = this.selectedDungeon();
    return dungeon ? formatClock(dungeon.timerSeconds) : undefined;
  });

  private readonly dungeonsById = computed(() =>
    new Map(this.dungeons().map(dungeon => [dungeon.id, dungeon])));
  private readonly affixesById = computed(() =>
    new Map((this.index()?.affixes ?? []).map(affix => [affix.id, affix])));
  readonly affixWeek = computed(() => currentAffixWeek([...this.runsByDungeon().values()].flat()));
  readonly weekAffixes = computed(() => {
    const affixes = this.affixesById();
    return (this.affixWeek()?.affixes ?? [])
      .map(id => affixes.get(id))
      .filter((affix): affix is MythicPlusAffix => affix !== undefined);
  });

  private readonly scoreColors = computed(() => seasonScoreColors(this.index()));

  readonly scopeRuns = computed(() => runsInScope(
    this.runsByDungeon(),
    this.dungeons(),
    this.selectedDungeon(),
    this.period() === 'week' ? this.affixWeek()?.since : undefined));

  readonly runsLoading = computed(() =>
    !this.isLoading() && !this.loadError() && !this.upcomingSeason() && this.scopeRuns() === undefined);

  readonly dungeonRuns = computed(() => this.scopeRuns() ?? []);

  private readonly rankedRuns = computed<RankedRun[]>(() =>
    this.dungeonRuns().map((run, index) => ({ run, rank: index + 1 })));

  readonly filteredRows = computed(() =>
    filterRuns(this.rankedRuns(), this.characterFilter()?.key, this.search(), this.runOrder()));

  constructor() {
    setPageHeader(() => ({ lastEdited: this.lastEdited() }));
  }

  setRunOrder(order: RunOrder): void {
    if (order === this.runOrder()) {
      return;
    }
    this.runOrder.set(order);
    this.page.set(1);
    this.expandedRunId.set(undefined);
    this.syncQueryParams();
  }

  private readonly rankedPlayers = computed<RankedPlayer[]>(() => {
    const include = memberFilter({
      realm: this.realmFilter(),
      classId: this.classFilter(),
      spec: this.specFilter(),
      role: this.roleFilter()
    });
    const ranking = rankPlayers(this.dungeonRuns(), include);
    const ranks = playerRanks(ranking);
    return ranking.map((player, index) => ({ player, rank: ranks[index] }));
  });

  readonly filteredPlayers = computed<RankedPlayer[]>(() => {
    const query = this.search();
    const ranked = this.rankedPlayers();
    return query.trim() ? ranked.filter(entry => memberNameMatches(entry.player.member, query)) : ranked;
  });

  private readonly showStandingChanges = computed(() =>
    hasScanChanges(this.index())
      && this.period() === 'season'
      && !this.selectedDungeon()
      && this.realmFilter() === undefined
      && this.classFilter() === undefined
      && this.specFilter() === undefined
      && this.roleFilter() === undefined);

  private readonly standingChanges = computed<ReadonlyMap<string, StandingChange>>(() =>
    standingChanges(this.index()));

  readonly resultCount = computed(() =>
    this.view() === 'players' ? this.filteredPlayers().length : this.filteredRows().length);
  readonly resultUnit = computed(() => {
    const single = this.resultCount() === 1;
    return this.view() === 'players' ? (single ? 'player' : 'players') : (single ? 'run' : 'runs');
  });

  readonly totalPages = computed(() => pageCount(this.resultCount(), this.pageSize()));
  readonly currentPage = computed(() => Math.min(this.page(), this.totalPages()));

  private readonly playerColor = computed(() => {
    const colors = this.scoreColors();
    if (this.selectedDungeon()) {
      return (score: number) => runScoreColor(score, colors);
    }

    const tiers = this.period() === 'week'
      ? scoreTiers(this.rankedPlayers().map(entry => entry.player.score))
      : colors.tiers;
    return (score: number) => scoreColor(score, tiers);
  });

  readonly pagedRows = computed<RunRow[]>(() => {
    const dungeons = this.dungeonsById();
    const affixes = this.affixesById();
    const colors = this.scoreColors();

    return pageSlice(this.filteredRows(), this.currentPage(), this.pageSize()).flatMap(({ run, rank }) => {
      const dungeon = dungeons.get(run.dungeon);
      return dungeon ? [{ ...toRunView(run, dungeon, affixes, colors), rank }] : [];
    });
  });

  readonly playerDungeons = computed(() => {
    const dungeon = this.selectedDungeon();
    return dungeon ? [dungeon] : this.dungeons();
  });

  readonly pagedPlayers = computed<PlayerRow[]>(() => {
    const dungeons = this.playerDungeons();
    const showChanges = this.showStandingChanges();
    const changes = this.standingChanges();
    const changeOf = (key: string) => showChanges ? changes.get(key) : undefined;
    const shown = pageSlice(this.filteredPlayers(), this.currentPage(), this.pageSize());
    const gains = scoreGains(
      this.dungeonRuns(),
      shown.filter(({ player }) => (changeOf(player.key)?.score ?? 0) > 0).map(({ player }) => player.member),
      this.index()?.previousGeneratedAt);

    const playerColor = this.playerColor();
    return shown.map(({ player, rank }) => {
      const change = changeOf(player.key);
      return {
        key: player.key,
        rank,
        member: toMemberView({ ...player.member, spec: player.primarySpec }),
        score: player.score,
        color: playerColor(player.score),
        change,
        newSinceLastScan: showChanges && !change,
        bests: bestRunCells(player.bestRuns, dungeons, gains.get(player.key))
      };
    });
  });

  readonly characterSummary = computed(() => {
    const character = this.characterFilter();
    if (!character || this.view() !== 'runs') {
      return undefined;
    }

    const count = this.filteredRows().length;
    const dungeon = this.selectedDungeon();
    return {
      character,
      count,
      unit: count === 1 ? 'Mythic+ run' : 'Mythic+ runs',
      scope: [dungeon && `in ${dungeon.name}`, this.period() === 'week' ? 'this week' : 'this season']
        .filter(Boolean).join(' ')
    };
  });

  readonly emptyMessage = computed(() => emptyLeaderboardMessage({
    view: this.view(),
    period: this.period(),
    query: this.search(),
    dungeon: this.selectedDungeon(),
    character: this.characterFilter(),
    classId: this.classFilter(),
    spec: this.specFilter(),
    realmName: this.realmName(),
    role: this.roleFilter()
  }));

  ngOnInit(): void {
    const query = this.route.snapshot.queryParamMap;
    this.store.load(query.get('dungeon') ?? undefined, query.get('season') ?? undefined);
  }

  retryLoad(): void {
    this.store.retry();
  }

  setRealmFilter(value: FilterDropdownValue): void {
    const realm = typeof value === 'string' ? value : undefined;
    if (realm === this.realmFilter()) {
      return;
    }

    this.realmFilter.set(realm);
    this.page.set(1);
    this.syncQueryParams();
  }

  resetFilters(): void {
    this.roleFilter.set(undefined);
    this.realmFilter.set(undefined);
    this.classFilter.set(undefined);
    this.specFilter.set(undefined);
    this.page.set(1);
    this.syncQueryParams();
  }

  setClassFilter(value: FilterDropdownValue): void {
    const classId = typeof value === 'number' ? value : undefined;
    if (classId === this.classFilter()) {
      return;
    }

    this.classFilter.set(classId);
    this.specFilter.set(undefined);
    this.fitClassAndSpecToRole();
    this.page.set(1);
    this.syncQueryParams();
  }

  setSpecFilter(value: FilterDropdownValue): void {
    const spec = typeof value === 'string' ? value : undefined;
    if (spec === this.specFilter()) {
      return;
    }

    this.specFilter.set(spec);
    this.page.set(1);
    this.syncQueryParams();
  }

  showSpecPlayers(selection: { classId: number; spec: string }): void {
    this.view.set('players');
    this.roleFilter.set(undefined);
    this.classFilter.set(selection.classId);
    this.specFilter.set(selection.spec);
    this.page.set(1);
    this.expandedRunId.set(undefined);
    this.syncQueryParams();
  }

  setPeriod(period: LeaderboardPeriod): void {
    if (period === this.period()) {
      return;
    }

    this.period.set(period);
    this.page.set(1);
    this.expandedRunId.set(undefined);
    this.syncQueryParams();
  }

  pickSeason(seasonId: string): void {
    if (seasonId === this.season()?.id) {
      return;
    }

    this.store.seasonId.set(seasonId);
    if (this.upcomingSeason()) {
      this.period.set('season');
    }
    this.page.set(1);
    this.expandedRunId.set(undefined);
    this.syncQueryParams();
    this.store.loadScopeRuns();
  }

  setView(view: LeaderboardView): void {
    if (view === this.view()) {
      return;
    }

    this.view.set(view);
    this.page.set(1);
    this.expandedRunId.set(undefined);
    this.syncQueryParams();
  }

  setRole(role: RoleFilter | undefined): void {
    if (role === this.roleFilter()) {
      return;
    }

    this.roleFilter.set(role);
    this.fitClassAndSpecToRole();
    this.page.set(1);
    this.syncQueryParams();
  }

  private fitClassAndSpecToRole(): void {
    const fitted = fitFiltersToRole(this.roleFilter(), { classId: this.classFilter(), spec: this.specFilter() });
    this.classFilter.set(fitted.classId);
    this.specFilter.set(fitted.spec);
  }

  setChartRole(role: RoleFilter | undefined): void {
    this.chartRole.set(role);
    this.syncQueryParams();
  }

  selectDungeon(dungeonId: string | undefined): void {
    this.store.selectedDungeonId.set(dungeonId);
    this.page.set(1);
    this.expandedRunId.set(undefined);
    this.syncQueryParams();
    this.store.loadScopeRuns();
  }

  goToPage(page: number): void {
    this.page.set(page);
    this.expandedRunId.set(undefined);
    this.syncQueryParams();
  }

  clearCharacterFilter(): void {
    this.characterParam.set(undefined);
    this.page.set(1);
    this.expandedRunId.set(undefined);
    this.syncQueryParams();
  }

  onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);

    if (this.characterParam() || this.page() !== 1) {
      this.characterParam.set(undefined);
      this.page.set(1);
      this.syncQueryParams();
    }
  }

  toggleRun(runId: string): void {
    this.expandedRunId.update(current => current === runId ? undefined : runId);
  }

  private syncQueryParams(): void {
    const players = this.view() === 'players';
    const character = this.characterFilter();
    this.replaceUrl({
      season: seasonParam(this.season()),
      dungeon: this.selectedDungeon()?.id ?? null,
      period: this.period() === 'week' && !this.upcomingSeason() ? 'week' : null,
      view: players ? 'players' : null,
      sort: !players && this.runOrder() === 'latest' ? 'latest' : null,
      realm: players ? this.realmFilter() ?? null : null,
      class: players ? this.classFilter() ?? null : null,
      spec: players ? this.specFilter() ?? null : null,
      role: players ? this.roleFilter() ?? null : null,
      chartRole: this.chartRole() ?? null,
      character: character ? characterParam(character) : null,
      page: this.currentPage() > 1 ? this.currentPage() : null
    });
  }
}
