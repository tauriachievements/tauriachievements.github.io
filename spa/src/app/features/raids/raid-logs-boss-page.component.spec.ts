import { provideLocationMocks } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Observable, of, throwError } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { specFor } from '../../game/wow-specs';
import { RaidBossFile, RaidLogsIndexFile } from './raid-logs.types';
import { RaidLogsBossPageComponent } from './raid-logs-boss-page.component';
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
  specs: [{ id: 64, class: 8, name: 'Frost', role: 'dps' }],
  guilds: [['Miracle', 'Evermoon', 1, 3676]],
  logs: [['Tauri', 10, 2, 16, 1_000, 100_000, 0, 1, 0, 0, 20]],
  top: [],
  items: []
};

const ursocFile: RaidBossFile = {
  version: 1,
  boss: 'ursoc',
  difficulty: 'mythic',
  guilds: [['Miracle', 'Evermoon', 1, 3676]],
  players: [['Alpha', 'Evermoon', 8, 10, 0, 'Miracle']],
  logs: [['Tauri', 10, 1_000, 100_000, 0, 1, 0, 0, 0, [[0, 64, 870, 100_000_000, 0, 0, 0, 0, 0, 0]], []]]
};

class FakeDataFiles {
  constructor(private readonly files: Readonly<Record<string, unknown>>) {}

  fetchJson<T>(path: string): Observable<T> {
    return path in this.files ? of(this.files[path] as T) : throwError(() => new Error(`No ${path}`));
  }

  refresh(): void {}
}

async function openBoss(slug: string) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'raid-logs/boss/:boss', component: RaidLogsBossPageComponent }]),
      provideLocationMocks(),
      {
        provide: DataFileService,
        useValue: new FakeDataFiles({
          'raid-log-data/index.json': indexFile,
          'raid-log-data/ursoc-mythic.json': ursocFile,
          'raid-log-data/talents.json': { v: 1, specs: {} },
          'raid-log-data/talent-tooltips.json': {},
          'assets/data/raid-genders.json': { v: 1, female: { Evermoon: ['Alpha'] } }
        })
      }
    ]
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(`/raid-logs/boss/${slug}?difficulty=mythic`, RaidLogsBossPageComponent);
  harness.detectChanges();
  return harness.routeNativeElement as HTMLElement;
}

describe('RaidLogsBossPageComponent', () => {
  it('lists the bosses in the order raiders kill them and numbers the boss by that order', async () => {
    const element = await openBoss('ursoc');

    expect([...element.querySelectorAll('.boss-pick span')].map(pick => pick.textContent)).toEqual(['Nythendra', 'Ursoc', "Il'gynoth"]);
    expect(element.querySelector('.boss-heading .eyebrow')?.textContent?.trim()).toBe('Boss 2 · The Emerald Nightmare');
  });

  it('shows the spec icon, the race icon, the name and the realm on one line', async () => {
    const element = await openBoss('ursoc');
    const character = element.querySelector('tbody .character');

    expect([...character?.querySelectorAll('img') ?? []].map(image => image.getAttribute('src')))
      .toEqual([specFor(8, 'Frost')?.icon, 'assets/race-icons/10-1.gif']);
    expect([...character?.querySelector('.character-line')?.children ?? []].map(part => part.textContent?.trim())).toEqual(['Alpha', 'Evermoon']);
    expect([...character?.children ?? []].map(part => part.className)).toEqual(['', 'race-icon', 'character-line']);
  });
});
