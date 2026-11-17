import { RaidClearRun } from './raid-clears';
import { RaidKill } from './raid-logs.types';
import { raidWeekEnd, raidWeekStart } from './raid-logs';

export const KILL_WEEK_PAGE_SIZE = 25;

export interface KillWeek<T = RaidKill> {
  start: number;
  end: number;
  kills: T[];
  validKills: number;
  bosses: number;
  clear?: RaidClearRun;
}

export type WeekName = 'This week' | 'Last week';

export interface NamedKillWeek<T = RaidKill> extends KillWeek<T> {
  name?: WeekName;
}

export interface KillWeekPage<T = RaidKill> {
  weeks: NamedKillWeek<T>[];
  page: number;
  pages: number;
}

export type WeekKill = Pick<RaidKill, 'killedAt' | 'boss' | 'invalid'>;

export function killWeeks<T>(rows: readonly T[], killOf: (row: T) => WeekKill, clears: readonly RaidClearRun[] = []): KillWeek<T>[] {
  const weeks = new Map<number, T[]>();
  for (const row of [...rows].sort((a, b) => killOf(b).killedAt - killOf(a).killedAt)) {
    const start = raidWeekStart(killOf(row).killedAt);
    const week = weeks.get(start);
    week ? week.push(row) : weeks.set(start, [row]);
  }

  const fastestClears = new Map<number, RaidClearRun>();
  for (const clear of clears) {
    const start = raidWeekStart(clear.endedAt);
    const fastest = fastestClears.get(start);
    if (!fastest || clear.clearMs < fastest.clearMs || clear.clearMs === fastest.clearMs && clear.endedAt < fastest.endedAt) {
      fastestClears.set(start, clear);
    }
  }

  return [...weeks].map(([start, weekRows]) => {
    const valid = weekRows.map(killOf).filter(kill => kill.invalid === undefined);
    return {
      start,
      end: raidWeekEnd(start),
      kills: weekRows,
      validKills: valid.length,
      bosses: new Set(valid.map(kill => kill.boss)).size,
      clear: fastestClears.get(start)
    };
  });
}

export function weekPages<T>(weeks: readonly KillWeek<T>[], pageSize: number): KillWeek<T>[][] {
  const pages: KillWeek<T>[][] = [];
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

export function killWeekPage<T>(weeks: readonly KillWeek<T>[], page: number, now: number): KillWeekPage<T> {
  const pages = weekPages(weeks, KILL_WEEK_PAGE_SIZE);
  const pageCount = Math.max(1, pages.length);
  const current = Math.min(Math.max(1, page), pageCount);
  return {
    weeks: (pages[current - 1] ?? []).map(week => ({ ...week, name: weekName(week.start, now) })),
    page: current,
    pages: pageCount
  };
}

export function weekName(start: number, now: number): WeekName | undefined {
  const thisWeek = raidWeekStart(now);
  if (start === thisWeek) {
    return 'This week';
  }

  return raidWeekEnd(start) === thisWeek ? 'Last week' : undefined;
}
