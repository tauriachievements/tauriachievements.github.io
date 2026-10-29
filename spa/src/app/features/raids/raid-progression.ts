import { realmSlug } from '../../game/wow';
import { RaidGuild, RaidKill, RaidKillDetails } from './raid-logs.types';
import { characterKey, guildKey, logKey, raidWeekStart } from './raid-logs';

export function fastestKills<T extends Pick<RaidKill, 'fightMs' | 'killedAt'>>(kills: readonly T[]): T[] {
  return [...kills].sort((a, b) => a.fightMs - b.fightMs || a.killedAt - b.killedAt);
}

export function latestKills<T extends Pick<RaidKill, 'killedAt'>>(kills: readonly T[]): T[] {
  return [...kills].sort((a, b) => b.killedAt - a.killedAt);
}

export type ProgressKill = Omit<RaidKill, 'memberCount'>;

export interface GuildProgress {
  rank: number;
  key: string;
  guild?: RaidGuild;
  realm: string;
  faction: number;
  firsts: Array<ProgressKill | undefined>;
  killed: number;
  progressedAt: number;
  kills: number;
}

export interface PickupGroup {
  key: string;
  realm: string;
  faction: number;
  kills: RaidKillDetails[];
}

const RAID_WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const HALF_DAY_MS = 12 * 60 * 60 * 1000;

export function pickupGroups(kills: readonly RaidKillDetails[]): PickupGroup[] {
  const pickups = kills.filter(kill => !kill.guild?.name).sort((a, b) => a.killedAt - b.killedAt);
  const players = pickups.map(kill => new Set(kill.members.map(member => characterKey(member.character))));
  const parent = pickups.map((_, position) => position);
  const root = (position: number): number => {
    while (parent[position] !== position) {
      parent[position] = parent[parent[position]];
      position = parent[position];
    }
    return position;
  };

  let weekEnd = -Infinity;
  let killsByPlayer = new Map<string, number[]>();
  pickups.forEach((kill, position) => {
    if (kill.killedAt >= weekEnd) {
      weekEnd = raidWeekStart(raidWeekStart(kill.killedAt) + RAID_WEEK_MS + HALF_DAY_MS);
      killsByPlayer = new Map();
    }
    const shared = new Map<number, number>();
    for (const player of players[position]) {
      const earlier = killsByPlayer.get(player);
      for (const other of earlier ?? []) {
        shared.set(other, (shared.get(other) ?? 0) + 1);
      }
      earlier ? earlier.push(position) : killsByPlayer.set(player, [position]);
    }
    for (const [other, count] of shared) {
      if (count * 2 >= Math.min(players[position].size, players[other].size)) {
        parent[root(other)] = root(position);
      }
    }
  });

  const groups = new Map<number, number[]>();
  pickups.forEach((_, position) => {
    const group = root(position);
    const members = groups.get(group);
    members ? members.push(position) : groups.set(group, [position]);
  });

  return [...groups.values()]
    .sort((a, b) => a[0] - b[0])
    .map(positions => {
      const groupKills = positions.map(position => pickups[position]);
      const realms = new Map(positions.flatMap(position => pickups[position].members)
        .map(member => [characterKey(member.character), member.character.realm]));
      return {
        key: `pickup/${logKey(groupKills[0])}`,
        realm: mostCommon([...realms.values()]) ?? groupKills[0].realm,
        faction: mostCommon(groupKills.map(kill => kill.faction)) ?? groupKills[0].faction,
        kills: groupKills
      };
    });
}

function mostCommon<T>(values: readonly T[]): T | undefined {
  const counts = new Map<T, number>();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  let best: T | undefined;
  let bestCount = 0;
  for (const [value, count] of counts) {
    if (count > bestCount) {
      best = value;
      bestCount = count;
    }
  }
  return best;
}

export function guildProgression(
  kills: readonly ProgressKill[],
  difficultyId: number,
  bossCount: number,
  pickups: readonly PickupGroup[] = []
): GuildProgress[] {
  const rows = new Map<string, Omit<GuildProgress, 'rank'>>();
  const addKill = (row: Omit<GuildProgress, 'rank'>, kill: ProgressKill) => {
    row.kills++;
    const first = row.firsts[kill.boss.index];
    if (!first || kill.killedAt < first.killedAt) {
      row.firsts[kill.boss.index] = kill;
    }
  };
  const emptyRow = (key: string, realm: string, faction: number, guild?: RaidGuild): Omit<GuildProgress, 'rank'> =>
    ({ key, guild, realm, faction, firsts: Array.from({ length: bossCount }, () => undefined), killed: 0, progressedAt: 0, kills: 0 });

  for (const kill of kills) {
    const guild = kill.guild;
    if (kill.difficulty.id !== difficultyId || !guild?.name) {
      continue;
    }

    const key = guildKey(guild);
    let row = rows.get(key);
    if (!row) {
      row = emptyRow(key, guild.realm, guild.faction, guild);
      rows.set(key, row);
    }
    addKill(row, kill);
  }

  for (const group of pickups) {
    const row = emptyRow(group.key, group.realm, group.faction);
    group.kills.filter(kill => kill.difficulty.id === difficultyId).forEach(kill => addKill(row, kill));
    if (row.kills) {
      rows.set(group.key, row);
    }
  }

  for (const row of rows.values()) {
    const firsts = row.firsts.filter((kill): kill is ProgressKill => !!kill);
    row.killed = firsts.length;
    row.progressedAt = Math.max(0, ...firsts.map(kill => kill.killedAt));
  }

  return [...rows.values()]
    .sort((a, b) => b.killed - a.killed || a.progressedAt - b.progressedAt || (a.guild?.name ?? '').localeCompare(b.guild?.name ?? ''))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export interface ProgressionFilter {
  faction?: number;
  realm?: string;
}

export function filterProgression(rows: readonly GuildProgress[], filter: ProgressionFilter = {}): GuildProgress[] {
  return rows
    .filter(row => (filter.faction === undefined || row.faction === filter.faction)
      && (filter.realm === undefined || realmSlug(row.realm) === filter.realm))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export interface ProgressChange {
  isNew: boolean;
  bosses: ReadonlySet<number>;
}

export function progressionChanges(
  current: readonly GuildProgress[],
  previous: readonly GuildProgress[]
): Map<string, ProgressChange> {
  const before = new Map(previous.map(row => [row.key, row]));
  const changes = new Map<string, ProgressChange>();

  for (const row of current) {
    const earlier = before.get(row.key);
    const bosses = new Set(row.firsts.flatMap((kill, boss) => kill && !earlier?.firsts[boss] ? [boss] : []));
    if (bosses.size) {
      changes.set(row.key, { isNew: !earlier, bosses });
    }
  }

  return changes;
}

export function speedRank(kill: Pick<RaidKill, 'realm' | 'logId'>, kills: readonly RaidKill[]): number {
  const fastest = fastestKills(kills);
  return fastest.findIndex(other => other.realm === kill.realm && other.logId === kill.logId) + 1;
}
