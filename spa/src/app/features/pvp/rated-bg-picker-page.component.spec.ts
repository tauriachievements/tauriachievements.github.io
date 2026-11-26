import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { provideLocationMocks } from '@angular/common/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { describe, expect, it } from 'vitest';
import { DataFileService } from '../../core/data-file.service';
import { RatedBgPickerPageComponent } from './rated-bg-picker-page.component';
import { RatedBgRosterEntry, RatedBgRosterFile } from './rated-bg-picker';

function entry(index: number, overrides: Partial<RatedBgRosterEntry> = {}): RatedBgRosterEntry {
  return {
    name: `Player${String(index).padStart(2, '0')}`,
    realm: 'Evermoon',
    race: 1,
    gender: 0,
    class: 1,
    spec: 'Arms',
    traits: 40,
    itemLevel: 880 + (index % 10),
    ...overrides
  };
}

function roster(count: number): RatedBgRosterFile {
  return {
    version: 1,
    generatedAt: '2026-11-24T12:29:26Z',
    players: Array.from({ length: count }, (_, index) =>
      index < 6
        ? entry(index, { class: 5, spec: 'Holy' })
        : index < 12
          ? entry(index, { class: 3, spec: 'Marksmanship' })
          : entry(index))
  };
}

async function openPage(url: string, file: RatedBgRosterFile = roster(24)) {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([{ path: 'rated-bg-picker', component: RatedBgPickerPageComponent }]),
      provideLocationMocks(),
      { provide: DataFileService, useValue: { getJson: () => of(file) } }
    ]
  });
  const harness = await RouterTestingHarness.create();
  await harness.navigateByUrl(url, RatedBgPickerPageComponent);
  harness.detectChanges();
  await harness.fixture.whenStable();
  return { harness, element: harness.routeNativeElement as HTMLElement, location: TestBed.inject(Location) };
}

const checkboxes = (element: HTMLElement) =>
  [...element.querySelectorAll<HTMLInputElement>('.roster input[type="checkbox"]')];

const button = (element: HTMLElement, selector: string) =>
  element.querySelector<HTMLButtonElement>(selector);

const teamNames = (element: HTMLElement) =>
  [...element.querySelectorAll('.team')].map(team =>
    [...team.querySelectorAll('.player-name')].map(name => name.textContent?.trim()));

async function tick(harness: RouterTestingHarness, element: HTMLElement, count: number) {
  for (const box of checkboxes(element).slice(0, count)) {
    box.click();
  }
  harness.detectChanges();
  await harness.fixture.whenStable();
}

const markedInTeams = (element: HTMLElement) =>
  [...element.querySelectorAll('.team')].map(team =>
    [...team.querySelectorAll('.flag-carrier[aria-pressed="true"]')]
      .map(carrier => carrier.closest('li')?.querySelector('.player-name')?.textContent?.trim()));

async function press(harness: RouterTestingHarness, element: HTMLElement, selector: string) {
  button(element, selector)?.click();
  harness.detectChanges();
  await harness.fixture.whenStable();
}

async function choose(harness: RouterTestingHarness, element: HTMLElement, dropdown: string, label: string) {
  await press(harness, element, `#${dropdown}Trigger`);
  [...element.querySelectorAll<HTMLButtonElement>(`#${dropdown}Menu .dropdown-option`)]
    .find(option => option.textContent?.trim() === label)
    ?.click();
  harness.detectChanges();
  await harness.fixture.whenStable();
}

const chosen = (element: HTMLElement) =>
  ['ratedBgHealers', 'ratedBgRanged', 'ratedBgMelee'].map(dropdown =>
    element.querySelector(`#${dropdown}Trigger .trigger-current`)?.textContent?.trim());

const barText = (element: HTMLElement) =>
  element.querySelector('.pick-count')?.textContent?.replace(/\s+/g, ' ').trim();

const benchNames = (element: HTMLElement) =>
  [...element.querySelectorAll('.bench .player-name')].map(name => name.textContent?.trim() ?? '');

const backFromBench = (element: HTMLElement) =>
  [...element.querySelectorAll('.team .back-from-bench .player-name')].map(name => name.textContent?.trim() ?? '');

const teamListSizes = (element: HTMLElement) =>
  [...element.querySelectorAll('.team')].map(team =>
    [...team.querySelectorAll('.team-players')].map(list =>
      `${list.getAttribute('aria-label')} ${list.querySelectorAll('li').length}`));

describe('RatedBgPickerPageComponent', () => {
  it('puts the composition, ticked count and actions in one toolbar', async () => {
    const { element } = await openPage('/rated-bg-picker');
    const toolbar = element.querySelector('.picker-card.toolbar');

    expect(toolbar?.querySelector('.composition')).not.toBeNull();
    expect(toolbar?.querySelector('.pick-count')).not.toBeNull();
    expect(toolbar?.querySelector('.toolbar-buttons')).not.toBeNull();
    expect(element.querySelectorAll('.picker-card.toolbar, .picker-card.composition')).toHaveLength(1);
    expect(chosen(element)).toEqual(['3', '3', '4']);
  });

  it("lists every player with their class, spec and race icons, traits and item level", async () => {
    const { element } = await openPage('/rated-bg-picker', {
      version: 1,
      generatedAt: '2026-11-24T12:29:26Z',
      players: [
        { name: 'Xyhop', realm: 'Evermoon', race: 9, gender: 1, class: 5, spec: 'Shadow', traits: 42, itemLevel: 886 },
        { name: 'Typo', realm: 'Evermoon', notFound: true }
      ]
    });
    const rows = [...element.querySelectorAll('.roster li')];

    expect(rows).toHaveLength(2);
    const row = (name: string) => rows.find(item => item.querySelector('.player-name')?.textContent?.trim() === name);
    const xyhop = row('Xyhop');
    expect([...xyhop?.querySelectorAll('.player-icons img') ?? []].map(icon => icon.getAttribute('alt')))
      .toEqual(['Priest', 'Shadow', 'Goblin']);
    expect(xyhop?.querySelector('.player-traits')?.textContent).toContain('42');
    expect(xyhop?.querySelector('.player-item-level')?.textContent).toContain('886');
    expect(row('Typo')?.textContent).toContain('Not on the armory');
  });

  it('lists the melee, the ranged and the healers in three columns, each with how many are ticked', async () => {
    const { harness, element } = await openPage('/rated-bg-picker');
    await tick(harness, element, 14);

    const columns = [...element.querySelectorAll('.roster-columns > .roster-group')].map(group => ({
      label: group.querySelector('.group-label')?.textContent?.replace(/\s+/g, ' ').trim(),
      names: [...group.querySelectorAll('.player-name')].map(name => name.textContent?.trim())
    }));

    expect(columns.map(column => column.label)).toEqual(['Melee · 12 ticked', 'Ranged · 2 ticked', 'Healers · 0 ticked']);
    expect(columns[0].names).toHaveLength(12);
    expect(columns[1].names).toEqual(['Player06', 'Player07', 'Player08', 'Player09', 'Player10', 'Player11']);
    expect(columns[2].names).toEqual(['Player00', 'Player01', 'Player02', 'Player03', 'Player04', 'Player05']);
  });

  it('groups a column by class in alphabetical order, each by spec then traits, with a gap before each new class', async () => {
    const { element } = await openPage('/rated-bg-picker', {
      version: 1,
      generatedAt: '2026-11-24T12:29:26Z',
      players: [
        entry(0, { class: 1, spec: 'Arms', traits: 45 }),
        entry(1, { class: 6, spec: 'Frost', traits: 40 }),
        entry(2, { class: 1, spec: 'Arms', traits: 50 }),
        entry(3, { class: 6, spec: 'Unholy', traits: 52 })
      ]
    });

    const rows = [...element.querySelectorAll('.roster-group:first-child .roster li')].map(row =>
      [row.querySelector('.player-name')?.textContent?.trim(), row.classList.contains('class-start')]);

    expect(rows).toEqual([['Player01', false], ['Player03', false], ['Player02', true], ['Player00', false]]);
  });

  it('says so in a column with nobody in it', async () => {
    const { element } = await openPage('/rated-bg-picker', {
      version: 1,
      generatedAt: '2026-11-24T12:29:26Z',
      players: [entry(0)]
    });

    const empty = [...element.querySelectorAll('.roster-group')].map(group => group.querySelector('.group-empty')?.textContent?.trim());

    expect(empty).toEqual([undefined, 'Nobody on the list', 'Nobody on the list']);
  });

  it('ticks any number of players, and shuffles once each group has enough for both teams', async () => {
    const { harness, element } = await openPage('/rated-bg-picker');

    await tick(harness, element, 20);
    expect(button(element, '.shuffle')?.disabled).toBe(true);
    expect(barText(element)).toBe('20 ticked · tick 4 more healers');
    expect(element.querySelector('.pick-count .shuffle-warning')).not.toBeNull();

    for (const box of checkboxes(element).slice(20)) {
      box.click();
    }
    harness.detectChanges();
    await harness.fixture.whenStable();

    expect(checkboxes(element).filter(box => box.checked)).toHaveLength(24);
    expect(checkboxes(element).some(box => box.disabled)).toBe(false);
    expect(barText(element)).toBe('24 ticked · 4 on the bench');
    expect(element.querySelector('.shuffle-warning')).toBeNull();
    expect(button(element, '.shuffle')?.disabled).toBe(false);
  });

  it('counts two ticked characters of one person once on the bench, and puts only one of them in the match', async () => {
    const file = roster(24);
    const { harness, element } = await openPage('/rated-bg-picker', {
      ...file,
      players: [...file.players, entry(24, { person: 'Player24-Evermoon' }), entry(25, { person: 'Player24-Evermoon' })]
    });
    await tick(harness, element, 26);

    expect(barText(element)).toBe('26 ticked · 5 on the bench');

    await press(harness, element, '.shuffle');
    const inMatch = [...teamNames(element).flat(), ...benchNames(element)];
    expect(inMatch).toHaveLength(25);
    expect(inMatch.filter(name => name === 'Player24' || name === 'Player25')).toHaveLength(1);
    expect(element.querySelector('.bench .team-summary')?.textContent?.trim()).toBe('5 players');
  });

  it("unticks a character's other spec when one of their specs is ticked", async () => {
    const solaureus = { name: 'Solaureus', realm: 'Evermoon', race: 1, gender: 0, class: 2, traits: 37, itemLevel: 879 };
    const { harness, element } = await openPage('/rated-bg-picker', {
      version: 1,
      generatedAt: '2026-11-24T12:29:26Z',
      players: [{ ...solaureus, spec: 'Retribution' }, { ...solaureus, spec: 'Holy' }]
    });
    const [retribution, holy] = checkboxes(element);

    retribution.click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    holy.click();
    harness.detectChanges();
    await harness.fixture.whenStable();

    expect(checkboxes(element).map(box => box.checked)).toEqual([false, true]);
    expect(barText(element)).toMatch(/^1 ticked/);
  });

  it('shuffles only when the healers, ranged and melee per team add up to 10, and fills each team that way', async () => {
    const { harness, element } = await openPage('/rated-bg-picker');
    await tick(harness, element, 24);
    expect(chosen(element)).toEqual(['3', '3', '4']);

    await choose(harness, element, 'ratedBgMelee', '5');
    expect(chosen(element)).toEqual(['3', '3', '5']);
    expect(barText(element)).toBe('24 ticked · 11 per team, a team is 10');
    expect(button(element, '.shuffle')?.disabled).toBe(true);

    await choose(harness, element, 'ratedBgHealers', '2');
    expect(barText(element)).toBe('24 ticked · 4 on the bench');

    await press(harness, element, '.shuffle');
    expect(teamListSizes(element)).toEqual([
      ['Healers 2', 'Ranged 3', 'Melee 5'],
      ['Healers 2', 'Ranged 3', 'Melee 5']
    ]);
    expect(benchNames(element)).toHaveLength(4);
  });

  it('splits the ticked players into two teams of 10 and writes them to the address', async () => {
    const { harness, element, location } = await openPage('/rated-bg-picker');
    await tick(harness, element, 24);

    await press(harness, element, '.shuffle');

    const teams = teamNames(element);
    expect(teams.map(team => team.length)).toEqual([10, 10]);
    expect([...element.querySelectorAll('.team .team-summary')].map(summary => summary.textContent?.trim().split(' · ')[0]))
      .toEqual(['3 healers', '3 healers']);
    const [, query] = location.path().split('?');
    const params = new URLSearchParams(query);
    expect(params.get('a')?.split(',').map(key => key.replace('-Evermoon', ''))).toEqual(teams[0]);
    expect(params.get('b')?.split(',').map(key => key.replace('-Evermoon', ''))).toEqual(teams[1]);
  });

  it('lists the bench, and the next shuffle plays it first, marked as back from the bench', async () => {
    const { harness, element } = await openPage('/rated-bg-picker');
    await tick(harness, element, 24);

    await press(harness, element, '.shuffle');
    const firstBench = benchNames(element);
    expect(firstBench).toHaveLength(4);
    expect(element.querySelector('.bench .team-summary')?.textContent?.trim()).toBe('4 players');
    expect(teamNames(element).flat().filter(name => firstBench.includes(name ?? ''))).toEqual([]);
    expect(backFromBench(element)).toEqual([]);
    expect(barText(element)).toBe('24 ticked · 4 on the bench');

    await press(harness, element, '.shuffle-again');
    expect(backFromBench(element).sort()).toEqual([...firstBench].sort());
    expect(benchNames(element)).toHaveLength(4);
    expect(benchNames(element).filter(name => firstBench.includes(name))).toEqual([]);
    for (const team of element.querySelectorAll('.team')) {
      const said = team.querySelector('.team-summary')?.textContent?.match(/(\d+) back from the bench/)?.[1] ?? '0';
      expect(said).toBe(`${team.querySelectorAll('li.back-from-bench').length}`);
    }
  });

  it('marks each benched player with a bench icon, and each player back from the bench with a return icon', async () => {
    const { harness, element } = await openPage('/rated-bg-picker');
    await tick(harness, element, 24);
    await press(harness, element, '.shuffle');

    const benchMarks = [...element.querySelectorAll('.bench-players li')]
      .map(row => row.querySelector('app-rated-bg-mark.benched')?.getAttribute('aria-label'));
    expect(benchMarks).toEqual(['On the bench', 'On the bench', 'On the bench', 'On the bench']);
    expect(element.querySelector('.bench h2 app-rated-bg-mark.benched')?.getAttribute('aria-hidden')).toBe('true');
    expect(element.querySelectorAll('.team app-rated-bg-mark')).toHaveLength(0);

    await press(harness, element, '.shuffle-again');

    const rowMarks = [...element.querySelectorAll('.team .player-row app-rated-bg-mark')].map(mark => [
      mark.closest('li')?.classList.contains('back-from-bench'),
      mark.classList.contains('back-from-bench'),
      mark.getAttribute('aria-label')
    ]);
    expect(rowMarks).toEqual(Array.from({ length: 4 }, () => [true, true, 'Back from the bench']));
    const teamsWithReturns = [...element.querySelectorAll('.team')].filter(team => team.querySelector('li.back-from-bench'));
    expect(element.querySelectorAll('.team .bench-note app-rated-bg-mark.back-from-bench[aria-hidden="true"]'))
      .toHaveLength(teamsWithReturns.length);
  });

  it('shows no bench when the ticked players fill both teams exactly', async () => {
    const { harness, element } = await openPage('/rated-bg-picker', roster(20));
    await tick(harness, element, 20);
    expect(barText(element)).toBe('20 ticked');

    await press(harness, element, '.shuffle');

    expect(teamNames(element).map(team => team.length)).toEqual([10, 10]);
    expect(element.querySelector('.bench')).toBeNull();
  });

  it('Change players keeps the bench rotation, and Clear starts it again', async () => {
    const { harness, element } = await openPage('/rated-bg-picker');
    await tick(harness, element, 24);
    await press(harness, element, '.shuffle');
    const firstBench = benchNames(element);

    await press(harness, element, '.change-players');
    expect(element.querySelector('.bench')).toBeNull();
    await press(harness, element, '.shuffle');
    expect(backFromBench(element).sort()).toEqual([...firstBench].sort());

    await press(harness, element, '.change-players');
    await press(harness, element, '.clear');
    await tick(harness, element, 24);
    await press(harness, element, '.shuffle');
    expect(backFromBench(element)).toEqual([]);
  });

  const carrierName = (carrier: HTMLButtonElement) => carrier.closest('li')?.querySelector('.player-name')?.textContent?.trim();

  it('marks and unmarks any number of flag carriers in the teams, and a reshuffle spreads them evenly', async () => {
    const { harness, element } = await openPage('/rated-bg-picker');
    await tick(harness, element, 24);
    await press(harness, element, '.shuffle');

    const teamButtons = () => [...element.querySelectorAll<HTMLElement>('.team')].map(team =>
      [...team.querySelectorAll<HTMLButtonElement>('.flag-carrier')]);
    const [firstTeam, secondTeam] = teamButtons();
    const healerButtons = [firstTeam[0], firstTeam[1], secondTeam[0], secondTeam[1]];

    healerButtons.forEach(carrier => carrier.click());
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(healerButtons.map(carrier => carrier.getAttribute('aria-pressed'))).toEqual(['true', 'true', 'true', 'true']);

    secondTeam[1].click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(healerButtons.map(carrier => carrier.getAttribute('aria-pressed'))).toEqual(['true', 'true', 'true', 'false']);
    const carriers = healerButtons.slice(0, 3).map(carrierName);

    await press(harness, element, '.shuffle-again');
    expect(markedInTeams(element).map(team => team.length).sort()).toEqual([1, 2]);
    expect(markedInTeams(element).flat().sort()).toEqual(carriers.sort());
  });

  it('marks any number of ticked players as flag carriers before the shuffle, and keeps two of them playing', async () => {
    const { harness, element } = await openPage('/rated-bg-picker');
    await tick(harness, element, 24);
    const rosterButtons = () => [...element.querySelectorAll<HTMLButtonElement>('.roster .flag-carrier')];
    const pressed = () => rosterButtons().filter(carrier => carrier.getAttribute('aria-pressed') === 'true');
    expect(rosterButtons()).toHaveLength(24);

    rosterButtons().slice(0, 3).forEach(carrier => carrier.click());
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(pressed()).toHaveLength(3);
    expect(rosterButtons().some(carrier => carrier.disabled)).toBe(false);
    const carriers = pressed().map(carrierName);

    await press(harness, element, '.shuffle');

    const [first, second] = markedInTeams(element);
    expect(first.length + second.length).toBeGreaterThanOrEqual(2);
    expect(Math.abs(first.length - second.length)).toBeLessThanOrEqual(1);
    expect([...first, ...second].every(name => carriers.includes(name))).toBe(true);
    expect(rosterButtons().every(carrier => carrier.disabled)).toBe(true);

    await press(harness, element, '.change-players');
    expect(pressed()).toHaveLength(3);
  });

  it('offers no flag carrier button on an unticked player, and drops the mark when the player is unticked', async () => {
    const { harness, element } = await openPage('/rated-bg-picker');
    await tick(harness, element, 1);
    const firstRow = () => element.querySelector('.roster li');
    expect(element.querySelectorAll('.roster .flag-carrier')).toHaveLength(1);

    firstRow()?.querySelector<HTMLButtonElement>('.flag-carrier')?.click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(firstRow()?.querySelector('.flag-carrier')?.getAttribute('aria-pressed')).toBe('true');

    await tick(harness, element, 1);
    expect(element.querySelectorAll('.roster .flag-carrier')).toHaveLength(0);

    await tick(harness, element, 1);
    expect(firstRow()?.querySelector('.flag-carrier')?.getAttribute('aria-pressed')).toBe('false');
  });

  it('opens a shared link on its teams, with their players ticked and the ticks locked', async () => {
    const first = Array.from({ length: 10 }, (_, index) => `Player${String(index).padStart(2, '0')}-Evermoon`);
    const second = Array.from({ length: 10 }, (_, index) => `Player${String(index + 10).padStart(2, '0')}-Evermoon`);
    const { element } = await openPage(`/rated-bg-picker?a=${first.join(',')}&b=${second.join(',')}`);

    expect(teamNames(element)[0]).toHaveLength(10);
    expect(teamNames(element).flat().sort()).toEqual([...first, ...second].map(key => key.replace('-Evermoon', '')).sort());
    expect(checkboxes(element).filter(box => box.checked)).toHaveLength(20);
    expect(checkboxes(element).every(box => box.disabled)).toBe(true);
    expect(element.querySelector('.bench')).toBeNull();
  });

  it("sets the dropdowns to a shared link's healers, ranged and melee per team", async () => {
    const key = (index: number) => `Player${String(index).padStart(2, '0')}-Evermoon`;
    const first = [0, 1, 6, 7, 8, 12, 13, 14, 15, 16].map(key);
    const second = [2, 3, 9, 10, 11, 17, 18, 19, 20, 21].map(key);
    const { element } = await openPage(`/rated-bg-picker?a=${first.join(',')}&b=${second.join(',')}`);

    expect(chosen(element)).toEqual(['2', '3', '5']);
    expect(button(element, '.shuffle-again')?.disabled).toBe(false);
  });

  it("lists each team's healers, ranged and melee as separate lists, in that order", async () => {
    const key = (index: number) => `Player${String(index).padStart(2, '0')}-Evermoon`;
    const first = [0, 1, 6, 7, 8, 12, 13, 14, 15, 16].reverse().map(key);
    const second = [2, 3, 9, 10, 11, 17, 18, 19, 20, 21].map(key);
    const { element } = await openPage(`/rated-bg-picker?a=${first.join(',')}&b=${second.join(',')}`);

    const firstTeamLists = [...element.querySelectorAll('.team')[0].querySelectorAll('.team-players')].map(list => [
      list.getAttribute('aria-label'),
      [...list.querySelectorAll('.player-name')].map(name => name.textContent?.trim())
    ]);

    expect(firstTeamLists).toEqual([
      ['Healers', ['Player00', 'Player01']],
      ['Ranged', ['Player06', 'Player07', 'Player08']],
      ['Melee', ['Player12', 'Player13', 'Player14', 'Player15', 'Player16']]
    ]);
  });

  it('says so when a shared link no longer matches the list, and drops it from the address', async () => {
    const { element, location } = await openPage('/rated-bg-picker?a=Gone-Evermoon&b=Player01-Evermoon');

    expect(element.querySelectorAll('.team')).toHaveLength(0);
    expect(element.querySelector('.stale-link')).not.toBeNull();
    expect(location.path()).toBe('/rated-bg-picker');
  });

  it('Change players hides the teams, keeps the ticks and clears the address', async () => {
    const { harness, element, location } = await openPage('/rated-bg-picker');
    await tick(harness, element, 24);
    await press(harness, element, '.shuffle');

    await press(harness, element, '.change-players');

    expect(element.querySelectorAll('.team')).toHaveLength(0);
    expect(checkboxes(element).filter(box => box.checked)).toHaveLength(24);
    expect(checkboxes(element)[0].disabled).toBe(false);
    expect(location.path()).toBe('/rated-bg-picker');
  });

  it('Clear unticks everyone and drops the flag carrier marks', async () => {
    const { harness, element } = await openPage('/rated-bg-picker');
    await tick(harness, element, 5);
    expect(checkboxes(element).filter(box => box.checked)).toHaveLength(5);
    await press(harness, element, '.roster .flag-carrier');
    expect(element.querySelectorAll('.roster .flag-carrier[aria-pressed="true"]')).toHaveLength(1);

    await press(harness, element, '.clear');

    expect(checkboxes(element).filter(box => box.checked)).toHaveLength(0);
    await tick(harness, element, 5);
    expect(element.querySelectorAll('.roster .flag-carrier[aria-pressed="true"]')).toHaveLength(0);
  });
});
