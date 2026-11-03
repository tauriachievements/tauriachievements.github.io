import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { DataFileService } from '../../core/data-file.service';
import { ArenaGamesPageComponent } from './arena-games-page.component';
import { ArenaLadderFile, ArenaPlayer } from './arena-games';

function player(index: number, overrides: Partial<ArenaPlayer> = {}): ArenaPlayer {
  return {
    guid: index + 1,
    realm: 'Evermoon',
    name: `Player${index}`,
    class: 1,
    race: 1,
    gender: 0,
    faction: 0,
    guild: '',
    spec: 71,
    games: 60,
    wins: 30,
    weekGames: 0,
    weekWins: 0,
    rating: 2000 - index,
    peakRating: 2000 - index,
    weekPeakRating: 0,
    ...overrides
  };
}

function ladder(players: ArenaPlayer[]): ArenaLadderFile {
  return {
    version: 2,
    bracket: '2v2',
    seasonStart: '2026-09-16T00:00:00+02:00',
    generatedAt: '2026-11-02T23:14:17Z',
    players
  };
}

async function renderPage(players: ArenaPlayer[]) {
  await TestBed.configureTestingModule({
    imports: [ArenaGamesPageComponent],
    providers: [
      provideRouter([]),
      { provide: DataFileService, useValue: { getJson: () => of(ladder(players)) } }
    ]
  }).compileComponents();

  const fixture = TestBed.createComponent(ArenaGamesPageComponent);
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

describe('ArenaGamesPageComponent', () => {
  it('shows 50 players to a page', async () => {
    const fixture = await renderPage(Array.from({ length: 60 }, (_, index) => player(index)));
    const element: HTMLElement = fixture.nativeElement;

    expect(element.querySelectorAll('.players-table tbody tr:not(.title-group)').length).toBe(50);
    expect(element.querySelector('.pager-status')?.textContent).toContain('Page 1 of 2');
  });

  it("shows each player's race and guild", async () => {
    const fixture = await renderPage([
      player(0, { race: 10, gender: 1, guild: 'Sapped Girls' }),
      player(1, { guild: '' })
    ]);
    const rows = [...(fixture.nativeElement as HTMLElement).querySelectorAll('.players-table tbody tr:not(.title-group)')];

    expect(rows[0].querySelector('img.race-icon')?.getAttribute('alt')).toBe('Blood Elf');
    expect(rows[0].querySelector('td.guild')?.textContent?.trim()).toBe('Sapped Girls');
    expect(rows[1].querySelector('td.guild')?.textContent?.trim()).toBe('');
  });

  it('keeps the season info closed until its button is pressed', async () => {
    const fixture = await renderPage([player(0)]);
    const element: HTMLElement = fixture.nativeElement;
    const toggle = element.querySelector<HTMLButtonElement>('#arenaInfoToggle');

    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(element.querySelector('.titles-table')).toBeNull();
    expect(element.querySelector('.summary')).toBeNull();
    expect(element.querySelector('.bracket-switch')).not.toBeNull();

    toggle?.click();
    fixture.detectChanges();

    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    expect(element.querySelector('.titles-table')).not.toBeNull();
    expect(element.querySelector('.summary')).not.toBeNull();

    toggle?.click();
    fixture.detectChanges();

    expect(element.querySelector('.titles-table')).toBeNull();
  });
});
