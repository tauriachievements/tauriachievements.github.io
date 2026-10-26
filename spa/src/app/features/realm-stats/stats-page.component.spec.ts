import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LadderLastUpdatedService } from '../../players/ladder-last-updated.service';
import { statsSnapshotKey } from './realm-stats';
import { statsSnapshot } from './realm-stats.fixture';
import { ServerStatsService, ServerStatsSnapshotCollection } from './server-stats.service';
import { StatsPageComponent } from './stats-page.component';

const collection: ServerStatsSnapshotCollection = {
  version: 3,
  filters: {
    [statsSnapshotKey(undefined, 110)]: statsSnapshot(),
    [statsSnapshotKey('Evermoon', 110)]: statsSnapshot({ totalPlayers: 70, realms: [{ name: 'Evermoon', count: 70 }] }),
    [statsSnapshotKey('Tauri', 'all')]: statsSnapshot({ totalPlayers: 1234, realms: [{ name: 'Tauri', count: 1234 }] }),
    [statsSnapshotKey('WoD', 80)]: statsSnapshot({ totalPlayers: 0 })
  }
};

async function open(url: string) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'stats', component: StatsPageComponent }]),
      provideLocationMocks(),
      { provide: ServerStatsService, useValue: { getServerStats: () => of(collection) } },
      { provide: LadderLastUpdatedService, useValue: { getLastUpdated: () => of(null) } }
    ]
  });
  const harness = await RouterTestingHarness.create();
  const page = await harness.navigateByUrl(url, StatsPageComponent);
  harness.detectChanges();
  return { harness, page, element: harness.routeNativeElement as HTMLElement, location: TestBed.inject(Location) };
}

const characters = (element: HTMLElement) => element.querySelector('.summary dd')?.textContent;

describe('StatsPageComponent', () => {
  beforeEach(() => {
    vi.stubGlobal('matchMedia', (media: string) => ({
      media,
      matches: media.includes('reduce'),
      addEventListener: () => undefined,
      removeEventListener: () => undefined
    }));
  });

  afterEach(() => vi.unstubAllGlobals());

  it('opens on level 110 across all realms, with the realm split', async () => {
    const { element } = await open('/stats');

    expect(characters(element)).toBe('100');
    expect(element.querySelectorAll('.realm-legend li').length).toBe(2);
    expect(element.querySelector<HTMLButtonElement>('.filter-reset')?.disabled).toBe(true);
  });

  it('opens the realm and level a shared link names, without the realm split', async () => {
    const { element } = await open('/stats?realm=tauri&level=all');

    expect(characters(element)).toBe('1,234');
    expect(element.querySelector('.realm-strip')).toBeNull();
    expect(element.querySelector<HTMLButtonElement>('.filter-reset')?.disabled).toBe(false);
  });

  it('writes a picked filter to the URL and clears it on Reset', async () => {
    const { harness, page, element, location } = await open('/stats');

    page.setRealm('Evermoon');
    harness.detectChanges();
    expect(location.path()).toBe('/stats?realm=evermoon');
    expect(characters(element)).toBe('70');

    page.resetFilters();
    harness.detectChanges();
    expect(location.path()).toBe('/stats');
    expect(characters(element)).toBe('100');
  });

  it('says so when no character matches the filters', async () => {
    const { element } = await open('/stats?realm=wod&level=80');

    expect(element.querySelector('.stats-empty')?.textContent).toContain('No characters match these filters.');
    expect(element.querySelector('.summary')).toBeNull();
  });
});
