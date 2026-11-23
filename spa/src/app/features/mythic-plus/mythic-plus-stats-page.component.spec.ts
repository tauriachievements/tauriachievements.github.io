import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Observable, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MythicPlusDungeonFile, MythicPlusIndex } from './mythic-plus';
import { MythicPlusStatsPageComponent } from './mythic-plus-stats-page.component';
import { DataFileService } from '../../core/data-file.service';

const index: MythicPlusIndex = {
  version: 1,
  tables: 'aaaaaaaaaaaa',
  generatedAt: '2026-10-15T06:00:00Z',
  season: { id: 'legion-s1', name: 'Season 1 - Patch 7.0.3', raid: 'Emerald Nightmare', startDate: '2026-09-16' },
  dungeons: [
    { id: 'nl', challengeId: 206, shortName: 'NL', name: "Neltharion's Lair", timerSeconds: 1980, icon: 'nl.png', runCount: 1, bestScore: 160 }
  ],
  affixes: [],
  specs: [{ class: 6, name: 'Unholy', role: 'dps' }],
  players: [['Dksmus', 'Evermoon', 'Skill Issue', 6, 1, 0]]
};

class FakeDataFiles {
  fetches = 0;

  getJson<T>(): Observable<T> {
    return of(index as T);
  }

  fetchJson<T>(): Observable<T> {
    this.fetches++;
    const file: MythicPlusDungeonFile = {
      version: 1,
      dungeon: 'nl',
      tables: index.tables,
      runs: [[16, 1500000, Date.parse('2026-10-14T18:00:00Z') / 1000, 160, [9, 7, 13], [[0, 0]]]]
    };
    return of(file as T);
  }

  refresh(): void {}
}

async function open(url: string) {
  const dataFiles = new FakeDataFiles();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'mythic-plus/stats', component: MythicPlusStatsPageComponent }]),
      { provide: DataFileService, useValue: dataFiles }
    ]
  });
  const harness = await RouterTestingHarness.create();
  const page = await harness.navigateByUrl(url, MythicPlusStatsPageComponent);
  harness.detectChanges();
  return { harness, page, dataFiles, element: harness.routeNativeElement as HTMLElement, location: TestBed.inject(Location) };
}

const weekToggle = (element: HTMLElement) => element.querySelector<HTMLButtonElement>('.period-bar .week-toggle');

describe('MythicPlusStatsPageComponent seasons', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', (media: string) => ({
      media,
      matches: media.includes('prefers-reduced-motion: reduce'),
      addEventListener: () => undefined,
      removeEventListener: () => undefined
    }));
  });

  afterEach(() => vi.unstubAllGlobals());

  it('names the exported season and turns This week on from a toggle beside the season dropdown', async () => {
    const { harness, page, element, location } = await open('/mythic-plus/stats');

    expect(element.querySelector('h1')?.textContent).toBe('Mythic+ stats · Season 1 - Patch 7.0.3');
    expect(element.querySelector('#mythicPlusSeasonTrigger .trigger-current')?.textContent?.trim()).toBe('Season 1 - Patch 7.0.3');

    weekToggle(element)?.click();
    harness.detectChanges();
    expect([page.period(), location.path()]).toEqual(['week', '/mythic-plus/stats?period=week']);
  });

  it('opens the Season 2 waiting room without downloading a dungeon file, and the back link keeps the season', async () => {
    const { element, dataFiles } = await open('/mythic-plus/stats?season=legion-s2');

    expect(element.querySelector('h1')?.textContent).toBe('Mythic+ stats · Season 2 - Patch 7.1.0');
    expect(element.querySelector('app-mythic-plus-season-waiting h2')?.textContent).toContain('Season 2 - Patch 7.1.0');
    expect(element.querySelector('.summary')).toBeNull();
    expect(weekToggle(element)?.disabled).toBe(true);
    expect(element.querySelector('.back-link')?.getAttribute('href')).toBe('/mythic-plus?season=legion-s2');
    expect(dataFiles.fetches).toBe(0);
  });

  it('leaves the queue for the exported season and loads its runs', async () => {
    const { harness, element, dataFiles, location } = await open('/mythic-plus/stats?season=legion-s2');

    element.querySelector<HTMLButtonElement>('app-mythic-plus-season-waiting .leave-queue')?.click();
    harness.detectChanges();

    expect(location.path()).toBe('/mythic-plus/stats');
    expect(dataFiles.fetches).toBe(1);
    expect(element.querySelector('.summary')).not.toBeNull();
  });
});
