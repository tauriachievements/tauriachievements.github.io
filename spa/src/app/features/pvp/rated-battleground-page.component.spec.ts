import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RatedBattlegroundPageComponent } from './rated-battleground-page.component';
import { match } from './rated-battleground-stats.fixture';
import { RatedBattlegroundsService } from './rated-battlegrounds.service';

const MATCHES = [
  match({ matchid: 11, mapname: 'Warsong Gulch', starttime: 1_789_600_000 }),
  match({ matchid: 12, mapid: 726, mapname: 'Twin Peaks', starttime: 1_789_610_000 }),
  match({ matchid: 13, mapname: 'Warsong Gulch', starttime: 1_789_620_000 })
];

async function open(url: string) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'rated-battleground', component: RatedBattlegroundPageComponent }]),
      provideLocationMocks(),
      {
        provide: RatedBattlegroundsService,
        useValue: { getMatches: () => of(MATCHES), getNewMatches: () => of(undefined) }
      }
    ]
  });
  const harness = await RouterTestingHarness.create();
  const page = await harness.navigateByUrl(url, RatedBattlegroundPageComponent);
  harness.detectChanges();
  return { harness, page, element: harness.routeNativeElement as HTMLElement, location: TestBed.inject(Location) };
}

const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim();

describe('RatedBattlegroundPageComponent match links', () => {
  const scrollIntoView = vi.fn();

  beforeEach(() => {
    scrollIntoView.mockClear();
    HTMLElement.prototype.scrollIntoView = scrollIntoView;
  });

  afterEach(() => {
    delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
  });

  it('opens the match the address names and scrolls the match explorer to it', async () => {
    const { page, element, location } = await open('/rated-battleground?view=matches&match=12');

    expect(page.selectedMatch()?.matchid).toBe(12);
    expect(text(element.querySelector('.match-tab.active strong'))).toBe('Twin Peaks');
    expect(text(element.querySelector('.match-detail-header h2'))).toBe('Twin Peaks');
    expect(location.path()).toBe('/rated-battleground?view=matches&match=12');
    expect(scrollIntoView.mock.contexts).toEqual([element.querySelector('.match-section')]);
  });

  it('names the latest match in the address when the match explorer opens without one', async () => {
    const { page, location } = await open('/rated-battleground?view=matches');

    expect(page.selectedMatch()?.matchid).toBe(13);
    expect(location.path()).toBe('/rated-battleground?view=matches&match=13');
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it('writes the match a tab picks to the address', async () => {
    const { harness, page, element, location } = await open('/rated-battleground?view=matches');

    element.querySelectorAll<HTMLButtonElement>('.match-tab')[2].click();
    harness.detectChanges();

    expect(page.selectedMatch()?.matchid).toBe(11);
    expect(location.path()).toBe('/rated-battleground?view=matches&match=11');
  });

  it('opens the latest match when the address names one the archive does not have', async () => {
    const { page, location } = await open('/rated-battleground?view=matches&match=999');

    expect(page.selectedMatch()?.matchid).toBe(13);
    expect(location.path()).toBe('/rated-battleground?view=matches&match=13');
  });

  it('leaves the match out of the address in the players view and writes it back with the match explorer', async () => {
    const { page, location } = await open('/rated-battleground?view=matches&match=12');

    page.setView('players');
    expect(location.path()).toBe('/rated-battleground');

    page.setView('matches');
    expect(location.path()).toBe('/rated-battleground?view=matches&match=12');
  });

  it('names the latest match of the battleground the filter picks', async () => {
    const { page, location } = await open('/rated-battleground?view=matches&match=13');

    page.setMap('Twin Peaks');

    expect(page.selectedMatch()?.matchid).toBe(12);
    expect(location.path()).toBe('/rated-battleground?view=matches&match=12');
  });

  it('keeps the players view address free of a match', async () => {
    const { location } = await open('/rated-battleground');

    expect(location.path()).toBe('/rated-battleground');
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});
