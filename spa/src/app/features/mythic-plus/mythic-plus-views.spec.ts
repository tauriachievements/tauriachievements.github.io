import { describe, expect, it } from 'vitest';
import { MythicPlusDungeon, MythicPlusRun } from './mythic-plus';
import { bestRunCells } from './mythic-plus-views';

function dungeon(id: string): MythicPlusDungeon {
  return { id, challengeId: 1, shortName: id.toUpperCase(), name: id, timerSeconds: 1800, icon: '', runCount: 1, bestScore: 0 };
}

function run(dungeonId: string, keyLevel: number, completedAt: string): MythicPlusRun {
  return {
    id: `${dungeonId}-1`, dungeon: dungeonId, keyLevel, clearTimeSeconds: 1500, score: 100 + keyLevel,
    completedAt, affixes: [], roster: []
  };
}

describe('bestRunCells', () => {
  const dungeons = [dungeon('nl'), dungeon('dht'), dungeon('cos')];
  const bestRuns = new Map([
    ['nl', run('nl', 21, '2026-10-30T20:11:37.000Z')],
    ['dht', run('dht', 20, '2026-10-30T17:41:00.000Z')]
  ]);

  it('marks the best runs finished after the last scan as the ones that raised the score', () => {
    expect(bestRunCells(bestRuns, dungeons, '2026-10-30T17:43:31Z').map(cell => cell?.raisedScore))
      .toEqual([true, false, undefined]);
  });

  it('marks no run when there is no score gain to explain', () => {
    expect(bestRunCells(bestRuns, dungeons).map(cell => cell?.raisedScore)).toEqual([false, false, undefined]);
  });
});
