import { describe, expect, it } from 'vitest';
import { MythicPlusDungeon, MythicPlusMember, MythicPlusRun } from './mythic-plus';
import { bestRunCells, scoreGains } from './mythic-plus-views';

function dungeon(id: string): MythicPlusDungeon {
  return { id, challengeId: 1, shortName: id.toUpperCase(), name: id, timerSeconds: 1800, icon: '', runCount: 1, bestScore: 0 };
}

function member(name: string, realm = 'Evermoon'): MythicPlusMember {
  return { name, realm, class: 1, race: 1, gender: 0, spec: 'Arms', role: 'dps' };
}

function run(
  dungeonId: string,
  keyLevel: number,
  completedAt: string,
  roster: MythicPlusMember[] = [],
  clearTimeSeconds = 1500
): MythicPlusRun {
  return {
    id: `${dungeonId}-${keyLevel}-${completedAt}`, dungeon: dungeonId, keyLevel, clearTimeSeconds, score: 100 + keyLevel,
    completedAt, affixes: [], roster
  };
}

describe('bestRunCells', () => {
  const dungeons = [dungeon('nl'), dungeon('dht'), dungeon('cos')];
  const bestRuns = new Map([
    ['nl', run('nl', 21, '2026-10-30T20:11:37.000Z')],
    ['dht', run('dht', 20, '2026-10-30T17:41:00.000Z')]
  ]);

  it('marks the best runs finished after the last scan as the ones that raised the score', () => {
    expect(bestRunCells(bestRuns, dungeons, { since: '2026-10-30T17:43:31Z', earlierBests: new Map() })
      .map(cell => cell?.raisedScore)).toEqual([true, false, undefined]);
  });

  it('marks no run when there is no score gain to explain', () => {
    expect(bestRunCells(bestRuns, dungeons).map(cell => cell?.raisedScore)).toEqual([false, false, undefined]);
  });

  it('names the best key each raised key replaced', () => {
    const earlierBests = new Map([
      ['nl', run('nl', 20, '2026-10-21T19:00:00.000Z', [], 1900)],
      ['dht', run('dht', 19, '2026-10-20T19:00:00.000Z')]
    ]);
    const cells = bestRunCells(bestRuns, dungeons, { since: '2026-10-30T17:43:31Z', earlierBests });

    expect(cells.map(cell => cell?.previousBest)).toEqual([
      { keyLevel: 20, timed: false, score: 120 },
      undefined,
      undefined
    ]);
  });
});

describe('scoreGains', () => {
  const since = '2026-10-30T17:43:31Z';
  const pretz = member('Pretz');
  const twin = member('Pretz', 'Tauri');
  const other = member('Chekic');
  const runs = [
    run('nl', 18, '2026-10-20T19:00:00.000Z', [pretz, other]),
    run('nl', 20, '2026-10-25T19:00:00.000Z', [pretz]),
    run('nl', 22, '2026-10-30T19:00:00.000Z', [pretz]),
    run('dht', 17, '2026-10-30T17:43:31.000Z', [pretz, twin]),
    run('dht', 19, '2026-10-22T19:00:00.000Z', [other])
  ];

  it('finds each gaining player\'s best run per dungeon from before the last scan', () => {
    const gains = scoreGains(runs, [pretz], since);

    expect([...gains.keys()]).toEqual(['Pretz|Evermoon']);
    const pretzGain = gains.get('Pretz|Evermoon');
    expect(pretzGain?.since).toBe(since);
    expect([...(pretzGain?.earlierBests ?? new Map())].map(([id, best]) => [id, best.keyLevel])).toEqual([
      ['nl', 20],
      ['dht', 17]
    ]);
  });

  it('keeps characters of the same name on different realms apart', () => {
    expect([...(scoreGains(runs, [twin], since).get('Pretz|Tauri')?.earlierBests.keys() ?? [])]).toEqual(['dht']);
  });

  it('finds nothing without a previous scan or a gaining player', () => {
    expect(scoreGains(runs, [pretz], undefined).size).toBe(0);
    expect(scoreGains(runs, [], since).size).toBe(0);
  });
});
