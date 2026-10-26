import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RevealDirective } from '../../shared/motion/reveal.directive';
import { TapTooltipDirective } from '../../shared/tap-tooltip.directive';
import { StatsColumn } from './realm-stats-views';

@Component({
  selector: 'app-stats-column-chart',
  templateUrl: './stats-column-chart.component.html',
  styleUrls: ['./stats-column-chart.component.scss'],
  imports: [RevealDirective, TapTooltipDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatsColumnChartComponent {
  readonly columns = input.required<readonly StatsColumn[]>();
  readonly caption = input.required<string>();
  readonly unit = input('characters');
}
