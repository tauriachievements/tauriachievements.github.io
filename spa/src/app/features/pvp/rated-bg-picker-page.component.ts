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
  averageItemLevel,
  benchSize,
  canShuffle,
  inviteCommands,
  playMatch,
  rosterGroups,
  rosterPlayers,
  shuffleWarning,
  teamGroups,
  tickedFlagCarriers,
  toggleFlagCarrier,
  togglePick,
  withLeader
} from './rated-bg-picker';
import { PICKER_LINK_PARAM, PickerState, linkNote, openLegacyLink, openPickerLink, pickerLink } from './rated-bg-picker-link';
import { RatedBgMark, RatedBgMarkComponent } from './rated-bg-mark.component';
import { RatedBgPlayerComponent } from './rated-bg-player.component';

type CopyState = 'ready' | 'copied' | 'failed';

interface TeamInvites {
  readonly label: string;
  readonly invites: string;
}

interface CopyResult extends TeamInvites {
  readonly copied: boolean;
}

const COPY_LABELS: readonly { readonly state: CopyState; readonly text: string }[] = [
  { state: 'ready', text: 'Copy invites' },
  { state: 'copied', text: 'Copied' },
  { state: 'failed', text: 'Copy failed' }
];
const COPY_RESULT_MS = 2000;

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
  readonly linkNote = signal<string | undefined>(undefined);
  readonly copyLabels = COPY_LABELS;
  private readonly copyResult = signal<CopyResult | undefined>(undefined);
  private copyResultTimer: ReturnType<typeof setTimeout> | undefined;
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
      averageItemLevel: averageItemLevel(players),
      backFromBench: players.filter(player => match.backFromBench.has(player.key)).length,
      invites: inviteCommands(players, match.leaders)
    }));
  });
  readonly copyMessage = computed(() => {
    const result = this.copyResult();
    if (!result) {
      return '';
    }
    return result.copied ? `Copied the invites for ${result.label}` : `Couldn't copy the invites for ${result.label}`;
  });
  private readonly lastEdited = computed(() => {
    const generatedAt = this.generatedAt();
    return generatedAt ? new Date(generatedAt) : undefined;
  });

  constructor() {
    setPageHeader(() => ({ lastEdited: this.lastEdited() }));
    this.destroyRef.onDestroy(() => clearTimeout(this.copyResultTimer));
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
            this.openSharedLink(players);
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
    this.writeUrl();
  }

  setComposition(id: RosterGroupId, count: FilterDropdownValue): void {
    if (typeof count === 'number') {
      this.composition.update(composition => ({ ...composition, [id]: count }));
      this.writeUrl();
    }
  }

  isFlagCarrier(player: RosterPlayer): boolean {
    return this.flagCarriers().has(player.key);
  }

  toggleFlagCarrier(player: RosterPlayer): void {
    this.flagCarriers.update(flagCarriers => toggleFlagCarrier(flagCarriers, player.key));
    this.writeUrl();
  }

  setLeader(player: RosterPlayer): void {
    this.match.update(match => match && withLeader(match, player.key));
    this.writeUrl();
  }

  copyState(team: TeamInvites): CopyState {
    const result = this.copyResult();
    if (result?.label !== team.label || result.invites !== team.invites) {
      return 'ready';
    }
    return result.copied ? 'copied' : 'failed';
  }

  async copyInvites(team: TeamInvites): Promise<void> {
    let copied = true;
    try {
      await navigator.clipboard.writeText(team.invites);
    } catch {
      copied = false;
    }
    clearTimeout(this.copyResultTimer);
    this.copyResult.set({ label: team.label, invites: team.invites, copied });
    this.copyResultTimer = setTimeout(() => this.copyResult.set(undefined), COPY_RESULT_MS);
  }

  shuffle(): void {
    const players = this.pickedPlayers();
    if (!canShuffle(players, this.composition())) {
      return;
    }

    const { match, history } = playMatch(players, this.composition(), this.benchHistory(), this.flagCarriers());
    this.match.set(match);
    this.benchHistory.set(history);
    this.linkNote.set(undefined);
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
    this.flagCarriers.set(new Set());
    this.linkNote.set(undefined);
    this.writeUrl();
  }

  private openSharedLink(players: readonly RosterPlayer[]): void {
    const params = this.route.snapshot.queryParamMap;
    const value = params.get(PICKER_LINK_PARAM);
    if (value === null && !params.has('a') && !params.has('b')) {
      return;
    }

    const opened = value === null
      ? openLegacyLink(params.get('a'), params.get('b'), params.get('leaders'), players)
      : openPickerLink(value, players);
    if (opened) {
      this.showState(opened.state);
    }
    this.linkNote.set(linkNote(opened));
    this.writeUrl();
  }

  private showState({ picked, composition, flagCarriers, match, history }: PickerState): void {
    this.picked.set(picked);
    this.composition.set(composition);
    this.flagCarriers.set(flagCarriers);
    this.match.set(match);
    this.benchHistory.set(history);
  }

  private scrollToTeams(): void {
    this.teamsSection()?.nativeElement.scrollIntoView?.({
      behavior: prefersReducedMotion() ? 'auto' : 'smooth',
      block: 'start'
    });
  }

  private writeUrl(): void {
    const state: PickerState = {
      picked: this.picked(),
      composition: this.composition(),
      flagCarriers: this.flagCarriers(),
      match: this.match(),
      history: this.benchHistory()
    };
    this.replaceUrl({ [PICKER_LINK_PARAM]: pickerLink(state, this.players()) });
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
