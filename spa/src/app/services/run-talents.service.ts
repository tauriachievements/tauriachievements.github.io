import { DOCUMENT } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, shareReplay, switchMap } from 'rxjs';
import {
  RunKey,
  RunTalents,
  RunTalentsResponse,
  TalentCatalog,
  decodeRunTalents,
  keystoneApiBase,
  talentsPath
} from '../run-talents';

/**
 * Loads a run's talents from the Keystone Tauri API when its details open: the catalog once
 * (about 15 KB compressed, cached by the browser for a day), then a few hundred bytes per run.
 * Runs without talents, and any failure, resolve to null so the page simply shows none.
 */
@Injectable({ providedIn: 'root' })
export class RunTalentsService {
  private readonly http = inject(HttpClient);
  private readonly apiBase = keystoneApiBase(inject(DOCUMENT).location?.hostname ?? '');
  private readonly byRun = new Map<string, Observable<RunTalents | null>>();
  private catalog$?: Observable<TalentCatalog | null>;

  forRun(run: RunKey): Observable<RunTalents | null> {
    const path = talentsPath(run);
    let talents$ = this.byRun.get(path);
    if (!talents$) {
      // The catalog is only fetched once some run actually has talents.
      talents$ = this.http.get<RunTalentsResponse>(`${this.apiBase}${path}`).pipe(
        catchError(() => of(null)),
        switchMap(response => (response
          ? this.catalog().pipe(map(catalog => (catalog ? decodeRunTalents(response, catalog) : null)))
          : of(null))),
        shareReplay(1)
      );
      this.byRun.set(path, talents$);
    }
    return talents$;
  }

  private catalog(): Observable<TalentCatalog | null> {
    this.catalog$ ??= this.http.get<TalentCatalog>(`${this.apiBase}/api/v1/embed/catalog`).pipe(
      catchError(() => {
        this.catalog$ = undefined;
        return of(null);
      }),
      shareReplay(1)
    );
    return this.catalog$;
  }
}
