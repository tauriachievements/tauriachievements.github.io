import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { MythicPlusMember, MythicPlusRun } from './mythic-plus';
import { MythicPlusSpecChartComponent } from './mythic-plus-spec-chart.component';
import { FilterDropdownCoordinatorService } from '../../shared/filter-dropdown-coordinator.service';

function run(id: string, keyLevel: number, spec: string): MythicPlusRun {
  return {
    id,
    dungeon: 'brh',
    keyLevel,
    clearTimeSeconds: 1800,
    score: 100,
    completedAt: '2026-10-01T20:00:00Z',
    affixes: [],
    roster: [{ name: `Healer${id}`, realm: 'Evermoon', class: 11, race: 4, gender: 0, spec, role: 'healer' }]
  };
}

function mage(name: string, spec: string): MythicPlusMember {
  return { name, realm: 'Evermoon', class: 8, race: 1, gender: 0, spec, role: 'dps', range: 'ranged' };
}

function druid(name: string): MythicPlusMember {
  return { name, realm: 'Evermoon', class: 11, race: 4, gender: 0, spec: 'Restoration', role: 'healer' };
}

function scored(id: string, dungeon: string, keyLevel: number, score: number, roster: MythicPlusMember[]): MythicPlusRun {
  return { id, dungeon, keyLevel, clearTimeSeconds: 1800, score, completedAt: '2026-10-01T20:00:00Z', affixes: [], roster };
}

describe('MythicPlusSpecChartComponent', () => {
  it('counts only keys at or above the chosen level', async () => {
    await TestBed.configureTestingModule({ imports: [MythicPlusSpecChartComponent], providers: [FilterDropdownCoordinatorService] }).compileComponents();
    const fixture = TestBed.createComponent(MythicPlusSpecChartComponent);
    fixture.componentRef.setInput('runs', [run('a', 4, 'Restoration'), run('b', 10, 'Restoration'), run('c', 15, 'Restoration')]);
    const chart = fixture.componentInstance;

    expect(chart.popularity().runCount).toBe(3);
    expect(chart.subtitle()).toContain('All keys');

    chart.minLevel.set(10);
    expect(chart.popularity().runCount).toBe(2);
    expect(chart.subtitle()).toContain('Keys +10 and higher');

    chart.minLevel.set(15);
    expect(chart.popularity().total).toBe(1);
  });

  it('resets role, key level and count mode in one click', async () => {
    await TestBed.configureTestingModule({ imports: [MythicPlusSpecChartComponent], providers: [FilterDropdownCoordinatorService] }).compileComponents();
    const fixture = TestBed.createComponent(MythicPlusSpecChartComponent);
    fixture.componentRef.setInput('runs', [run('a', 4, 'Restoration')]);
    const chart = fixture.componentInstance;

    expect(chart.isFiltered()).toBe(false);

    chart.role.set('healer');
    chart.minLevel.set(10);
    chart.countMode.set('characters');
    expect(chart.isFiltered()).toBe(true);

    chart.resetFilters();
    expect([chart.role(), chart.minLevel(), chart.countMode()]).toEqual([undefined, 0, 'runs']);
    expect(chart.isFiltered()).toBe(false);
  });

  it('selects the class and spec represented by a clicked bar', async () => {
    await TestBed.configureTestingModule({ imports: [MythicPlusSpecChartComponent], providers: [FilterDropdownCoordinatorService] }).compileComponents();
    const fixture = TestBed.createComponent(MythicPlusSpecChartComponent);
    fixture.componentRef.setInput('runs', [run('a', 10, 'Restoration')]);
    const selections: Array<{ classId: number; spec: string }> = [];
    fixture.componentInstance.specSelect.subscribe(selection => selections.push(selection));
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const restorationBar = [...element.querySelectorAll<HTMLButtonElement>('.bar-slot')]
      .find(bar => bar.getAttribute('aria-label')?.startsWith('Show Restoration Druid players'));
    restorationBar?.click();

    expect(selections).toEqual([{ classId: 11, spec: 'Restoration' }]);
  });

  it('switches to Performance, which averages the best leaderboard scores of each spec', async () => {
    await TestBed.configureTestingModule({ imports: [MythicPlusSpecChartComponent], providers: [FilterDropdownCoordinatorService] }).compileComponents();
    const fixture = TestBed.createComponent(MythicPlusSpecChartComponent);
    fixture.componentRef.setInput('runs', [
      scored('a', 'brh', 10, 200, [mage('Spark', 'Fire'), druid('Leaf')]),
      scored('b', 'hov', 10, 150, [mage('Chill', 'Frost'), druid('Leaf')]),
      scored('c', 'brh', 5, 120, [mage('Ember', 'Fire')])
    ]);
    fixture.detectChanges();
    const element = fixture.nativeElement as HTMLElement;
    const chart = fixture.componentInstance;

    const views = [...element.querySelectorAll<HTMLButtonElement>('.view-filter button')];
    expect(views.map(button => button.textContent?.trim())).toEqual(['Popularity', 'Performance']);
    expect(element.querySelector('[aria-label="How characters are counted"]')).not.toBeNull();

    views[1].click();
    fixture.detectChanges();
    expect(chart.view()).toBe('performance');
    expect(element.querySelector('h2')?.textContent).toContain('Spec Performance');
    expect(element.querySelector('[aria-label="How characters are counted"]')).toBeNull();
    expect(chart.plot().groups[0].className).toBe('Druid');
    expect(chart.plot().groups[0].specs[0]).toMatchObject({ spec: 'Restoration', valueLabel: '350' });

    chart.role.set('dps');
    fixture.detectChanges();
    const mageGroup = chart.plot().groups[0];
    expect(mageGroup.className).toBe('Mage');
    expect(mageGroup.valueLabel).toBe(String(Math.round((200 + 150 + 120) / 3)));
    expect(mageGroup.specs.map(spec => [spec.spec, spec.valueLabel, spec.count])).toEqual([
      ['Fire', '160', 2],
      ['Frost', '150', 1],
      ['Arcane', '0', 0]
    ]);
    expect(chart.plot().gridlines.map(line => line.label)).toEqual(['0', '100', '200']);
    expect(chart.subtitle()).toContain('3 characters');
    expect(chart.subtitle()).toContain("Each spec's top 10 scores, averaged");

    const fireBar = [...element.querySelectorAll<HTMLButtonElement>('.bar-slot')]
      .find(bar => bar.getAttribute('aria-label')?.startsWith('Show Fire Mage players'));
    expect(fireBar?.getAttribute('aria-label')).toBe('Show Fire Mage players: score 160. Average of all 2 characters');
    expect(fireBar?.textContent).toContain('Best: Spark, 200.0');

    chart.minLevel.set(10);
    expect(chart.plot().groups[0].specs[0]).toMatchObject({ spec: 'Fire', valueLabel: '200', count: 1 });
  });

  it('leaves the count mode out of Reset while Performance hides it', async () => {
    await TestBed.configureTestingModule({ imports: [MythicPlusSpecChartComponent], providers: [FilterDropdownCoordinatorService] }).compileComponents();
    const fixture = TestBed.createComponent(MythicPlusSpecChartComponent);
    fixture.componentRef.setInput('runs', [run('a', 10, 'Restoration')]);
    const chart = fixture.componentInstance;

    chart.countMode.set('characters');
    expect(chart.isFiltered()).toBe(true);

    chart.view.set('performance');
    expect(chart.isFiltered()).toBe(false);

    chart.minLevel.set(10);
    expect(chart.isFiltered()).toBe(true);
  });

  it('highlights the class and spec selected in the players filters', async () => {
    await TestBed.configureTestingModule({ imports: [MythicPlusSpecChartComponent], providers: [FilterDropdownCoordinatorService] }).compileComponents();
    const fixture = TestBed.createComponent(MythicPlusSpecChartComponent);
    fixture.componentRef.setInput('runs', [run('a', 10, 'Restoration')]);
    fixture.componentRef.setInput('selectedClassId', 11);
    fixture.componentRef.setInput('selectedSpec', 'Restoration');
    fixture.detectChanges();

    const element = fixture.nativeElement as HTMLElement;
    const restorationBar = [...element.querySelectorAll<HTMLButtonElement>('.bar-slot')]
      .find(bar => bar.getAttribute('aria-label')?.startsWith('Show Restoration Druid players'));
    const balanceBar = [...element.querySelectorAll<HTMLButtonElement>('.bar-slot')]
      .find(bar => bar.getAttribute('aria-label')?.startsWith('Show Balance Druid players'));

    expect(restorationBar?.classList.contains('filter-match')).toBe(true);
    expect(balanceBar?.classList.contains('filter-match')).toBe(false);
    expect(element.querySelector('.class-label.filter-match')?.textContent).toContain('Druid');
  });
});
