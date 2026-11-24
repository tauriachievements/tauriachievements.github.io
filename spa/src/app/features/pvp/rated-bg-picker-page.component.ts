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
import { LoadStateComponent } from '../../shared/load-state.component';
import { prefersReducedMotion } from '../../shared/motion/motion';
import {
  FLAG_CARRIER_COUNT,
  PICK_COUNT,
  RATED_BG_ROSTER_FILE,
  RatedBgRosterFile,
  RosterPlayer,
  Teams,
  canShuffle,
  countHealers,
  healerWarning,
  markTeamFlagCarrier,
  parseTeams,
  rosterGroups,
  rosterPlayers,
  shuffleTeams,
  teamGroups,
  teamSummary,
  teamsParams,
  tickedFlagCarriers,
  toggleFlagCarrier,
  togglePick
} from './rated-bg-picker';
import { RatedBgPlayerComponent } from './rated-bg-player.component';

@Component({
  selector: 'app-rated-bg-picker-page',
  templateUrl: './rated-bg-picker-page.component.html',
  styleUrls: ['./rated-bg-picker-page.component.scss'],
  imports: [DecimalPipe, LoadStateComponent, RatedBgPlayerComponent],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RatedBgPickerPageComponent implements OnInit {
  private readonly dataFiles = inject(DataFileService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly replaceUrl = injectReplaceUrl();
  private readonly teamsSection = viewChild<ElementRef<HTMLElement>>('teamsSection');

  readonly pickCount = PICK_COUNT;
  readonly isLoading = signal(true);
  readonly loadError = signal<string | undefined>(undefined);
  readonly players = signal<readonly RosterPlayer[]>([]);
  readonly picked = signal<ReadonlySet<string>>(new Set());
  readonly teams = signal<Teams | undefined>(undefined);
  readonly flagCarriers = signal<ReadonlySet<string>>(new Set());
  readonly staleLink = signal(false);
  private readonly generatedAt = signal<string | undefined>(undefined);

  readonly pickedCount = computed(() => this.picked().size);
  private readonly pickedPlayers = computed(() => {
    const picked = this.picked();
    return this.players().filter(player => picked.has(player.key));
  });
  readonly pickedHealers = computed(() => countHealers(this.pickedPlayers()));
  readonly healerWarning = computed(() => healerWarning(this.pickedHealers()));
  readonly readyToShuffle = computed(() => canShuffle(this.pickedPlayers()));
  readonly groups = computed(() => {
    const picked = this.picked();
    return rosterGroups(this.players()).map(group => ({
      ...group,
      ticked: group.classes
        .flatMap(rosterClass => rosterClass.players)
        .filter(player => picked.has(player.key)).length
    }));
  });
  readonly teamViews = computed(() =>
    this.teams()?.map((players, index) => ({
      label: `Team ${index + 1}`,
      groups: teamGroups(players),
      summary: teamSummary(players)
    }))
  );
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

  isLocked(player: RosterPlayer): boolean {
    return this.teams() !== undefined || (this.pickedCount() >= PICK_COUNT && !this.isPicked(player));
  }

  toggle(player: RosterPlayer): void {
    if (this.teams()) {
      return;
    }

    this.picked.update(picked => togglePick(picked, player.key));
    this.flagCarriers.update(flagCarriers => tickedFlagCarriers(flagCarriers, this.picked()));
  }

  isFlagCarrier(player: RosterPlayer): boolean {
    return this.flagCarriers().has(player.key);
  }

  canMarkFlagCarrier(player: RosterPlayer): boolean {
    return !this.teams() && (this.isFlagCarrier(player) || this.flagCarriers().size < FLAG_CARRIER_COUNT);
  }

  toggleFlagCarrier(player: RosterPlayer): void {
    if (this.canMarkFlagCarrier(player)) {
      this.flagCarriers.update(flagCarriers => toggleFlagCarrier(flagCarriers, player.key));
    }
  }

  markTeamFlagCarrier(teamIndex: number, player: RosterPlayer): void {
    const team = this.teams()?.[teamIndex];
    if (team) {
      this.flagCarriers.update(flagCarriers => markTeamFlagCarrier(flagCarriers, team, player.key));
    }
  }

  shuffle(): void {
    const players = this.pickedPlayers();
    if (!canShuffle(players)) {
      return;
    }

    this.teams.set(shuffleTeams(players, Math.random, this.flagCarriers()));
    this.staleLink.set(false);
    this.writeUrl();
    afterNextRender(() => this.scrollToTeams(), { injector: this.injector });
  }

  changePlayers(): void {
    this.teams.set(undefined);
    this.writeUrl();
  }

  clear(): void {
    this.picked.set(new Set());
    this.teams.set(undefined);
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
      this.teams.set(teams);
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
    this.replaceUrl(teamsParams(this.teams()));
  }
}
