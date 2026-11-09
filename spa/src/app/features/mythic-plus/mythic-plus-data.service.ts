import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, switchMap, throwError } from 'rxjs';
import {
  MYTHIC_PLUS_DATA_DIR,
  MythicPlusDungeonFile,
  MythicPlusIndex,
  MythicPlusRun,
  NEWER_DATA_MESSAGE,
  SplitRuns,
  createRunDecoder,
  sharesTables,
  splitInvalidRuns
} from './mythic-plus';
import { DataFileService } from '../../core/data-file.service';
import { ObservableCache } from '../../core/observable-cache';

export interface MythicPlusSeason {
  readonly index: MythicPlusIndex;
  readonly runs: readonly MythicPlusRun[];
  readonly invalidRuns: readonly MythicPlusRun[];
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

  index(): Observable<MythicPlusIndex> {
    return this.cache.get('index', () => this.dataFiles.getJson<MythicPlusIndex>(`${MYTHIC_PLUS_DATA_DIR}/index.json`));
  }

  dungeonRuns(index: MythicPlusIndex, dungeonId: string): Observable<readonly MythicPlusRun[]> {
    return this.dungeon(index, dungeonId).pipe(map(dungeon => dungeon.runs));
  }

  season(): Observable<MythicPlusSeason> {
    return this.loadSeason().pipe(
      catchError((error: unknown) => {
        if (!(error instanceof NewerExportError)) {
          return throwError(() => error);
        }
        this.refresh();
        return this.loadSeason();
      })
    );
  }

  refresh(): void {
    this.dataFiles.refresh();
    this.cache.clear();
  }

  private loadSeason(): Observable<MythicPlusSeason> {
    return this.index().pipe(
      switchMap(index => forkJoin(index.dungeons.map(dungeon => this.dungeon(index, dungeon.id))).pipe(
        map(dungeons => ({
          index,
          runs: dungeons.flatMap(dungeon => dungeon.runs),
          invalidRuns: dungeons.flatMap(dungeon => dungeon.invalidRuns)
        }))
      ))
    );
  }

  private dungeon(index: MythicPlusIndex, dungeonId: string): Observable<SplitRuns> {
    return this.cache.get(`dungeon:${dungeonId}`, () =>
      this.dataFiles.fetchJson<MythicPlusDungeonFile>(`${MYTHIC_PLUS_DATA_DIR}/${dungeonId}.json`).pipe(
        map(file => {
          if (!sharesTables(index, file)) {
            throw new NewerExportError(dungeonId);
          }
          return splitInvalidRuns(this.decoderFor(index)(file));
        })
      ));
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
