import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Observable, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RaidBossFile, RaidLogsIndexFile, RaidMemberEntry } from './raid-logs.types';
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
  readonly requested: string[] = [];

  constructor(private readonly file: RaidLogsIndexFile, private readonly bossFiles: Record<string, RaidBossFile> = {}) {}

  fetchJson<T>(path: string): Observable<T> {
    this.requested.push(path);
    const name = path.split('/').pop()!;
    return of((name === 'index.json' ? this.file : this.bossFiles[name]) as T);
  }

  refresh(): void {}
}

async function open(file: RaidLogsIndexFile, url = '/raid-logs/guilds', bossFiles: Record<string, RaidBossFile> = {}) {
  const dataFiles = new FakeDataFiles(file, bossFiles);
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'raid-logs/guilds', component: RaidLogsProgressionPageComponent }]),
      provideLocationMocks(),
      { provide: DataFileService, useValue: dataFiles }
    ]
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url, RaidLogsProgressionPageComponent);
  harness.detectChanges();
  return { harness, element: harness.routeNativeElement as HTMLElement, location: TestBed.inject(Location), dataFiles };
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

function periodButton(element: HTMLElement, label: 'Season' | 'This week') {
  return [...element.querySelectorAll<HTMLButtonElement>('.period-switch button')].find(button => button.textContent?.trim() === label);
}

function pressedPeriod(element: HTMLElement) {
  return [...element.querySelectorAll('.period-switch button[aria-pressed="true"]')].map(button => button.textContent?.trim());
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

  it('ranks only the kills since the Wednesday reset on This week, and keeps the period in the URL', async () => {
    const { harness, element, location } = await open(weekFile);
    expect(pressedPeriod(element)).toEqual(['Season']);
    expect(periodButton(element, 'This week')?.title).toMatch(/^Show only the kills since the raid reset on Wed 28 Oct, \d\d:00$/);
    expect(progressRows(element)).toEqual([
      ['1', 'Miracle', '2/3', '3'],
      ['2', 'Outlaws', '2/3', '2'],
      ['3', 'Newcomers', '1/3', '1']
    ]);

    periodButton(element, 'This week')?.click();
    harness.detectChanges();
    expect(pressedPeriod(element)).toEqual(['This week']);
    expect(location.path()).toBe('/raid-logs/guilds?difficulty=mythic&period=week');
    expect(progressRows(element)).toEqual([
      ['1', 'Outlaws', '2/3', '2'],
      ['2', 'Miracle', '1/3', '1']
    ]);

    periodButton(element, 'Season')?.click();
    harness.detectChanges();
    expect(pressedPeriod(element)).toEqual(['Season']);
    expect(location.path()).toBe('/raid-logs/guilds?difficulty=mythic');
    expect(progressRows(element).length).toBe(3);
  });

  it('shows no change since the last scan on This week', async () => {
    const { harness, element } = await open({ ...weekFile, previousGeneratedAt: '2026-10-28T18:00:00Z', newLogs: [['Tauri', 14], ['Tauri', 15]] });
    expect(rows(element)).toEqual([
      ['Miracle', '2/3', '', '', 0],
      ['Outlaws', '2/3', '', '+1', 1],
      ['Newcomers', '1/3', '', '', 0]
    ]);

    periodButton(element, 'This week')?.click();
    harness.detectChanges();
    expect(rows(element)).toEqual([
      ['Outlaws', '2/3', '', '', 0],
      ['Miracle', '1/3', '', '', 0]
    ]);
  });

  it('goes back to the season when Reset clears the filters', async () => {
    const { harness, element, location } = await open(weekFile, '/raid-logs/guilds?period=week');
    const reset = element.querySelector<HTMLButtonElement>('.filter-reset');
    expect(reset?.disabled).toBe(false);

    reset?.click();
    harness.detectChanges();
    expect(pressedPeriod(element)).toEqual(['Season']);
    expect(location.path()).toBe('/raid-logs/guilds?difficulty=mythic');
    expect(progressRows(element).length).toBe(3);
    expect(reset?.disabled).toBe(true);
  });

  it('opens on this week from the URL, and says so when nobody has killed a boss since the reset', async () => {
    vi.setSystemTime(new Date('2026-11-05T12:00:00Z'));
    const { element } = await open(weekFile, '/raid-logs/guilds?period=week');

    expect(pressedPeriod(element)).toEqual(['This week']);
    expect(progressRows(element)).toEqual([]);
    expect(element.querySelector('.empty-note')?.textContent?.trim()).toBe('No guild has a kill on Mythic this week yet.');
  });
});

const raiders = (prefix: string, realm: string) => Array.from({ length: 10 }, (_, n): [string, string, number, number, number, string] =>
  [`${prefix}${n}`, realm, 8, 1, 0, '']);
const members = (from: number): RaidMemberEntry[] => Array.from({ length: 10 }, (_, n) => [from + n, 0, 870, 1, 0, 0, 0, 0, 0, 0]);

const pickupFile: RaidLogsIndexFile = {
  ...indexFile,
  guilds: [['Miracle', 'Evermoon', 1, 1]],
  logs: [
    ['Tauri', 10, 0, 16, seconds('2026-10-22T19:00:00Z'), 100_000, 0, 1, 0, 0, 20],
    ['Tauri', 20, 0, 16, seconds('2026-10-22T19:30:00Z'), 100_000, -1, 1, 0, 0, 10],
    ['Tauri', 21, 1, 16, seconds('2026-10-22T20:30:00Z'), 100_000, -1, 1, 0, 0, 10],
    ['Tauri', 22, 0, 16, seconds('2026-10-23T19:00:00Z'), 100_000, -1, 0, 0, 0, 10]
  ],
  newLogs: [['Tauri', 21], ['Tauri', 22]]
};

const pickupBossFiles: Record<string, RaidBossFile> = {
  'nythendra-mythic.json': {
    version: 3,
    boss: 'nythendra',
    difficulty: 'mythic',
    guilds: [['Miracle', 'Evermoon', 1, 1]],
    players: [...raiders('a', 'Evermoon'), ...raiders('b', 'Tauri'), ...raiders('m', 'Evermoon')],
    logs: [
      ['Tauri', 10, seconds('2026-10-22T19:00:00Z'), 100_000, 0, 1, 0, 0, 0, members(20), []],
      ['Tauri', 20, seconds('2026-10-22T19:30:00Z'), 100_000, -1, 1, 0, 0, 0, members(0), []],
      ['Tauri', 22, seconds('2026-10-23T19:00:00Z'), 100_000, -1, 0, 0, 0, 0, members(10), []]
    ]
  },
  'ilgynoth-mythic.json': {
    version: 3,
    boss: 'ilgynoth',
    difficulty: 'mythic',
    guilds: [],
    players: raiders('a', 'Evermoon'),
    logs: [['Tauri', 21, seconds('2026-10-22T20:30:00Z'), 100_000, -1, 1, 0, 0, 0, members(0), []]]
  }
};

function groupsButton(element: HTMLElement, label: 'Guilds' | 'All groups') {
  return [...element.querySelectorAll<HTMLButtonElement>('.groups-switch button')].find(button => button.textContent?.trim() === label);
}

function pressedGroups(element: HTMLElement) {
  return [...element.querySelectorAll('.groups-switch button[aria-pressed="true"]')].map(button => button.textContent?.trim());
}

const fetchedFiles = (dataFiles: FakeDataFiles) => dataFiles.requested.map(path => path.split('/').pop());

describe('RaidLogsProgressionPageComponent All groups', () => {
  it('ranks every pickup group beside the guilds, read from the boss files only once All groups is on', async () => {
    const { harness, element, location, dataFiles } = await open(pickupFile, '/raid-logs/guilds', pickupBossFiles);
    expect(pressedGroups(element)).toEqual(['Guilds']);
    expect(progressRows(element)).toEqual([['1', 'Miracle', '1/3', '1']]);
    expect(fetchedFiles(dataFiles)).toEqual(['index.json']);

    groupsButton(element, 'All groups')?.click();
    harness.detectChanges();
    expect(pressedGroups(element)).toEqual(['All groups']);
    expect(location.path()).toBe('/raid-logs/guilds?difficulty=mythic&groups=all');
    expect(fetchedFiles(dataFiles)).toEqual(['index.json', 'nythendra-mythic.json', 'ilgynoth-mythic.json']);
    expect(progressRows(element)).toEqual([
      ['1', 'Pickup group', '2/3', '2'],
      ['2', 'Miracle', '1/3', '1'],
      ['3', 'Pickup group', '1/3', '1']
    ]);
    expect(rows(element)).toEqual([
      ['Pickup group', '2/3', '', '', 0],
      ['Miracle', '1/3', '', '', 0],
      ['Pickup group', '1/3', '', '', 0]
    ]);
    expect(element.querySelectorAll('tbody tr.pickup .pickup-icon').length).toBe(2);
    expect([...element.querySelectorAll('tbody .guild-name')].map(link => link.getAttribute('href'))).toEqual([
      '/raid-logs/log/tauri/21',
      '/raid-logs/guild/evermoon/Miracle?difficulty=mythic',
      '/raid-logs/log/tauri/22'
    ]);

    groupsButton(element, 'Guilds')?.click();
    harness.detectChanges();
    expect(location.path()).toBe('/raid-logs/guilds?difficulty=mythic');
    expect(progressRows(element)).toEqual([['1', 'Miracle', '1/3', '1']]);
  });

  it('filters the pickup groups by the realm most of their players play on and the faction of most of their kills', async () => {
    const { element } = await open(pickupFile, '/raid-logs/guilds?groups=all&realm=tauri', pickupBossFiles);
    expect(pressedGroups(element)).toEqual(['All groups']);
    expect(progressRows(element)).toEqual([['1', 'Pickup group', '1/3', '1']]);

    TestBed.resetTestingModule();
    const none = await open(pickupFile, '/raid-logs/guilds?groups=all&faction=horde&realm=tauri', pickupBossFiles);
    expect(progressRows(none.element)).toEqual([]);
    expect(none.element.querySelector('.empty-note')?.textContent?.trim()).toBe('No group with these filters has a kill on Mythic yet.');
  });

  it('goes back to Guilds when Reset clears the filters', async () => {
    const { harness, element, location } = await open(pickupFile, '/raid-logs/guilds?groups=all', pickupBossFiles);
    const reset = element.querySelector<HTMLButtonElement>('.filter-reset');
    expect(reset?.disabled).toBe(false);

    reset?.click();
    harness.detectChanges();
    expect(pressedGroups(element)).toEqual(['Guilds']);
    expect(location.path()).toBe('/raid-logs/guilds?difficulty=mythic');
    expect(reset?.disabled).toBe(true);
  });
});

describe('RaidLogsProgressionPageComponent pages', () => {
  const manyGuilds: RaidLogsIndexFile = {
    ...indexFile,
    previousGeneratedAt: undefined,
    newLogs: undefined,
    guilds: Array.from({ length: 55 }, (_, n) => [`Guild ${n + 1}`, 'Evermoon', 1, n + 1]),
    logs: Array.from({ length: 55 }, (_, n) => ['Tauri', 100 + n, 0, 16, 1_000 + n, 100_000, n, 1, 0, 0, 20])
  };

  function pagerButton(element: HTMLElement, label: string) {
    return [...element.querySelectorAll<HTMLButtonElement>('.pager button')].find(button => button.textContent?.includes(label));
  }

  it('shows 50 rows a page and keeps the page in the URL', async () => {
    const { harness, element, location } = await open(manyGuilds);
    const section = element.querySelector<HTMLElement>('section.section');
    if (section) {
      section.scrollIntoView = vi.fn();
    }
    expect(progressRows(element).length).toBe(50);
    expect(element.querySelector('.pager-status')?.textContent?.trim()).toBe('Page 1 of 2 · 55 guilds');

    pagerButton(element, 'Next')?.click();
    harness.detectChanges();
    expect(location.path()).toBe('/raid-logs/guilds?difficulty=mythic&page=2');
    expect(progressRows(element).map(([rank, guild]) => `${rank} ${guild}`))
      .toEqual(['51 Guild 51', '52 Guild 52', '53 Guild 53', '54 Guild 54', '55 Guild 55']);
  });

  it('opens on the page in the URL, and goes back to the first page when Reset clears the filters', async () => {
    const { harness, element, location } = await open(manyGuilds, '/raid-logs/guilds?faction=horde&page=2');
    expect(progressRows(element)[0]).toEqual(['51', 'Guild 51', '1/3', '1']);

    element.querySelector<HTMLButtonElement>('.filter-reset')?.click();
    harness.detectChanges();
    expect(location.path()).toBe('/raid-logs/guilds?difficulty=mythic');
    expect(progressRows(element)[0]).toEqual(['1', 'Guild 1', '1/3', '1']);
  });
});
