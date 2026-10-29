import { DatePipe, DecimalPipe, formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, LOCALE_ID, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { FilterDropdownComponent } from '../../shared/filter-dropdown.component';
import { FilterDropdownCoordinatorService } from '../../shared/filter-dropdown-coordinator.service';
import { FilterDropdownOption, FilterDropdownValue } from '../../shared/filter-dropdown.types';
import { RaidDifficultySwitchComponent } from './raid-difficulty-switch.component';
import {
  GuildProgress,
  ProgressChange,
  ProgressKill,
  filterProgression,
  guildProgression,
  pickupGroups,
  progressionChanges
} from './raid-progression';
import { RaidBoss, RaidDifficulty, RaidKillDetails, RaidLogsIndex } from './raid-logs.types';
import { bossesInKillOrder, defaultDifficulty, logKey, raidWeekStart } from './raid-logs';
import { RAID_PAGE_SIZE, raidGuildLink, raidLogLink } from './raid-display';
import { RaidLogsDataService } from './raid-logs-data.service';
import { REALM_FILTER_OPTIONS, parseRealmSlug } from '../../game/wow';
import { injectReplaceUrl, parsePage } from '../../core/url-state';
import { LoadStateComponent } from '../../shared/load-state.component';
import { PagerComponent } from '../../shared/pager.component';
import { pageCount, pageSlice } from '../../shared/pager';
import { SkeletonBlock } from '../../shared/skeleton';
import { setPageHeader } from '../../core/page-header';
import { GlideDirective } from '../../shared/motion/glide.directive';

type ProgressionPeriod = 'season' | 'week';
type ProgressionGroups = 'guilds' | 'all';

const FACTIONS: ReadonlyArray<{ slug: string; id: number; label: string }> = [
  { slug: 'horde', id: 1, label: 'Horde' },
  { slug: 'alliance', id: 0, label: 'Alliance' }
];

const ROWS_SKELETON: readonly SkeletonBlock[] = ['rows:15'];

interface LoadedPickups {
  difficulty: RaidDifficulty;
  kills: RaidKillDetails[];
}

@Component({
  selector: 'app-raid-logs-progression-page',
  imports: [RouterLink, RaidDifficultySwitchComponent, FilterDropdownComponent, DatePipe, DecimalPipe, LoadStateComponent, GlideDirective, PagerComponent],
  templateUrl: './raid-logs-progression-page.component.html',
  styleUrl: './raid-logs-progression-page.component.scss',
  providers: [FilterDropdownCoordinatorService],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RaidLogsProgressionPageComponent implements OnInit {
  private readonly data = inject(RaidLogsDataService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly locale = inject(LOCALE_ID);
  private readonly route = inject(ActivatedRoute);
  private readonly replaceUrl = injectReplaceUrl();

  readonly index = signal<RaidLogsIndex | undefined>(undefined);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | undefined>(undefined);
  readonly lastEdited = computed(() => this.index()?.generatedAt);
  readonly rowsSkeleton = ROWS_SKELETON;

  private readonly query = this.route.snapshot.queryParamMap;
  private readonly requestedDifficulty = signal(this.query.get('difficulty') ?? this.data.lastDifficulty());
  readonly factionFilter = signal(FACTIONS.find(faction => faction.slug === this.query.get('faction'))?.slug);
  readonly realmFilter = signal(parseRealmSlug(this.query.get('realm')));
  readonly period = signal<ProgressionPeriod>(this.query.get('period') === 'week' ? 'week' : 'season');
  readonly groups = signal<ProgressionGroups>(this.query.get('groups') === 'all' ? 'all' : 'guilds');
  readonly page = signal(parsePage(this.query.get('page')));
  private readonly weekStart = raidWeekStart(Date.now());
  readonly weekTitle = `Show only the kills since the raid reset on ${formatDate(this.weekStart, 'EEE d MMM, HH:mm', this.locale)}`;
  readonly hasFilters = computed(() =>
    this.factionFilter() !== undefined || this.realmFilter() !== undefined || this.period() === 'week' || this.groups() === 'all');

  readonly factionOptions: ReadonlyArray<FilterDropdownOption> = [
    { value: undefined, label: 'All factions' },
    ...FACTIONS.map(faction => ({ value: faction.slug, label: faction.label }))
  ];
  readonly realmOptions = REALM_FILTER_OPTIONS;
  readonly factionWidthLabels = this.factionOptions.map(option => option.label);
  readonly realmWidthLabels = this.realmOptions.map(option => option.label);

  readonly pipBosses = computed(() => bossesInKillOrder(this.index()?.bosses ?? []));

  readonly difficulty = computed(() => {
    const difficulties = this.index()?.difficulties ?? [];
    return difficulties.find(difficulty => difficulty.slug === this.requestedDifficulty() && difficulty.kills > 0)
      ?? defaultDifficulty(difficulties);
  });

  private readonly since = computed(() => this.period() === 'week' ? this.weekStart : -Infinity);

  private readonly difficultyKills = computed(() => {
    const difficulty = this.difficulty();
    const since = this.since();
    return (this.index()?.kills ?? []).filter(kill => kill.difficulty === difficulty && kill.killedAt >= since);
  });

  private readonly loadedPickups = signal<LoadedPickups | undefined>(undefined);
  readonly pickupsLoading = signal(false);
  readonly pickupsError = signal<string | undefined>(undefined);
  private pickupsSubscription?: Subscription;

  readonly pickupsReady = computed(() => this.groups() === 'guilds' || this.loadedPickups()?.difficulty === this.difficulty());

  private readonly pickupKills = computed(() => {
    const loaded = this.loadedPickups();
    if (this.groups() === 'guilds' || !loaded || loaded.difficulty !== this.difficulty()) {
      return [];
    }
    const since = this.since();
    return loaded.kills.filter(kill => kill.killedAt >= since);
  });

  readonly progression = computed<GuildProgress[]>(() =>
    guildProgression(this.difficultyKills(), this.difficulty()?.id ?? 0, this.index()?.bosses.length ?? 0, pickupGroups(this.pickupKills())));

  private readonly changes = computed(() => {
    const newLogs = this.index()?.newLogs;
    if (!newLogs?.size || this.period() === 'week') {
      return new Map<string, ProgressChange>();
    }
    const before = (kill: ProgressKill) => !newLogs.has(logKey(kill));
    const previous = guildProgression(
      this.difficultyKills().filter(before),
      this.difficulty()?.id ?? 0,
      this.index()?.bosses.length ?? 0,
      pickupGroups(this.pickupKills().filter(before)));
    return progressionChanges(this.progression(), previous);
  });

  private readonly changesSince = computed(() => {
    const previousGeneratedAt = this.index()?.previousGeneratedAt;
    return previousGeneratedAt ? `since the scan of ${formatDate(previousGeneratedAt, 'd MMM, HH:mm', this.locale)}` : 'since the last scan';
  });

  readonly shownProgression = computed(() => filterProgression(this.progression(), {
    faction: FACTIONS.find(faction => faction.slug === this.factionFilter())?.id,
    realm: this.realmFilter()
  }));

  readonly total = computed(() => this.shownProgression().length);
  readonly pages = computed(() => pageCount(this.total(), RAID_PAGE_SIZE));
  readonly currentPage = computed(() => Math.min(this.page(), this.pages()));
  readonly pageRows = computed(() => pageSlice(this.shownProgression(), this.currentPage(), RAID_PAGE_SIZE));
  readonly rowNoun = computed(() => this.groups() === 'all' ? 'group' : 'guild');

  readonly allGroupsTitle = 'Also rank the pickup groups: the kills of one raid week that share at least half their players';
  readonly guildLink = raidGuildLink;

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
          this.loadPickups();
        },
        error: error => {
          console.error('Failed to load the raid logs:', error);
          this.loadError.set('The raid logs could not be loaded.');
          this.isLoading.set(false);
        }
      });
  }

  loadPickups(): void {
    const index = this.index();
    const difficulty = this.difficulty();
    if (this.groups() === 'guilds' || !index || !difficulty || this.loadedPickups()?.difficulty === difficulty) {
      return;
    }

    this.pickupsSubscription?.unsubscribe();
    this.pickupsLoading.set(true);
    this.pickupsError.set(undefined);
    this.pickupsSubscription = this.data.difficultyKills(index, difficulty)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: kills => {
          this.loadedPickups.set({ difficulty, kills });
          this.pickupsLoading.set(false);
        },
        error: error => {
          console.error('Failed to load the pickup groups:', error);
          this.pickupsError.set('The pickup groups could not be loaded.');
          this.pickupsLoading.set(false);
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
    this.loadPickups();
  }

  setGroups(groups: ProgressionGroups): void {
    if (groups === this.groups()) {
      return;
    }

    this.groups.set(groups);
    this.page.set(1);
    this.writeUrl();
    this.loadPickups();
  }

  setPeriod(period: ProgressionPeriod): void {
    if (period === this.period()) {
      return;
    }

    this.period.set(period);
    this.page.set(1);
    this.writeUrl();
  }

  resetFilters(): void {
    this.factionFilter.set(undefined);
    this.realmFilter.set(undefined);
    this.period.set('season');
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

  change(row: GuildProgress): ProgressChange | undefined {
    return this.changes().get(row.key);
  }

  pickupLink(row: GuildProgress): Array<string | number> {
    const reached = this.reachedBy(row);
    return reached ? raidLogLink(reached) : [];
  }

  pickupTitle(row: GuildProgress): string {
    const reached = this.reachedBy(row);
    return reached ? `See who played: opens the group's ${reached.boss.shortName} kill` : '';
  }

  newLabel(difficulty: string): string {
    return `New on ${difficulty} ${this.changesSince()}`;
  }

  gainLabel(change: ProgressChange): string {
    const bosses = this.pipBosses().filter(boss => change.bosses.has(boss.index)).map(boss => boss.shortName);
    return `Killed ${new Intl.ListFormat('en-GB').format(bosses)} ${this.changesSince()}`;
  }

  pipTitle(boss: RaidBoss, kill: ProgressKill | undefined, fresh: boolean): string {
    if (!kill) {
      return `${boss.shortName}: not killed yet`;
    }
    const title = `${boss.shortName}: first kill ${new Date(kill.killedAt).toLocaleDateString('en-GB')}`;
    return fresh ? `${title}, new ${this.changesSince()}` : title;
  }

  private reachedBy(row: GuildProgress): ProgressKill | undefined {
    return row.firsts.find(kill => kill?.killedAt === row.progressedAt);
  }

  private writeUrl(): void {
    this.replaceUrl({
      difficulty: this.difficulty()?.slug ?? null,
      faction: this.factionFilter() ?? null,
      realm: this.realmFilter() ?? null,
      period: this.period() === 'week' ? 'week' : null,
      groups: this.groups() === 'all' ? 'all' : null,
      page: this.currentPage() > 1 ? this.currentPage() : null
    });
  }
}
