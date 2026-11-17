import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NamedKillWeek } from './raid-kill-weeks';
import { formatFightTime, raidLogLink } from './raid-display';

@Component({
  selector: 'app-raid-kill-week',
  imports: [RouterLink, DatePipe],
  templateUrl: './raid-kill-week.component.html',
  styleUrl: './raid-kill-week.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RaidKillWeekComponent {
  readonly week = input.required<NamedKillWeek<unknown>>();
  readonly bossCount = input.required<number>();

  readonly headingId = computed(() => `kill-week-${this.week().start}`);

  readonly logLink = raidLogLink;
  readonly formatFightTime = formatFightTime;
}
