import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { RoleFilter } from '../game/wow';
import { FilterDropdownCoordinatorService } from './filter-dropdown-coordinator.service';
import { RoleFilterComponent } from './role-filter.component';

async function renderRoleFilter(inputs: Record<string, unknown> = {}) {
  await TestBed.configureTestingModule({
    imports: [RoleFilterComponent],
    providers: [FilterDropdownCoordinatorService]
  }).compileComponents();
  const fixture = TestBed.createComponent(RoleFilterComponent);
  fixture.componentRef.setInput('dropdownId', 'pageRole');
  for (const [name, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(name, value);
  }
  fixture.detectChanges();
  const element: HTMLElement = fixture.nativeElement;
  const emitted: Array<RoleFilter | undefined> = [];
  fixture.componentInstance.selectedChange.subscribe((role) => emitted.push(role));
  const optionButtons = () => [...element.querySelectorAll<HTMLButtonElement>('.dropdown-option')];
  return {
    element,
    emitted,
    options: () => optionButtons().map((option) => option.textContent?.trim()),
    pick: (label: string) => optionButtons().find((option) => option.textContent?.trim() === label)?.click(),
    shown: () => element.querySelector('.trigger-current')?.textContent?.trim()
  };
}

describe('RoleFilterComponent', () => {
  it('offers every role after "All roles" and shows the picked one', async () => {
    const { options, shown } = await renderRoleFilter({ selected: 'melee' });

    expect(options()).toEqual(['All roles', 'Tank', 'Healer', 'DPS', 'Melee DPS', 'Ranged DPS']);
    expect(shown()).toBe('Melee DPS');
  });

  it('shows "All roles" while no role is picked', async () => {
    const { shown } = await renderRoleFilter();

    expect(shown()).toBe('All roles');
  });

  it('offers only the roles it is given, without "All roles" when a role is required', async () => {
    const { options } = await renderRoleFilter({ roles: ['dps', 'ranged'], includeAll: false, selected: 'dps' });

    expect(options()).toEqual(['DPS', 'Ranged DPS']);
  });

  it('emits the picked role, undefined for "All roles", and nothing for the role already picked', async () => {
    const { pick, emitted } = await renderRoleFilter({ selected: 'tank' });

    pick('Ranged DPS');
    pick('Tank');
    pick('All roles');

    expect(emitted).toEqual(['ranged', undefined]);
  });

  it('names its trigger after its dropdown and labels it for screen readers', async () => {
    const { element } = await renderRoleFilter();
    const trigger = element.querySelector('.dropdown-trigger');

    expect(trigger?.id).toBe('pageRoleTrigger');
    expect(trigger?.getAttribute('aria-label')).toBe('Filter by role');
  });
});
