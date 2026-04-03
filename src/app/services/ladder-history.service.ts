import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, shareReplay } from 'rxjs';
import {
  LadderHistoryData,
  LadderHistoryMoverView,
  LadderHistoryPlayerRanks,
  SerializedLadderHistoryMover,
  SerializedLadderHistoryPlayerRecord,
  SerializedLadderHistorySnapshot
} from '../ladder-history.types';
import { splitLadderHistoryPlayerKey } from '../ladder-history.mapper';

@Injectable({ providedIn: 'root' })
export class LadderHistoryService {
  private readonly http = inject(HttpClient);
  private readonly history$ = this.http.get<SerializedLadderHistorySnapshot>('assets/data/players.history.snapshot.json').pipe(
    map((snapshot) => this.deserializeSnapshot(snapshot)),
    catchError((error) => {
      console.warn('Failed to load ladder history snapshot:', error);
      return of(null);
    }),
    shareReplay({ bufferSize: 1, refCount: false })
  );

  getHistory(): Observable<LadderHistoryData | null> {
    return this.history$;
  }

  private deserializeSnapshot(snapshot: SerializedLadderHistorySnapshot): LadderHistoryData | null {
    if (!snapshot || !Array.isArray(snapshot.s) || !Array.isArray(snapshot.p)) {
      return null;
    }

    const snapshots = snapshot.s
      .map((value) => new Date(value))
      .filter((value) => !Number.isNaN(value.getTime()));
    const players = new Map<string, LadderHistoryPlayerRanks>(
      snapshot.p.map((record) => this.deserializePlayerRecord(record, snapshots.length))
    );

    return {
      generatedAt: this.parseOptionalDate(snapshot.g),
      snapshots,
      trackedRankLimit: snapshot.t,
      players,
      movers: {
        achievementPoints: (snapshot.m?.a ?? []).map((mover) => this.deserializeMover(mover)),
        honorableKills: (snapshot.m?.h ?? []).map((mover) => this.deserializeMover(mover))
      }
    };
  }

  private deserializePlayerRecord(
    record: SerializedLadderHistoryPlayerRecord,
    snapshotCount: number
  ): [string, LadderHistoryPlayerRanks] {
    const [playerKey, entries] = record;
    const achievementRanks = Array.from({ length: snapshotCount }, () => 0);
    const honorableRanks = Array.from({ length: snapshotCount }, () => 0);
    const achievementPoints = Array.from({ length: snapshotCount }, () => 0);
    const honorableKills = Array.from({ length: snapshotCount }, () => 0);

    for (const entry of entries) {
      const [snapshotIndex, achievementRank, honorableRank, snapshotAchievementPoints, snapshotHonorableKills] = entry;
      if (snapshotIndex < 0 || snapshotIndex >= snapshotCount) {
        continue;
      }

      achievementRanks[snapshotIndex] = achievementRank ?? 0;
      honorableRanks[snapshotIndex] = honorableRank ?? 0;
      achievementPoints[snapshotIndex] = snapshotAchievementPoints ?? 0;
      honorableKills[snapshotIndex] = snapshotHonorableKills ?? 0;
    }

    return [
      playerKey,
      {
        achievementRanks,
        honorableRanks,
        achievementPoints,
        honorableKills
      }
    ];
  }

  private deserializeMover(mover: SerializedLadderHistoryMover): LadderHistoryMoverView {
    const [
      playerKey,
      rankDelta,
      previousRank,
      currentRank,
      achievementPointsDelta,
      honorableKillsDelta,
      previousAchievementPoints,
      currentAchievementPoints,
      previousHonorableKills,
      currentHonorableKills,
      race,
      gender,
      classId
    ] = mover;
    const { name, realm } = splitLadderHistoryPlayerKey(playerKey);

    return {
      playerKey,
      name,
      realm,
      race,
      gender,
      classId,
      rankDelta,
      previousRank,
      currentRank,
      achievementPointsDelta,
      honorableKillsDelta,
      previousAchievementPoints,
      currentAchievementPoints,
      previousHonorableKills,
      currentHonorableKills
    };
  }

  private parseOptionalDate(value: string | undefined): Date | undefined {
    if (!value) {
      return undefined;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? undefined : parsed;
  }
}
