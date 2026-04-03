import { Routes } from '@angular/router';
import { AchievementLadderComponent } from './ladder.component';
import { RankMovementPageComponent } from './rank-movement-page.component';

export const routes: Routes = [
  {
    path: '',
    component: AchievementLadderComponent
  },
  {
    path: 'rank-movement',
    component: RankMovementPageComponent
  },
  {
    path: '**',
    redirectTo: ''
  }
];
