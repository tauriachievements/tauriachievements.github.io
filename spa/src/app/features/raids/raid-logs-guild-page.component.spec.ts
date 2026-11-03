import { Location } from '@angular/common';
import { provideLocationMocks } from '@angular/common/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Observable, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RaidIndexLogEntry, RaidLogsIndexFile } from './raid-logs.types';
import { RaidLogsGuildPageComponent } from './raid-logs-guild-page.component';
import { DataFileService } from '../../core/data-file.service';

const seconds = (at: string) => Date.parse(at) / 1000;
const MIRACLE = 0;
const OUTLAWS = 1;

function log(logId: number, boss: number, difficulty: number, at: string, guild = MIRACLE, offsetMinutes = 0): RaidIndexLogEntry {
  return ['Tauri', logId, boss, difficulty, seconds(at) + offsetMinutes * 60, 100_000, guild, 1, 0, 0, 20];
}

const indexFile: RaidLogsIndexFile = {
  version: 4,
  generatedAt: '2026-10-29T12:00:00Z',
  raid: { id: 1520, slug: 'emerald-nightmare', name: 'The Emerald Nightmare' },
  difficulties: [
    { id: 15, slug: 'heroic', name: 'Heroic', shortName: 'HC', kills: 1 },
    { id: 16, slug: 'mythic', name: 'Mythic', shortName: 'M', kills: 34 }
  ],
  bosses: [
    { id: 1853, slug: 'nythendra', name: 'Nythendra' },
    { id: 1873, slug: 'ilgynoth', name: "Il'gynoth, The Heart of Corruption" },
    { id: 1876, slug: 'elerethe-renferal', name: 'Elerethe Renferal' }
  ],
  specs: [],
  guilds: [['Miracle', 'Tauri', 1, 1], ['Outlaws', 'Tauri', 0, 2]],
  logs: [
    ...Array.from({ length: 10 }, (_, index) => log(300 + index, 0, 16, '2026-10-08T19:00:00Z', MIRACLE, index)),
    ...Array.from({ length: 20 }, (_, index) => log(200 + index, 0, 16, '2026-10-22T19:00:00Z', MIRACLE, index)),
    log(100, 0, 16, '2026-10-28T19:00:00Z'),
    log(101, 1, 16, '2026-10-28T19:30:00Z'),
    log(102, 2, 16, '2026-10-28T20:00:00Z'),
    log(103, 0, 16, '2026-10-28T21:00:00Z', OUTLAWS),
    log(400, 0, 15, '2026-10-27T19:00:00Z')
  ],
  clears: [['Tauri', 16, 'Tauri', [100, 1, 1]]],
  top: [],
  items: []
};

class FakeDataFiles {
  fetchJson<T>(): Observable<T> {
    return of(indexFile as T);
  }

  refresh(): void {}
}

async function open(url = '/raid-logs/guild/tauri/Miracle') {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'raid-logs/guild/:realm/:name', component: RaidLogsGuildPageComponent }]),
      provideLocationMocks(),
      { provide: DataFileService, useValue: new FakeDataFiles() }
    ]
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url, RaidLogsGuildPageComponent);
  harness.detectChanges();
  const element = harness.routeNativeElement as HTMLElement;
  const history = element.querySelector<HTMLElement>('[aria-labelledby="guild-history-title"]')!;
  history.scrollIntoView = vi.fn();
  return { harness, element, history, location: TestBed.inject(Location) };
}

const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim();

function weeks(element: HTMLElement) {
  return [...element.querySelectorAll('.week')].map(week => [
    text(week.querySelector('h3')),
    text(week.querySelector('.week-stats')),
    week.querySelectorAll('.history li').length
  ]);
}

function button(element: HTMLElement, label: string) {
  return [...element.querySelectorAll<HTMLButtonElement>('button')].find(found => text(found) === label);
}

describe('RaidLogsGuildPageComponent kill history', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-29T12:00:00Z'));
  });

  afterEach(() => vi.useRealTimers());

  it("groups the guild's kills by raid week, each with its kills, bosses and full clear", async () => {
    const { element } = await open();

    expect(weeks(element)).toEqual([
      ['This week · 28 Oct – 4 Nov', '3 kills · 3/3 bosses · Full clear 1:01:40', 3],
      ['Last week · 21 Oct – 28 Oct', '20 kills · 1/3 bosses', 20]
    ]);
    expect(element.querySelector('.week-stats a')?.getAttribute('href')).toBe('/raid-logs/log/tauri/102');
    expect(text(element.querySelector('.pager-status'))).toBe('Page 1 of 2 · 33 kills');
  });

  it('opens the page in the URL and writes the page the pager turns to', async () => {
    const { harness, element, history, location } = await open('/raid-logs/guild/tauri/Miracle?page=2');
    expect(weeks(element)).toEqual([['7 Oct – 14 Oct', '10 kills · 1/3 bosses', 10]]);

    button(element, '« First')?.click();
    harness.detectChanges();
    expect(location.path()).toBe('/raid-logs/guild/tauri/Miracle');
    expect(history.scrollIntoView).toHaveBeenCalledOnce();
    expect(weeks(element).map(([heading]) => heading)).toEqual(['This week · 28 Oct – 4 Nov', 'Last week · 21 Oct – 28 Oct']);

    button(element, 'Next ›')?.click();
    harness.detectChanges();
    expect(location.path()).toBe('/raid-logs/guild/tauri/Miracle?page=2');
  });

  it('shows the last page for a page past the end', async () => {
    const { element } = await open('/raid-logs/guild/tauri/Miracle?page=9');

    expect(weeks(element)).toEqual([['7 Oct – 14 Oct', '10 kills · 1/3 bosses', 10]]);
  });

  it('goes back to the first page on another difficulty, and has no pager for a single page', async () => {
    const { harness, element, location } = await open('/raid-logs/guild/tauri/Miracle?difficulty=mythic&page=2');

    button(element, 'Heroic')?.click();
    harness.detectChanges();
    expect(location.path()).toBe('/raid-logs/guild/tauri/Miracle?difficulty=heroic');
    expect(weeks(element)).toEqual([['Last week · 21 Oct – 28 Oct', '1 kill · 1/3 bosses', 1]]);
    expect(element.querySelector('app-pager')).toBeNull();
  });
});
