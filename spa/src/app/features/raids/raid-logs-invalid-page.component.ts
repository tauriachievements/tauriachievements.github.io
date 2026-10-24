import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { RaidLogsIndex } from './raid-logs.types';
import { logKey } from './raid-logs';
import { latestKills } from './raid-progression';
import { formatFightTime, raidLogLink } from './raid-display';
import { RaidLogsDataService } from './raid-logs-data.service';
import { LoadStateComponent } from '../../shared/load-state.component';
import { setPageHeader } from '../../core/page-header';

@Component({
  selector: 'app-raid-logs-invalid-page',
  imports: [RouterLink, DatePipe, LoadStateComponent],
  templateUrl: './raid-logs-invalid-page.component.html',
  styleUrl: './raid-logs-invalid-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RaidLogsInvalidPageComponent {
  readonly logKey = logKey;

  private readonly data = inject(RaidLogsDataService);
  private readonly destroyRef = inject(DestroyRef);

  readonly index = signal<RaidLogsIndex | undefined>(undefined);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | undefined>(undefined);
  readonly lastEdited = computed(() => this.index()?.generatedAt);
  readonly kills = computed(() => latestKills(this.index()?.invalidKills ?? []));

  readonly logLink = raidLogLink;
  readonly formatFightTime = formatFightTime;

  constructor() {
    setPageHeader(() => ({ lastEdited: this.lastEdited() }));
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
        },
        error: error => {
          console.error('Failed to load the raid logs:', error);
          this.loadError.set('The raid logs could not be loaded.');
          this.isLoading.set(false);
        }
      });
  }
}
