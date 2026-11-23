import { MythicPlusSeason } from './mythic-plus';

export interface SeasonChoice {
  id: string;
  name: string;
  upcoming: boolean;
}

type SeasonName = Pick<MythicPlusSeason, 'id' | 'name'>;

export const MYTHIC_PLUS_SEASONS: readonly SeasonName[] = [
  { id: 'legion-s1', name: 'Season 1 - Patch 7.0.3' },
  { id: 'legion-s2', name: 'Season 2 - Patch 7.1.0' }
];

export function seasonName(
  season: SeasonName | undefined,
  seasons: readonly SeasonName[] = MYTHIC_PLUS_SEASONS
): string | undefined {
  return season && (seasons.find(known => known.id === season.id)?.name ?? season.name);
}

export function seasonChoices(
  exported: SeasonName | undefined,
  seasons: readonly SeasonName[] = MYTHIC_PLUS_SEASONS
): SeasonChoice[] {
  if (!exported) {
    return [];
  }

  const position = seasons.findIndex(season => season.id === exported.id);
  const upcoming = position === -1 ? [] : seasons.slice(position + 1);
  return [
    { id: exported.id, name: seasonName(exported, seasons) ?? exported.name, upcoming: false },
    ...upcoming.map(({ id, name }) => ({ id, name, upcoming: true }))
  ];
}

export function chosenSeason(choices: readonly SeasonChoice[], id: string | null | undefined): SeasonChoice | undefined {
  return choices.find(choice => choice.id === id) ?? choices[0];
}

export function seasonParam(choice: SeasonChoice | undefined): string | null {
  return choice?.upcoming ? choice.id : null;
}
