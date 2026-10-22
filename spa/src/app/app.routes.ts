import { Routes } from '@angular/router';
import { AchievementLadderComponent } from './ladder.component';
import { GUILD_PAGES, guildAnalysisResolver, guildPagePath } from './guild-analysis';

export const routes: Routes = [
  {
    path: '',
    component: AchievementLadderComponent
  },
  {
    path: 'guilds',
    loadComponent: () => import('./guild-presence-page.component')
      .then(module => module.GuildPresencePageComponent)
  },
  {
    path: 'rare-achievements',
    loadComponent: () => import('./rare-achievements-page.component')
      .then(module => module.RareAchievementsPageComponent)
  },
  {
    path: 'raid-history',
    loadComponent: () => import('./guild-realm-firsts-page.component')
      .then(module => module.GuildRealmFirstsPageComponent)
  },
  {
    path: 'emerald-nightmare',
    loadComponent: () => import('./emerald-nightmare-page.component')
      .then(module => module.EmeraldNightmarePageComponent)
  },
  {
    path: 'mythic-plus',
    loadComponent: () => import('./mythic-plus-page.component')
      .then(module => module.MythicPlusPageComponent)
  },
  {
    path: 'mythic-plus/scoring',
    loadComponent: () => import('./mythic-plus-scoring-page.component')
      .then(module => module.MythicPlusScoringPageComponent)
  },
  {
    path: 'mythic-plus/stats',
    loadComponent: () => import('./mythic-plus-stats-page.component')
      .then(module => module.MythicPlusStatsPageComponent)
  },
  {
    path: 'mythic-plus/records',
    loadComponent: () => import('./mythic-plus-records-page.component')
      .then(module => module.MythicPlusRecordsPageComponent)
  },
  {
    path: 'mythic-plus/compare',
    loadComponent: () => import('./mythic-plus-compare-page.component')
      .then(module => module.MythicPlusComparePageComponent)
  },
  {
    path: 'mythic-plus/character/:realm/:name',
    loadComponent: () => import('./mythic-plus-profile-page.component')
      .then(module => module.MythicPlusProfilePageComponent)
  },
  {
    path: 'mythic-plus/guild/:realm/:guild',
    loadComponent: () => import('./mythic-plus-guild-page.component')
      .then(module => module.MythicPlusGuildPageComponent)
  },
  {
    path: 'legion-key-history-addon',
    loadComponent: () => import('./legion-key-history-page.component')
      .then(module => module.LegionKeyHistoryPageComponent)
  },
  {
    path: 'raid-logs',
    loadComponent: () => import('./raid-logs-page.component')
      .then(module => module.RaidLogsPageComponent)
  },
  {
    path: 'raid-logs/guilds',
    loadComponent: () => import('./raid-logs-progression-page.component')
      .then(module => module.RaidLogsProgressionPageComponent)
  },
  {
    path: 'raid-logs/stats',
    loadComponent: () => import('./raid-logs-stats-page.component')
      .then(module => module.RaidLogsStatsPageComponent)
  },
  {
    path: 'raid-logs/talents',
    loadComponent: () => import('./raid-logs-talents-page.component')
      .then(module => module.RaidLogsTalentsPageComponent)
  },
  {
    path: 'raid-logs/leaderboard',
    loadComponent: () => import('./raid-logs-leaderboard-page.component')
      .then(module => module.RaidLogsLeaderboardPageComponent)
  },
  {
    path: 'raid-logs/boss/:boss',
    loadComponent: () => import('./raid-logs-boss-page.component')
      .then(module => module.RaidLogsBossPageComponent)
  },
  {
    path: 'raid-logs/log/:realm/:id',
    loadComponent: () => import('./raid-log-page.component')
      .then(module => module.RaidLogPageComponent)
  },
  {
    path: 'raid-logs/guild/:realm/:name',
    loadComponent: () => import('./raid-logs-guild-page.component')
      .then(module => module.RaidLogsGuildPageComponent)
  },
  {
    path: 'raid-logs/character/:realm/:name',
    loadComponent: () => import('./raid-logs-character-page.component')
      .then(module => module.RaidLogsCharacterPageComponent)
  },
  {
    path: 'guild-realm-firsts',
    redirectTo: 'raid-history',
    pathMatch: 'full'
  },
  {
    path: 'top-gainers',
    loadComponent: () => import('./rank-movement-page.component')
      .then(module => module.TopGainersPageComponent)
  },
  {
    path: 'new-rare-characters',
    loadComponent: () => import('./new-rare-characters-page.component')
      .then(module => module.NewRareCharactersPageComponent)
  },
  {
    path: 'stats',
    loadComponent: () => import('./stats-page.component')
      .then(module => module.StatsPageComponent)
  },
  {
    path: 'battleground',
    loadComponent: () => import('./battleground-page.component')
      .then(module => module.BattlegroundPageComponent)
  },
  {
    path: 'rated-battleground',
    loadComponent: () => import('./rated-battleground-page.component')
      .then(module => module.RatedBattlegroundPageComponent)
  },
  {
    path: 'arena',
    loadComponent: () => import('./arena-games-page.component')
      .then(module => module.ArenaGamesPageComponent)
  },
  {
    path: '50-games-played-arenas',
    redirectTo: 'arena',
    pathMatch: 'full'
  },
  {
    path: 'ap-chest-looters',
    loadComponent: () => import('./ap-chest-looters-page.component')
      .then(module => module.ApChestLootersPageComponent)
  },
  {
    path: 'compare',
    loadComponent: () => import('./compare-page.component')
      .then(module => module.ComparePageComponent)
  },
  {
    path: 'support',
    loadComponent: () => import('./support-page.component')
      .then(module => module.SupportPageComponent)
  },
  {
    path: 'k7m2q9v4x8p3n6z',
    loadComponent: () => import('./rare-items-page.component')
      .then(module => module.RareItemsPageComponent)
  },
  ...GUILD_PAGES.map(guild => ({
    path: guildPagePath(guild),
    loadComponent: () => import('./guild-analysis-page.component')
      .then(module => module.GuildAnalysisPageComponent),
    data: { guild },
    resolve: { analysis: guildAnalysisResolver }
  })),
  {
    path: '**',
    redirectTo: ''
  }
];
