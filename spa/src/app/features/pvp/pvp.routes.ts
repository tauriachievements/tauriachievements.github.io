import { Routes } from '@angular/router';

export const PVP_ROUTES: Routes = [
  {
    path: 'arena',
    loadComponent: () => import('./arena-games-page.component')
      .then(module => module.ArenaGamesPageComponent)
  },
  {
    path: 'arena/stats',
    loadComponent: () => import('./arena-stats-page.component')
      .then(module => module.ArenaStatsPageComponent)
  },
  {
    path: '50-games-played-arenas',
    redirectTo: 'arena',
    pathMatch: 'full'
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
    path: 'rated-bg-picker',
    loadComponent: () => import('./rated-bg-picker-page.component')
      .then(module => module.RatedBgPickerPageComponent)
  },
  {
    path: 'rated-bg-picker/info',
    loadComponent: () => import('./rated-bg-picker-info-page.component')
      .then(module => module.RatedBgPickerInfoPageComponent)
  }
];
