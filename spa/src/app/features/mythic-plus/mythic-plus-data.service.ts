import { Injectable, inject, signal } from '@angular/core';
import { Observable, catchError, forkJoin, map, of, switchMap, throwError } from 'rxjs';
import {
  MYTHIC_PLUS_DATA_DIR,
  MythicPlusDungeonFile,
  MythicPlusIndex,
  MythicPlusRun,
  NEWER_DATA_MESSAGE,
  archivedSeasonId,
  createRunDecoder,
  seasonDataDir,
  sharesTables
} from './mythic-plus';
import { DataFileService } from '../../core/data-file.service';
import { ObservableCache } from '../../core/observable-cache';

export interface MythicPlusSeason {
  readonly index: MythicPlusIndex;
  readonly runs: readonly MythicPlusRun[];
}

export class NewerExportError extends Error {
  constructor(dungeonId: string) {
    super(`${dungeonId}.json and index.json come from different exports`);
  }
}

export function mythicPlusLoadError(error: unknown): string {
  return error instanceof NewerExportError ? NEWER_DATA_MESSAGE : 'The Mythic+ runs could not be loaded.';
}

@Injectable({ providedIn: 'root' })
export class MythicPlusDataService {
  private readonly dataFiles = inject(DataFileService);
  private readonly cache = new ObservableCache();
  private readonly decoders = new WeakMap<MythicPlusIndex, (file: MythicPlusDungeonFile) => MythicPlusRun[]>();

  readonly selectedSeason = signal<string | undefined>(undefined);

  index(seasonId?: string): Observable<MythicPlusIndex> {
    return this.liveIndex().pipe(
      switchMap(live => {
        const archived = archivedSeasonId(live, seasonId);
        return archived === undefined ? of(live) : this.archivedIndex(live, archived);
      })
    );
  }

  dungeonRuns(index: MythicPlusIndex, dungeonId: string): Observable<readonly MythicPlusRun[]> {
    const dir = seasonDataDir(index);
    return this.cache.get(`dungeon:${dir}/${dungeonId}`, () =>
      this.dataFiles.fetchJson<MythicPlusDungeonFile>(`${dir}/${dungeonId}.json`).pipe(
        map(file => {
          if (!sharesTables(index, file)) {
            throw new NewerExportError(dungeonId);
          }
          return this.decoderFor(index)(file);
        })
      ));
  }

  season(seasonId?: string): Observable<MythicPlusSeason> {
    return this.loadSeason(seasonId).pipe(
      catchError((error: unknown) => {
        if (!(error instanceof NewerExportError)) {
          return throwError(() => error);
        }
        this.refresh();
        return this.loadSeason(seasonId);
      })
    );
  }

  refresh(): void {
    this.dataFiles.refresh();
    this.cache.clear();
  }

  private liveIndex(): Observable<MythicPlusIndex> {
    return this.cache.get('index', () => this.dataFiles.getJson<MythicPlusIndex>(`${MYTHIC_PLUS_DATA_DIR}/index.json`));
  }

  private archivedIndex(live: MythicPlusIndex, seasonId: string): Observable<MythicPlusIndex> {
    return this.cache.get(`index:${seasonId}`, () =>
      this.dataFiles.getJson<MythicPlusIndex>(`${MYTHIC_PLUS_DATA_DIR}/${seasonId}/index.json`).pipe(
        map(index => ({ ...index, seasons: live.seasons }))
      ));
  }

  private loadSeason(seasonId: string | undefined): Observable<MythicPlusSeason> {
    return this.index(seasonId).pipe(
      switchMap(index => forkJoin(index.dungeons.map(dungeon => this.dungeonRuns(index, dungeon.id))).pipe(
        map(runsByDungeon => ({ index, runs: runsByDungeon.flat() }))
      ))
    );
  }

  private decoderFor(index: MythicPlusIndex): (file: MythicPlusDungeonFile) => MythicPlusRun[] {
    let decode = this.decoders.get(index);
    if (!decode) {
      decode = createRunDecoder(index);
      this.decoders.set(index, decode);
    }
    return decode;
  }
}
