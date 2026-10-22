import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { FilterBarComponent } from './filter-bar.component';
import { MobileFilterToggleComponent } from './mobile-filter-toggle.component';

async function renderToggle(inputs: { expanded?: boolean; activeFilters?: string[]; label?: string }) {
  await TestBed.configureTestingModule({ imports: [MobileFilterToggleComponent] }).compileComponents();
  const fixture = TestBed.createComponent(MobileFilterToggleComponent);
  fixture.componentRef.setInput('controlsId', 'page-filters');
  for (const [name, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(name, value);
  }
  fixture.detectChanges();
  const element: HTMLElement = fixture.nativeElement;
  return { fixture, element, button: element.querySelector('button')! };
}

describe('MobileFilterToggleComponent', () => {
  it('shows how many filters are active and lists them while closed', async () => {
    const { element, button } = await renderToggle({ activeFilters: ['Tauri', 'Horde'] });

    expect(button.getAttribute('aria-controls')).toBe('page-filters');
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-label')).toBe('Filters, 2 active');
    expect(element.querySelector('.mobile-filter-count')?.textContent?.trim()).toBe('2');
    expect([...element.querySelectorAll('.mobile-filter-chips li')].map((li) => li.textContent?.trim())).toEqual(['Tauri', 'Horde']);
  });

  it('hides the chips while the panel is open', async () => {
    const { element, button } = await renderToggle({ expanded: true, activeFilters: ['Tauri'] });

    expect(button.getAttribute('aria-expanded')).toBe('true');
    expect(element.querySelector('.mobile-filter-chips')).toBeNull();
  });

  it('shows no count or chips when nothing is filtered', async () => {
    const { element, button } = await renderToggle({ label: 'Class breakdown' });

    expect(button.getAttribute('aria-label')).toBe('Class breakdown');
    expect(element.querySelector('.mobile-filter-count')).toBeNull();
    expect(element.querySelector('.mobile-filter-chips')).toBeNull();
  });

  it('asks for the opposite state when tapped', async () => {
    const { fixture, button } = await renderToggle({ expanded: false });
    const emitted: boolean[] = [];
    fixture.componentInstance.expandedChange.subscribe((value) => emitted.push(value));

    button.click();
    fixture.componentRef.setInput('expanded', true);
    fixture.detectChanges();
    button.click();

    expect(emitted).toEqual([true, false]);
  });
});

describe('FilterBarComponent active filters', () => {
  it('lists every setting Reset would undo, but not the search', () => {
    TestBed.configureTestingModule({ imports: [FilterBarComponent] });
    const fixture = TestBed.createComponent(FilterBarComponent);
    const setInputs = (inputs: Record<string, unknown>) =>
      Object.entries(inputs).forEach(([name, value]) => fixture.componentRef.setInput(name, value));
    setInputs({
      sortOptions: [{ value: 'achievementPoints', label: 'Character Achievements' }, { value: 'honorableKills', label: 'Honorable Kills' }],
      realmOptions: [{ value: undefined, label: 'All Realms' }, { value: 'Tauri', label: 'Tauri' }],
      factionOptions: [{ value: undefined, label: 'All Factions' }, { value: 'Horde', label: 'Horde' }],
      classOptions: [{ id: 8, name: 'Mage', icon: '' }]
    });

    expect(fixture.componentInstance.activeFilterLabels()).toEqual([]);

    setInputs({ searchTerm: 'larahh', sort: 'honorableKills', realm: 'Tauri', playerClass: 8, faction: 'Horde', pageSize: 500 });

    expect(fixture.componentInstance.activeFilterLabels()).toEqual(['Sort: Honorable Kills', 'Tauri', 'Mage', 'Horde', '500 per page']);
  });
});
