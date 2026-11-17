import { provideLocationMocks } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Observable, of, throwError } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { RaidLogsIndexFile } from './raid-logs.types';
import { RaidLogsPageComponent } from './raid-logs-page.component';
import { DataFileService } from '../../core/data-file.service';

const indexFile: RaidLogsIndexFile = {
  version: 2,
  generatedAt: '2026-11-17T22:00:00Z',
  raid: { id: 1520, slug: 'emerald-nightmare', name: 'The Emerald Nightmare' },
  difficulties: [{ id: 16, slug: 'mythic', name: 'Mythic', shortName: 'M', kills: 1 }],
  bosses: [
    { id: 1853, slug: 'nythendra', name: 'Nythendra' },
    { id: 1873, slug: 'ilgynoth', name: "Il'gynoth, The Heart of Corruption" },
    { id: 1841, slug: 'ursoc', name: 'Ursoc' }
  ],
  specs: [],
  guilds: [['Miracle', 'Evermoon', 1, 3676]],
  logs: [['Tauri', 10, 2, 16, 1_000, 100_000, 0, 1, 0, 0, 20]],
  top: [],
  items: []
};

class FakeDataFiles {
  fetchJson<T>(path: string): Observable<T> {
    return path === 'raid-log-data/index.json' ? of(indexFile as T) : throwError(() => new Error(`No ${path}`));
  }

  refresh(): void {}
}

describe('RaidLogsPageComponent', () => {
  it('lists the boss cards in the order raiders kill them, numbered by that order', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'raid-logs', component: RaidLogsPageComponent }]),
        provideLocationMocks(),
        { provide: DataFileService, useValue: new FakeDataFiles() }
      ]
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/raid-logs?difficulty=mythic', RaidLogsPageComponent);
    harness.detectChanges();
    const element = harness.routeNativeElement as HTMLElement;

    expect([...element.querySelectorAll('.boss-card')].map(card =>
      [card.querySelector('.boss-number')?.textContent, card.querySelector('h3')?.textContent]))
      .toEqual([['Boss 1', 'Nythendra'], ['Boss 2', 'Ursoc'], ['Boss 3', "Il'gynoth"]]);
  });
});
