import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Observable, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RaidLogsIndexFile } from './raid-logs.types';
import { RaidLogsProgressionPageComponent } from './raid-logs-progression-page.component';
import { DataFileService } from '../../core/data-file.service';

const indexFile: RaidLogsIndexFile = {
  version: 2,
  generatedAt: '2026-10-22T22:00:00Z',
  previousGeneratedAt: '2026-10-21T22:00:00Z',
  raid: { id: 1520, slug: 'emerald-nightmare', name: 'The Emerald Nightmare' },
  difficulties: [{ id: 16, slug: 'mythic', name: 'Mythic', shortName: 'M', kills: 6 }],
  bosses: [
    { id: 1853, slug: 'nythendra', name: 'Nythendra' },
    { id: 1873, slug: 'ilgynoth', name: "Il'gynoth, The Heart of Corruption" },
    { id: 1876, slug: 'elerethe-renferal', name: 'Elerethe Renferal' }
  ],
  specs: [],
  guilds: [['Miracle', 'Evermoon', 1, 1], ['Outlaws', 'Tauri', 0, 2], ['Newcomers', 'Evermoon', 1, 3]],
  logs: [
    ['Tauri', 10, 0, 16, 1_000, 100_000, 0, 1, 0, 0, 20],
    ['Tauri', 11, 0, 16, 2_000, 100_000, 1, 0, 0, 0, 20],
    ['Tauri', 12, 1, 16, 3_000, 100_000, 0, 1, 0, 0, 20],
    ['Tauri', 13, 2, 16, 4_000, 100_000, 0, 1, 0, 0, 20],
    ['Tauri', 14, 0, 16, 5_000, 100_000, 1, 0, 0, 0, 20],
    ['Tauri', 15, 0, 16, 6_000, 100_000, 2, 1, 0, 0, 20]
  ],
  newLogs: [['Tauri', 12], ['Tauri', 13], ['Tauri', 14], ['Tauri', 15]],
  top: [],
  items: []
};

class FakeDataFiles {
  constructor(private readonly file: RaidLogsIndexFile) {}

  fetchJson<T>(): Observable<T> {
    return of(this.file as T);
  }

  refresh(): void {}
}

async function open(file: RaidLogsIndexFile, url = '/raid-logs/guilds') {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'raid-logs/guilds', component: RaidLogsProgressionPageComponent }]),
      provideLocationMocks(),
      { provide: DataFileService, useValue: new FakeDataFiles(file) }
    ]
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url, RaidLogsProgressionPageComponent);
  harness.detectChanges();
  return { harness, element: harness.routeNativeElement as HTMLElement, location: TestBed.inject(Location) };
}

function rows(element: HTMLElement) {
  return [...element.querySelectorAll('tbody tr')].map(row => [
    row.querySelector('.guild-name .strong')?.textContent,
    row.querySelector('.progress-count')?.textContent,
    row.querySelector('.guild-new')?.textContent ?? '',
    row.querySelector('.progress-gain [aria-hidden="true"]')?.textContent ?? '',
    row.querySelectorAll('.pip.fresh').length
  ]);
}

describe('RaidLogsProgressionPageComponent changes since the last scan', () => {
  it('tags a guild new to the difficulty and counts the bosses another guild killed', async () => {
    const { element } = await open(indexFile);

    expect(rows(element)).toEqual([
      ['Miracle', '3/3', '', '+2', 2],
      ['Outlaws', '1/3', '', '', 0],
      ['Newcomers', '1/3', 'new', '', 1]
    ]);
    expect(element.querySelector('.progress-gain')?.getAttribute('title'))
      .toMatch(/^Killed Elerethe and Il'gynoth since the scan of 2[12] Oct, \d\d:\d\d$/);
    expect(element.querySelector('.guild-new')?.getAttribute('title')).toMatch(/^New on Mythic since the scan of 2[12] Oct, \d\d:\d\d$/);
  });

  it('shows no change when the index has no previous scan', async () => {
    const { element } = await open({ ...indexFile, previousGeneratedAt: undefined, newLogs: undefined });

    expect(rows(element).map(([guild, , isNew, gain, fresh]) => [guild, isNew, gain, fresh])).toEqual([
      ['Miracle', '', '', 0],
      ['Outlaws', '', '', 0],
      ['Newcomers', '', '', 0]
    ]);
  });
});

const seconds = (at: string) => Date.parse(at) / 1000;

const weekFile: RaidLogsIndexFile = {
  ...indexFile,
  previousGeneratedAt: undefined,
  newLogs: undefined,
  logs: [
    ['Tauri', 10, 0, 16, seconds('2026-10-24T19:00:00Z'), 100_000, 0, 1, 0, 0, 20],
    ['Tauri', 11, 1, 16, seconds('2026-10-24T20:00:00Z'), 100_000, 0, 1, 0, 0, 20],
    ['Tauri', 12, 0, 16, seconds('2026-10-28T07:59:59Z'), 100_000, 2, 1, 0, 0, 20],
    ['Tauri', 13, 0, 16, seconds('2026-10-28T08:00:00Z'), 100_000, 1, 0, 0, 0, 20],
    ['Tauri', 14, 2, 16, seconds('2026-10-28T19:00:00Z'), 100_000, 1, 0, 0, 0, 20],
    ['Tauri', 15, 0, 16, seconds('2026-10-28T20:00:00Z'), 100_000, 0, 1, 0, 0, 20]
  ]
};

function weekToggle(element: HTMLElement) {
  return element.querySelector<HTMLButtonElement>('.week-switch button');
}

function progressRows(element: HTMLElement) {
  return [...element.querySelectorAll('tbody tr')].map(row => [
    row.querySelector('.rank')?.textContent,
    row.querySelector('.guild-name .strong')?.textContent,
    row.querySelector('.progress-count')?.textContent,
    row.querySelector('td.num')?.textContent
  ]);
}

describe('RaidLogsProgressionPageComponent This week', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-29T12:00:00Z'));
  });

  afterEach(() => vi.useRealTimers());

  it('ranks only the kills since the Wednesday reset while This week is on, and keeps it in the URL', async () => {
    const { harness, element, location } = await open(weekFile);
    expect(weekToggle(element)?.textContent?.trim()).toBe('This week');
    expect(weekToggle(element)?.getAttribute('aria-pressed')).toBe('false');
    expect(weekToggle(element)?.title).toMatch(/^Show only the kills since the raid reset on Wed 28 Oct, \d\d:00$/);
    expect(progressRows(element)).toEqual([
      ['1', 'Miracle', '2/3', '3'],
      ['2', 'Outlaws', '2/3', '2'],
      ['3', 'Newcomers', '1/3', '1']
    ]);

    weekToggle(element)?.click();
    harness.detectChanges();
    expect(weekToggle(element)?.getAttribute('aria-pressed')).toBe('true');
    expect(location.path()).toBe('/raid-logs/guilds?difficulty=mythic&period=week');
    expect(progressRows(element)).toEqual([
      ['1', 'Outlaws', '2/3', '2'],
      ['2', 'Miracle', '1/3', '1']
    ]);

    weekToggle(element)?.click();
    harness.detectChanges();
    expect(location.path()).toBe('/raid-logs/guilds?difficulty=mythic');
    expect(progressRows(element).length).toBe(3);
  });

  it('opens on this week from the URL, and says so when nobody has killed a boss since the reset', async () => {
    vi.setSystemTime(new Date('2026-11-05T12:00:00Z'));
    const { element } = await open(weekFile, '/raid-logs/guilds?period=week');

    expect(weekToggle(element)?.getAttribute('aria-pressed')).toBe('true');
    expect(progressRows(element)).toEqual([]);
    expect(element.querySelector('.empty-note')?.textContent?.trim()).toBe('No guild has a kill on Mythic this week yet.');
  });
});
