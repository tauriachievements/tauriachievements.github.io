import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { GlideDirective } from './glide.directive';
import { RaidDifficulty } from './raid-logs';

/**
 * Normal / Heroic / Mythic. A difficulty without a kill anywhere in the raid isn't shown (LFR,
 * which the servers don't log); one without a kill of this boss can't be picked.
 */
@Component({
  selector: 'app-raid-difficulty-switch',
  standalone: true,
  imports: [CommonModule, GlideDirective],
  template: `
    <div class="difficulty-switch" role="group" [attr.aria-label]="label()" appGlide>
      @for (difficulty of shown(); track difficulty.slug) {
        <button
          type="button"
          [class.active]="difficulty.slug === selected()"
          [attr.aria-pressed]="difficulty.slug === selected()"
          [disabled]="!counts(difficulty)"
          (click)="selectedChange.emit(difficulty.slug)">
          <span class="difficulty-dot" [ngClass]="difficulty.slug" aria-hidden="true"></span>
          <span>{{ difficulty.name === 'Looking For Raid' ? 'LFR' : difficulty.name }}</span>
        </button>
      }
    </div>
  `,
  styles: [`
    @use './raid-logs-shared' as *;
    :host { display: inline-block; max-width: 100%; }
    @include difficulty-switch;
  `],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RaidDifficultySwitchComponent {
  readonly difficulties = input.required<readonly RaidDifficulty[]>();
  readonly selected = input<string>();
  readonly label = input('Difficulty');
  /** Kills per difficulty slug; defaults to each difficulty's raid-wide count. */
  readonly killCounts = input<ReadonlyMap<string, number>>();
  readonly selectedChange = output<string>();

  readonly shown = computed(() => this.difficulties().filter(difficulty => difficulty.kills > 0));

  counts(difficulty: RaidDifficulty): number {
    const killCounts = this.killCounts();
    return killCounts ? killCounts.get(difficulty.slug) ?? 0 : difficulty.kills;
  }
}
