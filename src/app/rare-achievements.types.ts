export interface RareAchievementDefinition {
  id: number;
  name: string;
}

export interface RareAchievementOwnership {
  id: number;
  obtainedAt: string | null;
}

export type RareAchievementMarkerType = 'gladiatorTitle' | 'gladiatorMount';

export interface RareAchievementMarker {
  key: string;
  type: RareAchievementMarkerType;
  shortLabel: string;
  fullLabel: string;
  ariaLabel: string;
}

export interface RareAchievementSummary {
  gladiatorTitleCount: number;
  gladiatorMountCount: number;
  ratedBattlegroundHeroCount: number;
  markers: RareAchievementMarker[];
}

export interface RareAchievementCharacter {
  name: string;
  realm: string;
  race: number;
  class: number;
  guild: string;
  achievements: RareAchievementOwnership[];
}

export interface RareAchievementsDataset {
  generatedAt: string;
  achievements: RareAchievementDefinition[];
  characters: RareAchievementCharacter[];
}
