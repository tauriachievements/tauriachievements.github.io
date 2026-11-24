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
      index < 4
        ? entry(index, { class: 5, spec: 'Holy' })
        : index < 10
          ? entry(index, { class: 3, spec: 'Marksmanship' })
          : entry(index))
  };
}

async function openPage(url: string, file: RatedBgRosterFile = roster(22)) {
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

async function press(harness: RouterTestingHarness, element: HTMLElement, selector: string) {
  button(element, selector)?.click();
  harness.detectChanges();
  await harness.fixture.whenStable();
}

describe('RatedBgPickerPageComponent', () => {
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
    expect(columns[1].names).toEqual(['Player04', 'Player05', 'Player06', 'Player07', 'Player08', 'Player09']);
    expect(columns[2].names).toEqual(['Player00', 'Player01', 'Player02', 'Player03']);
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

  it('shuffles only with an even number of healers ticked', async () => {
    const { harness, element } = await openPage('/rated-bg-picker');
    for (const box of checkboxes(element).slice(1, 21)) {
      box.click();
    }
    harness.detectChanges();
    await harness.fixture.whenStable();

    expect(button(element, '.shuffle')?.disabled).toBe(true);
    expect(element.querySelector('.healer-warning')?.textContent).toContain('3 healers');

    checkboxes(element)[20].click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    checkboxes(element)[0].click();
    harness.detectChanges();
    await harness.fixture.whenStable();

    expect(button(element, '.shuffle')?.disabled).toBe(false);
    expect(element.querySelector('.healer-warning')).toBeNull();
  });

  it('shuffles only with 20 ticked, and never ticks a 21st player', async () => {
    const { harness, element } = await openPage('/rated-bg-picker');

    await tick(harness, element, 19);
    expect(button(element, '.shuffle')?.disabled).toBe(true);
    expect(element.querySelector('.pick-count')?.textContent).toContain('19 of 20');

    checkboxes(element)[19].click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    checkboxes(element)[20].click();
    harness.detectChanges();
    await harness.fixture.whenStable();

    expect(checkboxes(element).filter(box => box.checked)).toHaveLength(20);
    expect(checkboxes(element).slice(20).map(box => box.disabled)).toEqual([true, true]);
    expect(button(element, '.shuffle')?.disabled).toBe(false);
  });

  it('splits the ticked players into two teams of 10 and writes them to the address', async () => {
    const { harness, element, location } = await openPage('/rated-bg-picker');
    await tick(harness, element, 20);

    await press(harness, element, '.shuffle');

    const teams = teamNames(element);
    expect(teams.map(team => team.length)).toEqual([10, 10]);
    expect([...element.querySelectorAll('.team-summary')].map(summary => summary.textContent?.trim().split(' · ')[0]))
      .toEqual(['1 healer', '1 healer']);
    const [, query] = location.path().split('?');
    const params = new URLSearchParams(query);
    expect(params.get('a')?.split(',').map(key => key.replace('-Evermoon', ''))).toEqual(teams[0]);
    expect(params.get('b')?.split(',').map(key => key.replace('-Evermoon', ''))).toEqual(teams[1]);
  });

  it('marks one possible flag carrier per team and clears the marks on reshuffle', async () => {
    const { harness, element } = await openPage('/rated-bg-picker');
    await tick(harness, element, 20);
    await press(harness, element, '.shuffle');

    const teamButtons = () => [...element.querySelectorAll<HTMLElement>('.team')].map(team =>
      [...team.querySelectorAll<HTMLButtonElement>('.flag-carrier')]);
    const [firstTeam, secondTeam] = teamButtons();

    firstTeam[0].click();
    secondTeam[0].click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(firstTeam[0].getAttribute('aria-pressed')).toBe('true');
    expect(secondTeam[0].getAttribute('aria-pressed')).toBe('true');

    firstTeam[1].click();
    harness.detectChanges();
    await harness.fixture.whenStable();
    expect(firstTeam[0].getAttribute('aria-pressed')).toBe('false');
    expect(firstTeam[1].getAttribute('aria-pressed')).toBe('true');
    expect(secondTeam[0].getAttribute('aria-pressed')).toBe('true');

    await press(harness, element, '.shuffle-again');
    expect(teamButtons().flat().every(candidate => candidate.getAttribute('aria-pressed') === 'false')).toBe(true);
  });

  it('opens a shared link on its teams, with their players ticked and the ticks locked', async () => {
    const first = Array.from({ length: 10 }, (_, index) => `Player${String(index).padStart(2, '0')}-Evermoon`);
    const second = Array.from({ length: 10 }, (_, index) => `Player${String(index + 10).padStart(2, '0')}-Evermoon`);
    const { element } = await openPage(`/rated-bg-picker?a=${first.join(',')}&b=${second.join(',')}`);

    expect(teamNames(element)[0]).toHaveLength(10);
    expect(teamNames(element).flat().sort()).toEqual([...first, ...second].map(key => key.replace('-Evermoon', '')).sort());
    expect(checkboxes(element).filter(box => box.checked)).toHaveLength(20);
    expect(checkboxes(element).every(box => box.disabled)).toBe(true);
  });

  it("lists each team's melee, ranged and healers as separate lists, in that order", async () => {
    const key = (index: number) => `Player${String(index).padStart(2, '0')}-Evermoon`;
    const first = [0, 1, 4, 5, 6, 10, 11, 12, 13, 14].reverse().map(key);
    const second = [2, 3, 7, 8, 9, 15, 16, 17, 18, 19].map(key);
    const { element } = await openPage(`/rated-bg-picker?a=${first.join(',')}&b=${second.join(',')}`);

    const firstTeamLists = [...element.querySelectorAll('.team')[0].querySelectorAll('.team-players')].map(list => [
      list.getAttribute('aria-label'),
      [...list.querySelectorAll('.player-name')].map(name => name.textContent?.trim())
    ]);

    expect(firstTeamLists).toEqual([
      ['Melee', ['Player10', 'Player11', 'Player12', 'Player13', 'Player14']],
      ['Ranged', ['Player04', 'Player05', 'Player06']],
      ['Healers', ['Player00', 'Player01']]
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
    await tick(harness, element, 20);
    await press(harness, element, '.shuffle');

    await press(harness, element, '.change-players');

    expect(element.querySelectorAll('.team')).toHaveLength(0);
    expect(checkboxes(element).filter(box => box.checked)).toHaveLength(20);
    expect(checkboxes(element)[0].disabled).toBe(false);
    expect(location.path()).toBe('/rated-bg-picker');
  });

  it('Clear unticks everyone', async () => {
    const { harness, element } = await openPage('/rated-bg-picker');
    await tick(harness, element, 5);
    expect(checkboxes(element).filter(box => box.checked)).toHaveLength(5);

    await press(harness, element, '.clear');

    expect(checkboxes(element).filter(box => box.checked)).toHaveLength(0);
  });
});
