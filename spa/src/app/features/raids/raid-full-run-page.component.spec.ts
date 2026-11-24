import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Observable, of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { DataFileService } from '../../core/data-file.service';
import { RaidFullRunPageComponent } from './raid-full-run-page.component';
import { RaidLogsIndexFile } from './raid-logs.types';

const index: RaidLogsIndexFile = {
  version: 2,
  generatedAt: '2026-11-24T12:00:00Z',
  raid: { id: 1520, slug: 'emerald-nightmare', name: 'The Emerald Nightmare' },
  difficulties: [{ id: 16, slug: 'mythic', name: 'Mythic', shortName: 'M', kills: 2 }],
  bosses: [
    { id: 1853, slug: 'nythendra', name: 'Nythendra' },
    { id: 1873, slug: 'ilgynoth', name: "Il'gynoth, The Heart of Corruption" }
  ],
  specs: [],
  guilds: [['Miracle', 'Evermoon', 1, 1]],
  logs: [
    ['Tauri', 10, 0, 16, 1_000, 100_000, 0, 1, 1, 0, 20],
    ['Tauri', 11, 1, 16, 2_000, 120_000, 0, 1, 2, 0, 20]
  ],
  clears: [['Tauri', 16, 'Evermoon', [10, 1]]],
  top: [],
  items: []
};

class FakeDataFiles {
  readonly requested: string[] = [];

  fetchJson<T>(path: string): Observable<T> {
    this.requested.push(path);
    return of(index as T);
  }

  refresh(): void {}
}

async function open(url = '/raid-logs/run/tauri/11') {
  const dataFiles = new FakeDataFiles();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'raid-logs/run/:realm/:id', component: RaidFullRunPageComponent }]),
      { provide: DataFileService, useValue: dataFiles }
    ]
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url, RaidFullRunPageComponent);
  harness.detectChanges();
  return { element: harness.routeNativeElement as HTMLElement, dataFiles };
}

describe('RaidFullRunPageComponent', () => {
  it('shows the exact full run and links every boss kill', async () => {
    const { element, dataFiles } = await open();
    const kills = [...element.querySelectorAll<HTMLAnchorElement>('.boss-kill')];

    expect(element.querySelector('h1')?.textContent).toContain('Miracle');
    expect(element.querySelector('.run-header')?.textContent).toContain('The Emerald Nightmare');
    expect(element.querySelector('.run-header')?.textContent).toContain('Mythic');
    expect(element.querySelector('.summary')?.textContent).toContain('18:20');
    expect(element.querySelector('.summary')?.textContent).toContain('2/2');
    expect(element.querySelector('.summary')?.textContent).toContain('3');
    expect(kills.map(kill => [kill.getAttribute('href'), kill.textContent?.replace(/\s+/g, ' ').trim()]))
      .toEqual([
        ['/raid-logs/log/tauri/10', expect.stringContaining('Nythendra')],
        ['/raid-logs/log/tauri/11', expect.stringContaining("Il'gynoth")]
      ]);
    expect(element.querySelector('.clear-leaderboard-link')?.getAttribute('href'))
      .toBe('/raid-logs/clears?difficulty=mythic');
    expect(dataFiles.requested).toEqual(['raid-log-data/index.json']);
  });

  it('explains when the requested log did not finish a full clear', async () => {
    const { element } = await open('/raid-logs/run/tauri/10');

    expect(element.textContent).toContain('That log did not finish a full clear.');
  });
});
