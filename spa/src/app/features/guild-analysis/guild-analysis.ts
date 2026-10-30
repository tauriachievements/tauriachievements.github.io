import { inject } from '@angular/core';
import { ResolveFn } from '@angular/router';
import { Observable, catchError, of } from 'rxjs';
import { DataFileService } from '../../core/data-file.service';
import { Realm } from '../../game/wow';

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

export interface GuildPage {
  readonly key: string;
  readonly guid: string;
  readonly name: string;
  readonly realm: Realm;
}

export const GUILD_PAGES = [
  { key: 'competence-optional', guid: '8bd3132c-72d6-432c-a160-e009a1e50155', name: 'Competence Optional', realm: 'Evermoon' },
  { key: 'miracle', guid: 'aee35fc2-cca6-47c7-aa26-6bf331a7bc95', name: 'Miracle', realm: 'Evermoon' },
  { key: 'outlaws', guid: '1c92f10c-2108-4fe9-b506-080f9661f551', name: 'Outlaws', realm: 'Tauri' },
  { key: 'endless', guid: '9f4c446e-5fef-4265-b4c6-2fc5d61e5e59', name: 'Endless', realm: 'Evermoon' },
  { key: 'impaired', guid: '581a1b07-e519-4e36-8b01-187af33367df', name: 'Impaired', realm: 'Evermoon' },
  { key: 'deeznuts', guid: '7bed7be7-549a-448f-a9c4-aa43f5afd060', name: 'deeznuts', realm: 'Evermoon' },
  { key: 'nfa', guid: '91f07e78-ec10-4161-99f9-3b5d01673524', name: 'NFA', realm: 'Evermoon' },
  { key: 'vistustan', guid: '8ecce8ca-c670-4d06-ab01-06861c3d3ec2', name: 'Vistustan', realm: 'Evermoon' },
  { key: 'skill-issue', guid: '3f7fe216-b578-47c4-b22b-ddf7c9e4e834', name: 'Skill Issue', realm: 'Evermoon' },
  { key: 'highly-regarded', guid: 'cedd1db9-e352-4c11-8f6f-e85937723121', name: 'Highly Regarded', realm: 'Evermoon' }
] as const satisfies readonly GuildPage[];

export function guildPagePath(page: GuildPage): string {
  return `${page.key}-${page.guid}`;
}

export const guildAnalysisResolver: ResolveFn<GuildAnalysis | null> = (route): Observable<GuildAnalysis | null> => {
  const page = route.data['guild'] as GuildPage;

  return inject(DataFileService).getJson<GuildAnalysis>(`guild-analysis/${page.key}.json`).pipe(
    catchError((error: unknown) => {
      console.error(`Failed to load the ${page.key} guild analysis:`, error);
      return of(null);
    })
  );
};

