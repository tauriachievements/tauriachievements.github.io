import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Observable, of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { RaidLogsIndexFile } from './raid-logs.types';
import { RaidLogsInvalidPageComponent } from './raid-logs-invalid-page.component';
import { indexFile } from './raid-logs.fixture';
import { DataFileService } from '../../core/data-file.service';

class FakeDataFiles {
  constructor(private readonly index: RaidLogsIndexFile) {}

  fetchJson<T>(): Observable<T> {
    return of(this.index as T);
  }

  refresh(): void {}
}

async function open(index: RaidLogsIndexFile) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'raid-logs/invalid', component: RaidLogsInvalidPageComponent }]),
      { provide: DataFileService, useValue: new FakeDataFiles(index) }
    ]
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl('/raid-logs/invalid', RaidLogsInvalidPageComponent);
  harness.detectChanges();
  return harness.routeNativeElement as HTMLElement;
}

describe('RaidLogsInvalidPageComponent', () => {
  it('lists every invalid log, latest first, with its reason and a link to the log', async () => {
    const element = await open({
      ...indexFile,
      invalidLogs: [['Tauri', 10, 'Bug abusing'], ['Tauri', 12, 'Wrong boss']]
    });

    const rows = [...element.querySelectorAll('.invalid-row')];
    expect(rows.map(row => [
      row.querySelector('.boss-name')?.textContent?.trim(),
      row.querySelector('.difficulty')?.textContent?.trim(),
      row.querySelector('.reason')?.textContent?.trim()
    ])).toEqual([["Il'gynoth", 'Heroic', 'Wrong boss'], ['Nythendra', 'Mythic', 'Bug abusing']]);
    expect(rows[1].getAttribute('href')).toBe('/raid-logs/log/tauri/10');
  });

  it('says so when no log is invalid', async () => {
    const element = await open(indexFile);

    expect(element.querySelector('.invalid-row')).toBeNull();
    expect(element.querySelector('.empty-note')?.textContent).toContain('No log is marked invalid.');
  });
});
