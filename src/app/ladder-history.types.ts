export type SerializedLadderHistoryEntry = [
  snapshotIndex: number,
  achievementRank: number,
  honorableRank: number,
  achievementPoints: number,
  honorableKills: number
];

export type SerializedLadderHistoryPlayerRecord = [
  playerKey: string,
  entries: SerializedLadderHistoryEntry[]
];

export type SerializedLadderHistoryMover = [
  playerKey: string,
  delta: number,
  previousRank: number,
  currentRank: number,
  achievementPointsDelta: number,
  honorableKillsDelta: number,
  previousAchievementPoints: number,
  currentAchievementPoints: number,
  previousHonorableKills: number,
  currentHonorableKills: number,
  race: number,
  gender: number,
  classId: number
];

export interface SerializedLadderHistorySnapshot {
  v: 1;
  g: string;
  t: number;
  s: string[];
  p: SerializedLadderHistoryPlayerRecord[];
  m: {
    a: SerializedLadderHistoryMover[];
    h: SerializedLadderHistoryMover[];
  };
}

export interface LadderHistoryPlayerRanks {
  achievementRanks: number[];
  honorableRanks: number[];
  achievementPoints: number[];
  honorableKills: number[];
}

export interface LadderHistoryMoverView {
  playerKey: string;
  name: string;
  realm: string;
  race: number;
  gender: number;
  classId: number;
  rankDelta: number;
  previousRank: number;
  currentRank: number;
  achievementPointsDelta: number;
  honorableKillsDelta: number;
  previousAchievementPoints: number;
  currentAchievementPoints: number;
  previousHonorableKills: number;
  currentHonorableKills: number;
}

export interface LadderHistoryData {
  generatedAt?: Date;
  snapshots: Date[];
  trackedRankLimit: number;
  players: ReadonlyMap<string, LadderHistoryPlayerRanks>;
  movers: {
    achievementPoints: LadderHistoryMoverView[];
    honorableKills: LadderHistoryMoverView[];
  };
}
