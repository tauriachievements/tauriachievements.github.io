import { getClassIconPath } from '../utils/classIconHelper';
import { LadderSort } from './ladder.types';
import { CLASSES_BY_NAME, REALMS } from './wow';

export interface LadderSelectOption<TValue> {
  value: TValue;
  label: string;
}

export interface LadderClassOption {
  id: number;
  name: string;
  icon: string;
}

export const DEFAULT_SORT: LadderSort = 'achievementPoints';
export const DEFAULT_PAGE_SIZE = 100;
export const PAGE_SIZE_OPTIONS = [100, 500, 1000] as const;

export const SORT_OPTIONS: ReadonlyArray<LadderSelectOption<LadderSort>> = [
  { value: 'achievementPoints', label: 'Character Achievements' },
  { value: 'achievementsTotal', label: 'Account Wide Achievements' },
  { value: 'honorableKills', label: 'Honorable Kills' },
  { value: 'playedTime', label: 'Time Played' },
  { value: 'ilvl', label: 'Item Level' },
  { value: 'appearanceCount', label: 'Appearances' }
];

export const REALM_OPTIONS: ReadonlyArray<LadderSelectOption<string | undefined>> = [
  { value: undefined, label: 'All Realms' },
  ...REALMS.map(realm => ({ value: realm, label: realm }))
];

export const FACTION_OPTIONS: ReadonlyArray<LadderSelectOption<string | undefined>> = [
  { value: undefined, label: 'All Factions' },
  { value: 'Horde', label: 'Horde' },
  { value: 'Alliance', label: 'Alliance' }
];

export const CLASS_OPTIONS: ReadonlyArray<LadderClassOption> = CLASSES_BY_NAME
  .map(({ id, name }) => ({ id, name, icon: getClassIconPath(id) }));
