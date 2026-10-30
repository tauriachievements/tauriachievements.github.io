import { describe, expect, it } from 'vitest';
import { clearEndedBy, clearRun, clearSplits, rankClears } from './raid-clears';
import { RaidDifficulty, RaidFullClear, RaidGuild, RaidKill } from './raid-logs.types';
import { logKey } from './raid-logs';
import { index } from './raid-logs.fixture';

const [nythendra, ilgynoth] = index.bosses;
const heroic = index.difficulties[1];
const mythic = index.difficulties[2];
const miracle: RaidGuild = { name: 'Miracle', realm: 'Evermoon', faction: 1, id: 3676 };
const outlaws: RaidGuild = { name: 'Outlaws', realm: 'Tauri', faction: 0, id: 602 };
const unnamed: RaidGuild = { name: '', realm: 'Evermoon', faction: 1, id: 8489 };

let nextLogId = 1;

function kill(killedAtSeconds: number, fightSeconds: number, guild?: RaidGuild, details: Partial<RaidKill> = {}): RaidKill {
  return {
    realm: 'Tauri',
    logId: nextLogId++,
    boss: nythendra,
    difficulty: mythic,
    killedAt: killedAtSeconds * 1000,
    fightMs: fightSeconds * 1000,
    guild,
    faction: guild?.faction ?? 0,
    wipes: 0,
    deaths: 0,
    memberCount: 20,
    ...details
  };
}

function clear(kills: RaidKill[], realm = 'Evermoon', difficulty: RaidDifficulty = mythic): RaidFullClear {
  return { realm, difficulty, kills };
}

function guildClear(guild: RaidGuild, endedAtSeconds: number, clearSeconds: number, difficulty: RaidDifficulty = mythic): RaidFullClear {
  return clear([
    kill(endedAtSeconds - clearSeconds + 60, 60, guild, { difficulty }),
    kill(endedAtSeconds, 120, guild, { boss: ilgynoth, difficulty })
  ], guild.realm, difficulty);
}

describe('clearRun', () => {
  it('times the clear from the pull of its first boss to its last kill, and adds up the wipes', () => {
    const kills = [kill(1_000, 120, miracle, { wipes: 2 }), kill(2_000, 300, miracle, { boss: ilgynoth, wipes: 3 })];

    expect(clearRun(clear(kills))).toMatchObject({
      key: logKey(kills[1]),
      guild: miracle,
      realm: 'Evermoon',
      faction: 1,
      startedAt: 880_000,
      endedAt: 2_000_000,
      clearMs: 1_120_000,
      wipes: 5,
      last: kills[1]
    });
  });

  it('counts for a guild only when the API credits a named guild with every kill', () => {
    expect(clearRun(clear([kill(1_000, 60, miracle), kill(2_000, 60)])).guild).toBeUndefined();
    expect(clearRun(clear([kill(1_000, 60, unnamed), kill(2_000, 60, unnamed)])).guild).toBeUndefined();
  });

  it("takes a guild clear's realm from the guild, and a pickup clear's from its players and the faction of most kills", () => {
    expect(clearRun(clear([kill(1_000, 60, miracle), kill(2_000, 60, miracle)], 'Tauri')).realm).toBe('Evermoon');

    const pickup = clearRun(clear([kill(1_000, 60, undefined, { faction: 1 }), kill(2_000, 60), kill(3_000, 60, undefined, { faction: 1 })], 'Tauri'));
    expect(pickup).toMatchObject({ guild: undefined, realm: 'Tauri', faction: 1 });
  });
});

describe('clearSplits', () => {
  it('places each fight on the clear by its pull and its length, in percent of the clear time', () => {
    const kills = [kill(100, 100, miracle), kill(1_000, 200, miracle, { boss: ilgynoth })];

    expect(clearSplits(clearRun(clear(kills)))).toEqual([
      { kill: kills[0], start: 0, width: 10 },
      { kill: kills[1], start: 80, width: 20 }
    ]);
  });
});

describe('rankClears', () => {
  const miracleSlow = guildClear(miracle, 10_000, 1_000);
  const miracleFast = guildClear(miracle, 20_000, 800);
  const outlawsTied = guildClear(outlaws, 30_000, 800);
  const outlawsHeroic = guildClear(outlaws, 40_000, 100, heroic);
  const pickup = clear([kill(49_100, 60), kill(50_000, 60, undefined, { boss: ilgynoth })], 'Tauri');
  const clears = [miracleSlow, miracleFast, outlawsTied, outlawsHeroic, pickup];
  const ranking = (filter: Parameters<typeof rankClears>[2] = {}) =>
    rankClears(clears, mythic, filter).map(run => [run.rank, run.guild?.name ?? 'pickup', run.clearMs / 1000]);

  it("ranks each guild once, by its fastest clear of the difficulty, the earlier clear first on a tie", () => {
    expect(ranking()).toEqual([[1, 'Miracle', 800], [2, 'Outlaws', 800]]);
  });

  it('adds every pickup clear with All groups', () => {
    expect(ranking({ groups: 'all' })).toEqual([[1, 'Miracle', 800], [2, 'Outlaws', 800], [3, 'pickup', 960]]);
  });

  it('filters by faction and realm and ranks the clears left again', () => {
    expect(ranking({ faction: 0 })).toEqual([[1, 'Outlaws', 800]]);
    expect(ranking({ realm: 'evermoon' })).toEqual([[1, 'Miracle', 800]]);
    expect(ranking({ realm: 'tauri', groups: 'all' })).toEqual([[1, 'Outlaws', 800], [2, 'pickup', 960]]);
  });
});

describe('clearEndedBy', () => {
  it('finds the clear a log finished, by realm and log id, and none for the kills before it', () => {
    const finished = guildClear(miracle, 10_000, 1_000);
    const [first, last] = finished.kills;

    expect(clearEndedBy([finished], { realm: 'Tauri', logId: last.logId })?.clearMs).toBe(1_000_000);
    expect(clearEndedBy([finished], first)).toBeUndefined();
  });
});
