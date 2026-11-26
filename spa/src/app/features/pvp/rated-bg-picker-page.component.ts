import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  inject,
  signal,
  viewChild
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { DataFileService } from '../../core/data-file.service';
import { setPageHeader } from '../../core/page-header';
import { injectReplaceUrl } from '../../core/url-state';
import { FilterDropdownCoordinatorService } from '../../shared/filter-dropdown-coordinator.service';
import { FilterDropdownComponent } from '../../shared/filter-dropdown.component';
import { FilterDropdownValue } from '../../shared/filter-dropdown.types';
import { LoadStateComponent } from '../../shared/load-state.component';
import { prefersReducedMotion } from '../../shared/motion/motion';
import {
  COMPOSITION_CHOICES,
  DEFAULT_COMPOSITION,
  Match,
  NO_BENCH_HISTORY,
  RATED_BG_ROSTER_FILE,
  RatedBgRosterFile,
  RosterGroupId,
  RosterPlayer,
  TeamComposition,
  benchSize,
  canShuffle,
  compositionOf,
  linkedMatch,
  matchParams,
  parseLeaders,
  parseTeams,
  playMatch,
  rosterGroups,
  rosterPlayers,
  shuffleWarning,
  teamGroups,
  teamSummary,
  tickedFlagCarriers,
  toggleFlagCarrier,
  togglePick,
  withLeader
} from './rated-bg-picker';
import { RatedBgMark, RatedBgMarkComponent } from './rated-bg-mark.component';
import { RatedBgPlayerComponent } from './rated-bg-player.component';

@Component({
  selector: 'app-rated-bg-picker-page',
  templateUrl: './rated-bg-picker-page.component.html',
  styleUrls: ['./rated-bg-picker-page.component.scss'],
  imports: [DecimalPipe, FilterDropdownComponent, LoadStateComponent, RatedBgMarkComponent, RatedBgPlayerComponent],
  providers: [FilterDropdownCoordinatorService],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RatedBgPickerPageComponent implements OnInit {
  private readonly dataFiles = inject(DataFileService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly dropdowns = inject(FilterDropdownCoordinatorService);
  private readonly replaceUrl = injectReplaceUrl();
  private readonly teamsSection = viewChild<ElementRef<HTMLElement>>('teamsSection');

  readonly compositionChoices = COMPOSITION_CHOICES.map(choice => {
    const options = choice.counts.map(count => ({ value: count, label: `${count}` }));
    return {
      ...choice,
      dropdownId: `ratedBg${choice.label}`,
      options,
      widthLabels: options.map(option => option.label)
    };
  });
  readonly isLoading = signal(true);
  readonly loadError = signal<string | undefined>(undefined);
  readonly players = signal<readonly RosterPlayer[]>([]);
  readonly picked = signal<ReadonlySet<string>>(new Set());
  readonly composition = signal<TeamComposition>(DEFAULT_COMPOSITION);
  readonly match = signal<Match | undefined>(undefined);
  readonly flagCarriers = signal<ReadonlySet<string>>(new Set());
  readonly staleLink = signal(false);
  private readonly benchHistory = signal(NO_BENCH_HISTORY);
  private readonly generatedAt = signal<string | undefined>(undefined);

  readonly teams = computed(() => this.match()?.teams);
  readonly bench = computed(() => this.match()?.bench ?? []);
  readonly locked = computed(() => this.teams() !== undefined);
  readonly pickedCount = computed(() => this.picked().size);
  private readonly pickedPlayers = computed(() => {
    const picked = this.picked();
    return this.players().filter(player => picked.has(player.key));
  });
  readonly shuffleWarning = computed(() => shuffleWarning(this.pickedPlayers(), this.composition()));
  readonly readyToShuffle = computed(() => canShuffle(this.pickedPlayers(), this.composition()));
  readonly benchCount = computed(() => this.readyToShuffle() ? benchSize(this.pickedPlayers()) : 0);
  readonly compositionOpen = computed(() =>
    this.compositionChoices.some(choice => this.dropdowns.isOpen(choice.dropdownId)));
  readonly groups = computed(() => {
    const picked = this.picked();
    return rosterGroups(this.players()).map(group => ({
      ...group,
      ticked: group.classes
        .flatMap(rosterClass => rosterClass.players)
        .filter(player => picked.has(player.key)).length
    }));
  });
  readonly teamViews = computed(() => {
    const match = this.match();
    return match?.teams.map((players, index) => ({
      label: `Team ${index + 1}`,
      groups: teamGroups(players).map(group => ({
        ...group,
        rows: group.players.map(player => teamRow(player, match))
      })),
      summary: teamSummary(players),
      backFromBench: players.filter(player => match.backFromBench.has(player.key)).length
    }));
  });
  private readonly lastEdited = computed(() => {
    const generatedAt = this.generatedAt();
    return generatedAt ? new Date(generatedAt) : undefined;
  });

  constructor() {
    setPageHeader(() => ({ lastEdited: this.lastEdited() }));
  }

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.isLoading.set(true);
    this.loadError.set(undefined);
    this.dataFiles
      .getJson<RatedBgRosterFile>(RATED_BG_ROSTER_FILE)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: file => {
          try {
            const players = rosterPlayers(file);
            this.players.set(players);
            this.generatedAt.set(file.generatedAt);
            this.openSharedTeams(players);
          } catch {
            this.loadError.set("Couldn't read the player list. Reload the page to get the latest one.");
          }
          this.isLoading.set(false);
        },
        error: () => {
          this.loadError.set("Couldn't load the player list.");
          this.isLoading.set(false);
        }
      });
  }

  isPicked(player: RosterPlayer): boolean {
    return this.picked().has(player.key);
  }

  toggle(player: RosterPlayer): void {
    if (this.locked()) {
      return;
    }

    this.picked.update(picked => togglePick(picked, player, this.players()));
    this.flagCarriers.update(flagCarriers => tickedFlagCarriers(flagCarriers, this.picked()));
  }

  setComposition(id: RosterGroupId, count: FilterDropdownValue): void {
    if (typeof count === 'number') {
      this.composition.update(composition => ({ ...composition, [id]: count }));
    }
  }

  isFlagCarrier(player: RosterPlayer): boolean {
    return this.flagCarriers().has(player.key);
  }

  toggleFlagCarrier(player: RosterPlayer): void {
    this.flagCarriers.update(flagCarriers => toggleFlagCarrier(flagCarriers, player.key));
  }

  setLeader(player: RosterPlayer): void {
    this.match.update(match => match && withLeader(match, player.key));
    this.writeUrl();
  }

  shuffle(): void {
    const players = this.pickedPlayers();
    if (!canShuffle(players, this.composition())) {
      return;
    }

    const { match, history } = playMatch(players, this.composition(), this.benchHistory(), this.flagCarriers());
    this.match.set(match);
    this.benchHistory.set(history);
    this.staleLink.set(false);
    this.writeUrl();
    afterNextRender(() => this.scrollToTeams(), { injector: this.injector });
  }

  changePlayers(): void {
    this.match.set(undefined);
    this.writeUrl();
  }

  clear(): void {
    this.picked.set(new Set());
    this.match.set(undefined);
    this.benchHistory.set(NO_BENCH_HISTORY);
    this.clearFlagCarriers();
    this.staleLink.set(false);
    this.writeUrl();
  }

  private openSharedTeams(players: readonly RosterPlayer[]): void {
    this.clearFlagCarriers();
    const params = this.route.snapshot.queryParamMap;
    if (!params.has('a') && !params.has('b')) {
      return;
    }

    const teams = parseTeams(params.get('a'), params.get('b'), players);
    if (teams) {
      const { match, history } = linkedMatch(teams, parseLeaders(params.get('leaders'), teams));
      this.match.set(match);
      this.benchHistory.set(history);
      this.composition.set(compositionOf(teams) ?? DEFAULT_COMPOSITION);
      this.picked.set(new Set([...teams[0], ...teams[1]].map(player => player.key)));
      return;
    }

    this.staleLink.set(true);
    this.writeUrl();
  }

  private clearFlagCarriers(): void {
    this.flagCarriers.set(new Set());
  }

  private scrollToTeams(): void {
    this.teamsSection()?.nativeElement.scrollIntoView?.({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'start'
    });
  }

  private writeUrl(): void {
    this.replaceUrl(matchParams(this.match()));
  }
}

function teamRow(player: RosterPlayer, match: Match) {
  const leader = match.leaders.has(player.key);
  const backFromBench = match.backFromBench.has(player.key);
  const marks: RatedBgMark[] = [];
  if (leader) {
    marks.push('leader');
  }
  if (backFromBench) {
    marks.push('back-from-bench');
  }
  return { player, leader, backFromBench, marks };
}
