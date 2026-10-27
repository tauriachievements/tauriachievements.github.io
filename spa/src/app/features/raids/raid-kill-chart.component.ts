import { DatePipe, formatDate } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { injectCompactViewport } from '../../shared/compact-viewport';
import { ITEM_QUALITY_COLORS, formatFightTime, formatPerSecond, raidLogLink } from './raid-display';
import { KillHistory, killChart, recordChange } from './raid-kill-history';
import { RaidMetric } from './raid-scores';

const PHONE_LABELS = 5;
const WIDE_LABELS = 12;

@Component({
  selector: 'app-raid-kill-chart',
  imports: [RouterLink, DatePipe],
  templateUrl: './raid-kill-chart.component.html',
  styleUrl: './raid-kill-chart.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class.compact]': 'compact()',
    '[attr.aria-hidden]': 'compact() || null'
  }
})
export class RaidKillChartComponent {
  readonly history = input.required<KillHistory>();
  readonly top = input.required<number>();
  readonly metric = input.required<RaidMetric>();
  readonly mainSpecId = input<number>();
  readonly referenceLabel = input('#1');
  readonly color = input('#e0e0e0');
  readonly compact = input(false);

  private readonly phone = injectCompactViewport();

  readonly chart = computed(() =>
    killChart(this.history(), this.top(), this.mainSpecId(), this.phone() ? PHONE_LABELS : WIDE_LABELS));

  readonly record = computed(() => {
    const check = this.history().check;
    return check && recordChange(check.change);
  });

  readonly unit = computed(() => this.metric() === 'hps' ? 'HPS' : 'DPS');

  readonly labels = computed(() => (this.chart()?.points ?? []).map(point =>
    `${formatDate(point.kill.kill.killedAt, 'd MMM', 'en-US')}: ${formatPerSecond(point.kill.value)} ${this.unit()}, ${
      point.invalid ? "invalid, doesn't count" : `${this.percent(point.relative)} of best`}. Opens the log.`));

  readonly qualityColors = ITEM_QUALITY_COLORS;
  readonly formatPerSecond = formatPerSecond;
  readonly formatFightTime = formatFightTime;
  readonly logLink = raidLogLink;

  percent(relative: number): string {
    return `${Math.floor(relative * 100)}%`;
  }
}
