import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { RevealDirective } from '../../shared/motion/reveal.directive';
import { StatsBarRow } from './realm-stats-views';

@Component({
  selector: 'app-stats-bar-list',
  templateUrl: './stats-bar-list.component.html',
  styleUrls: ['./stats-bar-list.component.scss'],
  imports: [RevealDirective],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatsBarListComponent {
  readonly rows = input.required<readonly StatsBarRow[]>();
  readonly label = input.required<string>();

  readonly ranked = computed(() => this.rows().some(row => row.rank !== undefined));
}
