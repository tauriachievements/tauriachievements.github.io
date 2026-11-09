import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { FilterDropdownCoordinatorService } from '../../shared/filter-dropdown-coordinator.service';
import { MythicPlusSeasonOption } from './mythic-plus';
import { MythicPlusSeasonSwitchComponent } from './mythic-plus-season-switch.component';

const seasons: MythicPlusSeasonOption[] = [
  { id: 'legion-s1-1', name: 'Season 1.1 - Pre fixes' },
  { id: 'legion-s1-2', name: 'Season 1.2 - Post fixes' }
];

async function renderSwitch(inputs: Record<string, unknown>) {
  await TestBed.configureTestingModule({
    imports: [MythicPlusSeasonSwitchComponent],
    providers: [FilterDropdownCoordinatorService]
  }).compileComponents();
  const fixture = TestBed.createComponent(MythicPlusSeasonSwitchComponent);
  for (const [name, value] of Object.entries(inputs)) {
    fixture.componentRef.setInput(name, value);
  }
  fixture.detectChanges();
  const element: HTMLElement = fixture.nativeElement;
  const seasonsPicked: string[] = [];
  let weeksPicked = 0;
  fixture.componentInstance.seasonChange.subscribe(id => seasonsPicked.push(id));
  fixture.componentInstance.weekSelect.subscribe(() => weeksPicked++);
  const options = () => [...element.querySelectorAll<HTMLButtonElement>('.dropdown-option')];
  const week = () => [...element.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.trim() === 'This week');
  return {
    element,
    seasonsPicked,
    weeksPicked: () => weeksPicked,
    options: () => options().map(option => option.textContent?.trim()),
    pick: (name: string) => options().find(option => option.textContent?.trim() === name)?.click(),
    shown: () => element.querySelector('.trigger-current')?.textContent?.trim(),
    week
  };
}

describe('MythicPlusSeasonSwitchComponent', () => {
  it('offers every season in a dropdown that shows the one on screen', async () => {
    const { options, shown, pick, seasonsPicked } = await renderSwitch({ seasons, seasonId: 'legion-s1-2', period: 'season' });

    expect(options()).toEqual(['Season 1.1 - Pre fixes', 'Season 1.2 - Post fixes']);
    expect(shown()).toBe('Season 1.2 - Post fixes');

    pick('Season 1.1 - Pre fixes');
    expect(seasonsPicked).toEqual(['legion-s1-1']);
  });

  it('marks the season dropdown or This week as the active half', async () => {
    const season = await renderSwitch({ seasons, seasonId: 'legion-s1-1', period: 'season' });
    expect(season.element.querySelector('app-filter-dropdown')?.classList.contains('active')).toBe(true);
    expect(season.week()?.classList.contains('active')).toBe(false);

    TestBed.resetTestingModule();
    const week = await renderSwitch({ seasons, seasonId: 'legion-s1-2', period: 'week' });
    expect(week.element.querySelector('app-filter-dropdown')?.classList.contains('active')).toBe(false);
    expect(week.week()?.classList.contains('active')).toBe(true);
    expect(week.week()?.getAttribute('aria-pressed')).toBe('true');
  });

  it('asks for this week, unless there is no week to show', async () => {
    const enabled = await renderSwitch({ seasons, seasonId: 'legion-s1-1', period: 'season' });
    enabled.week()?.click();
    expect(enabled.weeksPicked()).toBe(1);

    TestBed.resetTestingModule();
    const disabled = await renderSwitch({ seasons, seasonId: 'legion-s1-2', period: 'season', weekDisabled: true });
    expect(disabled.week()?.disabled).toBe(true);
  });

  it('keeps the plain Season button when there is only one season', async () => {
    const { element, seasonsPicked } = await renderSwitch({
      seasons: [seasons[1]],
      seasonId: 'legion-s1-2',
      period: 'week'
    });

    expect(element.querySelector('app-filter-dropdown')).toBeNull();
    const season = [...element.querySelectorAll<HTMLButtonElement>('button')].find(button => button.textContent?.trim() === 'Season');
    season?.click();
    expect(seasonsPicked).toEqual(['legion-s1-2']);
  });
});
