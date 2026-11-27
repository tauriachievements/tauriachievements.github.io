import { describe, expect, it } from 'vitest';
import { CLASS_FILTER_OPTIONS, CLASS_NAMES, CLASSES_BY_NAME } from './wow';
import {
  LEGION_SPECS,
  classOptionsFor,
  fitClassAndSpecTo,
  specById,
  specFilterOptions,
  specIconFor,
  specRoleFor,
  specsForRole
} from './wow-specs';

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

describe('specFilterOptions', () => {
  it("offers All specs, then the class's specs by name with their icons, in the game's order", () => {
    expect(specFilterOptions(6).map(option => [option.value, option.label])).toEqual([
      [undefined, 'All specs'],
      ['Blood', 'Blood'],
      ['Frost', 'Frost'],
      ['Unholy', 'Unholy']
    ]);
    expect(specFilterOptions(6)[1].icon).toContain('spell_deathknight_bloodpresence');
  });

  it('offers only All specs without a class', () => {
    expect(specFilterOptions(undefined)).toEqual([{ value: undefined, label: 'All specs' }]);
  });

  it("offers only the class's specs of a role", () => {
    const labels = (options: ReturnType<typeof specFilterOptions>) => options.map(option => option.label);

    expect(labels(specFilterOptions(11, 'dps'))).toEqual(['All specs', 'Balance', 'Feral']);
    expect(labels(specFilterOptions(3, 'melee'))).toEqual(['All specs', 'Survival']);
    expect(labels(specFilterOptions(8, 'healer'))).toEqual(['All specs']);
  });
});

describe('specsForRole', () => {
  it('lists every spec without a role, and only the matching specs with one', () => {
    expect(specsForRole(undefined)).toEqual(LEGION_SPECS);
    expect(specsForRole('tank').map(spec => spec.spec)).toEqual([
      'Protection', 'Protection', 'Blood', 'Brewmaster', 'Guardian', 'Vengeance'
    ]);
    expect(specsForRole('ranged').every(spec => spec.range === 'ranged')).toBe(true);
  });
});

describe('classOptionsFor', () => {
  it('lists All classes, then the classes with one of the specs, by name', () => {
    expect(classOptionsFor(specsForRole('tank')).map(option => option.label)).toEqual([
      'All classes', 'Death Knight', 'Demon Hunter', 'Druid', 'Monk', 'Paladin', 'Warrior'
    ]);
    expect(classOptionsFor(LEGION_SPECS)).toEqual(CLASS_FILTER_OPTIONS);
  });
});

describe('fitClassAndSpecTo', () => {
  const tanks = specsForRole('tank');

  it('keeps a class and spec among the specs', () => {
    expect(fitClassAndSpecTo(LEGION_SPECS, { classId: 11, specId: 103 })).toEqual({ classId: 11, specId: 103 });
    expect(fitClassAndSpecTo(LEGION_SPECS, { classId: 11 })).toEqual({ classId: 11, specId: undefined });
  });

  it('clears a class without one of the specs, and its spec', () => {
    expect(fitClassAndSpecTo(tanks, { classId: 8, specId: 63 })).toEqual({ classId: undefined, specId: undefined });
  });

  it("picks the class's only spec, or drops a spec that isn't among them", () => {
    expect(fitClassAndSpecTo(tanks, { classId: 11, specId: 103 })).toEqual({ classId: 11, specId: 104 });
    expect(fitClassAndSpecTo(specsForRole('dps'), { classId: 11, specId: 104 })).toEqual({ classId: 11, specId: undefined });
  });

  it('drops a spec without a class', () => {
    expect(fitClassAndSpecTo(LEGION_SPECS, { specId: 103 })).toEqual({ classId: undefined, specId: undefined });
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
