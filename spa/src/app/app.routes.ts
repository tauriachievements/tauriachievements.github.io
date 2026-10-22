import { Routes } from '@angular/router';
import { AchievementLadderComponent } from './features/ladder/ladder.component';
import { GUILD_PAGES, guildAnalysisResolver, guildPagePath } from './features/guild-analysis/guild-analysis';

export const routes: Routes = [
  {
    path: '',
    component: AchievementLadderComponent
  },
  {
    path: 'guilds',
    loadComponent: () => import('./features/ladder/guild-presence-page.component')
      .then(module => module.GuildPresencePageComponent)
  },
  {
    path: 'rare-achievements',
    loadComponent: () => import('./features/achievements/rare-achievements-page.component')
      .then(module => module.RareAchievementsPageComponent)
  },
  {
    path: 'raid-history',
    loadComponent: () => import('./features/raids/guild-realm-firsts-page.component')
      .then(module => module.GuildRealmFirstsPageComponent)
  },
  {
    path: 'emerald-nightmare',
    loadComponent: () => import('./features/raids/emerald-nightmare-page.component')
      .then(module => module.EmeraldNightmarePageComponent)
  },
  {
    path: 'mythic-plus',
    loadComponent: () => import('./features/mythic-plus/mythic-plus-page.component')
      .then(module => module.MythicPlusPageComponent)
  },
  {
    path: 'mythic-plus/scoring',
    loadComponent: () => import('./features/mythic-plus/mythic-plus-scoring-page.component')
      .then(module => module.MythicPlusScoringPageComponent)
  },
  {
    path: 'mythic-plus/stats',
    loadComponent: () => import('./features/mythic-plus/mythic-plus-stats-page.component')
      .then(module => module.MythicPlusStatsPageComponent)
  },
  {
    path: 'mythic-plus/records',
    loadComponent: () => import('./features/mythic-plus/mythic-plus-records-page.component')
      .then(module => module.MythicPlusRecordsPageComponent)
  },
  {
    path: 'mythic-plus/compare',
    loadComponent: () => import('./features/mythic-plus/mythic-plus-compare-page.component')
      .then(module => module.MythicPlusComparePageComponent)
  },
  {
    path: 'mythic-plus/character/:realm/:name',
    loadComponent: () => import('./features/mythic-plus/mythic-plus-profile-page.component')
      .then(module => module.MythicPlusProfilePageComponent)
  },
  {
    path: 'mythic-plus/guild/:realm/:guild',
    loadComponent: () => import('./features/mythic-plus/mythic-plus-guild-page.component')
      .then(module => module.MythicPlusGuildPageComponent)
  },
  {
    path: 'legion-key-history-addon',
    loadComponent: () => import('./features/mythic-plus/legion-key-history-page.component')
      .then(module => module.LegionKeyHistoryPageComponent)
  },
  {
    path: 'raid-logs',
    loadComponent: () => import('./features/raids/raid-logs-page.component')
      .then(module => module.RaidLogsPageComponent)
  },
  {
    path: 'raid-logs/guilds',
    loadComponent: () => import('./features/raids/raid-logs-progression-page.component')
      .then(module => module.RaidLogsProgressionPageComponent)
  },
  {
    path: 'raid-logs/stats',
    loadComponent: () => import('./features/raids/raid-logs-stats-page.component')
      .then(module => module.RaidLogsStatsPageComponent)
  },
  {
    path: 'raid-logs/talents',
    loadComponent: () => import('./features/raids/raid-logs-talents-page.component')
      .then(module => module.RaidLogsTalentsPageComponent)
  },
  {
    path: 'raid-logs/leaderboard',
    loadComponent: () => import('./features/raids/raid-logs-leaderboard-page.component')
      .then(module => module.RaidLogsLeaderboardPageComponent)
  },
  {
    path: 'raid-logs/boss/:boss',
    loadComponent: () => import('./features/raids/raid-logs-boss-page.component')
      .then(module => module.RaidLogsBossPageComponent)
  },
  {
    path: 'raid-logs/log/:realm/:id',
    loadComponent: () => import('./features/raids/raid-log-page.component')
      .then(module => module.RaidLogPageComponent)
  },
  {
    path: 'raid-logs/guild/:realm/:name',
    loadComponent: () => import('./features/raids/raid-logs-guild-page.component')
      .then(module => module.RaidLogsGuildPageComponent)
  },
  {
    path: 'raid-logs/character/:realm/:name',
    loadComponent: () => import('./features/raids/raid-logs-character-page.component')
      .then(module => module.RaidLogsCharacterPageComponent)
  },
  {
    path: 'guild-realm-firsts',
    redirectTo: 'raid-history',
    pathMatch: 'full'
  },
  {
    path: 'top-gainers',
    loadComponent: () => import('./features/ladder/rank-movement-page.component')
      .then(module => module.TopGainersPageComponent)
  },
  {
    path: 'new-rare-characters',
    loadComponent: () => import('./features/achievements/new-rare-characters-page.component')
      .then(module => module.NewRareCharactersPageComponent)
  },
  {
    path: 'stats',
    loadComponent: () => import('./features/realm-stats/stats-page.component')
      .then(module => module.StatsPageComponent)
  },
  {
    path: 'battleground',
    loadComponent: () => import('./features/pvp/battleground-page.component')
      .then(module => module.BattlegroundPageComponent)
  },
  {
    path: 'rated-battleground',
    loadComponent: () => import('./features/pvp/rated-battleground-page.component')
      .then(module => module.RatedBattlegroundPageComponent)
  },
  {
    path: 'arena',
    loadComponent: () => import('./features/pvp/arena-games-page.component')
      .then(module => module.ArenaGamesPageComponent)
  },
  {
    path: '50-games-played-arenas',
    redirectTo: 'arena',
    pathMatch: 'full'
  },
  {
    path: 'ap-chest-looters',
    loadComponent: () => import('./features/achievements/ap-chest-looters-page.component')
      .then(module => module.ApChestLootersPageComponent),
    data: { backToTop: false }
  },
  {
    path: 'compare',
    loadComponent: () => import('./features/ladder/compare-page.component')
      .then(module => module.ComparePageComponent)
  },
  {
    path: 'support',
    loadComponent: () => import('./features/support/support-page.component')
      .then(module => module.SupportPageComponent)
  },
  {
    path: 'k7m2q9v4x8p3n6z',
    loadComponent: () => import('./features/achievements/rare-items-page.component')
      .then(module => module.RareItemsPageComponent),
    data: { header: false }
  },
  ...GUILD_PAGES.map(guild => ({
    path: guildPagePath(guild),
    loadComponent: () => import('./features/guild-analysis/guild-analysis-page.component')
      .then(module => module.GuildAnalysisPageComponent),
    data: { guild, backToTop: false },
    resolve: { analysis: guildAnalysisResolver }
  })),
  {
    path: '**',
    redirectTo: ''
  }
];
