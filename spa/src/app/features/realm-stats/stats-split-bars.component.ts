import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RevealDirective } from '../../shared/motion/reveal.directive';
import { StatsSplit } from './realm-stats-views';

@Component({
  selector: 'app-stats-split-bars',
  templateUrl: './stats-split-bars.component.html',
  styleUrls: ['./stats-split-bars.component.scss'],
  imports: [RevealDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatsSplitBarsComponent {
  readonly split = input.required<StatsSplit>();
  readonly leftName = input.required<string>();
  readonly rightName = input.required<string>();
  readonly leftColor = input.required<string>();
  readonly rightColor = input.required<string>();

  readonly rows = computed(() => [this.split().total, ...this.split().rows]);
}
