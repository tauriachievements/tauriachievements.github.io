import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Observable, of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { DataFileService } from '../../core/data-file.service';
import { RaidLogPageComponent } from './raid-log-page.component';
import { RaidBossFile, RaidLogsIndexFile } from './raid-logs.types';

const index: RaidLogsIndexFile = {
  version: 2,
  generatedAt: '2026-11-24T12:00:00Z',
  raid: { id: 1520, slug: 'emerald-nightmare', name: 'The Emerald Nightmare' },
  difficulties: [{ id: 16, slug: 'mythic', name: 'Mythic', shortName: 'M', kills: 2 }],
  bosses: [
    { id: 1853, slug: 'nythendra', name: 'Nythendra' },
    { id: 1873, slug: 'ilgynoth', name: "Il'gynoth, The Heart of Corruption" }
  ],
  specs: [{ id: 63, class: 8, name: 'Fire', role: 'dps' }],
  guilds: [['Miracle', 'Evermoon', 1, 1]],
  logs: [
    ['Tauri', 10, 0, 16, 1_000, 100_000, 0, 1, 0, 0, 20],
    ['Tauri', 11, 1, 16, 2_000, 120_000, 0, 1, 0, 0, 20]
  ],
  clears: [['Tauri', 16, 'Evermoon', [10, 1]]],
  top: [],
  items: []
};

const bossFile: RaidBossFile = {
  version: 1,
  boss: 'ilgynoth',
  difficulty: 'mythic',
  guilds: [['Miracle', 'Evermoon', 1, 1]],
  players: [['Kael', 'Tauri', 8, 1, 0, 'Miracle']],
  logs: [[
    'Tauri', 11, 2_000, 120_000, 0, 1, 0, 0, 0,
    [[0, 63, 870, 120_000_000, 0, 0, 0, 1_000_000, 0, 0]],
    []
  ]]
};

class FakeDataFiles {
  fetchJson<T>(path: string): Observable<T> {
    const files: Record<string, unknown> = {
      'raid-log-data/index.json': index,
      'raid-log-data/ilgynoth-mythic.json': bossFile,
      'raid-log-data/talents.json': { version: 1, specs: [] },
      'raid-log-data/talent-tooltips.json': { version: 1, spells: [] },
      'assets/data/raid-genders.json': { v: 1, female: {}, male: {} }
    };
    return of(files[path] as T);
  }

  refresh(): void {}
}

describe('RaidLogPageComponent full clear', () => {
  it('opens the exact full run and keeps the full-clear leaderboard as a separate link', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'raid-logs/log/:realm/:id', component: RaidLogPageComponent }]),
        { provide: DataFileService, useClass: FakeDataFiles }
      ]
    });
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/raid-logs/log/tauri/11', RaidLogPageComponent);
    harness.detectChanges();
    const element = harness.routeNativeElement as HTMLElement;

    expect(element.querySelector('.clear-chip')?.textContent).toContain('View full run');
    expect(element.querySelector('.clear-chip')?.getAttribute('href')).toBe('/raid-logs/run/tauri/11');
    expect(element.querySelector('.clear-leaderboard-link')?.getAttribute('href'))
      .toBe('/raid-logs/clears?difficulty=mythic');
  });
});
