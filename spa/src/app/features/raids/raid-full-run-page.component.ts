import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { setPageHeader } from '../../core/page-header';
import { LoadStateComponent } from '../../shared/load-state.component';
import { RaidClearRun, clearEndedBy } from './raid-clears';
import { formatFightTime, raidGuildLink, raidLogLink } from './raid-display';
import { RaidLogsDataService } from './raid-logs-data.service';
import { RaidLogsIndex } from './raid-logs.types';

@Component({
  selector: 'app-raid-full-run-page',
  imports: [RouterLink, DatePipe, LoadStateComponent],
  templateUrl: './raid-full-run-page.component.html',
  styleUrl: './raid-full-run-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RaidFullRunPageComponent {
  private readonly data = inject(RaidLogsDataService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap, { initialValue: this.route.snapshot.paramMap });

  readonly index = signal<RaidLogsIndex | undefined>(undefined);
  readonly run = signal<RaidClearRun | undefined>(undefined);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | undefined>(undefined);
  readonly lastEdited = computed(() => this.index()?.generatedAt);
  readonly formatFightTime = formatFightTime;
  readonly guildLink = raidGuildLink;
  readonly logLink = raidLogLink;

  private subscription?: Subscription;

  constructor() {
    setPageHeader(() => ({ lastEdited: this.lastEdited() }));
    effect(() => {
      const params = this.params();
      untracked(() => this.load(params.get('realm') ?? '', Number(params.get('id'))));
    });
  }

  reload(): void {
    const params = this.params();
    this.load(params.get('realm') ?? '', Number(params.get('id')));
  }

  private load(realm: string, logId: number): void {
    this.subscription?.unsubscribe();
    this.run.set(undefined);
    this.isLoading.set(true);
    this.loadError.set(undefined);

    if (!Number.isInteger(logId) || logId <= 0) {
      this.loadError.set('That is not a full raid run.');
      this.isLoading.set(false);
      return;
    }

    this.subscription = this.data.index()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: index => {
          const run = clearEndedBy(index.clears, { realm, logId });
          this.index.set(index);
          this.run.set(run);
          if (run) {
            this.data.lastDifficulty.set(run.difficulty.slug);
          } else {
            this.loadError.set('That log did not finish a full clear.');
          }
          this.isLoading.set(false);
        },
        error: error => {
          console.error('Failed to load the full raid run:', error);
          this.loadError.set('The full raid run could not be loaded.');
          this.isLoading.set(false);
        }
      });
  }
}
