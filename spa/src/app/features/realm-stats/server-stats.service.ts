import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { DataFileService } from '../../core/data-file.service';

export interface ServerStatsNamedCount {
  name: string;
  count: number;
}

export interface ServerStatsClass {
  id: number;
  count: number;
  female: number;
  horde: number;
  alliance: number;
  avgItemLevel: number;
  avgPlayedHours: number;
  avgAchievementPoints: number;
}

export interface ServerStatsRace {
  id: number;
  count: number;
  female: number;
}

export interface ServerStatsCombo {
  race: number;
  class: number;
  count: number;
  female: number;
}

export interface ServerStatsDistribution {
  labels: string[];
  counts: number[];
}

export interface ServerStatsDistributions {
  itemLevel: ServerStatsDistribution;
  achievementPoints: ServerStatsDistribution;
  honorableKills: ServerStatsDistribution;
  playedDays: ServerStatsDistribution;
  level10Year: ServerStatsDistribution;
  guildSize: ServerStatsDistribution;
}

export interface ServerStatsSnapshot {
  totalPlayers: number;
  guildedPlayers: number;
  uniqueGuilds: number;
  femalePlayers: number;
  avgAchievementPoints: number;
  maxAchievementPoints: number;
  avgHonorableKills: number;
  maxHonorableKills: number;
  avgItemLevel: number;
  medianItemLevel: number;
  totalPlayedHours: number;
  medianPlayedHours: number;
  factions: ServerStatsNamedCount[];
  classes: ServerStatsClass[];
  races: ServerStatsRace[];
  combos: ServerStatsCombo[];
  guilds: ServerStatsNamedCount[];
  realms: ServerStatsNamedCount[];
  distributions: ServerStatsDistributions;
}

export interface ServerStatsSnapshotCollection {
  version: 3;
  filters: Record<string, ServerStatsSnapshot>;
}

@Injectable({ providedIn: 'root' })
export class ServerStatsService {
  private readonly dataFiles = inject(DataFileService);

  getServerStats(): Observable<ServerStatsSnapshotCollection> {
    return this.dataFiles.getJson<ServerStatsSnapshotCollection>('assets/data/stats.snapshot.json');
  }
}
