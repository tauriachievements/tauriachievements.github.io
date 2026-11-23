import { MythicPlusSeason } from './mythic-plus';

export interface SeasonChoice {
  id: string;
  name: string;
  upcoming: boolean;
}

type SeasonName = Pick<MythicPlusSeason, 'id' | 'name'>;

export const UPCOMING_MYTHIC_PLUS_SEASONS: readonly SeasonName[] = [
  { id: 'legion-s2', name: 'Season 2 - Patch 7.1.0' }
];

export function seasonChoices(
  exported: SeasonName | undefined,
  upcoming: readonly SeasonName[] = UPCOMING_MYTHIC_PLUS_SEASONS
): SeasonChoice[] {
  if (!exported) {
    return [];
  }

  return [
    { id: exported.id, name: exported.name, upcoming: false },
    ...upcoming.filter(season => season.id !== exported.id).map(({ id, name }) => ({ id, name, upcoming: true }))
  ];
}

export function chosenSeason(choices: readonly SeasonChoice[], id: string | null | undefined): SeasonChoice | undefined {
  return choices.find(choice => choice.id === id) ?? choices[0];
}

export function seasonParam(choice: SeasonChoice | undefined): string | null {
  return choice?.upcoming ? choice.id : null;
}
