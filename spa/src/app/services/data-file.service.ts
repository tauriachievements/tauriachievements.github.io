import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, shareReplay, switchMap, throwError } from 'rxjs';

interface DataManifest {
  files: Record<string, string>;
}

const MANIFEST_URL = 'assets/data/data-manifest.json';

@Injectable({ providedIn: 'root' })
export class DataFileService {
  private readonly http = inject(HttpClient);
  private sessionStamp = Date.now();
  private readonly memoized = new Map<string, Observable<unknown>>();
  private manifest$ = this.loadManifest();

  refresh(): void {
    this.sessionStamp = Date.now();
    this.manifest$ = this.loadManifest();
    this.memoized.clear();
  }

  getJson<T>(path: string): Observable<T> {
    return this.memoize(path, () => this.fetchJson<T>(path));
  }

  getText(path: string): Observable<string> {
    return this.memoize(`text:${path}`, () =>
      this.versionedUrl(path).pipe(switchMap((url) => this.http.get(url, { responseType: 'text' })))
    );
  }

  fetchJson<T>(path: string): Observable<T> {
    return this.versionedUrl(path).pipe(switchMap((url) => this.http.get<T>(url)));
  }

  private loadManifest(): Observable<DataManifest> {
    return this.http.get<DataManifest>(`${MANIFEST_URL}?v=${this.sessionStamp}`).pipe(
      catchError((error: unknown) => {
        console.warn('Could not load the data manifest; data files will not be cached.', error);
        return of({ files: {} });
      }),
      shareReplay({ bufferSize: 1, refCount: false })
    );
  }

  private versionedUrl(path: string): Observable<string> {
    return this.manifest$.pipe(
      map((manifest) => `${path}?v=${manifest.files[path] ?? this.sessionStamp}`)
    );
  }

  private memoize<T>(key: string, load: () => Observable<T>): Observable<T> {
    let cached = this.memoized.get(key) as Observable<T> | undefined;

    if (!cached) {
      cached = load().pipe(
        catchError((error: unknown) => {
          this.memoized.delete(key);
          return throwError(() => error);
        }),
        shareReplay({ bufferSize: 1, refCount: false })
      );
      this.memoized.set(key, cached);
    }

    return cached;
  }
}
