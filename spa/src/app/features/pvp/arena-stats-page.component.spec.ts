import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Observable, Subject, of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { DataFileService } from '../../core/data-file.service';
import { ArenaBracket, ArenaLadderFile, ArenaPlayer } from './arena-games';
import { ArenaStatsPageComponent } from './arena-stats-page.component';

function player(name: string, classId: number, spec: number, rating: number): ArenaPlayer {
  return {
    guid: rating,
    realm: 'Evermoon',
    name,
    class: classId,
    race: 1,
    gender: 0,
    faction: 0,
    guild: '',
    spec,
    games: 60,
    wins: 30,
    weekGames: 0,
    weekWins: 0,
    rating,
    peakRating: rating,
    weekPeakRating: 0
  };
}

function ladder(bracket: ArenaBracket, players: ArenaPlayer[]): ArenaLadderFile {
  return {
    version: 2,
    bracket,
    seasonStart: '2026-09-16T00:00:00+02:00',
    generatedAt: '2026-11-06T20:03:16Z',
    players
  };
}

const LADDERS: Readonly<Record<string, ArenaLadderFile>> = {
  'arena-ladder-2v2.json': ladder('2v2', [
    player('Exa', 8, 64, 2600),
    player('Wxz', 11, 105, 2100),
    player('Brak', 1, 71, 1600),
    player('Nospec', 1, 0, 1550)
  ]),
  'arena-ladder-3v3.json': ladder('3v3', [player('Holyman', 2, 65, 2050), player('Sosa', 8, 64, 1400)])
};

class FakeDataFiles {
  readonly requests: string[] = [];
  readonly pending = new Map<string, Subject<ArenaLadderFile>>();

  constructor(private readonly delayed: readonly string[] = []) {}

  getJson<T>(path: string): Observable<T> {
    this.requests.push(path);
    if (!this.delayed.includes(path)) {
      return of(LADDERS[path] as T);
    }

    const response = new Subject<ArenaLadderFile>();
    this.pending.set(path, response);
    return response as unknown as Observable<T>;
  }
}

async function open(url: string, dataFiles = new FakeDataFiles()) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'arena/stats', component: ArenaStatsPageComponent }]),
      { provide: DataFileService, useValue: dataFiles }
    ]
  });
  const harness = await RouterTestingHarness.create();
  const page = await harness.navigateByUrl(url, ArenaStatsPageComponent);
  harness.detectChanges();
  return { harness, page, dataFiles, element: harness.routeNativeElement as HTMLElement };
}

describe('ArenaStatsPageComponent', () => {
  it('reads the bracket, the rating floor and the role from the address bar', async () => {
    const { page, dataFiles, element } = await open('/arena/stats?bracket=3v3&rating=2000&role=healer');

    expect(dataFiles.requests).toEqual(['arena-ladder-3v3.json']);
    expect(page.popularity().total).toBe(1);
    expect(element.querySelector('.chart-subtitle')?.textContent)
      .toBe('Rated 3v3 arena · Healer · Current rating 2000+ · 1 character · Grouped by popularity');
    expect(element.querySelector('.rating-filter [aria-pressed="true"]')?.textContent?.trim()).toBe('2000+');
  });

  it('counts every character with a spec when nothing is filtered', async () => {
    const { page, element } = await open('/arena/stats');

    expect(page.popularity().total).toBe(3);
    expect(element.querySelector('app-spec-popularity-chart')).not.toBeNull();
    expect(element.querySelectorAll('app-race-by-spec')).toHaveLength(3);
  });

  it('writes the filters into the address bar and leaves the defaults out', async () => {
    const { page } = await open('/arena/stats');
    const location = TestBed.inject(Location);

    page.setRatingFloor(2200);
    expect(location.path()).toBe('/arena/stats?rating=2200');

    page.setRole('healer');
    page.selectBracket('3v3');
    expect(location.path()).toBe('/arena/stats?bracket=3v3&rating=2200&role=healer');

    page.resetFilters();
    expect(location.path()).toBe('/arena/stats?bracket=3v3');
  });

  it('says nobody holds the rating instead of drawing an empty chart', async () => {
    const { harness, page, element } = await open('/arena/stats');

    page.setRatingFloor(2500);
    harness.detectChanges();

    expect(page.popularity().total).toBe(1);

    page.selectBracket('3v3');
    harness.detectChanges();

    expect(element.querySelector('app-spec-popularity-chart')).toBeNull();
    expect(element.querySelector('.chart-empty')?.textContent?.trim()).toBe('Nobody in 3v3 is rated 2500 or higher right now.');
    expect(element.querySelectorAll('app-race-by-spec')).toHaveLength(0);
  });

  it('keeps the race boxes when a role filter empties only the chart', async () => {
    const { harness, page, element } = await open('/arena/stats?bracket=3v3&rating=2000');

    page.setRole('tank');
    harness.detectChanges();

    expect(element.querySelector('.chart-empty')?.textContent?.trim()).toBe('No Tank players in 3v3 are rated 2000 or higher right now.');
    expect(element.querySelectorAll('app-race-by-spec')).toHaveLength(3);
  });

  it('drops the answer for a bracket the reader has already switched away from', async () => {
    const dataFiles = new FakeDataFiles(['arena-ladder-2v2.json', 'arena-ladder-3v3.json']);
    const { page } = await open('/arena/stats', dataFiles);

    page.selectBracket('3v3');
    dataFiles.pending.get('arena-ladder-3v3.json')!.next(LADDERS['arena-ladder-3v3.json']);
    dataFiles.pending.get('arena-ladder-2v2.json')!.next(LADDERS['arena-ladder-2v2.json']);

    expect(page.dataset()?.bracket).toBe('3v3');
    expect(page.isLoading()).toBe(false);
  });
});
