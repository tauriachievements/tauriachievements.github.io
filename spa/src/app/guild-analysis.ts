import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { Observable, catchError, of } from 'rxjs';
import { DataFileService } from './services/data-file.service';

export interface GuildAnalysisPlayer {
  name: string;
  race: number;
  gender: number;
  class: number;
  guildRank?: number | null;
  guildRankName?: string | null;
  specialization?: string | null;
  playedTime: number;
  achievementPoints: number;
  artifactRelics: number;
  artifactTraits: number;
  artifacts?: GuildAnalysisArtifact[] | null;
  artifactKnowledge?: number | null;
  itemLevel: number;
  legendaries?: GuildAnalysisLegendary[];
}

export interface GuildAnalysisArtifact {
  specialization: string;
  name: string;
  traits: number;
}

export interface GuildAnalysisLegendary {
  id: number;
  name: string;
  icon: string;
  tooltipHtml?: string;
}

export interface GuildAnalysis {
  timestamp: string;
  guild?: GuildAnalysisMetadata;
  ranks?: GuildAnalysisRank[];
  players: GuildAnalysisPlayer[];
}

export interface GuildAnalysisRank {
  order: number;
  name: string;
}

export interface GuildAnalysisMetadata {
  name: string;
  realm: string;
  faction: 'Alliance' | 'Horde' | 'Unknown';
}

export type GuildAnalysisKey =
  'endless' | 'competence-optional' | 'entropy' | 'impaired' | 'impact' | 'miracle' | 'outlaws' | 'highly-regarded' | 'temerite' |
  'rycerze-ortalionu';

export const DEFAULT_GUILD_ANALYSIS_KEY: GuildAnalysisKey = 'endless';

export const guildAnalysisResolver: ResolveFn<GuildAnalysis | null> = (route): Observable<GuildAnalysis | null> => {
  const key = (route.data['guild'] as GuildAnalysisKey | undefined) ?? DEFAULT_GUILD_ANALYSIS_KEY;

  return inject(DataFileService).getJson<GuildAnalysis>(`guild-analysis/${key}.json`).pipe(
    catchError((error: unknown) => {
      console.error(`Failed to load the ${key} guild analysis:`, error);
      return of(null);
    })
  );
};
