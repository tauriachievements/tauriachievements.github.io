import { describe, expect, it } from 'vitest';
import { MythicPlusDungeon, MythicPlusMember, MythicPlusRun, characterKey, rankPlayers } from './mythic-plus';
import {
  DAY_MS,
  baselineCutoff,
  describeMovement,
  exportOf,
  formatVisitTime,
  lastVisitCutoff,
  lastVisitParts,
  lastVisitSummary,
  movementLabel,
  movementTone,
  parseCharacterKey,
  parseSeenExport,
  rankIndex,
  rankMovement,
  runsUpTo,
  safeStorage,
  shouldMarkSeen
} from './mythic-plus-movement';

function dungeon(id: string, timerSeconds = 1800): MythicPlusDungeon {
  return { id, challengeId: 0, shortName: id.toUpperCase(), name: id, timerSeconds, icon: '', runCount: 0, bestScore: 0 };
}

const dungeons = [dungeon('cos'), dungeon('dht'), dungeon('nl')];

function member(name: string, role: MythicPlusMember['role'] = 'dps', classId = 10, spec = 'Windwalker'): MythicPlusMember {
  return { name, realm: 'Evermoon', class: classId, race: 1, gender: 0, spec, role };
}

const EXPORTED = Date.UTC(2026, 9, 8, 13, 0, 0);
const HOUR = 60 * 60 * 1000;

let nextId = 0;
/** A run `hoursAgo` hours before the export. Timed unless `clear` is over the 1800 s timer. */
function run(dungeonId: string, keyLevel: number, score: number, hoursAgo: number, roster: MythicPlusMember[], clear = 1500): MythicPlusRun {
  return {
    id: `${dungeonId}-${++nextId}`,
    dungeon: dungeonId,
    keyLevel,
    clearTimeSeconds: clear,
    score,
    completedAt: new Date(EXPORTED - hoursAgo * HOUR).toISOString(),
    affixes: [],
    roster
  };
}

const progtrix = member('Progtrix', 'tank');
const napim = member('Napim');
const fellicia = member('Fellicia', 'healer', 9, 'Affliction');
const exkeito = member('Exkeito', 'dps', 11, 'Balance');

describe('baselineCutoff', () => {
  it('takes the 24 h baseline a day before the export', () => {
    expect(baselineCutoff('day', EXPORTED, undefined)).toBe(EXPORTED - DAY_MS);
  });

  it('takes the reset baseline just before the week began, and none without a week', () => {
    expect(baselineCutoff('reset', EXPORTED, 5000)).toBe(4999);
    expect(baselineCutoff('reset', EXPORTED, undefined)).toBeUndefined();
  });
});

describe('runsUpTo', () => {
  it('keeps runs finished at or before the cutoff', () => {
    const runs = [run('cos', 10, 100, 30, [napim]), run('cos', 10, 100, 24, [napim]), run('cos', 10, 100, 23, [napim])];
    expect(runsUpTo(runs, EXPORTED - DAY_MS)).toEqual(runs.slice(0, 2));
  });
});

describe('baseline ranking and rank movement', () => {
  // A day ago: Napim 200, Progtrix 150. Since then Progtrix timed a better key and Fellicia
  // played her first run.
  const runs = [
    run('cos', 15, 200, 30, [napim]),
    run('cos', 12, 150, 28, [progtrix]),
    run('dht', 16, 210, 3, [progtrix]),
    run('nl', 10, 120, 2, [fellicia])
  ];
  const now = rankPlayers(runs);
  const before = rankIndex(rankPlayers(runsUpTo(runs, EXPORTED - DAY_MS)));
  const movementOf = (key: string) => {
    const position = now.findIndex(player => player.key === key);
    return rankMovement(position + 1, now[position].score, before.get(key));
  };

  it('ranks the leaderboard as it was at the baseline', () => {
    expect([...before]).toEqual([
      [characterKey(napim), { rank: 1, score: 200 }],
      [characterKey(progtrix), { rank: 2, score: 150 }]
    ]);
  });

  it('counts places climbed and dropped, with the score gained', () => {
    expect(movementOf(characterKey(progtrix))).toEqual({ places: 1, isNew: false, gained: 210, previousRank: 2 });
    expect(movementOf(characterKey(napim))).toEqual({ places: -1, isNew: false, gained: 0, previousRank: 1 });
  });

  it('marks a character who was not ranked at the baseline as new', () => {
    expect(movementOf(characterKey(fellicia))).toEqual({ places: 0, isNew: true, gained: 120 });
  });

  it('compares filtered ranks with filtered ranks', () => {
    const monks = (entry: MythicPlusMember) => entry.class === 10;
    const nowMonks = rankPlayers(runs, monks);
    const beforeMonks = rankIndex(rankPlayers(runsUpTo(runs, EXPORTED - DAY_MS), monks));
    const position = nowMonks.findIndex(player => player.key === characterKey(progtrix));
    expect(rankMovement(position + 1, nowMonks[position].score, beforeMonks.get(characterKey(progtrix))).places).toBe(1);
    expect(beforeMonks.has(characterKey(fellicia))).toBe(false);
  });

  it('rounds the score gained to one decimal', () => {
    expect(rankMovement(3, 300.3, { rank: 3, score: 100.1 }).gained).toBe(200.2);
  });
});

describe('movement labels', () => {
  it('shows arrows, NEW, and nothing for no change', () => {
    expect(movementLabel({ places: 12, isNew: false, gained: 1 })).toBe('▲12');
    expect(movementLabel({ places: -3, isNew: false, gained: 0 })).toBe('▼3');
    expect(movementLabel({ places: 0, isNew: false, gained: 0 })).toBe('');
    expect(movementLabel({ places: 0, isNew: true, gained: 90 })).toBe('NEW');
    expect(movementTone({ places: 0, isNew: true, gained: 90 })).toBe('new');
    expect(movementTone({ places: -1, isNew: false, gained: 0 })).toBe('down');
  });

  it('describes the move and the score change for tooltips and screen readers', () => {
    expect(describeMovement({ places: 12, isNew: false, gained: 12.4, previousRank: 24 }, 'day'))
      .toBe('Up 12 places in the last 24 hours (was #24), +12.4 score');
    expect(describeMovement({ places: -1, isNew: false, gained: 0, previousRank: 5 }, 'reset'))
      .toBe('Down 1 place since the weekly reset (was #5)');
    expect(describeMovement({ places: 0, isNew: true, gained: 90 }, 'day'))
      .toBe('New on the leaderboard in the last 24 hours, +90.0 score');
  });
});

describe('safeStorage', () => {
  const memory = () => {
    const values = new Map<string, string>();
    return {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => void values.set(key, value),
      removeItem: (key: string) => void values.delete(key)
    };
  };

  it('reads, writes and removes when storage works', () => {
    const store = memory();
    const storage = safeStorage(() => store);
    expect(storage.set('a', '1')).toBe(true);
    expect(storage.get('a')).toBe('1');
    storage.remove('a');
    expect(storage.get('a')).toBeUndefined();
  });

  it('acts as empty when even reaching storage throws (blocked site data)', () => {
    const storage = safeStorage(() => {
      throw new DOMException('The operation is insecure.', 'SecurityError');
    });
    expect(storage.get('a')).toBeUndefined();
    expect(storage.set('a', '1')).toBe(false);
    expect(() => storage.remove('a')).not.toThrow();
  });

  it('reports a failed write (private mode, full quota)', () => {
    const storage = safeStorage(() => ({
      getItem: () => null,
      setItem: () => {
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      },
      removeItem: () => {
        throw new Error('nope');
      }
    }));
    expect(storage.set('a', '1')).toBe(false);
    expect(() => storage.remove('a')).not.toThrow();
  });

  it('acts as empty without storage at all', () => {
    const storage = safeStorage(() => undefined);
    expect(storage.get('a')).toBeUndefined();
    expect(storage.set('a', '1')).toBe(false);
  });
});

describe('the export a visitor last saw', () => {
  const seen = (generatedAt: string, season = 'legion-s1') => ({ season, generatedAt });

  it('reads a stored export and ignores anything else', () => {
    expect(parseSeenExport('{"season":"legion-s1","generatedAt":"2026-10-06T21:03:00Z"}'))
      .toEqual(seen('2026-10-06T21:03:00Z'));
    expect(parseSeenExport(undefined)).toBeUndefined();
    expect(parseSeenExport('not json')).toBeUndefined();
    expect(parseSeenExport('null')).toBeUndefined();
    expect(parseSeenExport('{"season":"legion-s1"}')).toBeUndefined();
    expect(parseSeenExport('{"season":"legion-s1","generatedAt":"yesterday"}')).toBeUndefined();
  });

  it('takes the export of an index, unless it has no timestamp', () => {
    const season = { id: 'legion-s1', name: '', raid: '', startDate: '' };
    expect(exportOf({ season, generatedAt: '2026-10-08T13:00:00Z' })).toEqual(seen('2026-10-08T13:00:00Z'));
    expect(exportOf({ season })).toBeUndefined();
    expect(exportOf(undefined)).toBeUndefined();
  });

  it('cuts off at the seen export when it is an earlier one of the same season', () => {
    expect(lastVisitCutoff(seen('2026-10-06T21:03:00Z'), seen('2026-10-08T13:00:00Z'))).toBe(Date.UTC(2026, 9, 6, 21, 3));
  });

  it('has no line for a first visit, the same export, a newer one or another season', () => {
    const current = seen('2026-10-08T13:00:00Z');
    expect(lastVisitCutoff(undefined, current)).toBeUndefined();
    expect(lastVisitCutoff(current, current)).toBeUndefined();
    expect(lastVisitCutoff(seen('2026-10-09T13:00:00Z'), current)).toBeUndefined();
    expect(lastVisitCutoff(seen('2026-10-06T21:03:00Z', 'legion-s0'), current)).toBeUndefined();
  });

  it('stores a newer export as seen, never an older one', () => {
    const current = seen('2026-10-08T13:00:00Z');
    expect(shouldMarkSeen(undefined, current)).toBe(true);
    expect(shouldMarkSeen(seen('2026-10-06T21:03:00Z'), current)).toBe(true);
    expect(shouldMarkSeen(current, current)).toBe(false);
    expect(shouldMarkSeen(seen('2026-10-09T13:00:00Z'), current)).toBe(false);
    expect(shouldMarkSeen(undefined, undefined)).toBe(false);
  });
});

describe('lastVisitSummary', () => {
  const since = EXPORTED - 40 * HOUR;
  // Before the visit: the season's top timed key was a +18 COS by Napim's group.
  const seenRuns = [
    run('cos', 18, 230, 50, [progtrix, napim]),
    run('dht', 15, 200, 48, [napim]),
    run('nl', 12, 160, 45, [progtrix])
  ];

  it('is undefined when no run finished since the visit', () => {
    expect(lastVisitSummary(seenRuns, dungeons, since, characterKey(progtrix))).toBeUndefined();
  });

  it('is undefined when the new runs changed nothing worth a line', () => {
    const runs = [...seenRuns, run('cos', 4, 80, 5, [exkeito], 2000)];
    expect(lastVisitSummary(runs, dungeons, since)).toBeUndefined();
  });

  it("reports the saved character's move, a new top key, new keys where they play and fallen records", () => {
    const runs = [
      ...seenRuns,
      run('dht', 20, 260, 10, [fellicia, exkeito]), // new top key; DHT record falls
      run('nl', 14, 180, 8, [exkeito]), // new top NL key, Progtrix plays NL; record falls
      run('cos', 18, 231, 6, [exkeito], 1400), // faster +18 COS: record falls, level unchanged
      run('cos', 3, 300, 4, [exkeito, fellicia], 1700) // lifts both past Progtrix
    ];

    const summary = lastVisitSummary(runs, dungeons, since, characterKey(progtrix));

    expect(summary?.me?.rank).toBe(4);
    expect(summary?.me?.movement).toMatchObject({ places: -2, previousRank: 2 });
    expect(summary?.topKey).toMatchObject({ keyLevel: 20, mine: false });
    expect(summary?.topKey?.dungeon.id).toBe('dht');
    expect(summary?.topKey?.leader.name).toBe('Fellicia'); // the healer leads a group without a tank
    expect(summary?.playedKeys.map(key => `${key.dungeon.id}+${key.keyLevel}`)).toEqual(['nl+14']);
    expect(summary?.recordsFell).toBe(3);
    expect(lastVisitParts(summary!)).toEqual([
      'you dropped ▼2 (#2 → #4)',
      "Fellicia's group timed the first +20 (DHT)",
      'new top key where you play: NL +14',
      '3 dungeon records fell'
    ]);
  });

  it("says 'your group' for the saved character's own top key, and 'new' for their first run", () => {
    const runs = [...seenRuns, run('dht', 19, 250, 3, [exkeito, napim])];
    const summary = lastVisitSummary(runs, dungeons, since, characterKey(exkeito));
    // Napim 480 (COS 230 + DHT 250) and Progtrix 390 stay ahead of Exkeito's 250.
    expect(lastVisitParts(summary!)).toEqual([
      "you're new at #3",
      'your group timed the first +19 (DHT)',
      '1 dungeon record fell'
    ]);
  });

  it('leaves out what needs a saved character without one', () => {
    const runs = [...seenRuns, run('nl', 14, 180, 8, [exkeito])];
    const summary = lastVisitSummary(runs, dungeons, since);
    expect(summary?.me).toBeUndefined();
    expect(summary?.playedKeys).toEqual([]);
    expect(lastVisitParts(summary!)).toEqual(['1 dungeon record fell']);
  });
});

describe('formatVisitTime', () => {
  it('names the weekday within six days and the date before that', () => {
    const tuesday = new Date(2026, 9, 6, 21, 3).getTime();
    expect(formatVisitTime(tuesday, tuesday + 2 * DAY_MS)).toBe('Tue 21:03');
    expect(formatVisitTime(tuesday, tuesday + 8 * DAY_MS)).toBe('6 Oct, 21:03');
  });
});

describe('parseCharacterKey', () => {
  it('splits a saved key and rejects broken ones', () => {
    expect(parseCharacterKey('Progtrix|Evermoon')).toEqual({ name: 'Progtrix', realm: 'Evermoon' });
    expect(parseCharacterKey('M#2124685|Tauri')).toEqual({ name: 'M#2124685', realm: 'Tauri' });
    expect(parseCharacterKey('Progtrix')).toBeUndefined();
    expect(parseCharacterKey('|Evermoon')).toBeUndefined();
    expect(parseCharacterKey('Progtrix|')).toBeUndefined();
    expect(parseCharacterKey(undefined)).toBeUndefined();
  });
});
