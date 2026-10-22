import { Location, DecimalPipe, NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  inject,
  signal,
  viewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { getLocalTimeZoneLabel } from '../utils/time-zone-label';
import { BackToTopButtonComponent } from './back-to-top-button.component';
import { injectCompactViewport } from './compact-viewport';
import {
  MythicPlusAffix,
  MythicPlusIndex,
  MythicPlusMember,
  MythicPlusRun,
  NEWER_DATA_MESSAGE,
  ROLE_LABELS,
  characterKey,
  currentAffixWeek,
  exportedAt,
  formatClock,
  memberNameMatches,
  pageCount,
  PlayerScore,
  playerRanks,
  rankPlayers,
  rankRuns,
  runIncludesCharacter,
  runIncludesPlayer,
  runScoreColor,
  scoreColor,
  scoreTiers,
  seasonScoreColors
} from './mythic-plus';
import { MythicPlusPlayersListComponent } from './mythic-plus-players-list.component';
import { COMPARE_LIMIT, compareParam, parseCompareParam } from './mythic-plus-compare';
import { characterParam, characterProfileLink, findCharacters, parseCharacterParam, realmSlug } from './mythic-plus-profile';
import { MythicPlusRunsListComponent } from './mythic-plus-runs-list.component';
import { MythicPlusSpecChartComponent } from './mythic-plus-spec-chart.component';
import {
  MYTHIC_PLUS_CARDS_PAGE_SIZE,
  MYTHIC_PLUS_CARDS_QUERY,
  MYTHIC_PLUS_PAGE_SIZE,
  PlayerRow,
  RunRow,
  bestRunCells,
  toMemberView,
  toRunView
} from './mythic-plus-views';
import { MythicPlusWeekAffixesComponent } from './mythic-plus-week-affixes.component';
import { FilterDropdownComponent } from './filter-dropdown.component';
import { FilterDropdownCoordinatorService } from './filter-dropdown-coordinator.service';
import { FilterDropdownOption, FilterDropdownValue } from './filter-dropdown.types';
import { MobileFilterToggleComponent } from './mobile-filter-toggle.component';
import { UpdateBarComponent } from './update-bar.component';
import { MythicPlusDataService, NewerExportError } from './services/mythic-plus-data.service';
import { getClassColor } from './class-colors';
import { GlideDirective } from './glide.directive';
import { characterTransitionName } from './motion';
import { CLASS_FILTER_OPTIONS, CLASS_NAMES, Role } from './wow';
import { LEGION_SPECS } from './wow-specs';

interface RankedRun {
  run: MythicPlusRun;
  rank: number;
}

type LeaderboardView = 'runs' | 'players';

type LeaderboardPeriod = 'season' | 'week';

interface RankedPlayer {
  player: PlayerScore;
  rank: number;
}

interface PlayerStandingChange {
  score: number;
  rank: number;
}

interface CharacterFilter {
  key: string;
  name: string;
  realm: string;
  color: string;
  profileLink: string[];
}

function parsePage(value: string | null): number {
  const page = Number(value);
  return Number.isInteger(page) && page > 0 ? page : 1;
}

function parseRoleFilter(value: string | null): Role | undefined {
  return value === 'tank' || value === 'healer' || value === 'dps' ? value : undefined;
}

function parseClassFilter(value: string | null): number | undefined {
  const classId = Number(value);
  return value && CLASS_NAMES[classId] ? classId : undefined;
}

function parseSpecFilter(classId: number | undefined, value: string | null): string | undefined {
  return LEGION_SPECS.find(spec => spec.classId === classId && spec.spec === value)?.spec;
}

@Component({
  selector: 'app-mythic-plus-page',
  imports: [
    RouterLink,
    UpdateBarComponent,
    BackToTopButtonComponent,
    MythicPlusSpecChartComponent,
    MythicPlusWeekAffixesComponent,
    MythicPlusRunsListComponent,
    MythicPlusPlayersListComponent,
    FilterDropdownComponent,
    MobileFilterToggleComponent,
    GlideDirective,
    DecimalPipe,
    NgTemplateOutlet
  ],
  templateUrl: './mythic-plus-page.component.html',
  styleUrls: ['./mythic-plus-page.component.scss'],
  providers: [FilterDropdownCoordinatorService],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MythicPlusPageComponent implements OnInit {
  private readonly mythicPlusData = inject(MythicPlusDataService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly location = inject(Location);

  private readonly leaderboardRef = viewChild<ElementRef<HTMLElement>>('leaderboard');

  readonly cards = injectCompactViewport(MYTHIC_PLUS_CARDS_QUERY);
  private readonly pageSize = computed(() => this.cards() ? MYTHIC_PLUS_CARDS_PAGE_SIZE : MYTHIC_PLUS_PAGE_SIZE);
  readonly filtersOpen = signal(false);

  readonly index = signal<MythicPlusIndex | undefined>(undefined);
  readonly lastEdited = computed(() => exportedAt(this.index()));
  readonly lastEditedTimeZoneLabel = computed(() => getLocalTimeZoneLabel(this.lastEdited()));
  readonly runsByDungeon = signal<ReadonlyMap<string, readonly MythicPlusRun[]>>(new Map());
  readonly isLoading = signal(true);
  readonly loadError = signal<string | undefined>(undefined);
  readonly selectedDungeonId = signal<string | undefined>(
    this.route.snapshot.queryParamMap.get('dungeon') ?? undefined);
  readonly page = signal(parsePage(this.route.snapshot.queryParamMap.get('page')));
  readonly search = signal('');
  private readonly characterParam = signal(parseCharacterParam(this.route.snapshot.queryParamMap.get('character')));
  readonly expandedRunId = signal<string | undefined>(undefined);
  readonly view = signal<LeaderboardView>(
    this.route.snapshot.queryParamMap.get('view') === 'players' ? 'players' : 'runs');
  readonly runOrder = signal<'best' | 'latest'>(this.route.snapshot.queryParamMap.get('sort') === 'latest' ? 'latest' : 'best');
  readonly realmFilter = signal<string | undefined>(this.route.snapshot.queryParamMap.get('realm')?.toLowerCase() || undefined);
  readonly classFilter = signal<number | undefined>(parseClassFilter(this.route.snapshot.queryParamMap.get('class')));
  readonly specFilter = signal<string | undefined>(
    parseSpecFilter(this.classFilter(), this.route.snapshot.queryParamMap.get('spec')));
  readonly roleFilter = signal<Role | undefined>(
    this.view() === 'players' ? parseRoleFilter(this.route.snapshot.queryParamMap.get('role')) : undefined);
  readonly roles: readonly Role[] = ['tank', 'healer', 'dps'];
  readonly roleLabels = ROLE_LABELS;
  readonly period = signal<LeaderboardPeriod>(
    this.route.snapshot.queryParamMap.get('period') === 'week' ? 'week' : 'season');

  readonly classOptions = CLASS_FILTER_OPTIONS;

  readonly specOptions = computed<FilterDropdownOption[]>(() => {
    const classId = this.classFilter();
    return [
      { value: undefined, label: 'All specs' },
      ...LEGION_SPECS
        .filter(spec => spec.classId === classId)
        .map(spec => ({ value: spec.spec, label: spec.spec, icon: spec.icon }))
    ];
  });

  readonly realmOptions = computed<FilterDropdownOption[]>(() => {
    const players = new Map<string, number>();
    for (const [, realm] of this.index()?.players ?? []) {
      players.set(realm, (players.get(realm) ?? 0) + 1);
    }

    return [
      { value: undefined, label: 'All realms' },
      ...[...players].sort((a, b) => b[1] - a[1]).map(([realm]) => ({ value: realmSlug(realm), label: realm }))
    ];
  });

  private readonly realmName = computed(() => {
    const realm = this.realmFilter();
    return realm && (this.realmOptions().find(option => option.value === realm)?.label ?? realm);
  });

  readonly activeFilterLabels = computed(() => {
    const classId = this.classFilter();
    return [
      this.realmName(),
      classId === undefined ? undefined : CLASS_NAMES[classId],
      classId === undefined ? undefined : this.specFilter()
    ].filter((label): label is string => !!label);
  });

  private readonly indexCharacters = computed(() =>
    (this.index()?.players ?? []).map(([name, realm, , classId]) => ({ name, realm, classId })));

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
      profileLink: characterProfileLink(character)
    };
  });

  private loadedIndex?: MythicPlusIndex;
  private readonly requestedDungeons = new Set<string>();
  private reloadedForNewerData = false;

  readonly dungeons = computed(() => this.index()?.dungeons ?? []);
  readonly selectedDungeon = computed(() =>
    this.dungeons().find(dungeon => dungeon.id === this.selectedDungeonId()));
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

  readonly scopeRuns = computed<readonly MythicPlusRun[] | undefined>(() => {
    const since = this.period() === 'week' ? this.affixWeek()?.since : undefined;
    const inPeriod = (runs: readonly MythicPlusRun[]) => since === undefined
      ? runs
      : runs.filter(run => Date.parse(run.completedAt) >= since);
    const loaded = this.runsByDungeon();
    const dungeon = this.selectedDungeon();
    if (dungeon) {
      const runs = loaded.get(dungeon.id);
      return runs && rankRuns(inPeriod(runs));
    }

    const dungeons = this.dungeons();
    if (dungeons.some(entry => !loaded.has(entry.id))) {
      return undefined;
    }

    return rankRuns(inPeriod(dungeons.flatMap(entry => loaded.get(entry.id) ?? [])));
  });

  readonly runsLoading = computed(() => !this.isLoading() && !this.loadError() && this.scopeRuns() === undefined);

  readonly dungeonRuns = computed(() => this.scopeRuns() ?? []);

  private readonly rankedRuns = computed<RankedRun[]>(() =>
    this.dungeonRuns().map((run, index) => ({ run, rank: index + 1 })));

  readonly filteredRows = computed<RankedRun[]>(() => {
    const ranked = this.rankedRuns();
    const character = this.characterFilter();
    const query = this.search();
    const rows = character
      ? ranked.filter(entry => runIncludesCharacter(entry.run, character.key))
      : query.trim() ? ranked.filter(entry => runIncludesPlayer(entry.run, query)) : ranked;
    return this.runOrder() === 'latest'
      ? [...rows].sort((a, b) => Date.parse(b.run.completedAt) - Date.parse(a.run.completedAt) || a.rank - b.rank)
      : rows;
  });

  setRunOrder(order: 'best' | 'latest'): void {
    if (order === this.runOrder()) {
      return;
    }
    this.runOrder.set(order);
    this.page.set(1);
    this.expandedRunId.set(undefined);
    this.syncQueryParams();
  }

  private readonly rankedPlayers = computed<RankedPlayer[]>(() => {
    const realm = this.realmFilter();
    const classId = this.classFilter();
    const spec = this.specFilter();
    const role = this.roleFilter();
    const include = realm === undefined && classId === undefined && role === undefined
      ? undefined
      : (member: MythicPlusMember) => (realm === undefined || realmSlug(member.realm) === realm)
        && (classId === undefined || (member.class === classId && (spec === undefined || member.spec === spec)))
        && (role === undefined || member.role === role);

    const ranking = rankPlayers(this.dungeonRuns(), include);
    const ranks = playerRanks(ranking);
    return ranking.map((player, index) => ({ player, rank: ranks[index] }));
  });

  readonly filteredPlayers = computed<RankedPlayer[]>(() => {
    const query = this.search();
    const ranked = this.rankedPlayers();
    return query.trim() ? ranked.filter(entry => memberNameMatches(entry.player.member, query)) : ranked;
  });

  private readonly showStandingChanges = computed(() => {
    const index = this.index();
    return !!index?.previousGeneratedAt
      && index.standings?.length === index.players.length
      && this.period() === 'season'
      && !this.selectedDungeon()
      && this.realmFilter() === undefined
      && this.classFilter() === undefined
      && this.specFilter() === undefined
      && this.roleFilter() === undefined;
  });

  private readonly standingChanges = computed(() => {
    const index = this.index();
    const changes = new Map<string, PlayerStandingChange>();
    if (!index?.previousGeneratedAt || index.standings?.length !== index.players.length) {
      return changes;
    }

    index.standings.forEach((standing, playerIndex) => {
      const score = standing[2];
      const rank = standing[3];
      const player = index.players[playerIndex];
      if (player && score !== undefined && rank !== undefined) {
        changes.set(characterKey({ name: player[0], realm: player[1] }), { score, rank });
      }
    });
    return changes;
  });

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
    const size = this.pageSize();
    const start = (this.currentPage() - 1) * size;
    const dungeons = this.dungeonsById();
    const affixes = this.affixesById();
    const colors = this.scoreColors();

    return this.filteredRows().slice(start, start + size).flatMap(({ run, rank }) => {
      const dungeon = dungeons.get(run.dungeon);
      return dungeon ? [{ ...toRunView(run, dungeon, affixes, colors), rank }] : [];
    });
  });

  readonly playerDungeons = computed(() => {
    const dungeon = this.selectedDungeon();
    return dungeon ? [dungeon] : this.dungeons();
  });

  readonly pagedPlayers = computed<PlayerRow[]>(() => {
    const size = this.pageSize();
    const start = (this.currentPage() - 1) * size;
    const dungeons = this.playerDungeons();
    const showChanges = this.showStandingChanges();
    const changes = this.standingChanges();

    const playerColor = this.playerColor();
    return this.filteredPlayers().slice(start, start + size).map(({ player, rank }) => {
      const change = showChanges ? changes.get(player.key) : undefined;
      return {
        key: player.key,
        rank,
        member: toMemberView({ ...player.member, spec: player.primarySpec }),
        score: player.score,
        color: playerColor(player.score),
        change,
        newSinceLastScan: showChanges && !change,
        bests: bestRunCells(player.bestRuns, dungeons)
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

  readonly emptyMessage = computed(() => {
    const query = this.search().trim();
    const dungeon = this.selectedDungeon();
    const character = this.characterFilter();

    if (character && this.view() === 'runs') {
      return `No runs with ${character.name} (${character.realm})${dungeon ? ` in ${dungeon.name}` : ''}.`;
    }

    if (query) {
      const subject = this.view() === 'players' ? 'No players matching' : 'No runs with a player matching';
      return `${subject} "${query}"${dungeon ? ` in ${dungeon.name}` : ''}.`;
    }

    const classId = this.classFilter();
    const realm = this.realmName();
    const role = this.roleFilter();
    if (this.view() === 'players' && (classId !== undefined || realm || role)) {
      const who = role ? (role === 'dps' ? 'DPS player' : role)
        : classId === undefined ? 'player' : [this.specFilter(), CLASS_NAMES[classId]].filter(Boolean).join(' ');
      return `No ${who}${realm ? ` on ${realm}` : ''} has a run${dungeon ? ` in ${dungeon.name}` : ''} yet.`;
    }

    if (this.period() === 'week') {
      return dungeon ? `No ${dungeon.name} runs yet this week.` : 'No runs yet this week.';
    }

    return dungeon ? `No ${dungeon.name} runs recorded yet.` : 'No runs recorded yet this season.';
  });

  ngOnInit(): void {
    this.loadData();
  }

  readonly compareLimit = COMPARE_LIMIT;
  readonly compareMode = signal(this.route.snapshot.queryParamMap.has('compare'));
  private readonly comparePicks = signal(parseCompareParam(this.route.snapshot.queryParamMap.get('compare')));
  private viewBeforeCompare: LeaderboardView = 'runs';
  readonly picked = computed(() => {
    const characters = this.indexCharacters();
    return this.comparePicks().map(pick => {
      const found = findCharacters(characters, pick.realm, pick.name)[0];
      const character = found ?? pick;
      const key = characterKey(character);
      return {
        key,
        name: character.name,
        realm: character.realm,
        color: (found && getClassColor(found.classId)) ?? '#e0e0e0',
        nameTransition: characterTransitionName(key, 'name')
      };
    });
  });
  readonly pickedKeys = computed(() => new Set(this.picked().map(pick => pick.key)));
  readonly compareParams = computed(() => ({ players: compareParam(this.picked()) }));

  toggleCompareMode(): void {
    this.compareMode.update(on => !on);
    if (this.compareMode()) {
      this.viewBeforeCompare = this.view();
      this.setView('players');
    }
    this.syncQueryParams();
  }

  togglePick(row: PlayerRow): void {
    if (this.pickedKeys().has(row.key)) {
      this.removePick(row.key);
      return;
    }
    this.comparePicks.update(picks =>
      picks.length < COMPARE_LIMIT ? [...picks, { name: row.member.name, realm: row.member.realm }] : picks);
    this.syncQueryParams();
  }

  removePick(key: string): void {
    const characters = this.indexCharacters();
    this.comparePicks.update(picks => picks.filter(pick =>
      characterKey(findCharacters(characters, pick.realm, pick.name)[0] ?? pick) !== key));
    this.syncQueryParams();
  }

  cancelCompare(): void {
    this.comparePicks.set([]);
    this.compareMode.set(false);
    this.setView(this.viewBeforeCompare);
    this.syncQueryParams();
  }

  retryLoad(): void {
    if (this.reloadedForNewerData) {
      this.startOver();
    } else if (this.index()) {
      this.loadError.set(undefined);
      this.loadScopeRuns();
    } else {
      this.loadData();
    }
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

  setView(view: LeaderboardView): void {
    if (view === this.view() && !(view === 'players' && this.roleFilter())) {
      return;
    }

    this.view.set(view);
    this.roleFilter.set(undefined);
    this.page.set(1);
    this.expandedRunId.set(undefined);
    this.syncQueryParams();
  }

  showRoles(): void {
    if (this.view() === 'players' && this.roleFilter()) {
      return;
    }

    this.view.set('players');
    this.roleFilter.set('tank');
    this.classFilter.set(undefined);
    this.specFilter.set(undefined);
    this.page.set(1);
    this.expandedRunId.set(undefined);
    this.syncQueryParams();
  }

  setRole(role: Role): void {
    if (role === this.roleFilter()) {
      return;
    }

    this.roleFilter.set(role);
    this.page.set(1);
    this.syncQueryParams();
  }

  selectDungeon(dungeonId: string | undefined): void {
    this.selectedDungeonId.set(dungeonId);
    this.page.set(1);
    this.expandedRunId.set(undefined);
    this.syncQueryParams();
    this.loadScopeRuns();
  }

  goToPage(page: number, scrollToLeaderboard = false): void {
    const nextPage = Math.min(Math.max(1, page), this.totalPages());
    if (nextPage === this.currentPage()) {
      return;
    }

    this.page.set(nextPage);
    this.expandedRunId.set(undefined);
    this.syncQueryParams();

    if (scrollToLeaderboard) {
      this.leaderboardRef()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
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
    const url = this.router.createUrlTree([], {
      relativeTo: this.route,
      queryParams: {
        dungeon: this.selectedDungeon()?.id ?? null,
        period: this.period() === 'week' ? 'week' : null,
        view: players ? 'players' : null,
        sort: !players && this.runOrder() === 'latest' ? 'latest' : null,
        realm: players ? this.realmFilter() ?? null : null,
        class: players ? this.classFilter() ?? null : null,
        spec: players ? this.specFilter() ?? null : null,
        role: players ? this.roleFilter() ?? null : null,
        character: character ? characterParam(character) : null,
        page: this.currentPage() > 1 ? this.currentPage() : null,
        compare: this.compareMode() ? compareParam(this.picked()) || null : null
      }
    });

    this.location.replaceState(this.router.serializeUrl(url));
  }

  private loadData(): void {
    this.isLoading.set(true);
    this.loadError.set(undefined);
    this.mythicPlusData.index()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: index => {
          this.loadedIndex = index;
          this.index.set(index);
          this.isLoading.set(false);
          this.loadScopeRuns();
        },
        error: error => this.failLoad(error)
      });
  }

  private loadScopeRuns(): void {
    const index = this.loadedIndex;
    if (!index) {
      return;
    }

    const selected = this.selectedDungeon();
    const needed = selected ? [selected] : this.dungeons();

    for (const dungeon of needed) {
      if (this.requestedDungeons.has(dungeon.id)) {
        continue;
      }

      this.requestedDungeons.add(dungeon.id);
      this.mythicPlusData.dungeonRuns(index, dungeon.id)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: runs => {
            if (index === this.loadedIndex) {
              this.runsByDungeon.update(loaded => new Map(loaded).set(dungeon.id, runs));
            }
          },
          error: error => {
            if (index !== this.loadedIndex) {
              return;
            }
            if (error instanceof NewerExportError) {
              this.reloadForNewerData(error);
              return;
            }
            this.requestedDungeons.delete(dungeon.id);
            this.failLoad(error);
          }
        });
    }
  }

  private reloadForNewerData(error: NewerExportError): void {
    const firstTime = !this.reloadedForNewerData;
    this.reloadedForNewerData = true;
    if (firstTime) {
      this.startOver();
      return;
    }

    this.loadedIndex = undefined;
    this.failLoad(error, NEWER_DATA_MESSAGE);
  }

  private startOver(): void {
    this.mythicPlusData.refresh();
    this.loadedIndex = undefined;
    this.requestedDungeons.clear();
    this.runsByDungeon.set(new Map());
    this.expandedRunId.set(undefined);
    this.loadData();
  }

  private failLoad(error: unknown, message = 'The Mythic+ leaderboard could not be loaded.'): void {
    console.error('Failed to load Mythic+ leaderboard:', error);
    this.loadError.set(message);
    this.isLoading.set(false);
  }
}
