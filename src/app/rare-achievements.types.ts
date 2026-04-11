export interface RareAchievementDefinition {
  id: number;
  name: string;
}

export interface RareAchievementCharacter {
  name: string;
  realm: string;
  achievementIds: number[];
}

export interface RareAchievementsDataset {
  generatedAt: string;
  achievements: RareAchievementDefinition[];
  characters: RareAchievementCharacter[];
}
