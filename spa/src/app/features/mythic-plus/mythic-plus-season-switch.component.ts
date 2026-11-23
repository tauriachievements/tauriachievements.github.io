import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { FilterDropdownComponent } from '../../shared/filter-dropdown.component';
import { FilterDropdownOption, FilterDropdownValue } from '../../shared/filter-dropdown.types';
import { SeasonChoice } from './mythic-plus-seasons';

@Component({
  selector: 'app-mythic-plus-season-switch',
  imports: [FilterDropdownComponent],
  templateUrl: './mythic-plus-season-switch.component.html',
  styleUrl: './mythic-plus-season-switch.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class MythicPlusSeasonSwitchComponent {
  readonly seasons = input.required<readonly SeasonChoice[]>();
  readonly selected = input<SeasonChoice>();
  readonly week = input(false);
  readonly weekReady = input(false);

  readonly seasonChange = output<string>();
  readonly weekChange = output<boolean>();

  readonly options = computed<FilterDropdownOption[]>(() =>
    this.seasons().map(season => ({ value: season.id, label: season.name })));
  readonly labels = computed(() => this.seasons().map(season => season.name));
  readonly selectedId = computed(() => this.selected()?.id);
  readonly upcoming = computed(() => !!this.selected()?.upcoming);
  readonly pressed = computed(() => this.week() && !this.upcoming());
  readonly weekDisabled = computed(() => !this.weekReady() || this.upcoming());

  pick(value: FilterDropdownValue): void {
    if (typeof value === 'string' && value !== this.selectedId()) {
      this.seasonChange.emit(value);
    }
  }

  toggleWeek(): void {
    this.weekChange.emit(!this.pressed());
  }
}
