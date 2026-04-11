import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { RareAchievementsDataset } from './rare-achievements.types';

@Injectable({ providedIn: 'root' })
export class RareAchievementsService {
  private readonly http = inject(HttpClient);

  getRareAchievements(): Observable<RareAchievementsDataset> {
    return this.http.get<RareAchievementsDataset>(`RareAchievements.json?v=${Date.now()}`);
  }
}
