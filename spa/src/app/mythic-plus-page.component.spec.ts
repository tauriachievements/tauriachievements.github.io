import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Observable, of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MythicPlusDungeonFile, MythicPlusIndex, MythicPlusPlayerEntry, NEWER_DATA_MESSAGE } from './mythic-plus';
import { MOVEMENT_RANK_LIMIT } from './mythic-plus-movement';
import { MythicPlusPageComponent } from './mythic-plus-page.component';
import { DataFileService } from './services/data-file.service';
import { MYTHIC_PLUS_STORAGE } from './services/mythic-plus-visitor.service';

/** One export: an index and its Court of Stars file, where the healer is player 0. */
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

// The Oct 5 table had Fellicia (a warlock) where the Oct 7 one has Exkeito (a druid).
const oct5 = exportOf('aaaaaaaaaaaa', [['Fellicia', 'Evermoon', 'Yin Yang', 9, 1, 1]]);
const oct7 = exportOf('bbbbbbbbbbbb', [['Exkeito', 'Evermoon', '', 11, 4, 0]]);

/** Serves `held` until refresh(), then `deployed`: a tab that kept an old index across a deploy. */
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
    dataFiles.refresh = () => dataFiles.refreshes++; // the deploy is still going out
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
});

describe('MythicPlusPageComponent character and realm in the URL', () => {
  // Two runs: Exkeito (Evermoon) with Napim (Tauri), and Napim alone.
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
});

/** A localStorage stand-in for the visitor's saved character and last seen export. */
function memoryStorage(entries: Record<string, string> = {}) {
  const values = new Map(Object.entries(entries));
  return {
    values,
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    removeItem: (key: string) => void values.delete(key)
  };
}

describe('MythicPlusPageComponent rank movement, "This is me" and the last visit', () => {
  const generatedAt = '2026-10-08T13:00:00Z';
  const exported = Date.parse(generatedAt) / 1000;
  const hoursAgo = (hours: number) => exported - hours * 3600;
  const lastWeek = [10, 7, 4];
  const thisWeek = [9, 6, 3];

  /*
   * Court of Stars, a 30 minute timer. The week turned 28 hours before the export (Brightfall's
   * run is the last with last week's affixes); Napim's run 26 hours ago is the first of this week.
   * Now:          Brightfall 210, Ashra 200, Napim 180, Corwin 100
   * 24 h ago:     Ashra 200, Napim 180, Brightfall 150
   * At the reset: Ashra 200, Brightfall 150
   */
  const players: MythicPlusPlayerEntry[] = [
    ['Ashra', 'Evermoon', '', 1, 1, 0],
    ['Brightfall', 'Evermoon', '', 1, 1, 0],
    ['Napim', 'Tauri', '', 11, 4, 0],
    ['Corwin', 'Evermoon', '', 1, 1, 0]
  ];
  const runs: MythicPlusDungeonFile['runs'] = [
    [15, 1500000, hoursAgo(30), 200, lastWeek, [[0, 0]]],
    [12, 1500000, hoursAgo(28), 150, lastWeek, [[1, 0]]],
    [14, 1500000, hoursAgo(26), 180, thisWeek, [[2, 1]]],
    [16, 1500000, hoursAgo(20), 210, thisWeek, [[1, 0]]],
    [10, 1500000, hoursAgo(1), 100, thisWeek, [[3, 0]]]
  ];

  function movementExport(entries = players, dungeonRuns = runs, tables = 'dddddddddddd', at = generatedAt) {
    return {
      index: {
        version: 1,
        generatedAt: at,
        tables,
        season: { id: 'legion-s1', name: 'Legion Season 1', raid: 'Emerald Nightmare', startDate: '2026-09-16' },
        dungeons: [{ id: 'cos', challengeId: 210, shortName: 'COS', name: 'Court of Stars', timerSeconds: 1800, icon: '', runCount: dungeonRuns.length, bestScore: 210 }],
        affixes: [],
        specs: [{ class: 1, name: 'Arms', role: 'dps' }, { class: 11, name: 'Restoration', role: 'healer' }],
        players: entries
      } as MythicPlusIndex,
      cos: { version: 1, dungeon: 'cos', tables, runs: dungeonRuns } as MythicPlusDungeonFile
    };
  }

  async function open(url: string, storage = memoryStorage(), data = movementExport()) {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'mythic-plus', component: MythicPlusPageComponent }]),
        { provide: DataFileService, useValue: new FakeDataFiles(data.index, data) },
        { provide: MYTHIC_PLUS_STORAGE, useValue: () => storage }
      ]
    });
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl(url, MythicPlusPageComponent);
    harness.detectChanges();
    return { page, storage, harness };
  }

  const arrows = (page: MythicPlusPageComponent) =>
    page.pagedPlayers().map(row => `${row.member.name} ${row.movement?.label ?? '-'}`);

  it('shows each rank change in the last 24 hours, with NEW for a character who was not ranked', async () => {
    const { page } = await open('/mythic-plus?view=players');

    expect(arrows(page)).toEqual(['Brightfall ▲2', 'Ashra ▼1', 'Napim ▼1', 'Corwin NEW']);
    expect(page.pagedPlayers()[0].movement?.description).toBe('Up 2 places in the last 24 hours (was #3), +60.0 score');
    expect(page.movementColumn()).toEqual({ label: '24h', title: 'Rank change in the last 24 hours' });
  });

  it("counts from this week's reset in the Season view", async () => {
    const { page } = await open('/mythic-plus?view=players&since=reset');

    expect(page.activeBaseline()).toBe('reset');
    expect(arrows(page)).toEqual(['Brightfall ▲1', 'Ashra ▼1', 'Napim NEW', 'Corwin NEW']);
  });

  it('uses only the 24 h baseline in the This week view, comparing this week with this week', async () => {
    const { page } = await open('/mythic-plus?view=players&period=week&since=reset');

    expect(page.activeBaseline()).toBe('day');
    expect(arrows(page)).toEqual(['Brightfall NEW', 'Napim ▼1', 'Corwin NEW']);
  });

  it('compares filtered ranks with filtered ranks', async () => {
    const { page } = await open('/mythic-plus?view=players&class=1');

    // Among warriors 24 h ago: Ashra 1, Brightfall 2.
    expect(arrows(page)).toEqual(['Brightfall ▲1', 'Ashra ▼1', 'Corwin NEW']);
  });

  it('switches the baseline and keeps it in the URL', async () => {
    const { page } = await open('/mythic-plus?view=players');

    page.setMovementBaseline('reset');

    expect(arrows(page)).toEqual(['Brightfall ▲1', 'Ashra ▼1', 'Napim NEW', 'Corwin NEW']);
    expect(TestBed.inject(Location).path()).toContain('since=reset');

    page.setPeriod('week');
    expect(TestBed.inject(Location).path()).not.toContain('since=');
  });

  it(`shows arrows only down to rank ${MOVEMENT_RANK_LIMIT}`, async () => {
    const many: MythicPlusPlayerEntry[] = Array.from({ length: MOVEMENT_RANK_LIMIT + 2 }, (_, i) =>
      [`Player${String(i).padStart(3, '0')}`, 'Evermoon', '', 1, 1, 0]);
    const manyRuns: MythicPlusDungeonFile['runs'] = many.map((_, i) => [10, 1500000, hoursAgo(1), 1000 - i, thisWeek, [[i, 0]]]);
    // One run before the baseline, so there is a leaderboard to compare with.
    manyRuns.push([2, 1500000, hoursAgo(48), 1, lastWeek, [[0, 0]]]);
    const { page } = await open('/mythic-plus?view=players&page=11', memoryStorage(), movementExport(many, manyRuns));

    expect(page.pagedPlayers().map(row => [row.rank, row.movement?.label])).toEqual([[501, undefined], [502, undefined]]);
  });

  it("puts the saved character's place in the You bar and jumps to their page", async () => {
    const many: MythicPlusPlayerEntry[] = Array.from({ length: 60 }, (_, i) =>
      [`Player${String(i).padStart(2, '0')}`, 'Evermoon', '', 1, 1, 0]);
    const manyRuns: MythicPlusDungeonFile['runs'] = many.map((_, i) => [10, 1500000, hoursAgo(30), 1000 - i, lastWeek, [[i, 0]]]);
    manyRuns.push([20, 1500000, hoursAgo(2), 949.5, thisWeek, [[55, 0]]]); // Player55 climbs from #56 to #52, page 2
    const storage = memoryStorage({ 'mythicPlus.me': 'Player55|Evermoon' });
    const { page } = await open('/mythic-plus?view=players', storage, movementExport(many, manyRuns));

    expect(page.meStatus()).toMatchObject({ rank: 52, score: 949.5, movement: { label: '▲4', tone: 'up' } });
    expect(page.pagedPlayers().some(row => row.isMe)).toBe(false);

    // A search that hides them is cleared on the way.
    page.onSearch({ target: { value: 'Player0' } } as unknown as Event);
    page.jumpToMe();

    expect(page.search()).toBe('');
    expect(page.currentPage()).toBe(2);
    expect(page.jumpToMeRequest()).toBe(1);
    expect(page.pagedPlayers().find(row => row.isMe)?.member.name).toBe('Player55');
    expect(TestBed.inject(Location).path()).toContain('page=2');
  });

  it("says why the saved character isn't in the list instead of hiding the bar", async () => {
    const storage = memoryStorage({ 'mythicPlus.me': 'Napim|Tauri' });
    const { page } = await open('/mythic-plus?view=players&class=1', storage);
    expect(page.meStatus()).toMatchObject({ absence: "isn't a Warrior" });

    page.setClassFilter(undefined);
    page.setPeriod('week');
    page.setRealmFilter('evermoon');
    expect(page.meStatus()?.absence).toBe("isn't on Evermoon");

    page.forgetMe();
    expect(page.meStatus()).toBeUndefined();
    expect(storage.values.has('mythicPlus.me')).toBe(false);
  });

  it('saves a row as the visitor and forgets it on a second click', async () => {
    const storage = memoryStorage();
    const { page } = await open('/mythic-plus?view=players', storage);
    const napim = page.pagedPlayers().find(row => row.member.name === 'Napim')!;

    page.toggleMe(napim);
    expect(storage.values.get('mythicPlus.me')).toBe('Napim|Tauri');
    expect(page.meStatus()).toMatchObject({ rank: 3, movement: { label: '▼1' } });

    page.toggleMe(napim);
    expect(page.meStatus()).toBeUndefined();
  });

  it('works without storage at all', async () => {
    const blocked = () => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    };
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'mythic-plus', component: MythicPlusPageComponent }]),
        { provide: DataFileService, useValue: new FakeDataFiles(movementExport().index, movementExport()) },
        { provide: MYTHIC_PLUS_STORAGE, useValue: blocked }
      ]
    });
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/mythic-plus?view=players', MythicPlusPageComponent);
    harness.detectChanges();

    page.toggleMe(page.pagedPlayers()[0]);
    expect(page.meStatus()?.rank).toBe(1);
    expect(page.lastVisit()).toBeUndefined();
  });

  it('sums up what changed since the export the visitor last saw, then marks the current one seen', async () => {
    const seen = JSON.stringify({ season: 'legion-s1', generatedAt: '2026-10-07T13:00:00Z' });
    const storage = memoryStorage({ 'mythicPlus.seenExport': seen, 'mythicPlus.me': 'Brightfall|Evermoon' });
    const { page } = await open('/mythic-plus', storage);

    // Brightfall's +16 is also the season's new top key: Ashra's +15 led it a day ago.
    expect(page.lastVisit()?.text).toBe('you moved ▲2 (#3 → #1) · your group timed the first +16 (COS) · 1 dungeon record fell');
    expect(JSON.parse(storage.values.get('mythicPlus.seenExport')!)).toEqual({ season: 'legion-s1', generatedAt });
  });

  it('has no line on a first visit or after a season change, and still marks the export seen', async () => {
    const first = await open('/mythic-plus', memoryStorage());
    expect(first.page.lastVisit()).toBeUndefined();
    expect(first.storage.values.has('mythicPlus.seenExport')).toBe(true);

    TestBed.resetTestingModule();
    const seen = JSON.stringify({ season: 'legion-s0', generatedAt: '2026-08-01T13:00:00Z' });
    const reset = await open('/mythic-plus', memoryStorage({ 'mythicPlus.seenExport': seen }));
    expect(reset.page.lastVisit()).toBeUndefined();
    expect(JSON.parse(reset.storage.values.get('mythicPlus.seenExport')!).season).toBe('legion-s1');
  });

  it('does not mark an export seen when a tables mismatch keeps its runs from loading', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const seen = JSON.stringify({ season: 'legion-s1', generatedAt: '2026-10-07T13:00:00Z' });
    const storage = memoryStorage({ 'mythicPlus.seenExport': seen });
    const held = movementExport(players, runs, 'eeeeeeeeeeee', '2026-10-08T09:00:00Z');
    const deployed = movementExport();
    const dataFiles = new FakeDataFiles(held.index, deployed);
    dataFiles.refresh = () => dataFiles.refreshes++; // the deploy is still going out

    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: 'mythic-plus', component: MythicPlusPageComponent }]),
        { provide: DataFileService, useValue: dataFiles },
        { provide: MYTHIC_PLUS_STORAGE, useValue: () => storage }
      ]
    });
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/mythic-plus', MythicPlusPageComponent);
    harness.detectChanges();

    expect(page.loadError()).toBe(NEWER_DATA_MESSAGE);
    expect(storage.values.get('mythicPlus.seenExport')).toBe(seen);
  });
});
