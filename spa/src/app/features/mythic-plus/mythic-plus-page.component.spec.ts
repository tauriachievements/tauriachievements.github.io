import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Observable, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MythicPlusDungeonFile, MythicPlusIndex, MythicPlusPlayerEntry, NEWER_DATA_MESSAGE } from './mythic-plus';
import { MythicPlusPageComponent } from './mythic-plus-page.component';
import { DataFileService } from '../../core/data-file.service';

function exportOf(tables: string, players: MythicPlusPlayerEntry[]): { index: MythicPlusIndex; cos: MythicPlusDungeonFile } {
  return {
    index: {
      version: 1,
      tables,
      season: { id: 'legion-s1', name: 'Legion Season 1', raid: 'Emerald Nightmare', startDate: '2026-09-16' },
      dungeons: [{ id: 'cos', challengeId: 210, shortName: 'COS', name: 'Court of Stars', timerSeconds: 1800, icon: '', runCount: 1, bestScore: 196 }],
      affixes: [],
      specs: [{ class: 11, name: 'Restoration', role: 'healer' }],
      players
    } as MythicPlusIndex,
    cos: { version: 1, dungeon: 'cos', tables, runs: [[19, 1297289, 1791293804, 196, [], [[0, 0]]]] }
  };
}

const oct5 = exportOf('aaaaaaaaaaaa', [['Fellicia', 'Evermoon', 'Yin Yang', 9, 1, 1]]);
const oct7 = exportOf('bbbbbbbbbbbb', [['Exkeito', 'Evermoon', '', 11, 4, 0]]);

class FakeDataFiles {
  refreshes = 0;
  constructor(private held: MythicPlusIndex, private readonly deployed: ReturnType<typeof exportOf>) {}

  getJson<T>(): Observable<T> {
    return of(this.held as T);
  }

  fetchJson<T>(): Observable<T> {
    return of(this.deployed.cos as T);
  }

  refresh(): void {
    this.refreshes++;
    this.held = this.deployed.index;
  }
}

function createPage(dataFiles: FakeDataFiles): MythicPlusPageComponent {
  TestBed.configureTestingModule({
    imports: [MythicPlusPageComponent],
    providers: [provideRouter([]), { provide: DataFileService, useValue: dataFiles }]
  });
  const page = TestBed.createComponent(MythicPlusPageComponent).componentInstance;
  page.ngOnInit();
  return page;
}

describe('MythicPlusPageComponent data from two exports', () => {
  beforeEach(() => vi.spyOn(console, 'error').mockImplementation(() => undefined));

  it('loads the index again when a dungeon file belongs to a newer export', () => {
    const dataFiles = new FakeDataFiles(oct5.index, oct7);
    const page = createPage(dataFiles);

    expect(dataFiles.refreshes).toBe(1);
    expect(page.loadError()).toBeUndefined();
    const healer = page.runsByDungeon().get('cos')?.[0].roster[0];
    expect(healer).toMatchObject({ name: 'Exkeito', class: 11, spec: 'Restoration' });
  });

  it('reports a mismatch that a fresh load does not fix instead of reloading again', () => {
    const dataFiles = new FakeDataFiles(oct5.index, oct7);
    dataFiles.refresh = () => dataFiles.refreshes++;
    const page = createPage(dataFiles);

    expect(dataFiles.refreshes).toBe(1);
    expect(page.loadError()).toBe(NEWER_DATA_MESSAGE);
    expect(page.runsByDungeon().size).toBe(0);
  });

  it('reads files from the same export without reloading', () => {
    const dataFiles = new FakeDataFiles(oct7.index, oct7);
    const page = createPage(dataFiles);

    expect(dataFiles.refreshes).toBe(0);
    expect(page.runsByDungeon().get('cos')?.[0].roster[0].name).toBe('Exkeito');
  });

  it('maps compact scan changes to overall season player rows only', () => {
    const movement = exportOf('dddddddddddd', [['Exkeito', 'Evermoon', '', 11, 4, 0]]);
    movement.index.previousGeneratedAt = '2026-10-07T09:30:00Z';
    movement.index.players.push(['Gone', 'Tauri', '', 11, 4, 0], ['Left', 'Tauri', '', 11, 4, 0]);
    movement.index.scores = [[196, 1297289, 4.5, 0], [], []];
    movement.index.departed = [[1, 250, 1500000], [2, 200, 1500000]];
    const page = createPage(new FakeDataFiles(movement.index, movement));

    expect(page.pagedPlayers()[0]).toMatchObject({
      key: 'Exkeito|Evermoon',
      change: { score: 4.5, rank: 2 },
      newSinceLastScan: false
    });

    page.selectDungeon('cos');
    expect(page.pagedPlayers()[0].change).toBeUndefined();
    expect(page.pagedPlayers()[0].newSinceLastScan).toBe(false);
  });

  it('marks the best run that raised a player\'s score since the last scan, only while the change shows', () => {
    const raised = exportOf('eeeeeeeeeeee', [['Exkeito', 'Evermoon', '', 11, 4, 0]]);
    raised.index.previousGeneratedAt = '2026-10-06T09:00:00Z';
    raised.index.scores = [[196, 1297289, 4.5, 0]];
    raised.cos.runs.push([17, 1500000, Date.parse('2026-10-05T11:00:00Z') / 1000, 180, [], [[0, 0]]]);
    const page = createPage(new FakeDataFiles(raised.index, raised));

    expect(page.pagedPlayers()[0].bests.map(best => best?.raisedScore)).toEqual([true]);
    expect(page.pagedPlayers()[0].bests[0]?.previousBest).toEqual({ keyLevel: 17, timed: true, score: 180 });

    page.selectDungeon('cos');
    expect(page.pagedPlayers()[0].bests.map(best => best?.raisedScore)).toEqual([false]);
  });

  it('marks no run when the score did not go up since the last scan', () => {
    const flat = exportOf('ffffffffffff', [['Exkeito', 'Evermoon', '', 11, 4, 0]]);
    flat.index.previousGeneratedAt = '2026-10-06T09:00:00Z';
    flat.index.scores = [[196, 1297289, 0, 0]];
    const page = createPage(new FakeDataFiles(flat.index, flat));

    expect(page.pagedPlayers()[0].bests.map(best => best?.raisedScore)).toEqual([false]);
  });
});

describe('MythicPlusPageComponent character and realm in the URL', () => {
  const both = exportOf('cccccccccccc', [['Exkeito', 'Evermoon', '', 11, 4, 0], ['Napim', 'Tauri', '', 11, 4, 0]]);
  both.cos.runs = [
    [19, 1297289, 1791293804, 196, [], [[0, 0], [1, 0]]],
    [15, 1297289, 1791293904, 160, [], [[1, 0]]]
  ];

  async function open(url: string): Promise<MythicPlusPageComponent> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'mythic-plus', component: MythicPlusPageComponent }]),
        { provide: DataFileService, useValue: new FakeDataFiles(both.index, both) }
      ]
    });
    const harness = await RouterTestingHarness.create();
    return harness.navigateByUrl(url, MythicPlusPageComponent);
  }

  it('shows only the runs of the character a profile links to, matched to the export', async () => {
    const page = await open('/mythic-plus?character=napim-tauri');

    expect(page.characterFilter()).toMatchObject({ key: 'Napim|Tauri', name: 'Napim', realm: 'Tauri', color: '#ff7d0a' });
    expect(page.characterFilter()?.profileLink).toEqual(['/mythic-plus', 'character', 'tauri', 'Napim']);
    expect(page.filteredRows().length).toBe(2);
  });

  it('ranks the players of one realm', async () => {
    const page = await open('/mythic-plus?view=players&realm=evermoon');

    expect(page.filteredPlayers().map(entry => entry.player.member.name)).toEqual(['Exkeito']);
    expect(page.realmOptions().map(option => option.label)).toEqual(['All realms', 'Evermoon', 'Tauri']);
    expect(page.activeFilterLabels()).toEqual(['Evermoon']);
  });

  it('leaves the rows kept for players who left out of the realms and the ?character= match', async () => {
    const left = exportOf('gggggggggggg', [
      ['Exkeito', 'Evermoon', '', 11, 4, 0],
      ['Napim', 'Tauri', '', 11, 4, 0],
      ['Gone', 'WoD', '', 11, 4, 0],
      ['Left', 'WoD', '', 11, 4, 0],
      ['Away', 'WoD', '', 11, 4, 0]
    ]);
    left.index.scores = [[196, 1297289], [160, 1297289], [], [], []];
    left.cos.runs = both.cos.runs;
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'mythic-plus', component: MythicPlusPageComponent }]),
        { provide: DataFileService, useValue: new FakeDataFiles(left.index, left) }
      ]
    });
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/mythic-plus?character=gone-wod', MythicPlusPageComponent);

    expect(page.realmOptions().map(option => option.label)).toEqual(['All realms', 'Evermoon', 'Tauri']);
    expect(page.characterFilter()?.color).toBe('#e0e0e0');
  });

  it('opens the players view with the class and spec selected from the popularity chart', async () => {
    const page = await open('/mythic-plus');

    page.showSpecPlayers({ classId: 11, spec: 'Restoration' });

    expect(page.view()).toBe('players');
    expect(page.classFilter()).toBe(11);
    expect(page.specFilter()).toBe('Restoration');
    expect(page.activeFilterLabels()).toEqual(['Druid', 'Restoration']);
  });
});

describe('MythicPlusPageComponent seasons', () => {
  const seasons = [
    { id: 'legion-s1-1', name: 'Season 1.1 - Pre fixes' },
    { id: 'legion-s1-2', name: 'Season 1.2 - Post fixes' }
  ];
  const live = exportOf('hhhhhhhhhhhh', [['Exkeito', 'Evermoon', '', 11, 4, 0]]);
  live.index.season = { id: 'legion-s1-2', name: 'Season 1.2 - Post fixes', raid: 'Emerald Nightmare', startDate: '2026-11-09' };
  live.index.seasons = seasons;
  live.cos.runs = [[16, 1297289, Date.now() / 1000, 170, [], [[0, 0]]]];
  const archived = exportOf('iiiiiiiiiiii', [['Napim', 'Tauri', '', 11, 4, 0]]);
  archived.index.season = { id: 'legion-s1-1', name: 'Season 1.1 - Pre fixes', raid: 'Emerald Nightmare', startDate: '2026-09-16' };

  class SeasonDataFiles {
    getJson<T>(path: string): Observable<T> {
      return of((path.includes('legion-s1-1/') ? archived.index : live.index) as T);
    }

    fetchJson<T>(path: string): Observable<T> {
      return of((path.includes('legion-s1-1/') ? archived.cos : live.cos) as T);
    }

    refresh(): void {}
  }

  async function open(url: string) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([
          { path: 'mythic-plus', component: MythicPlusPageComponent },
          { path: 'mythic-plus/again', component: MythicPlusPageComponent }
        ]),
        { provide: DataFileService, useValue: new SeasonDataFiles() }
      ]
    });
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl(url, MythicPlusPageComponent);
    return { harness, page, location: TestBed.inject(Location) };
  }

  const rosterNames = (page: MythicPlusPageComponent) => page.filteredRows().map(row => row.run.roster[0].name);

  it('opens on the live season and offers every season', async () => {
    const { page } = await open('/mythic-plus');

    expect(page.index()?.season.id).toBe('legion-s1-2');
    expect(page.seasonOptions()).toEqual(seasons);
    expect(rosterNames(page)).toEqual(['Exkeito']);
  });

  it('opens the season the address names', async () => {
    const { page } = await open('/mythic-plus?season=legion-s1-1');

    expect(page.index()?.season.id).toBe('legion-s1-1');
    expect(rosterNames(page)).toEqual(['Napim']);
  });

  it('loads a picked season and names it in the address, and This week goes back to the live season', async () => {
    const { page, location } = await open('/mythic-plus?view=players');

    page.setSeason('legion-s1-1');
    expect(page.index()?.season.id).toBe('legion-s1-1');
    expect(page.period()).toBe('season');
    expect(location.path()).toBe('/mythic-plus?season=legion-s1-1&view=players');

    page.setPeriod('week');
    expect(page.index()?.season.id).toBe('legion-s1-2');
    expect(location.path()).toBe('/mythic-plus?period=week&view=players');
  });

  it('picks the season from This week and shows the whole season again', async () => {
    const { page, location } = await open('/mythic-plus?period=week');

    page.setSeason('legion-s1-2');
    expect(page.period()).toBe('season');
    expect(page.index()?.season.id).toBe('legion-s1-2');
    expect(location.path()).toBe('/mythic-plus');
  });

  it('keeps the picked season on the next Mythic+ page and writes it into that address', async () => {
    const { harness, page, location } = await open('/mythic-plus');
    page.setSeason('legion-s1-1');

    const next = await harness.navigateByUrl('/mythic-plus/again', MythicPlusPageComponent);

    expect(next.index()?.season.id).toBe('legion-s1-1');
    expect(location.path()).toBe('/mythic-plus/again?season=legion-s1-1');
  });

  it('shows the live season for a season it does not know and drops it from the address', async () => {
    const { page, location } = await open('/mythic-plus?season=legion-s0');

    expect(page.index()?.season.id).toBe('legion-s1-2');
    expect(location.path()).toBe('/mythic-plus');
  });
});

describe('MythicPlusPageComponent roles', () => {
  const roles = exportOf('dddddddddddd', [['Exkeito', 'Evermoon', '', 11, 4, 0], ['Napim', 'Tauri', '', 11, 4, 0]]);
  roles.index.specs = [
    { class: 11, name: 'Restoration', role: 'healer' },
    { class: 11, name: 'Guardian', role: 'tank' },
    { class: 11, name: 'Feral', role: 'dps' },
    { class: 11, name: 'Balance', role: 'dps' }
  ];
  roles.cos.runs = [
    [19, 1297289, 1791293804, 196, [], [[0, 0], [1, 1]]],
    [15, 1297289, 1791293904, 160, [], [[1, 0]]],
    [12, 1297289, 1791294004, 140, [], [[0, 2], [1, 3]]]
  ];

  async function open(url: string): Promise<MythicPlusPageComponent> {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'mythic-plus', component: MythicPlusPageComponent }]),
        { provide: DataFileService, useValue: new FakeDataFiles(roles.index, roles) }
      ]
    });
    const harness = await RouterTestingHarness.create();
    return harness.navigateByUrl(url, MythicPlusPageComponent);
  }

  const ladder = (page: MythicPlusPageComponent) =>
    page.filteredPlayers().map(entry => [entry.player.member.name, entry.player.score]);

  it('ranks each role on the runs played in it', async () => {
    const page = await open('/mythic-plus?view=players&role=healer');

    expect(page.roleFilter()).toBe('healer');
    expect(ladder(page)).toEqual([['Exkeito', 196], ['Napim', 160]]);

    page.setRole('tank');
    expect(ladder(page)).toEqual([['Napim', 196]]);
  });

  it('ranks the melee or the ranged damage dealers and keeps the role in the address bar', async () => {
    const page = await open('/mythic-plus?view=players&role=melee');
    expect(ladder(page)).toEqual([['Exkeito', 140]]);

    page.setRole('ranged');
    expect(ladder(page)).toEqual([['Napim', 140]]);
    expect(TestBed.inject(Location).path()).toBe('/mythic-plus?view=players&role=ranged');
  });

  it('keeps the spec chart role in the address bar, apart from the ladder role', async () => {
    const page = await open('/mythic-plus?chartRole=healer');
    const location = TestBed.inject(Location);
    expect([page.chartRole(), page.roleFilter()]).toEqual(['healer', undefined]);

    page.setChartRole('melee');
    expect(location.path()).toBe('/mythic-plus?chartRole=melee');

    page.setChartRole(undefined);
    expect(location.path()).toBe('/mythic-plus');
  });

  it('opens on tanks, and Players goes back to the plain ladder', async () => {
    const page = await open('/mythic-plus');

    page.showRoles();
    expect(page.view()).toBe('players');
    expect(page.roleFilter()).toBe('tank');

    page.setView('players');
    expect(page.roleFilter()).toBeUndefined();
    expect(ladder(page)).toEqual([['Exkeito', 196], ['Napim', 196]]);
  });
});
