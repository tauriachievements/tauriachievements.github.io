import { describe, expect, it } from 'vitest';
import {
  DIFFICULTY_COLORS,
  guildSuggestion,
  formatAgo,
  formatAmount,
  formatFightTime,
  formatPerSecond,
  nameMatches,
  parseBossView,
  raidLogLink
} from './raid-display';

describe('parseBossView', () => {
  it('reads the tab, and the role on the Damage tab', () => {
    expect(parseBossView(null, null)).toEqual({ tab: 'dps', role: undefined });
    expect(parseBossView('hps', null)).toEqual({ tab: 'hps', role: undefined });
    expect(parseBossView('latest', null)).toEqual({ tab: 'latest', role: undefined });
    expect(parseBossView(null, 'tank')).toEqual({ tab: 'dps', role: 'tank' });
    expect(parseBossView(null, 'melee')).toEqual({ tab: 'dps', role: 'melee' });
  });

  it('keeps the links to the old Ranged and Melee tabs working', () => {
    expect(parseBossView('ranged', null)).toEqual({ tab: 'dps', role: 'ranged' });
    expect(parseBossView('melee', 'tank')).toEqual({ tab: 'dps', role: 'melee' });
  });

  it('drops a role the tab does not rank, and anything it does not know', () => {
    expect(parseBossView('fastest', 'tank')).toEqual({ tab: 'fastest', role: undefined });
    expect(parseBossView('hps', 'healer')).toEqual({ tab: 'hps', role: undefined });
    expect(parseBossView(null, 'healer')).toEqual({ tab: 'dps', role: undefined });
    expect(parseBossView('tanks', 'heal')).toEqual({ tab: 'dps', role: undefined });
  });
});

describe('formatting', () => {
  it('formats fight times, per-second figures and totals', () => {
    expect(formatFightTime(296_400)).toBe('4:56');
    expect(formatFightTime(3_725_000)).toBe('1:02:05');
    expect(formatPerSecond(754_644)).toBe('754.6k');
    expect(formatPerSecond(1_236_000)).toBe('1.24M');
    expect(formatPerSecond(999)).toBe('999');
    expect(formatAmount(63_030_057)).toBe('63.0M');
    expect(formatAmount(2_740_000_000)).toBe('2.74B');
  });

  it('says how long ago', () => {
    const now = Date.UTC(2026, 9, 12, 12);
    expect(formatAgo(now - 30_000, now)).toBe('just now');
    expect(formatAgo(now - 12 * 60_000, now)).toBe('12 min ago');
    expect(formatAgo(now - 5 * 3_600_000, now)).toBe('5 h ago');
    expect(formatAgo(now - 3 * 86_400_000, now)).toBe('3 d ago');
  });

  it('finds names without regard to case or accents', () => {
    expect(nameMatches('Sósa', 'sosa')).toBe(true);
    expect(nameMatches('Ørna', 'rna')).toBe(true);
    expect(nameMatches('Kael', 'x')).toBe(false);
    expect(nameMatches('Kael', '  ')).toBe(true);
  });

  it('links a log by its realm and id', () => {
    expect(raidLogLink({ realm: 'WoD', logId: 283007 })).toEqual(['/raid-logs', 'log', 'wod', 283007]);
  });
});

describe('guildSuggestion', () => {
  const guild = (faction: number) => ({
    rank: 11,
    key: 'Evermoon/Cara Máxima',
    guild: { name: 'Cara Máxima', realm: 'Evermoon', faction, id: 7 },
    realm: 'Evermoon',
    faction,
    firsts: Array.from({ length: 7 }, () => undefined),
    killed: 5,
    progressedAt: 0,
    kills: 25
  });

  it('shows the faction, the guild, its realm, its rank and its progress, and opens the guild on the difficulty shown', () => {
    expect(guildSuggestion(guild(0), 'mythic')).toEqual({
      key: 'Evermoon/Cara Máxima',
      link: ['/raid-logs', 'guild', 'evermoon', 'Cara Máxima'],
      queryParams: { difficulty: 'mythic' },
      name: 'Cara Máxima',
      mark: '#3b78d8',
      detail: 'Evermoon',
      rank: 11,
      value: '5/7',
      valueColor: DIFFICULTY_COLORS['mythic']
    });
  });

  it('marks a Horde guild red and colours the progress by difficulty', () => {
    const heroic = guildSuggestion(guild(1), 'heroic');

    expect(heroic.mark).toBe('#c8322e');
    expect(heroic.valueColor).toBe(DIFFICULTY_COLORS['heroic']);
    expect(heroic.queryParams).toEqual({ difficulty: 'heroic' });
  });
});
