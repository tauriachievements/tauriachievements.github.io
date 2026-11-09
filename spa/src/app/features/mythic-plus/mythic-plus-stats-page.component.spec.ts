import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Observable, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MythicPlusDungeonFile, MythicPlusIndex } from './mythic-plus';
import { MythicPlusStatsPageComponent } from './mythic-plus-stats-page.component';
import { DataFileService } from '../../core/data-file.service';

const unix = (iso: string) => Date.parse(iso) / 1000;

const liveIndex: MythicPlusIndex = {
  version: 2,
  tables: 'aaaaaaaaaaaa',
  season: { id: 'legion-s1-2', name: 'Season 1.2 - Post fixes', raid: 'Emerald Nightmare', startDate: '2026-11-09' },
  seasons: [
    { id: 'legion-s1-1', name: 'Season 1.1 - Pre fixes' },
    { id: 'legion-s1-2', name: 'Season 1.2 - Post fixes' }
  ],
  dungeons: [{ id: 'nl', challengeId: 206, shortName: 'NL', name: "Neltharion's Lair", timerSeconds: 1980, icon: 'nl.png', runCount: 1, bestScore: 150 }],
  affixes: [],
  specs: [{ class: 10, name: 'Windwalker', role: 'dps' }],
  players: [['Progtrix', 'Evermoon', '', 10, 10, 1]]
};

const archivedIndex: MythicPlusIndex = {
  ...liveIndex,
  season: { id: 'legion-s1-1', name: 'Season 1.1 - Pre fixes', raid: 'Emerald Nightmare', startDate: '2026-09-16' },
  seasons: undefined
};

class SeasonDataFiles {
  getJson<T>(path: string): Observable<T> {
    return of((path.includes('/legion-s1-1/') ? archivedIndex : liveIndex) as T);
  }

  fetchJson<T>(path: string): Observable<T> {
    const archived = path.includes('/legion-s1-1/');
    const file: MythicPlusDungeonFile = {
      version: 2,
      dungeon: 'nl',
      tables: liveIndex.tables,
      runs: archived
        ? [[15, 1500000, unix('2026-10-01T18:00:00Z'), 150, [], [[0, 0]]], [14, 1500000, unix('2026-10-02T18:00:00Z'), 140, [], [[0, 0]]]]
        : [[15, 1500000, unix('2026-11-09T18:00:00Z'), 150, [], [[0, 0]]]]
    };
    return of(file as T);
  }

  refresh(): void {}
}

async function open(url: string) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'mythic-plus/stats', component: MythicPlusStatsPageComponent }]),
      { provide: DataFileService, useValue: new SeasonDataFiles() }
    ]
  });
  const harness = await RouterTestingHarness.create();
  const page = await harness.navigateByUrl(url, MythicPlusStatsPageComponent);
  return { page, location: TestBed.inject(Location) };
}

describe('MythicPlusStatsPageComponent seasons', () => {
  beforeEach(() => vi.stubGlobal('matchMedia', (media: string) => ({
    media,
    matches: false,
    addEventListener: () => undefined,
    removeEventListener: () => undefined
  })));

  afterEach(() => vi.unstubAllGlobals());

  it('counts the runs of the season the address names', async () => {
    const { page } = await open('/mythic-plus/stats?season=legion-s1-1');

    expect(page.index()?.season.id).toBe('legion-s1-1');
    expect(page.allRuns()).toHaveLength(2);
  });

  it('switches season from the dropdown, and This week goes back to the live season', async () => {
    const { page, location } = await open('/mythic-plus/stats');

    page.setSeason('legion-s1-1');
    expect(page.allRuns()).toHaveLength(2);
    expect(location.path()).toBe('/mythic-plus/stats?season=legion-s1-1');

    page.setPeriod('week');
    expect(page.index()?.season.id).toBe('legion-s1-2');
    expect(page.period()).toBe('week');
    expect(location.path()).toBe('/mythic-plus/stats?period=week');
  });
});
