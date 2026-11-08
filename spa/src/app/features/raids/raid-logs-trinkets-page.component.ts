import { DecimalPipe, NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { getClassColor } from '../../game/class-colors';
import { CLASS_FILTER_OPTIONS, CLASS_NAMES, Role, parseClassId } from '../../game/wow';
import { injectQueryParamMap, injectReplaceUrl, parseInteger } from '../../core/url-state';
import { setPageHeader } from '../../core/page-header';
import { FilterDropdownComponent } from '../../shared/filter-dropdown.component';
import { FilterDropdownCoordinatorService } from '../../shared/filter-dropdown-coordinator.service';
import { FilterDropdownOption, FilterDropdownValue } from '../../shared/filter-dropdown.types';
import { IconTipsComponent } from '../../shared/icon-tips.component';
import { LoadStateComponent } from '../../shared/load-state.component';
import { RaidDifficultySwitchComponent } from './raid-difficulty-switch.component';
import { RaidLogsDataService } from './raid-logs-data.service';
import { RaidDifficulty, RaidKillDetails, RaidLogsIndex } from './raid-logs.types';
import { ITEM_QUALITY_COLORS, formatPerSecond, iconSrcset, itemIconUrl, itemUrl, raidCharacterLink, raidLogLink } from './raid-display';
import { defaultDifficulty } from './raid-logs';
import { scoresBySpecForKills, specMetric } from './raid-scores';
import { NOTABLE_DIFFERENCE, NOTABLE_MIN_PICKS, formatShare, heatColor, sortByPerformance, specsMatching } from './raid-analytics';
import {
  SpecTrinketSummary,
  TrinketSample,
  TrinketUse,
  bossTrinketShares,
  specTrinketSummaries,
  trinketItems,
  trinketPairs,
  trinketSamples,
  trinketUses
} from './raid-trinkets';
import { trinketHeatRows, trinketInsights, trinketMetaTitle, trinketPairRows, trinketRows, trinketStats } from './raid-trinkets-views';

const FEW_CHARACTERS = 10;

const SPEC_COLUMNS = 3;

const CARD_TRINKETS = 5;

const ROLE_GROUPS: ReadonlyArray<{ role: Role; title: string }> = [
  { role: 'dps', title: 'Damage' },
  { role: 'tank', title: 'Tanks' },
  { role: 'healer', title: 'Healers' }
];

interface SpecCard extends SpecTrinketSummary {
  className: string;
  color: string;
  trinkets: TrinketUse[];
  label: string;
}

@Component({
  selector: 'app-raid-logs-trinkets-page',
  imports: [RouterLink, NgTemplateOutlet, FilterDropdownComponent, RaidDifficultySwitchComponent, IconTipsComponent, DecimalPipe, LoadStateComponent],
  templateUrl: './raid-logs-trinkets-page.component.html',
  styleUrls: [
    './raid-logs-trinkets-page.component.scss',
    './raid-logs-trinkets-page.component.phone.scss',
    './raid-logs-trinkets-page.motion.scss'
  ],
  providers: [FilterDropdownCoordinatorService],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RaidLogsTrinketsPageComponent {
  private readonly data = inject(RaidLogsDataService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly replaceUrl = injectReplaceUrl();
  private readonly queryParamMap = injectQueryParamMap();

  readonly index = signal<RaidLogsIndex | undefined>(undefined);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | undefined>(undefined);
  readonly kills = signal<readonly RaidKillDetails[]>([]);
  readonly killsLoading = signal(false);
  readonly killsError = signal<string | undefined>(undefined);
  readonly lastEdited = computed(() => this.index()?.generatedAt);

  private readonly requestedDifficulty = signal(this.route.snapshot.queryParamMap.get('difficulty') ?? this.data.lastDifficulty());
  readonly specId = signal<number | undefined>(undefined);
  private readonly bossSlug = signal<string | undefined>(undefined);
  private readonly classFilter = signal<number | undefined>(undefined);

  readonly difficulty = computed(() => {
    const difficulties = this.index()?.difficulties ?? [];
    return difficulties.find(difficulty => difficulty.slug === this.requestedDifficulty() && difficulty.kills > 0)
      ?? defaultDifficulty(difficulties);
  });
  readonly boss = computed(() => this.index()?.bosses.find(boss => boss.slug === this.bossSlug()));
  readonly selectedBoss = computed(() => this.boss()?.slug);
  readonly spec = computed(() => {
    const id = this.specId();
    return id === undefined ? undefined : this.index()?.specs.get(id);
  });
  readonly selectedSpec = computed(() => this.spec()?.id);
  readonly specs = computed(() => [...(this.index()?.specs.values() ?? [])]);
  readonly selectedClass = computed(() => this.spec()?.classId ?? this.classFilter());
  readonly title = computed(() => trinketMetaTitle(this.difficulty()?.name ?? '', this.boss()?.shortName));
  readonly titleOptions = computed(() => {
    const index = this.index();
    const bosses = [undefined, ...(index?.bosses ?? []).map(boss => boss.shortName)];
    return (index?.difficulties ?? [])
      .filter(difficulty => difficulty.kills > 0)
      .flatMap(difficulty => bosses.map(boss => trinketMetaTitle(difficulty.name, boss)));
  });

  readonly bossOptions = computed<FilterDropdownOption[]>(() => [
    { value: undefined, label: 'All bosses' },
    ...(this.index()?.bosses ?? []).map(boss => ({ value: boss.slug, label: boss.shortName, icon: boss.portrait }))
  ]);
  readonly bossWidthLabels = computed(() => this.bossOptions().map(option => option.label));
  readonly classOptions = CLASS_FILTER_OPTIONS;
  readonly classWidthLabels: ReadonlyArray<string> = CLASS_FILTER_OPTIONS.map(option => option.label);
  readonly specOptions = computed<FilterDropdownOption[]>(() => {
    const classId = this.selectedClass();
    const specs = classId === undefined ? [] : specsMatching(this.specs(), classId, undefined);
    return [{ value: undefined, label: 'All specs' }, ...specs.map(spec => ({ value: spec.id, label: spec.name, icon: spec.icon }))];
  });
  readonly specWidthLabels = computed(() => ['All specs', ...new Set(this.specs().map(spec => spec.name))]);

  readonly classFilterName = computed(() => {
    const classId = this.classFilter();
    return classId === undefined ? undefined : CLASS_NAMES[classId];
  });
  readonly backLabel = computed(() => ['All', this.classFilterName(), 'specs'].filter(Boolean).join(' '));
  readonly hasFilters = computed(() => this.classFilter() !== undefined || this.spec() !== undefined || this.boss() !== undefined);

  private readonly samples = computed(() => trinketSamples(this.kills()));
  private readonly items = computed(() => trinketItems(this.samples()));
  private readonly specScores = computed(() => scoresBySpecForKills(this.index()?.bosses ?? [], this.kills()));

  readonly specGroups = computed(() => {
    const boss = this.boss();
    const samples = boss ? this.samples().filter(sample => sample.boss === boss) : this.samples();
    const specs = specsMatching(this.specs(), this.classFilter(), undefined);
    const cards = specTrinketSummaries(samples, specs, this.items()).map((entry): SpecCard => {
      const className = CLASS_NAMES[entry.spec.classId] ?? 'Unknown';
      const top = entry.summary.trinkets[0];
      return {
        ...entry,
        className,
        color: this.classColor(entry.spec.classId),
        trinkets: entry.summary.trinkets.slice(0, CARD_TRINKETS),
        label: `${entry.spec.name} ${className}, ${entry.summary.characters} characters${top ? `, most worn ${top.item.name} ${formatShare(top.share)}` : ''}`
      };
    });
    const className = this.classFilterName();
    if (className) {
      return [{ key: 'class', title: className, columns: Math.max(SPEC_COLUMNS, cards.length), cards }];
    }
    const specScores = this.specScores();
    return ROLE_GROUPS
      .map(group => ({
        key: group.role,
        title: group.title,
        columns: SPEC_COLUMNS,
        cards: sortByPerformance(cards.filter(card => card.spec.role === group.role), specScores)
      }))
      .filter(group => group.cards.length);
  });

  private readonly specSamples = computed(() => {
    const spec = this.spec();
    return spec ? this.samples().filter(sample => sample.spec === spec) : [];
  });
  private readonly selected = computed<TrinketSample[]>(() => {
    const boss = this.boss();
    return boss ? this.specSamples().filter(sample => sample.boss === boss) : this.specSamples();
  });
  readonly summary = computed(() => trinketUses(this.selected(), this.items()));
  private readonly pairs = computed(() => trinketPairs(this.selected(), this.items()));
  private readonly specNames = computed(() => trinketUses(this.specSamples(), this.items()).trinkets.map(use => use.item.name));
  private readonly bossShares = computed(() => bossTrinketShares(this.specSamples(), this.index()?.bosses ?? [], this.specNames()));

  readonly className = computed(() => CLASS_NAMES[this.spec()?.classId ?? 0] ?? '');
  readonly specColor = computed(() => this.classColor(this.spec()?.classId ?? 0));
  readonly metricLabel = computed(() => this.spec() && specMetric(this.spec()!) === 'hps' ? 'HPS' : 'DPS');
  readonly isThin = computed(() => this.summary().characters > 0 && this.summary().characters < FEW_CHARACTERS);
  readonly stats = computed(() => trinketStats(this.summary(), this.pairs(), this.boss()));
  readonly rows = computed(() => trinketRows(this.summary()));
  readonly pairRows = computed(() => trinketPairRows(this.pairs()));
  readonly pairCount = computed(() => this.pairs().length);
  readonly insights = computed(() => trinketInsights({
    summary: this.summary(),
    pairs: this.pairs(),
    spec: this.spec(),
    boss: this.boss(),
    bossShares: this.bossShares(),
    names: this.specNames()
  }));
  readonly heatBosses = computed(() => this.bossShares().map(entry => ({ boss: entry.boss, picks: entry.picks, thin: entry.picks < NOTABLE_MIN_PICKS })));
  readonly heatRows = computed(() => trinketHeatRows(this.bossShares(), this.specNames(), this.rows()));

  readonly notableDifference = Math.round(NOTABLE_DIFFERENCE * 100);
  readonly icon = itemIconUrl;
  readonly iconSrcset = iconSrcset;
  readonly itemUrl = itemUrl;
  readonly characterLink = raidCharacterLink;
  readonly logLink = raidLogLink;
  readonly formatShare = formatShare;
  readonly formatPerSecond = formatPerSecond;
  readonly heatColor = heatColor;

  private killsSubscription?: Subscription;

  constructor() {
    setPageHeader(() => ({ lastEdited: this.lastEdited() }));
    this.data.lastDifficulty.set(this.requestedDifficulty());
    this.loadData();

    this.queryParamMap
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(params => {
        this.specId.set(parseInteger(params.get('spec')));
        this.bossSlug.set(params.get('boss') ?? undefined);
        this.classFilter.set(parseClassId(params.get('class')));
        const difficulty = params.get('difficulty');
        if (difficulty) {
          this.requestedDifficulty.set(difficulty);
          this.data.lastDifficulty.set(difficulty);
        }
      });

    effect(() => {
      const index = this.index();
      const difficulty = this.difficulty();
      if (index && difficulty) {
        untracked(() => this.loadKills(index, difficulty));
      }
    });
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

  retryKills(): void {
    const index = this.index();
    const difficulty = this.difficulty();
    if (index && difficulty) {
      this.loadKills(index, difficulty);
    }
  }

  setDifficulty(slug: string): void {
    if (slug === this.difficulty()?.slug) {
      return;
    }
    this.requestedDifficulty.set(slug);
    this.data.lastDifficulty.set(slug);
    this.writeUrl();
  }

  setBoss(value: FilterDropdownValue): void {
    this.bossSlug.set(typeof value === 'string' ? value : undefined);
    this.writeUrl();
  }

  setClass(value: FilterDropdownValue): void {
    const classId = typeof value === 'number' ? value : undefined;
    const spec = this.spec();
    if (spec && classId === spec.classId) {
      return;
    }
    this.classFilter.set(classId);
    if (spec) {
      this.openSpec(undefined);
    } else {
      this.writeUrl();
    }
  }

  setSpec(value: FilterDropdownValue): void {
    const specId = typeof value === 'number' ? value : undefined;
    if (specId === this.specId()) {
      return;
    }
    this.classFilter.set(this.selectedClass());
    this.openSpec(specId);
  }

  resetFilters(): void {
    this.classFilter.set(undefined);
    this.bossSlug.set(undefined);
    if (this.specId() === undefined) {
      this.writeUrl();
    } else {
      this.openSpec(undefined);
    }
  }

  queryParams(specId: number | undefined): Record<string, string | number | null> {
    return {
      difficulty: this.difficulty()?.slug ?? null,
      boss: this.boss()?.slug ?? null,
      class: this.classFilter() ?? null,
      spec: specId ?? null
    };
  }

  classColor(classId: number): string {
    return getClassColor(classId) ?? '#e0e0e0';
  }

  qualityColor(quality: number): string {
    return ITEM_QUALITY_COLORS[quality] ?? '#fff';
  }

  private openSpec(specId: number | undefined): void {
    void this.router.navigate([], { relativeTo: this.route, queryParams: this.queryParams(specId) });
  }

  private loadKills(index: RaidLogsIndex, difficulty: RaidDifficulty): void {
    this.killsSubscription?.unsubscribe();
    this.kills.set([]);
    this.killsLoading.set(true);
    this.killsError.set(undefined);
    this.killsSubscription = this.data.difficultyKills(index, difficulty)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: kills => {
          this.kills.set(kills);
          this.killsLoading.set(false);
        },
        error: error => {
          console.error('Failed to load the raid rosters:', error);
          this.killsError.set(`The ${difficulty.name} raid rosters could not be loaded.`);
          this.killsLoading.set(false);
        }
      });
  }

  private writeUrl(): void {
    this.replaceUrl(this.queryParams(this.specId()));
  }
}
