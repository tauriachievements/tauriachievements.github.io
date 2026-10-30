import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { ROLE_FILTER_LABELS, ROLE_FILTERS, RoleFilter, parseRoleFilter } from '../game/wow';
import { FilterDropdownComponent } from './filter-dropdown.component';
import { FilterDropdownOption, FilterDropdownValue } from './filter-dropdown.types';

const ALL_ROLES_LABEL = 'All roles';

@Component({
  selector: 'app-role-filter',
  imports: [FilterDropdownComponent],
  template: `
    <app-filter-dropdown
      [dropdownId]="dropdownId()"
      [triggerId]="dropdownId() + 'Trigger'"
      ariaLabel="Filter by role"
      [options]="options()"
      [selectedValue]="selected()"
      [compact]="true"
      [highlightWhenSelected]="includeAll()"
      [widthLabels]="widthLabels"
      (selectionChange)="select($event)" />
  `,
  styles: [':host { display: contents; }'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class RoleFilterComponent {
  readonly dropdownId = input.required<string>();
  readonly selected = input<RoleFilter>();
  readonly roles = input<readonly RoleFilter[]>(ROLE_FILTERS);
  readonly includeAll = input(true);

  readonly selectedChange = output<RoleFilter | undefined>();

  readonly widthLabels = [ALL_ROLES_LABEL, ...ROLE_FILTERS.map(role => ROLE_FILTER_LABELS[role])];

  readonly options = computed<FilterDropdownOption[]>(() => [
    ...(this.includeAll() ? [{ value: undefined, label: ALL_ROLES_LABEL }] : []),
    ...this.roles().map(role => ({ value: role, label: ROLE_FILTER_LABELS[role] }))
  ]);

  select(value: FilterDropdownValue): void {
    const role = typeof value === 'string' ? parseRoleFilter(value) : undefined;
    if (role !== this.selected()) {
      this.selectedChange.emit(role);
    }
  }
}
