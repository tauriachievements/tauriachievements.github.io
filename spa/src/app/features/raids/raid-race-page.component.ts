import { ChangeDetectionStrategy, Component, DestroyRef, OnInit, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { TapTooltipDirective } from '../../shared/tap-tooltip.directive';
import { getGuildArmoryUrl } from '../../game/armory';
import { DataFileService } from '../../core/data-file.service';
import { SkeletonComponent } from '../../shared/skeleton.component';
import {
  PLAYBACK_START_MINUTE,
  RaceBossView,
  RaceDataset,
  formatKillDate,
  formatRaceDuration,
  formatSplit,
  guildTimelines,
  nextPlaybackMinute,
  playbackClock,
  raceBossViews,
  raceDuration,
  raceGuildRealm,
  timelineHours
} from './raid-race';
import { RaidRace } from './raid-races';

@Component({
  selector: 'app-raid-race-page',
  imports: [TapTooltipDirective, SkeletonComponent],
  templateUrl: './raid-race-page.component.html',
  styleUrls: ['./raid-race-page.component.scss', './raid-race-page.motion.scss', './raid-race-page.valor.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[class]': 'themeClass' }
})
export class RaidRacePageComponent implements OnInit {
  private readonly dataFiles = inject(DataFileService);
  private readonly destroyRef = inject(DestroyRef);

  readonly race = inject(ActivatedRoute).snapshot.data['race'] as RaidRace;
  readonly themeClass = `theme-${this.race.theme}`;
  readonly duration = raceDuration(this.race);
  readonly timelineHours = timelineHours(this.race);
  readonly startLabel = playbackClock(this.race, 0);
  readonly endLabel = playbackClock(this.race, this.duration);
  readonly backdrop = this.race.backdropUrl ? `url("${this.race.backdropUrl}")` : 'none';
  readonly mediumColumns = Math.min(4, this.race.bosses.length);
  readonly formatRaceDuration = formatRaceDuration;
  readonly formatSplit = formatSplit;
  readonly formatKillDate = formatKillDate;

  readonly bosses = signal<RaceBossView[]>([]);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | undefined>(undefined);
  readonly playbackMinute = signal(this.duration);
  readonly isPlaying = signal(false);
  readonly playbackTimeLabel = computed(() => playbackClock(this.race, this.playbackMinute()));
  readonly playbackButtonLabel = computed(() =>
    this.isPlaying() ? 'Pause' : this.playbackMinute() >= this.duration ? 'Replay' : 'Play'
  );
  readonly guildTimelines = computed(() => guildTimelines(this.bosses(), this.race, this.playbackMinute()));
  readonly hasTimeline = computed(() => this.guildTimelines().length > 0);
  private playbackTimer?: ReturnType<typeof setInterval>;

  ngOnInit(): void {
    this.destroyRef.onDestroy(() => this.stopPlayback());
    this.loadData();
  }

  retryLoad(): void {
    this.loadData();
  }

  togglePlayback(): void {
    if (this.isPlaying()) {
      this.stopPlayback();
      return;
    }

    if (this.playbackMinute() >= this.duration) {
      this.playbackMinute.set(PLAYBACK_START_MINUTE);
    }

    this.isPlaying.set(true);
    this.playbackTimer = setInterval(() => {
      const nextMinute = nextPlaybackMinute(this.playbackMinute());
      if (nextMinute >= this.duration) {
        this.playbackMinute.set(this.duration);
        this.stopPlayback();
      } else {
        this.playbackMinute.set(nextMinute);
      }
    }, 200);
  }

  seekPlayback(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.playbackMinute.set(Math.min(this.duration, Math.max(0, value)));
  }

  resetPlayback(): void {
    this.stopPlayback();
    this.playbackMinute.set(this.duration);
  }

  guildArmoryUrl(guild: string, realm?: string): string {
    return getGuildArmoryUrl(guild, raceGuildRealm(guild, realm));
  }

  private loadData(): void {
    this.isLoading.set(true);
    this.loadError.set(undefined);
    this.dataFiles.getJson<RaceDataset>(this.race.dataFile)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: data => {
          this.bosses.set(raceBossViews(this.race, data));
          this.isLoading.set(false);
        },
        error: error => {
          console.error(`Failed to load the ${this.race.name} race:`, error);
          this.loadError.set(`The ${this.race.name} guild data could not be loaded.`);
          this.isLoading.set(false);
        }
      });
  }

  private stopPlayback(): void {
    if (this.playbackTimer !== undefined) {
      clearInterval(this.playbackTimer);
      this.playbackTimer = undefined;
    }
    this.isPlaying.set(false);
  }
}
