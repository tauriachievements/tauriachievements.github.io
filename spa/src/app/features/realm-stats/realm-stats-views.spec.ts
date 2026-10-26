import { describe, expect, it } from 'vitest';
import { getClassColor } from '../../game/class-colors';
import {
  ALLIANCE_COLOR,
  HORDE_COLOR,
  classAverages,
  classRaceMatrix,
  classRows,
  comboRows,
  distributionColumns,
  factionBalance,
  formatCompact,
  formatPlayedTotal,
  formatRowShare,
  genderSplit,
  guildRows,
  matrixCellText,
  matrixHeat,
  matrixReadout,
  matrixTopCell,
  medianBucket,
  raceRows,
  splitGuildKey,
  statsPageView,
  summaryTiles
} from './realm-stats-views';
import { statsSnapshot } from './realm-stats.fixture';

function matrixCell(key: string) {
  const matrix = classRaceMatrix(statsSnapshot());
  const cell = matrix.groups.flatMap(group => group.races.flatMap(race => race.cells)).find(entry => entry.key === key);
  if (!cell) {
    throw new Error(`No cell ${key}`);
  }
  return { matrix, cell };
}

describe('summaryTiles', () => {
  it('turns the totals into the six headline numbers', () => {
    expect(summaryTiles(statsSnapshot())).toEqual([
      { label: 'Characters', value: '100' },
      { label: 'Guilds', value: '3' },
      { label: 'In a guild', value: '90.0%' },
      { label: 'Median item level', value: '848' },
      { label: 'Female characters', value: '45.0%' },
      { label: 'Played in total', value: '2 years' }
    ]);
  });

  it('counts played time in years, or in days under half a year', () => {
    expect(formatPlayedTotal(8766)).toBe('1 year');
    expect(formatPlayedTotal(4000)).toBe('167 days');
    expect(formatPlayedTotal(20)).toBe('1 day');
  });
});

describe('classRows and raceRows', () => {
  it('lists classes most played first, in class colour, bars against the biggest class', () => {
    const rows = classRows(statsSnapshot());

    expect(rows.map(row => [row.label, row.value, row.detail, row.percent])).toEqual([
      ['Demon Hunter', '50', '50.0%', 100],
      ['Druid', '30', '30.0%', 60],
      ['Warrior', '20', '20.0%', 40]
    ]);
    expect(rows[0].color).toBe(getClassColor(12));
    expect(rows[0].barColor).toBe(getClassColor(12));
  });

  it('tells the Pandaren apart, colours races by faction and shows the gender most of them play', () => {
    const rows = raceRows(statsSnapshot());

    expect(rows.map(row => [row.label, row.barColor])).toEqual([
      ['Blood Elf', HORDE_COLOR],
      ['Night Elf', ALLIANCE_COLOR],
      ['Pandaren (H)', HORDE_COLOR],
      ['Pandaren (A)', ALLIANCE_COLOR]
    ]);
    expect(rows[0].icons).toEqual(['assets/race-icons/10-1.gif']);
    expect(rows[1].icons).toEqual(['assets/race-icons/4-0.gif']);
  });
});

describe('comboRows', () => {
  it('ranks the most played race and class pairs', () => {
    const rows = comboRows(statsSnapshot(), 'popular', 3);

    expect(rows.map(row => [row.rank, row.prefix, row.label, row.value, row.percent])).toEqual([
      [1, 'Blood Elf', 'Demon Hunter', '40', 100],
      [2, 'Night Elf', 'Druid', '20', 50],
      [3, 'Night Elf', 'Demon Hunter', '10', 25]
    ]);
    expect(rows[0].icons).toEqual(['assets/race-icons/10-1.gif', 'assets/class-icons/12.gif']);
  });

  it('ranks the rarest pairs, leaving out any already in the most played list', () => {
    const rows = comboRows(statsSnapshot(), 'rare', 3);

    expect(rows.map(row => [row.prefix, row.label, row.value, row.percent])).toEqual([
      ['Pandaren (A)', 'Druid', '4', 40],
      ['Pandaren (A)', 'Warrior', '6', 60],
      ['Blood Elf', 'Druid', '10', 100]
    ]);
  });
});

describe('classRaceMatrix', () => {
  it('lays every class across and every race down, grouped by faction, dropping an empty group', () => {
    const matrix = classRaceMatrix(statsSnapshot());

    expect(matrix.classes.map(entry => entry.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
    expect(matrix.groups.map(group => group.name)).toEqual(['Alliance', 'Horde']);
    expect(matrix.groups[0].races.map(race => race.label)).toEqual([
      'Human', 'Dwarf', 'Night Elf', 'Gnome', 'Draenei', 'Worgen', 'Pandaren (A)'
    ]);
    expect(matrix.groups[1].races.map(race => race.id)).toEqual([2, 5, 6, 8, 9, 10, 26]);
  });

  it('gives each square its share of everyone, of its class and of its race', () => {
    const { cell } = matrixCell('10:12');

    expect(cell).toMatchObject({ count: 40, ofAll: 0.4, ofClass: 0.8, ofRace: 0.8 });
  });

  it('shades on a square-root scale against the strongest square of the mode', () => {
    const { matrix, cell } = matrixCell('4:11');

    expect(matrix.max).toEqual({ count: 40, class: 0.8, race: 1 });
    expect(matrixHeat(cell, 'count', matrix)).toBeCloseTo(Math.sqrt(0.5));
  });

  it('writes a count, or a whole percentage of the class or race', () => {
    const { cell } = matrixCell('26:1');
    const { cell: empty } = matrixCell('1:4');

    expect(matrixCellText(cell, 'count')).toBe('10');
    expect(matrixCellText(cell, 'class')).toBe('50%');
    expect(matrixCellText(cell, 'race')).toBe('100%');
    expect(matrixCellText(empty, 'count')).toBe('');
    expect(matrixCellText({ ...cell, ofClass: 0.004 }, 'class')).toBe('<1%');
  });

  it('reads out a square, starting on the most played one', () => {
    const matrix = classRaceMatrix(statsSnapshot());
    const top = matrixTopCell(matrix);

    expect(top?.key).toBe('10:12');
    expect(top && matrixReadout(top)).toEqual({
      icons: ['assets/race-icons/10-1.gif', 'assets/class-icons/12.gif'],
      race: 'Blood Elf',
      className: 'Demon Hunter',
      color: getClassColor(12),
      count: '40 characters',
      facts: ['40.0% of all characters', '80.0% of Blood Elf characters', '80.0% of Demon Hunter characters', '62.5% female']
    });
    expect(matrixReadout(matrixCell('1:4').cell)).toMatchObject({ count: 'No characters', facts: [] });
  });
});

describe('factionBalance and genderSplit', () => {
  it('puts the overall Horde share first, then each class most Horde first', () => {
    const balance = factionBalance(statsSnapshot());

    expect([balance.total.label, balance.total.leftText, balance.total.rightText]).toEqual(['All characters', '60%', '40%']);
    expect(balance.rows.map(row => [row.label, row.leftText, row.rightText])).toEqual([
      ['Demon Hunter', '80%', '20%'],
      ['Warrior', '50%', '50%'],
      ['Druid', '33%', '67%']
    ]);
  });

  it('splits female characters by race or by class, the two shares always adding up to 100', () => {
    const byRace = genderSplit(statsSnapshot(), 'race');
    const byClass = genderSplit(statsSnapshot(), 'class');

    expect(byRace.total.leftText).toBe('45%');
    expect(byRace.rows.map(row => [row.label, row.leftText])).toEqual([
      ['Blood Elf', '60%'], ['Night Elf', '40%'], ['Pandaren (H)', '20%'], ['Pandaren (A)', '10%']
    ]);
    expect(byClass.rows.map(row => [row.label, row.leftText, row.rightText])).toEqual([
      ['Demon Hunter', '60%', '40%'], ['Druid', '33%', '67%'], ['Warrior', '25%', '75%']
    ]);
  });
});

describe('classAverages', () => {
  it('starts item level bars below the lowest class so small gaps show, leaving out classes without one', () => {
    const averages = classAverages(statsSnapshot(), 'itemLevel');

    expect(averages.baseline).toBe(810);
    expect(averages.rows.map(row => [row.label, row.value])).toEqual([['Druid', '833.5'], ['Demon Hunter', '822.0']]);
    expect(averages.rows[1].percent).toBeCloseTo((12 / 23.5) * 100);
  });

  it('shows played time in days and points as counts, bars from zero', () => {
    const played = classAverages(statsSnapshot(), 'played');
    const points = classAverages(statsSnapshot(), 'points');

    expect(played.baseline).toBe(0);
    expect(played.rows.map(row => row.value)).toEqual(['30 days', '26 days', '5.0 days']);
    expect(points.rows.map(row => row.value)).toEqual(['3,461', '3,000', '1,256']);
    expect(points.rows[2].percent).toBeCloseTo((1256 / 3461) * 100);
  });
});

describe('distributionColumns', () => {
  it('scales columns to the tallest, gives each its share, and marks the one holding the median', () => {
    const columns = distributionColumns(statsSnapshot().distributions.itemLevel);

    expect(columns.map(column => [column.tick, column.percent, column.shareText, column.highlight])).toEqual([
      ['<840', 40, '20.0%', false],
      ['840', 100, '50.0%', true],
      ['850', 60, '30.0%', false]
    ]);
  });

  it('shortens years to two digits once there are more than twelve', () => {
    const labels = Array.from({ length: 13 }, (_, index) => String(2014 + index));
    const columns = distributionColumns({ labels, counts: labels.map(() => 1) });

    expect(columns[0].tick).toBe('’14');
    expect(distributionColumns(statsSnapshot().distributions.level10Year)[0].tick).toBe('2025');
  });

  it('finds no median in an empty distribution', () => {
    expect(medianBucket([0, 0])).toBe(-1);
    expect(medianBucket([5])).toBe(0);
  });

  it('shortens big counts for the label over a column', () => {
    expect([999, 1000, 1250, 15572].map(formatCompact)).toEqual(['999', '1k', '1.3k', '16k']);
  });

  it('writes a share too small to round to 0.1% as under it, never as 0.0%', () => {
    expect([0, 0.0004, 0.0005, 0.137].map(formatRowShare)).toEqual(['0.0%', '<0.1%', '0.1%', '13.7%']);
  });
});

describe('guildRows', () => {
  it('splits the realm off the guild name and tags it only across realms', () => {
    expect(guildRows(statsSnapshot(), true).map(row => [row.rank, row.label, row.note, row.percent])).toEqual([
      [1, 'Cara Máxima', 'Evermoon', 100],
      [2, 'Outlaws', 'Tauri', 50]
    ]);
    expect(guildRows(statsSnapshot(), false)[0].note).toBeUndefined();
    expect(splitGuildKey('No realm')).toEqual({ name: 'No realm', realm: '' });
  });
});

describe('statsPageView', () => {
  it('shows the realm split only across all realms', () => {
    expect(statsPageView(statsSnapshot(), true).realms.map(realm => [realm.name, realm.label])).toEqual([
      ['Evermoon', '70.0%'], ['Tauri', '30.0%']
    ]);
    expect(statsPageView(statsSnapshot(), false).realms).toEqual([]);
  });
});
