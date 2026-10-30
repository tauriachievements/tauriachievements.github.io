import { describe, expect, it } from 'vitest';
import { foldName, searchByName } from './search-suggestions';

describe('foldName', () => {
  it('drops accents and case', () => {
    expect(foldName('Sósa')).toBe('sosa');
    expect(foldName('Cara Máxima')).toBe('cara maxima');
  });
});

describe('searchByName', () => {
  const ranking = ['Maxyl', 'Xyhop', 'Pyxis', 'Xyra', 'Sósa'];
  const folded = (name: string) => foldName(name);

  it('lists names that start with the query before names that contain it, each in list order', () => {
    expect(searchByName(ranking, 'xy', 8, folded)).toEqual(['Xyhop', 'Xyra', 'Maxyl']);
  });

  it('stops at the limit, prefix matches first', () => {
    expect(searchByName(ranking, 'xy', 2, folded)).toEqual(['Xyhop', 'Xyra']);
    expect(searchByName(ranking, 'x', 3, folded)).toEqual(['Xyhop', 'Xyra', 'Maxyl']);
  });

  it('ignores case, accents and the spaces around the query', () => {
    expect(searchByName(ranking, ' SOSA ', 8, folded)).toEqual(['Sósa']);
    expect(searchByName(ranking, 'sós', 8, folded)).toEqual(['Sósa']);
  });

  it('skips the items without a name', () => {
    expect(searchByName(ranking, 'xy', 8, name => name === 'Xyhop' ? undefined : folded(name))).toEqual(['Xyra', 'Maxyl']);
  });

  it('finds nothing for a blank query or a name nobody has', () => {
    expect(searchByName(ranking, '  ', 8, folded)).toEqual([]);
    expect(searchByName(ranking, 'qq', 8, folded)).toEqual([]);
  });

  it('stops reading the list once the prefix matches fill the limit', () => {
    const read: string[] = [];
    searchByName(['Xa', 'Xb', 'Xc', 'Xd'], 'x', 2, name => {
      read.push(name);
      return folded(name);
    });
    expect(read).toEqual(['Xa', 'Xb']);
  });
});
