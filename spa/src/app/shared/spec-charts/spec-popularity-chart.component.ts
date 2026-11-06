import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { FlipDirective } from '../motion/flip.directive';
import { RevealDirective } from '../motion/reveal.directive';
import { TapTooltipDirective } from '../tap-tooltip.directive';
import { PopularityBar, PopularityClassGroup, SpecPopularity, popularityChart } from './spec-popularity';

@Component({
  selector: 'app-spec-popularity-chart',
  imports: [DecimalPipe, FlipDirective, RevealDirective, TapTooltipDirective],
  templateUrl: './spec-popularity-chart.component.html',
  styleUrls: ['./spec-popularity-chart.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class SpecPopularityChartComponent {
  readonly popularity = input.required<SpecPopularity>();
  readonly unit = input.required<string>();

  readonly chart = computed(() => popularityChart(this.popularity()));

  barLabel(spec: PopularityBar, group: PopularityClassGroup): string {
    const total = this.popularity().total;
    return `${spec.spec} ${group.className}: ${spec.shareLabel}, ${spec.count.toLocaleString('en-US')} of ${total.toLocaleString('en-US')} ${this.unit()}`;
  }
}
