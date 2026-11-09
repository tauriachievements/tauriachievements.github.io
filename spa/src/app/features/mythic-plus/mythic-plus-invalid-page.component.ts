import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { MythicPlusIndex, MythicPlusRun, exportedAt, latestFirst, seasonScoreColors } from './mythic-plus';
import { MythicPlusDataService, mythicPlusLoadError } from './mythic-plus-data.service';
import { invalidReasons } from './mythic-plus-invalid';
import { MythicPlusRunsListComponent } from './mythic-plus-runs-list.component';
import { MYTHIC_PLUS_CARDS_QUERY, RunRow, toRunView } from './mythic-plus-views';
import { injectCompactViewport } from '../../shared/compact-viewport';
import { LoadStateComponent } from '../../shared/load-state.component';
import { setPageHeader } from '../../core/page-header';

@Component({
  selector: 'app-mythic-plus-invalid-page',
  imports: [RouterLink, DecimalPipe, LoadStateComponent, MythicPlusRunsListComponent],
  templateUrl: './mythic-plus-invalid-page.component.html',
  styleUrl: './mythic-plus-invalid-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MythicPlusInvalidPageComponent {
  private readonly mythicPlusData = inject(MythicPlusDataService);
  private readonly destroyRef = inject(DestroyRef);

  readonly cards = injectCompactViewport(MYTHIC_PLUS_CARDS_QUERY);

  readonly index = signal<MythicPlusIndex | undefined>(undefined);
  private readonly invalidRuns = signal<readonly MythicPlusRun[]>([]);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | undefined>(undefined);
  readonly expandedRunId = signal<string | undefined>(undefined);

  readonly lastEdited = computed(() => exportedAt(this.index()));
  readonly reasons = computed(() => invalidReasons(this.invalidRuns()));
  readonly rows = computed<RunRow[]>(() => {
    const index = this.index();
    const dungeons = new Map((index?.dungeons ?? []).map(dungeon => [dungeon.id, dungeon]));
    const affixes = new Map((index?.affixes ?? []).map(affix => [affix.id, affix]));
    const colors = seasonScoreColors(index);
    return [...this.invalidRuns()].sort(latestFirst).flatMap(run => {
      const dungeon = dungeons.get(run.dungeon);
      return dungeon ? [{ ...toRunView(run, dungeon, affixes, colors), rank: 0 }] : [];
    });
  });

  constructor() {
    setPageHeader(() => ({ lastEdited: this.lastEdited() }));
    this.loadData();
  }

  toggleRun(runId: string): void {
    this.expandedRunId.update(current => current === runId ? undefined : runId);
  }

  loadData(): void {
    this.isLoading.set(true);
    this.loadError.set(undefined);
    this.mythicPlusData.season()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ index, invalidRuns }) => {
          this.index.set(index);
          this.invalidRuns.set(invalidRuns);
          this.isLoading.set(false);
        },
        error: error => {
          console.error('Failed to load the invalid Mythic+ runs:', error);
          this.loadError.set(mythicPlusLoadError(error));
          this.isLoading.set(false);
        }
      });
  }
}
