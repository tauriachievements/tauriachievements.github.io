import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Observable, of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { MythicPlusDungeonFile, MythicPlusIndex, MythicPlusRunEntry } from './mythic-plus';
import { MythicPlusInvalidPageComponent } from './mythic-plus-invalid-page.component';
import { DataFileService } from '../../core/data-file.service';

const unix = (iso: string) => Date.parse(iso) / 1000;
const brhReason = 'Black Rook Hold +17 or higher with a Death Knight, before the 9 November fixes';
const cosReason = 'Court of Stars +17 or higher, before the 9 November fixes';

const index: MythicPlusIndex = {
  version: 2,
  tables: 'aaaaaaaaaaaa',
  season: { id: 'legion-s1', name: 'Legion Season 1', raid: 'Emerald Nightmare', startDate: '2026-09-16' },
  dungeons: [
    { id: 'brh', challengeId: 199, shortName: 'BRH', name: 'Black Rook Hold', timerSeconds: 2340, icon: 'brh.png', runCount: 1, bestScore: 150, invalidRunCount: 1 },
    { id: 'cos', challengeId: 210, shortName: 'COS', name: 'Court of Stars', timerSeconds: 1800, icon: 'cos.png', runCount: 0, bestScore: 0, invalidRunCount: 2 }
  ],
  affixes: [],
  specs: [{ class: 6, name: 'Blood', role: 'tank' }],
  players: [['Tank', 'Evermoon', '', 6, 1, 0]]
};

const allValid: Record<string, MythicPlusRunEntry[]> = {
  brh: [[15, 1500000, unix('2026-10-01T18:00:00Z'), 150, [], [[0, 0]]]],
  cos: [[12, 1500000, unix('2026-10-02T18:00:00Z'), 120, [], [[0, 0]]]]
};

class FakeDataFiles {
  constructor(private readonly runs: Record<string, MythicPlusRunEntry[]>) {}

  getJson<T>(): Observable<T> {
    return of(index as T);
  }

  fetchJson<T>(path: string): Observable<T> {
    const dungeon = path.replace(/^.*\//, '').replace('.json', '');
    const file: MythicPlusDungeonFile = { version: 2, dungeon, tables: index.tables, runs: this.runs[dungeon] };
    return of(file as T);
  }

  refresh(): void {}
}

async function open(runs: Record<string, MythicPlusRunEntry[]>) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'mythic-plus/invalid', component: MythicPlusInvalidPageComponent }]),
      { provide: DataFileService, useValue: new FakeDataFiles(runs) }
    ]
  });
  const harness = await RouterTestingHarness.create();
  const page = await harness.navigateByUrl('/mythic-plus/invalid', MythicPlusInvalidPageComponent);
  harness.detectChanges();
  return { page, element: harness.routeNativeElement as HTMLElement };
}

describe('MythicPlusInvalidPageComponent', () => {
  it('lists every invalid run, latest first, under the rules they broke', async () => {
    const { page, element } = await open({
      brh: [
        [20, 1500000, unix('2026-10-05T18:00:00Z'), 200, [], [[0, 0]], brhReason],
        [15, 1500000, unix('2026-10-01T18:00:00Z'), 150, [], [[0, 0]]]
      ],
      cos: [
        [19, 1500000, unix('2026-10-03T18:00:00Z'), 190, [], [[0, 0]], cosReason],
        [18, 1500000, unix('2026-10-07T18:00:00Z'), 180, [], [[0, 0]], cosReason]
      ]
    });

    expect([...element.querySelectorAll('.reason-list li')].map(item => item.textContent?.replace(/\s+/g, ' ').trim()))
      .toEqual([`2 runs ${cosReason}`, `1 run ${brhReason}`]);
    expect(page.rows().map(row => [row.dungeon.id, row.keyLevel])).toEqual([['cos', 18], ['brh', 20], ['cos', 19]]);
    expect(element.querySelectorAll('.run-row .invalid-tag')).toHaveLength(3);
    expect(element.querySelector('.back-link')?.getAttribute('href')).toBe('/mythic-plus');
  });

  it('says so when every run counts', async () => {
    const { element } = await open(allValid);

    expect(element.querySelector('.run-row')).toBeNull();
    expect(element.querySelector('.empty-note')?.textContent).toContain('No run is marked invalid.');
  });
});
