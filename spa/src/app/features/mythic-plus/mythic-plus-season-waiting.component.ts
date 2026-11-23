import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, output, signal } from '@angular/core';
import { formatClock } from '../../shared/time-format';
import { SeasonChoice } from './mythic-plus-seasons';

@Component({
  selector: 'app-mythic-plus-season-waiting',
  templateUrl: './mythic-plus-season-waiting.component.html',
  styleUrl: './mythic-plus-season-waiting.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MythicPlusSeasonWaitingComponent {
  readonly season = input.required<SeasonChoice>();
  readonly current = input<SeasonChoice>();
  readonly leave = output<string>();

  private readonly queuedAt = Date.now();
  private readonly now = signal(this.queuedAt);
  readonly timeInQueue = computed(() => formatClock((this.now() - this.queuedAt) / 1000));

  constructor() {
    const clock = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(clock));
  }
}
