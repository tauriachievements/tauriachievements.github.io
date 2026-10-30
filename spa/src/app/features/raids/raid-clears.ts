import { realmSlug } from '../../game/wow';
import { RaidDifficulty, RaidFullClear, RaidGuild, RaidKill } from './raid-logs.types';
import { guildKey, logKey } from './raid-logs';
import { mostCommon } from './raid-progression';

export type ClearGroups = 'guilds' | 'all';

export interface RaidClearRun {
  key: string;
  guild?: RaidGuild;
  realm: string;
  faction: number;
  difficulty: RaidDifficulty;
  startedAt: number;
  endedAt: number;
  clearMs: number;
  wipes: number;
  kills: readonly RaidKill[];
  last: RaidKill;
}

export interface RankedClear extends RaidClearRun {
  rank: number;
}

export interface ClearSplit {
  kill: RaidKill;
  start: number;
  width: number;
}

export interface ClearFilter {
  groups?: ClearGroups;
  faction?: number;
  realm?: string;
}

export function clearRun(clear: RaidFullClear): RaidClearRun {
  const [first] = clear.kills;
  const last = clear.kills[clear.kills.length - 1];
  const guild = creditedGuild(clear.kills);
  const startedAt = first.killedAt - first.fightMs;
  return {
    key: logKey(last),
    guild,
    realm: guild?.realm ?? clear.realm,
    faction: guild?.faction ?? mostCommon(clear.kills.map(kill => kill.faction)) ?? last.faction,
    difficulty: clear.difficulty,
    startedAt,
    endedAt: last.killedAt,
    clearMs: last.killedAt - startedAt,
    wipes: clear.kills.reduce((sum, kill) => sum + kill.wipes, 0),
    kills: clear.kills,
    last
  };
}

function creditedGuild(kills: readonly RaidKill[]): RaidGuild | undefined {
  const guild = kills[0].guild;
  return guild?.name && kills.every(kill => kill.guild === guild) ? guild : undefined;
}

export function clearSplits(run: Pick<RaidClearRun, 'kills' | 'startedAt' | 'clearMs'>): ClearSplit[] {
  const percent = (milliseconds: number) => run.clearMs > 0 ? milliseconds / run.clearMs * 100 : 0;
  return run.kills.map(kill => ({
    kill,
    start: percent(kill.killedAt - kill.fightMs - run.startedAt),
    width: percent(kill.fightMs)
  }));
}

export function rankClears(clears: readonly RaidFullClear[], difficulty: RaidDifficulty, filter: ClearFilter = {}): RankedClear[] {
  const ranked = new Set<string>();
  return clears
    .filter(clear => clear.difficulty === difficulty)
    .map(clearRun)
    .sort((a, b) => a.clearMs - b.clearMs || a.endedAt - b.endedAt)
    .filter(run => {
      if (!run.guild) {
        return filter.groups === 'all';
      }
      const key = guildKey(run.guild);
      if (ranked.has(key)) {
        return false;
      }
      ranked.add(key);
      return true;
    })
    .filter(run => (filter.faction === undefined || run.faction === filter.faction)
      && (filter.realm === undefined || realmSlug(run.realm) === filter.realm))
    .map((run, index) => ({ ...run, rank: index + 1 }));
}

export function clearEndedBy(clears: readonly RaidFullClear[], kill: Pick<RaidKill, 'realm' | 'logId'>): RaidClearRun | undefined {
  const key = logKey(kill);
  const clear = clears.find(candidate => logKey(candidate.kills[candidate.kills.length - 1]) === key);
  return clear && clearRun(clear);
}
