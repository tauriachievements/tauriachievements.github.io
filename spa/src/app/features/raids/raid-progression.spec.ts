import { describe, expect, it } from 'vitest';
import {
  GuildProgress,
  ProgressionFilter,
  fastestKills,
  filterProgression,
  guildProgression,
  pickupGroups,
  progressionChanges,
  speedRank
} from './raid-progression';
import { RaidCharacter, RaidGuild, RaidKill, RaidKillDetails } from './raid-logs.types';
import { index, kills, nythendra } from './raid-logs.fixture';

function raiders(prefix: string, count: number, realm = 'Evermoon'): RaidCharacter[] {
  return Array.from({ length: count }, (_, n) => ({ name: `${prefix}${n}`, realm, classId: 8, race: 1, gender: 0, guild: '' }));
}

function pickupKill(logId: number, boss: number, killedAt: string, players: RaidCharacter[], extra: Partial<RaidKillDetails> = {}): RaidKillDetails {
  return {
    ...kills[0],
    logId,
    boss: index.bosses[boss],
    killedAt: Date.parse(killedAt),
    guild: undefined,
    faction: 1,
    members: players.map(character => ({ ...kills[0].members[0], character })),
    ...extra
  };
}

const groupLogs = (kills: readonly RaidKillDetails[]) => pickupGroups(kills).map(group => group.kills.map(kill => kill.logId));

describe('guildProgression', () => {
  it('ranks the most bosses down first, then who got there first', () => {
    const heroic = guildProgression(index.kills, 15, index.bosses.length);
    expect(heroic.map(row => [row.rank, row.guild?.name, row.killed])).toEqual([[1, 'Outlaws', 1]]);

    const mythicRows = guildProgression(index.kills, 16, index.bosses.length);
    expect(mythicRows.map(row => [row.guild?.name, row.killed, row.progressedAt])).toEqual([
      ['Miracle', 1, 1_000_000],
      ['Outlaws', 1, 2_000_000]
    ]);
    expect(mythicRows[0].firsts[0]?.logId).toBe(10);
    expect(mythicRows[0].firsts[1]).toBeUndefined();
  });

  it('ranks pickup groups among the guilds, each on its own kills', () => {
    const pickups = pickupGroups([
      pickupKill(20, 0, '2026-10-22T19:00:00Z', raiders('a', 10)),
      pickupKill(21, 1, '2026-10-22T20:00:00Z', raiders('a', 10)),
      pickupKill(22, 0, '2026-10-22T19:30:00Z', raiders('b', 10), { realm: 'WoD', faction: 0 })
    ]);

    const rows = guildProgression(index.kills, 16, index.bosses.length, pickups);

    expect(rows.map(row => [row.rank, row.key, row.guild?.name, row.killed, row.kills])).toEqual([
      [1, 'pickup/tauri/20', undefined, 2, 2],
      [2, 'evermoon/Miracle', 'Miracle', 1, 1],
      [3, 'tauri/Outlaws', 'Outlaws', 1, 1],
      [4, 'pickup/wod/22', undefined, 1, 1]
    ]);
    expect(rows[0].firsts.map(kill => kill?.logId)).toEqual([20, 21]);
    expect(rows[0].progressedAt).toBe(Date.parse('2026-10-22T20:00:00Z'));
    expect(guildProgression(index.kills, 15, index.bosses.length, pickups).map(row => row.key)).toEqual(['tauri/Outlaws']);
  });
});

describe('pickupGroups', () => {
  it('puts together the pickup kills of a raid week that share at least half the players of the smaller raid', () => {
    const regulars = raiders('a', 10);
    const newcomers = raiders('b', 5);

    expect(groupLogs([
      pickupKill(10, 0, '2026-10-22T19:00:00Z', regulars),
      pickupKill(11, 1, '2026-10-22T20:00:00Z', [...regulars.slice(0, 5), ...newcomers]),
      pickupKill(12, 0, '2026-10-23T19:00:00Z', [...regulars.slice(0, 4), ...raiders('c', 6)]),
      pickupKill(13, 0, '2026-10-28T19:00:00Z', regulars)
    ])).toEqual([[10, 11], [12], [13]]);
  });

  it('ends the raid week at the server reset across a clock change', () => {
    const regulars = raiders('a', 10);

    expect(groupLogs([
      pickupKill(10, 0, '2026-10-21T07:30:00Z', regulars),
      pickupKill(11, 1, '2026-10-28T07:30:00Z', regulars),
      pickupKill(12, 2, '2026-10-28T08:00:00Z', regulars),
      pickupKill(13, 0, '2026-11-04T07:59:59Z', regulars)
    ])).toEqual([[10, 11], [12, 13]]);
  });

  it('chains kills that each share half their players with the next', () => {
    const [first, second, third] = [raiders('a', 6), raiders('b', 6), raiders('c', 3)];

    expect(groupLogs([
      pickupKill(30, 2, '2026-10-24T21:00:00Z', [...second.slice(0, 3), ...third]),
      pickupKill(31, 0, '2026-10-24T19:00:00Z', first),
      pickupKill(32, 1, '2026-10-24T20:00:00Z', [...first.slice(0, 3), ...second])
    ])).toEqual([[31, 32, 30]]);
  });

  it('leaves out the guild kills and keeps the kills of a guild the API could not name', () => {
    const players = raiders('a', 10);
    const miracle: RaidGuild = { name: 'Miracle', realm: 'Evermoon', faction: 1, id: 3676 };
    const unnamed: RaidGuild = { name: '', realm: 'Evermoon', faction: 1, id: 8489 };

    expect(groupLogs([
      pickupKill(40, 0, '2026-10-22T19:00:00Z', players, { guild: miracle }),
      pickupKill(41, 1, '2026-10-22T20:00:00Z', players, { guild: unnamed }),
      pickupKill(42, 2, '2026-10-22T21:00:00Z', players)
    ])).toEqual([[41, 42]]);
  });

  it('names a group by its first kill, and gives it the realm most of its players play on and the faction of most of its kills', () => {
    const players = [...raiders('t', 6, 'Tauri'), ...raiders('e', 4)];

    const [group] = pickupGroups([
      pickupKill(51, 1, '2026-10-22T20:00:00Z', players, { realm: 'WoD', faction: 0 }),
      pickupKill(50, 0, '2026-10-22T19:00:00Z', players, { faction: 1 }),
      pickupKill(52, 2, '2026-10-22T21:00:00Z', players, { faction: 0 })
    ]);

    expect(group).toMatchObject({ key: 'pickup/tauri/50', realm: 'Tauri', faction: 0 });
  });

  it('keeps a pickup kill with no members listed as a group of its own, on the realm of its log', () => {
    expect(pickupGroups([pickupKill(70, 0, '2026-10-22T19:00:00Z', [], { realm: 'WoD' })]))
      .toMatchObject([{ key: 'pickup/wod/70', realm: 'WoD', faction: 1 }]);
  });
});

describe('filterProgression', () => {
  it('keeps one faction or realm and ranks the guilds and pickup groups left among themselves', () => {
    const rows: GuildProgress[] = [['A', 'Evermoon', 1], ['B', 'Tauri', 0], ['', 'Evermoon', 1], ['C', 'Evermoon', 0], ['D', 'WoD', 1]]
      .map(([name, realm, faction], position) => ({
        rank: position + 1,
        key: name ? `${realm}/${name}` : `pickup/${position}`,
        guild: name ? { name: name as string, realm: realm as string, faction: faction as number, id: position } : undefined,
        realm: realm as string,
        faction: faction as number,
        firsts: [],
        killed: 0,
        progressedAt: 0,
        kills: 0
      }));
    const shown = (filter: ProgressionFilter) => filterProgression(rows, filter).map(row => `${row.rank} ${row.guild?.name ?? row.key}`);

    expect(shown({})).toEqual(['1 A', '2 B', '3 pickup/2', '4 C', '5 D']);
    expect(shown({ faction: 0 })).toEqual(['1 B', '2 C']);
    expect(shown({ realm: 'evermoon' })).toEqual(['1 A', '2 pickup/2', '3 C']);
    expect(shown({ faction: 1, realm: 'wod' })).toEqual(['1 D']);
    expect(shown({ faction: 0, realm: 'wod' })).toEqual([]);
    expect(rows.map(row => row.rank)).toEqual([1, 2, 3, 4, 5]);
  });
});

describe('progressionChanges', () => {
  it('marks a guild new to the difficulty, and the bosses another guild killed since the last scan', () => {
    const guild = (name: string, id: number): RaidGuild => ({ name, realm: 'Evermoon', faction: 1, id });
    const [miracle, outlaws, newcomers] = [guild('Miracle', 1), guild('Outlaws', 2), guild('Newcomers', 3)];
    const kill = (logId: number, boss: number, by: RaidGuild): RaidKill =>
      ({ ...index.kills[0], logId, boss: index.bosses[boss], guild: by, killedAt: logId * 1_000 });
    const before = [kill(1, 0, miracle), kill(2, 0, outlaws)];
    const latest = [kill(3, 1, miracle), kill(4, 0, outlaws), kill(5, 0, newcomers)];
    const progression = (kills: RaidKill[]) => guildProgression(kills, 16, index.bosses.length);

    const changes = progressionChanges(progression([...before, ...latest]), progression(before));

    expect([...changes].map(([key, change]) => [key, change.isNew, [...change.bosses]])).toEqual([
      ['evermoon/Miracle', false, [1]],
      ['evermoon/Newcomers', true, [0]]
    ]);
  });

  it('gives a pickup group no change, new or not', () => {
    const players = raiders('a', 10);
    const before = [pickupKill(60, 0, '2026-10-22T19:00:00Z', players)];
    const latest = [pickupKill(61, 1, '2026-10-22T20:00:00Z', players), pickupKill(62, 0, '2026-10-23T19:00:00Z', raiders('b', 10))];
    const progression = (kills: RaidKillDetails[]) => guildProgression(index.kills, 16, index.bosses.length, pickupGroups(kills));

    const changes = progressionChanges(progression([...before, ...latest]), guildProgression(index.kills.slice(0, 1), 16, index.bosses.length));

    expect([...changes].map(([key, change]) => [key, change.isNew, [...change.bosses]])).toEqual([
      ['tauri/Outlaws', true, [0]]
    ]);
  });

  it('finds nothing when the scan added no kill', () => {
    const rows = guildProgression(index.kills, 16, index.bosses.length);
    expect(progressionChanges(rows, rows).size).toBe(0);
  });
});

describe('fastestKills and speedRank', () => {
  it('orders by fight time, the earlier kill first on a tie', () => {
    const heroic = index.kills.filter(kill => kill.difficulty.id === 15 && kill.boss === nythendra);
    expect(fastestKills(heroic).map(kill => kill.logId)).toEqual([13, 10]);
    expect(speedRank({ realm: 'WoD', logId: 10 }, heroic)).toBe(2);
  });
});
