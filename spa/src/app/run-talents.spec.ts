import { describe, it, expect } from 'vitest';
import { RunTalentsResponse, TalentCatalog, decodeRunTalents, keystoneApiBase, memberKey, talentsPath } from './run-talents';

const option = (tier: number, column: number): [number, number, string, string] =>
  [tier * 10 + column, 1000 + tier * 10 + column, `Talent ${tier}.${column}`, `icon_${tier}_${column}`];

const catalog: TalentCatalog = {
  version: 1,
  build: '7.3.5.26972',
  iconBase: 'https://legion-static.tauri.hu/images/icons/large/',
  specs: {
    '581': {
      classId: 12,
      name: 'Vengeance',
      icon: 'ability_demonhunter_spectank',
      tiers: [1, 2, 3, 4, 5, 6, 7].map(tier => [1, 2, 3].map(column => option(tier, column)))
    }
  }
};

const response: RunTalentsResponse = {
  version: 1,
  runId: '8f5726019aeac32c',
  path: '/runs/8f5726019aeac32c',
  members: [
    { name: 'Nbsp', realm: '[EN] Evermoon', realmSlug: 'evermoon', classId: 12, specId: 581, source: 'self', picks: '1222031' },
    { name: 'Unknown', realm: '[EN] Evermoon', realmSlug: 'evermoon', classId: 1, specId: 999, source: 'inspect', picks: '1111111' }
  ]
};

describe('talentsPath', () => {
  it('identifies the run with the leaderboard values', () => {
    const path = talentsPath({ challengeId: 209, keyLevel: 8, completedAt: '2026-10-17T18:50:44.000Z', clearTimeMs: 1642406 });

    expect(path).toBe('/api/v1/embed/talents?dungeon=209&level=8&completed=1792263044&duration=1642406');
  });
});

describe('decodeRunTalents', () => {
  const decoded = decodeRunTalents(response, catalog);

  it('turns each picks string into seven tiers, empty where nothing was picked', () => {
    const nbsp = decoded.members.get(memberKey('Nbsp', 'Evermoon'));

    expect(nbsp?.source).toBe('self');
    expect(nbsp?.tiers.map(talent => talent?.name ?? null)).toEqual([
      'Talent 1.1', 'Talent 2.2', 'Talent 3.2', 'Talent 4.2', null, 'Talent 6.3', 'Talent 7.1'
    ]);
    expect(nbsp?.tiers[0]).toEqual({ spellId: 1011, name: 'Talent 1.1', icon: 'icon_1_1' });
  });

  it('leaves out a spec the catalog does not know', () => {
    expect(decoded.members.size).toBe(1);
  });
});

describe('keystoneApiBase', () => {
  it('uses the local backend only when the site itself runs locally', () => {
    expect(keystoneApiBase('localhost')).toBe('http://localhost:3000');
    expect(keystoneApiBase('tauriachievements.github.io')).toBe('https://keystone-tauri.vercel.app');
  });
});
