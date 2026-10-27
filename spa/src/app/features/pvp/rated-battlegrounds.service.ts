import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of } from 'rxjs';
import {
  RatedBattlegroundMatch,
  RatedNewMatches,
  normalizeRatedBattlegrounds,
  readNewMatches
} from './rated-battleground-stats';
import { BattlegroundCollectorState } from './battlegrounds.service';
import { DataFileService } from '../../core/data-file.service';

@Injectable({ providedIn: 'root' })
export class RatedBattlegroundsService {
  private readonly dataFiles = inject(DataFileService);

  getMatches(): Observable<RatedBattlegroundMatch[]> {
    return this.dataFiles.getJson<unknown>('rated-battlegrounds.json').pipe(
      map(value => normalizeRatedBattlegrounds(value))
    );
  }

  getNewMatches(): Observable<RatedNewMatches | undefined> {
    return this.dataFiles.getJson<BattlegroundCollectorState>('battleground-collector-state.json').pipe(
      map(readNewMatches),
      catchError(() => of(undefined))
    );
  }
}
