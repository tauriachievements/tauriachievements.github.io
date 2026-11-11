import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Observable, of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { DataFileService } from '../../core/data-file.service';
import { RaceDataset } from './raid-race';
import { EMERALD_NIGHTMARE_RACE, RaidRace, TRIAL_OF_VALOR_RACE } from './raid-races';
import { RaidRacePageComponent } from './raid-race-page.component';

class FakeDataFiles {
  readonly requested: string[] = [];

  constructor(private readonly data: RaceDataset) {}

  getJson<T>(path: string): Observable<T> {
    this.requested.push(path);
    return of(this.data as T);
  }
}

async function open(race: RaidRace, data: RaceDataset) {
  const dataFiles = new FakeDataFiles(data);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'race', component: RaidRacePageComponent, data: { race } }]),
      { provide: DataFileService, useValue: dataFiles }
    ]
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl('/race', RaidRacePageComponent);
  harness.detectChanges();
  return { element: harness.routeNativeElement as HTMLElement, dataFiles };
}

function texts(element: HTMLElement, selector: string): (string | undefined)[] {
  return [...element.querySelectorAll(selector)].map(node => node.textContent?.replace(/\s+/g, ' ').trim());
}

describe('RaidRacePageComponent', () => {
  it('shows the Trial of Valor race as a placeholder before the first kill', async () => {
    const { element, dataFiles } = await open(TRIAL_OF_VALOR_RACE, {});

    expect(dataFiles.requested).toEqual(['TrialOfValor.json']);
    expect(element.querySelector('.race-banner img')?.getAttribute('src')).toBe('assets/trial-of-valor-the-race-to.webp');
    expect(element.querySelector<HTMLElement>('.race-banner')?.style.getPropertyValue('--race-banner-offset')).toBe('10px');
    expect(texts(element, '.boss-card h2')).toEqual(['Odyn', 'Guarm', 'Helya']);
    expect(texts(element, '.guild-ranking .guild-name')).toEqual(Array(15).fill('Available'));
    expect(texts(element, '.axis-hour')).toEqual(['18:00', '19:00', '20:00', '21:00', '22:00']);
    expect(texts(element, '.placeholder-lane .guild-summary-copy > *')).toEqual(['No kills yet', '0/3 bosses']);
    expect(element.querySelector<HTMLButtonElement>('.playback-button')?.disabled).toBe(true);
    expect(element.querySelector<HTMLInputElement>('.playback-slider')?.disabled).toBe(true);
  });

  it('wears the colours of its raid', async () => {
    const valor = await open(TRIAL_OF_VALOR_RACE, {});
    expect(valor.element.classList).toContain('theme-valor');
    expect(valor.element.classList).not.toContain('theme-nightmare');

    TestBed.resetTestingModule();
    const nightmare = await open(EMERALD_NIGHTMARE_RACE, {});
    expect(nightmare.element.classList).toContain('theme-nightmare');
    expect(nightmare.element.classList).not.toContain('theme-valor');
  });

  it('draws a lane for each guild once the kills are in', async () => {
    const { element } = await open(TRIAL_OF_VALOR_RACE, {
      odyn: [{ guild: 'Miracle', realm: 'Evermoon', date: '2026-11-18', time: '18:20' }]
    });

    expect(element.querySelector('.placeholder-lane')).toBeNull();
    expect(texts(element, '.guild-lane .guild-summary-copy > *')).toEqual(['Miracle', '1/3 bosses']);
    expect(element.querySelector<HTMLButtonElement>('.playback-button')?.disabled).toBe(false);
    expect(element.querySelector('.boss-card .guild-card-link')?.getAttribute('href'))
      .toBe(element.querySelector('.timeline-guild-link')?.getAttribute('href'));
  });
});
