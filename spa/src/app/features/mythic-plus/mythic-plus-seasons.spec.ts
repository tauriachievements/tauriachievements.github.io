import { describe, expect, it } from 'vitest';
import { MYTHIC_PLUS_SEASONS, chosenSeason, seasonChoices, seasonName, seasonParam } from './mythic-plus-seasons';

const exportedOne = { id: 'legion-s1', name: 'Legion Season 1', raid: 'Emerald Nightmare', startDate: '2026-09-16' };
const seasons = [
  { id: 'legion-s1', name: 'Season 1 - Patch 7.0.3' },
  { id: 'legion-s2', name: 'Season 2 - Patch 7.1.0' }
];

describe('MYTHIC_PLUS_SEASONS', () => {
  it('names every season the site knows, oldest first', () => {
    expect(MYTHIC_PLUS_SEASONS).toEqual(seasons);
  });
});

describe('seasonName', () => {
  it("shows the site's name for a season it knows, whatever the export calls it", () => {
    expect(seasonName(exportedOne, seasons)).toBe('Season 1 - Patch 7.0.3');
  });

  it('keeps the exported name for a season the site does not know', () => {
    expect(seasonName({ id: 'legion-s5', name: 'Legion Season 5' }, seasons)).toBe('Legion Season 5');
  });

  it('has no name before the index has loaded', () => {
    expect(seasonName(undefined, seasons)).toBeUndefined();
  });
});

describe('seasonChoices', () => {
  it('lists the exported season under its site name first, then the seasons after it, which have not started', () => {
    expect(seasonChoices(exportedOne, seasons)).toEqual([
      { id: 'legion-s1', name: 'Season 1 - Patch 7.0.3', upcoming: false },
      { id: 'legion-s2', name: 'Season 2 - Patch 7.1.0', upcoming: true }
    ]);
  });

  it('lists only the exported season once the export holds the last one', () => {
    const exportedTwo = { ...exportedOne, id: 'legion-s2', name: 'Legion Season 2' };

    expect(seasonChoices(exportedTwo, seasons)).toEqual([
      { id: 'legion-s2', name: 'Season 2 - Patch 7.1.0', upcoming: false }
    ]);
  });

  it('lists a season the site does not know under its exported name, with nothing after it', () => {
    expect(seasonChoices({ id: 'legion-s5', name: 'Legion Season 5' }, seasons)).toEqual([
      { id: 'legion-s5', name: 'Legion Season 5', upcoming: false }
    ]);
  });

  it('offers nothing before the index has loaded', () => {
    expect(seasonChoices(undefined, seasons)).toEqual([]);
  });
});

describe('chosenSeason', () => {
  const choices = seasonChoices(exportedOne, seasons);

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
  const [exported, upcoming] = seasonChoices(exportedOne, seasons);

  it('names only an upcoming season in the URL, so the default links stay as they are', () => {
    expect([seasonParam(exported), seasonParam(upcoming), seasonParam(undefined)]).toEqual([null, 'legion-s2', null]);
  });
});
