import { describe, expect, it } from 'vitest';
import { CLASS_NAMES, CLASSES_BY_NAME } from './wow';
import { LEGION_SPECS, specById, specIconFor, specRoleFor } from './wow-specs';

describe('LEGION_SPECS', () => {
  it('lists every class with a unique game id per spec', () => {
    const ids = LEGION_SPECS.map(spec => spec.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(new Set(LEGION_SPECS.map(spec => spec.classId))).toEqual(new Set(Object.keys(CLASS_NAMES).map(Number)));
  });

  it('marks every damage spec melee or ranged, and no tank or healer', () => {
    expect(LEGION_SPECS.filter(spec => spec.role === 'dps' && !spec.range)).toEqual([]);
    expect(LEGION_SPECS.filter(spec => spec.role !== 'dps' && spec.range)).toEqual([]);
    expect(LEGION_SPECS.filter(spec => spec.range === 'ranged').map(spec => `${spec.classId} ${spec.spec}`)).toEqual([
      '3 Beast Mastery', '3 Marksmanship', '5 Shadow', '7 Elemental', '8 Arcane', '8 Fire', '8 Frost',
      '9 Affliction', '9 Demonology', '9 Destruction', '11 Balance'
    ]);
  });

  it('finds a spec by its game id', () => {
    expect(specById(105)).toMatchObject({ classId: 11, spec: 'Restoration', role: 'healer' });
    expect(specById(1)).toBeUndefined();
  });
});

describe('specIconFor', () => {
  it('looks the icon up by class and spec, so same-named specs stay distinct', () => {
    expect(specIconFor(6, 'Blood')).toContain('spell_deathknight_bloodpresence');
    expect(specIconFor(2, 'Holy')).toContain('spell_holy_holybolt');
    expect(specIconFor(5, 'Holy')).toContain('spell_holy_guardianspirit');
  });

  it('returns nothing for a spec it does not know', () => {
    expect(specIconFor(6, 'Frostfire')).toBeUndefined();
    expect(specRoleFor(6, 'Frostfire')).toBeUndefined();
  });
});

describe('CLASSES_BY_NAME', () => {
  it('orders the classes by name, as the class dropdowns list them', () => {
    expect(CLASSES_BY_NAME.map(entry => entry.name)).toEqual([
      'Death Knight', 'Demon Hunter', 'Druid', 'Hunter', 'Mage', 'Monk',
      'Paladin', 'Priest', 'Rogue', 'Shaman', 'Warlock', 'Warrior'
    ]);
  });
});
