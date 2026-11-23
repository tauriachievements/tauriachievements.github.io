import { describe, expect, it } from 'vitest';
import { UPCOMING_MYTHIC_PLUS_SEASONS, chosenSeason, seasonChoices, seasonParam } from './mythic-plus-seasons';

const seasonOne = { id: 'legion-s1', name: 'Season 1 - Patch 7.0.3', raid: 'Emerald Nightmare', startDate: '2026-09-16' };
const seasonTwo = { id: 'legion-s2', name: 'Season 2 - Patch 7.1.0' };

describe('seasonChoices', () => {
  it('lists the exported season first, then the seasons that have not started', () => {
    expect(seasonChoices(seasonOne, [seasonTwo])).toEqual([
      { id: 'legion-s1', name: 'Season 1 - Patch 7.0.3', upcoming: false },
      { id: 'legion-s2', name: 'Season 2 - Patch 7.1.0', upcoming: true }
    ]);
  });

  it('drops an upcoming season once the export holds it, keeping the exported name', () => {
    const started = { ...seasonOne, id: 'legion-s2', name: 'Season 2 - Patch 7.1.0 (exported)' };

    expect(seasonChoices(started, [seasonTwo])).toEqual([
      { id: 'legion-s2', name: 'Season 2 - Patch 7.1.0 (exported)', upcoming: false }
    ]);
  });

  it('offers nothing before the index has loaded', () => {
    expect(seasonChoices(undefined, [seasonTwo])).toEqual([]);
  });

  it('prepares Season 2 - Patch 7.1.0', () => {
    expect(UPCOMING_MYTHIC_PLUS_SEASONS).toEqual([seasonTwo]);
  });
});

describe('chosenSeason', () => {
  const choices = seasonChoices(seasonOne, [seasonTwo]);

  it('picks the season the URL names', () => {
    expect(chosenSeason(choices, 'legion-s2')?.id).toBe('legion-s2');
  });

  it('falls back to the exported season for no season or an unknown one', () => {
    expect([chosenSeason(choices, undefined)?.id, chosenSeason(choices, null)?.id, chosenSeason(choices, 'legion-s9')?.id])
      .toEqual(['legion-s1', 'legion-s1', 'legion-s1']);
  });

  it('picks nothing before the index has loaded', () => {
    expect(chosenSeason([], 'legion-s2')).toBeUndefined();
  });
});

describe('seasonParam', () => {
  const [exported, upcoming] = seasonChoices(seasonOne, [seasonTwo]);

  it('names only an upcoming season in the URL, so the default links stay as they are', () => {
    expect([seasonParam(exported), seasonParam(upcoming), seasonParam(undefined)]).toEqual([null, 'legion-s2', null]);
  });
});
