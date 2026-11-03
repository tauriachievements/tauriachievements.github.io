import { RaidClearRun } from './raid-clears';
import { RaidKill } from './raid-logs.types';
import { raidWeekEnd, raidWeekStart } from './raid-logs';
import { latestKills } from './raid-progression';

export interface KillWeek {
  start: number;
  end: number;
  kills: RaidKill[];
  validKills: number;
  bosses: number;
  clear?: RaidClearRun;
}

export type WeekName = 'This week' | 'Last week';

export function killWeeks(kills: readonly RaidKill[], clears: readonly RaidClearRun[] = []): KillWeek[] {
  const weeks = new Map<number, RaidKill[]>();
  for (const kill of latestKills(kills)) {
    const start = raidWeekStart(kill.killedAt);
    const week = weeks.get(start);
    week ? week.push(kill) : weeks.set(start, [kill]);
  }

  const fastestClears = new Map<number, RaidClearRun>();
  for (const clear of clears) {
    const start = raidWeekStart(clear.endedAt);
    const fastest = fastestClears.get(start);
    if (!fastest || clear.clearMs < fastest.clearMs || clear.clearMs === fastest.clearMs && clear.endedAt < fastest.endedAt) {
      fastestClears.set(start, clear);
    }
  }

  return [...weeks].map(([start, weekKills]) => {
    const valid = weekKills.filter(kill => kill.invalid === undefined);
    return {
      start,
      end: raidWeekEnd(start),
      kills: weekKills,
      validKills: valid.length,
      bosses: new Set(valid.map(kill => kill.boss)).size,
      clear: fastestClears.get(start)
    };
  });
}

export function weekPages(weeks: readonly KillWeek[], pageSize: number): KillWeek[][] {
  const pages: KillWeek[][] = [];
  let rows = 0;
  for (const week of weeks) {
    const page = pages.at(-1);
    if (page && rows + week.kills.length <= pageSize) {
      page.push(week);
      rows += week.kills.length;
    } else {
      pages.push([week]);
      rows = week.kills.length;
    }
  }
  return pages;
}

export function weekName(start: number, now: number): WeekName | undefined {
  const thisWeek = raidWeekStart(now);
  if (start === thisWeek) {
    return 'This week';
  }

  return raidWeekEnd(start) === thisWeek ? 'Last week' : undefined;
}
