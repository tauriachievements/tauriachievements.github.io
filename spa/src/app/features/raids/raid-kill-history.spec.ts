import { describe, expect, it } from 'vitest';
import { KillAppearance, killChart, killHistory, predictedChange, recordChange } from './raid-kill-history';
import { RaidCharacter, RaidKillDetails, RaidMember, RaidSpec } from './raid-logs.types';
import { mythic, nythendra } from './raid-logs.fixture';

const fire: RaidSpec = { id: 63, classId: 8, name: 'Fire', role: 'dps' };
const frost: RaidSpec = { id: 64, classId: 8, name: 'Frost', role: 'dps' };
const holy: RaidSpec = { id: 65, classId: 8, name: 'Holy', role: 'healer' };
const kael: RaidCharacter = { name: 'Kael', realm: 'Tauri', classId: 8, race: 1, gender: 0, guild: '' };

function appearance(logId: number, killedAt: number, dps: number, spec = fire): KillAppearance {
  const member: RaidMember = {
    character: kael,
    spec,
    itemLevel: 870,
    damage: 0,
    healing: 0,
    absorbs: 0,
    overhealing: 0,
    damageTaken: 0,
    interrupts: 0,
    dispels: 0,
    dps,
    hps: dps / 10,
    talents: '',
    trinkets: []
  };
  const kill: RaidKillDetails = {
    realm: 'Tauri',
    logId,
    boss: nythendra,
    difficulty: mythic,
    killedAt,
    fightMs: 300_000,
    faction: 1,
    wipes: 0,
    deaths: 0,
    resurrects: 0,
    members: [member],
    items: []
  };
  return { kill, member };
}

const logIds = (kills: readonly { kill: RaidKillDetails }[]) => kills.map(({ kill }) => kill.logId);

describe('killHistory', () => {
  it('lists the kills that count for the metric, oldest first', () => {
    const history = killHistory([
      appearance(3, 3_000, 500),
      appearance(1, 1_000, 400),
      appearance(2, 2_000, 0, holy)
    ], 'dps');

    expect(logIds(history.kills)).toEqual([1, 3]);
    expect(history.kills.map(kill => kill.value)).toEqual([400, 500]);
  });

  it('measures healing on the healing kills only', () => {
    const history = killHistory([appearance(1, 1_000, 400), appearance(2, 2_000, 5_000, holy)], 'hps');

    expect(logIds(history.kills)).toEqual([2]);
    expect(history.best?.value).toBe(500);
  });

  it('keeps only the kills played as the spec when one is given', () => {
    const history = killHistory([appearance(1, 1_000, 400), appearance(2, 2_000, 800, frost)], 'dps', 63);

    expect(logIds(history.kills)).toEqual([1]);
  });

  it('picks the best kill, the earlier on a tie', () => {
    const history = killHistory([appearance(1, 1_000, 600), appearance(2, 2_000, 600)], 'dps');

    expect(history.best?.kill.logId).toBe(1);
  });

  it('compares the latest kill with the best kill before it', () => {
    const lower = killHistory([appearance(1, 1_000, 400), appearance(2, 2_000, 600), appearance(3, 3_000, 500)], 'dps');
    const higher = killHistory([appearance(1, 1_000, 400), appearance(2, 2_000, 600), appearance(3, 3_000, 750)], 'dps');

    expect(lower.check && [lower.check.latest.kill.logId, lower.check.record.kill.logId]).toEqual([3, 2]);
    expect(lower.check?.change).toBeCloseTo(-1 / 6);
    expect(higher.check && [higher.check.latest.kill.logId, higher.check.record.kill.logId]).toEqual([3, 2]);
    expect(higher.check?.change).toBeCloseTo(.25);
  });

  it('has nothing to compare before a second kill', () => {
    expect(killHistory([appearance(1, 1_000, 400)], 'dps').check).toBeUndefined();
    expect(killHistory([], 'dps')).toEqual({ kills: [], best: undefined, check: undefined });
  });
});

describe('killHistory prediction', () => {
  const trendOf = (values: number[]) =>
    killHistory(values.map((value, index) => appearance(index, index * 1_000, value)), 'dps').trend;
  const predictionOf = (values: number[]) => trendOf(values)?.next;

  it('continues the best-fit line through the kills by one kill', () => {
    expect(predictionOf([400, 500, 600])).toBeCloseTo(700);
    expect(predictionOf([560, 575, 590, 610, 600, 640])).toBeCloseTo(645.33);
  });

  it('follows the last six kills only', () => {
    expect(predictionOf([2_000, 2_000, 400, 500, 600, 700, 800, 900])).toBeCloseTo(1_000);
  });

  it('gives the line from the first kill it fits, where the line passes that kill', () => {
    const trend = trendOf([2_000, 2_000, 400, 500, 600, 700, 800, 900]);
    const scattered = trendOf([330, 550, 440]);

    expect(trend?.from).toBe(2);
    expect(trend?.start).toBeCloseTo(400);
    expect(scattered?.from).toBe(0);
    expect(scattered?.start).toBeCloseTo(385);
    expect(scattered?.next).toBeCloseTo(550);
  });

  it('waits for a third kill', () => {
    expect(predictionOf([400, 500])).toBeUndefined();
    expect(predictionOf([])).toBeUndefined();
  });

  it('never predicts below zero', () => {
    expect(predictionOf([600, 300, 100])).toBe(0);
  });

  it('predicts from the kills that count, as the spec when one is given', () => {
    const history = killHistory([
      appearance(1, 1_000, 400),
      appearance(2, 2_000, 9_000, frost),
      appearance(3, 3_000, 500),
      appearance(4, 4_000, 600)
    ], 'dps', 63);

    expect(history.trend?.next).toBeCloseTo(700);
  });
});

describe('predictedChange', () => {
  const historyOf = (values: number[]) =>
    killHistory(values.map((value, index) => appearance(index, index * 1_000, value)), 'dps');

  it('measures the predicted next kill against the PR', () => {
    expect(predictedChange(historyOf([400, 500, 600]))).toBeCloseTo(1 / 6);
    expect(predictedChange(historyOf([500, 800, 600]))).toBeCloseTo(-1 / 12);
    expect(predictedChange(historyOf([600, 500, 400]))).toBeCloseTo(-.5);
  });

  it('has nothing to measure before a third kill', () => {
    expect(predictedChange(historyOf([400, 500]))).toBeUndefined();
  });
});

describe('recordChange', () => {
  it('rounds to a whole percent, with an arrow for the way it went', () => {
    expect(recordChange(.44)).toEqual({ trend: 'up', label: '▲ 44%', amount: '44%' });
    expect(recordChange(-.2207)).toEqual({ trend: 'down', label: '▼ 22%', amount: '22%' });
  });

  it('keeps a change under half a percent on its side', () => {
    expect(recordChange(.003)).toEqual({ trend: 'up', label: '▲ <1%', amount: 'less than 1%' });
    expect(recordChange(-.004)).toEqual({ trend: 'down', label: '▼ <1%', amount: 'less than 1%' });
    expect(recordChange(0)).toEqual({ trend: 'flat', label: '±0%', amount: '0%' });
  });
});

describe('killChart', () => {
  const chartOf = (appearances: KillAppearance[], top = 1_000, maxLabels = 12) =>
    killChart(killHistory(appearances, 'dps'), top, 63, maxLabels)!;

  it('gives every kill a column of its own, oldest on the left', () => {
    const chart = chartOf([appearance(1, 1_000, 550), appearance(2, 2_000, 440), appearance(3, 3_000, 880)]);

    expect(chart.viewBox).toBe('0 0 3 100');
    expect(chart.line).toBe('0.5,50.00 1.5,60.00 2.5,20.00');
    expect(chart.area).toBe('0.5,100 0.5,50.00 1.5,60.00 2.5,20.00 2.5,100');
  });

  it('scales against the best anyone did, with room above it', () => {
    const chart = chartOf([appearance(1, 1_000, 550)]);

    expect(chart.topBottom).toBeCloseTo(100 / 1.1);
    expect(chart.points[0].bottom).toBeCloseTo(50);
  });

  it('draws no line for a single kill', () => {
    const chart = chartOf([appearance(1, 1_000, 550)]);

    expect([chart.viewBox, chart.line, chart.area]).toEqual(['0 0 1 100', '', '']);
  });

  it('colours each kill by its share of the best, and marks the best and the off-spec kills', () => {
    const chart = chartOf([appearance(1, 1_000, 500), appearance(2, 2_000, 960, frost), appearance(3, 3_000, 800)]);

    expect(chart.points.map(point => [point.relative, point.quality, point.best, point.offSpec])).toEqual([
      [.5, 3, false, false],
      [.96, 5, true, true],
      [.8, 4, false, false]
    ]);
  });

  it('runs the PR line from the PR to the latest kill, its label under a lower kill', () => {
    const lower = chartOf([appearance(1, 1_000, 330), appearance(2, 2_000, 770), appearance(3, 3_000, 550)]);
    const higher = chartOf([appearance(1, 1_000, 770), appearance(2, 2_000, 330), appearance(3, 3_000, 880)]);

    expect(lower.record).toEqual({ from: 1.5, to: 2.5, y: 30, latest: 2, below: true });
    expect(higher.record).toEqual({ from: 0.5, to: 2.5, y: 30, latest: 2, below: false });
  });

  it('puts the label over a lower kill that sits too near the bottom for one under it', () => {
    const chart = chartOf([appearance(1, 1_000, 770), appearance(2, 2_000, 110)]);

    expect(chart.record?.below).toBe(false);
  });

  it('labels every kill when they fit, else an even spread from the first to the last', () => {
    const many = Array.from({ length: 13 }, (_, index) => appearance(index, index * 1_000, 500));

    expect(chartOf(many.slice(0, 4), 1_000, 5).points.map(point => point.showLabel)).toEqual([true, true, true, true]);
    expect(chartOf(many, 1_000, 5).points.flatMap((point, index) => point.showLabel ? [index] : [])).toEqual([0, 3, 6, 9, 12]);
  });

  it('opens the right half\'s tooltips to the left and lines the end columns up with the edges', () => {
    const chart = chartOf([appearance(1, 1_000, 500), appearance(2, 2_000, 500), appearance(3, 3_000, 500), appearance(4, 4_000, 500)]);

    expect(chart.points.map(point => [point.flip, point.edge])).toEqual([
      [false, 'start'], [false, undefined], [true, undefined], [true, 'end']
    ]);
    expect(chartOf([appearance(1, 1_000, 500)]).points.map(point => [point.flip, point.edge])).toEqual([[false, undefined]]);
  });

  it('puts the best-anyone label on the side the kills leave clear', () => {
    expect(chartOf([appearance(1, 1_000, 500), appearance(2, 2_000, 950)]).referenceSide).toBe('left');
    expect(chartOf([appearance(1, 1_000, 950), appearance(2, 2_000, 980)]).referenceSide).toBe('below');
    expect(chartOf([appearance(1, 1_000, 950), appearance(2, 2_000, 500)]).referenceSide).toBe('right');
    expect(chartOf([appearance(1, 1_000, 1_000)]).referenceSide).toBe('right');
  });

  it('has no chart without kills', () => {
    expect(killChart(killHistory([], 'dps'), 1_000, 63, 12)).toBeUndefined();
  });
});

describe('killChart with a prediction', () => {
  const predicted = (appearances: KillAppearance[], top = 1_000) =>
    killChart(killHistory(appearances, 'dps'), top, 63, 12, true)!;

  it('adds the predicted next kill as a column after the latest, its line dashed on from it', () => {
    const chart = predicted([appearance(1, 1_000, 330), appearance(2, 2_000, 440), appearance(3, 3_000, 550)]);

    expect([chart.columns, chart.viewBox, chart.line]).toEqual([4, '0 0 4 100', '0.5,70.00 1.5,60.00 2.5,50.00']);
    expect(chart.area).toBe('0.5,100 0.5,70.00 1.5,60.00 2.5,50.00 2.5,100');
    expect(chart.prediction).toMatchObject({ quality: 3, line: '2.5,50.00 3.5,40.00' });
    expect(chart.prediction?.value).toBeCloseTo(660);
    expect(chart.prediction?.bottom).toBeCloseTo(60);
    expect(chart.prediction?.relative).toBeCloseTo(.66);
  });

  it('draws the trend line from the first kill it fits to the prediction', () => {
    const scattered = predicted([appearance(1, 1_000, 330), appearance(2, 2_000, 550), appearance(3, 3_000, 440)]);
    const long = predicted([990, 330, 440, 550, 660, 770, 880].map((dps, index) => appearance(index, index * 1_000, dps)));

    expect(scattered.prediction?.trend).toBe('0.5,65.00 3.5,50.00');
    expect(long.prediction?.trend).toBe('1.5,70.00 7.5,10.00');
  });

  it('leaves the end of the chart and the right half to the prediction', () => {
    const chart = predicted([appearance(1, 1_000, 330), appearance(2, 2_000, 440), appearance(3, 3_000, 550)]);

    expect(chart.points.map(point => [point.flip, point.edge])).toEqual([[false, 'start'], [false, undefined], [true, undefined]]);
  });

  it('makes room for a prediction above the best anyone did', () => {
    const chart = predicted([appearance(1, 1_000, 800), appearance(2, 2_000, 900), appearance(3, 3_000, 1_000)]);

    expect(chart.prediction?.bottom).toBeCloseTo(100 / 1.1);
    expect(chart.topBottom).toBeCloseTo(1_000 / 1_210 * 100);
  });

  it('puts the best-anyone label on the right when the prediction leaves it clear', () => {
    const falling = [appearance(1, 1_000, 950), appearance(2, 2_000, 900), appearance(3, 3_000, 850)];

    expect(predicted(falling).referenceSide).toBe('right');
    expect(killChart(killHistory(falling, 'dps'), 1_000, 63, 12)!.referenceSide).toBe('below');
  });

  it('has no prediction column before a third kill, or when predictions are off', () => {
    const two = predicted([appearance(1, 1_000, 330), appearance(2, 2_000, 440)]);
    const off = killChart(killHistory([appearance(1, 1_000, 330), appearance(2, 2_000, 440), appearance(3, 3_000, 550)], 'dps'), 1_000, 63, 12)!;

    expect([two.columns, two.viewBox, two.prediction]).toEqual([2, '0 0 2 100', undefined]);
    expect([off.columns, off.viewBox, off.prediction]).toEqual([3, '0 0 3 100', undefined]);
  });
});
