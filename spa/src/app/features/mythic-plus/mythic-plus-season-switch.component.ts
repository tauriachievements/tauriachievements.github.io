import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FilterDropdownComponent } from '../../shared/filter-dropdown.component';
import { FilterDropdownOption, FilterDropdownValue } from '../../shared/filter-dropdown.types';
import { GlideDirective } from '../../shared/motion/glide.directive';
import { MythicPlusSeasonOption } from './mythic-plus';

@Component({
  selector: 'app-mythic-plus-season-switch',
  imports: [FilterDropdownComponent, GlideDirective],
  templateUrl: './mythic-plus-season-switch.component.html',
  styleUrls: ['./mythic-plus-season-switch.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MythicPlusSeasonSwitchComponent {
  readonly seasons = input.required<readonly MythicPlusSeasonOption[]>();
  readonly seasonId = input.required<string>();
  readonly period = input.required<'season' | 'week'>();
  readonly weekDisabled = input(false);

  readonly seasonChange = output<string>();
  readonly weekSelect = output<void>();

  readonly options = computed<FilterDropdownOption[]>(() =>
    this.seasons().map(season => ({ value: season.id, label: season.name })));
  readonly labels = computed(() => this.seasons().map(season => season.name));

  pickSeason(value: FilterDropdownValue): void {
    if (typeof value === 'string') {
      this.seasonChange.emit(value);
    }
  }
}
