import { describe, expect, it } from 'vitest';
import { clearRun } from './raid-clears';
import { KillWeek, KillWeekPage, killWeekPage, killWeeks, weekName, weekPages } from './raid-kill-weeks';
import { RaidGuild, RaidKill } from './raid-logs.types';
import { index } from './raid-logs.fixture';

const [nythendra, ilgynoth, elerethe] = index.bosses;
const mythic = index.difficulties[2];
const miracle: RaidGuild = { name: 'Miracle', realm: 'Evermoon', faction: 1, id: 3676 };

let nextLogId = 1;

function kill(at: string, details: Partial<RaidKill> = {}): RaidKill {
  return {
    realm: 'Tauri',
    logId: nextLogId++,
    boss: nythendra,
    difficulty: mythic,
    killedAt: Date.parse(at),
    fightMs: 60_000,
    guild: miracle,
    faction: 1,
    wipes: 0,
    deaths: 0,
    memberCount: 20,
    ...details
  };
}

const iso = (at: number) => new Date(at).toISOString();

describe('killWeeks', () => {
  it('groups the kills by raid week, the latest week and the latest kill first, and skips the weeks without kills', () => {
    const early = kill('2026-10-08T19:00:00Z');
    const before = kill('2026-10-24T19:00:00Z');
    const lastMinute = kill('2026-10-28T07:59:59Z');
    const reset = kill('2026-10-28T08:00:00Z');
    const later = kill('2026-10-29T20:00:00Z');

    expect(killWeeks([before, later, early, reset, lastMinute], kill => kill).map(week => [iso(week.start), iso(week.end), week.kills])).toEqual([
      ['2026-10-28T08:00:00.000Z', '2026-11-04T08:00:00.000Z', [later, reset]],
      ['2026-10-21T07:00:00.000Z', '2026-10-28T08:00:00.000Z', [lastMinute, before]],
      ['2026-10-07T07:00:00.000Z', '2026-10-14T07:00:00.000Z', [early]]
    ]);
  });

  it('counts the valid kills and the bosses they killed, and lists the invalid kills without counting them', () => {
    const [week] = killWeeks([
      kill('2026-10-28T19:00:00Z'),
      kill('2026-10-28T19:30:00Z', { boss: ilgynoth }),
      kill('2026-10-29T19:00:00Z'),
      kill('2026-10-29T19:30:00Z', { boss: elerethe, invalid: 'Bug abuse' })
    ], kill => kill);

    expect([week.kills.length, week.validKills, week.bosses]).toEqual([4, 3, 2]);
  });

  it("groups rows that hold a kill by that kill, as a character's kills are", () => {
    const early = { kill: kill('2026-10-22T19:00:00Z'), dps: 1 };
    const later = { kill: kill('2026-10-29T20:00:00Z'), dps: 2 };
    const sameWeek = { kill: kill('2026-10-28T19:00:00Z', { boss: ilgynoth }), dps: 3 };

    expect(killWeeks([early, sameWeek, later], row => row.kill).map(week => [week.kills, week.validKills, week.bosses])).toEqual([
      [[later, sameWeek], 2, 2],
      [[early], 1, 1]
    ]);
  });

  it("gives each week the guild's fastest full clear that ended in it, the earlier one on a tie", () => {
    const run = (first: string, last: string) =>
      clearRun({ realm: 'Evermoon', difficulty: mythic, kills: [kill(first), kill(last, { boss: ilgynoth })] });
    const slow = run('2026-10-28T19:00:00Z', '2026-10-28T21:00:00Z');
    const fast = run('2026-10-29T19:00:00Z', '2026-10-29T20:00:00Z');
    const tied = run('2026-10-30T19:00:00Z', '2026-10-30T20:00:00Z');
    const lastWeek = run('2026-10-22T19:00:00Z', '2026-10-22T20:30:00Z');
    const quiet = kill('2026-10-14T19:00:00Z');
    const kills = [slow, fast, tied, lastWeek].flatMap(clear => clear.kills);

    expect(killWeeks([...kills, quiet], kill => kill, [slow, tied, fast, lastWeek]).map(week => week.clear?.key))
      .toEqual([fast.key, lastWeek.key, undefined]);
  });
});

describe('weekPages', () => {
  const weekOf = (size: number, position: number): KillWeek => ({
    start: position,
    end: position + 1,
    kills: Array.from({ length: size }, () => kill('2026-10-28T19:00:00Z')),
    validKills: size,
    bosses: 1
  });
  const pageSizes = (sizes: number[]) => weekPages(sizes.map(weekOf), 25).map(page => page.map(week => week.kills.length));

  it('fills each page with whole weeks while they fit in the page size', () => {
    expect(pageSizes([5, 7, 9, 6, 3])).toEqual([[5, 7, 9], [6, 3]]);
    expect(pageSizes([10, 15, 1])).toEqual([[10, 15], [1]]);
  });

  it('gives a week bigger than a page a page of its own', () => {
    expect(pageSizes([6, 30, 3])).toEqual([[6], [30], [3]]);
  });

  it('has no pages without weeks', () => {
    expect(pageSizes([])).toEqual([]);
  });
});

describe('killWeekPage', () => {
  const now = Date.parse('2026-10-29T12:00:00Z');
  const kills = (count: number, at: string) => Array.from({ length: count }, () => kill(at));
  const weeks = killWeeks([
    ...kills(3, '2026-10-28T19:00:00Z'),
    ...kills(20, '2026-10-22T19:00:00Z'),
    ...kills(10, '2026-10-08T19:00:00Z')
  ], kill => kill);
  const shown = ({ page, pages, weeks }: KillWeekPage<RaidKill>) => [page, pages, weeks.map(week => [week.name, week.kills.length])];

  it('opens the page asked for, of whole weeks up to 25 kills, and names this week and last week', () => {
    expect(shown(killWeekPage(weeks, 1, now))).toEqual([1, 2, [['This week', 3], ['Last week', 20]]]);
    expect(shown(killWeekPage(weeks, 2, now))).toEqual([2, 2, [[undefined, 10]]]);
  });

  it('shows the last page for a page past the end', () => {
    expect(shown(killWeekPage(weeks, 9, now))).toEqual([2, 2, [[undefined, 10]]]);
  });

  it('has one empty page without kills', () => {
    expect(shown(killWeekPage([], 3, now))).toEqual([1, 1, []]);
  });
});

describe('weekName', () => {
  const now = Date.parse('2026-10-29T12:00:00Z');

  it('names this raid week and the one before it, and leaves the older weeks to their dates', () => {
    expect(weekName(Date.parse('2026-10-28T08:00:00Z'), now)).toBe('This week');
    expect(weekName(Date.parse('2026-10-21T07:00:00Z'), now)).toBe('Last week');
    expect(weekName(Date.parse('2026-10-14T07:00:00Z'), now)).toBeUndefined();
  });
});
