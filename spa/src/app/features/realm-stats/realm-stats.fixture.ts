import { ServerStatsSnapshot } from './server-stats.service';

export function statsSnapshot(overrides: Partial<ServerStatsSnapshot> = {}): ServerStatsSnapshot {
  return {
    totalPlayers: 100,
    guildedPlayers: 90,
    uniqueGuilds: 3,
    femalePlayers: 45,
    avgAchievementPoints: 2822,
    maxAchievementPoints: 20910,
    avgHonorableKills: 2518,
    maxHonorableKills: 733539,
    avgItemLevel: 830,
    medianItemLevel: 848,
    totalPlayedHours: 17_532,
    medianPlayedHours: 202,
    factions: [{ name: 'Horde', count: 60 }, { name: 'Alliance', count: 40 }],
    classes: [
      { id: 12, count: 50, female: 30, horde: 40, alliance: 10, avgItemLevel: 822, avgPlayedHours: 120, avgAchievementPoints: 1256 },
      { id: 11, count: 30, female: 10, horde: 10, alliance: 20, avgItemLevel: 833.5, avgPlayedHours: 612, avgAchievementPoints: 3000 },
      { id: 1, count: 20, female: 5, horde: 10, alliance: 10, avgItemLevel: 0, avgPlayedHours: 721, avgAchievementPoints: 3461 }
    ],
    races: [
      { id: 10, count: 50, female: 30 },
      { id: 4, count: 30, female: 12 },
      { id: 26, count: 10, female: 2 },
      { id: 25, count: 10, female: 1 }
    ],
    combos: [
      { race: 10, class: 12, count: 40, female: 25 },
      { race: 4, class: 11, count: 20, female: 8 },
      { race: 4, class: 12, count: 10, female: 5 },
      { race: 10, class: 11, count: 10, female: 5 },
      { race: 26, class: 1, count: 10, female: 2 },
      { race: 25, class: 1, count: 6, female: 1 },
      { race: 25, class: 11, count: 4, female: 0 }
    ],
    guilds: [{ name: 'Cara Máxima (Evermoon)', count: 60 }, { name: 'Outlaws (Tauri)', count: 30 }],
    realms: [{ name: 'Evermoon', count: 70 }, { name: 'Tauri', count: 30 }],
    distributions: {
      itemLevel: { labels: ['<840', '840–849', '850–859'], counts: [20, 50, 30] },
      achievementPoints: { labels: ['<1k', '1k–3k', '3k–6k'], counts: [60, 30, 10] },
      honorableKills: { labels: ['<1k', '1k–5k'], counts: [90, 10] },
      playedDays: { labels: ['<1', '1–3', '365+'], counts: [10, 80, 10] },
      level10Year: { labels: ['2025', '2026'], counts: [40, 60] },
      guildSize: { labels: ['1', '2–4', '100+'], counts: [1, 1, 1] }
    },
    ...overrides
  };
}
