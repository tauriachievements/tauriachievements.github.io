import { describe, it, expect } from 'vitest';
import { scoreColor, scoreQuality, scoreTiers } from './score-quality';

describe('score colours', () => {
  const scores = Array.from({ length: 2000 }, (_, i) => 2000 - i);
  const tiers = scoreTiers(scores);

  it('places the stops at the top 60%, 25%, 10%, 1% and 0.1% of players', () => {
    expect(tiers).toEqual([1, 801, 1501, 1801, 1981, 1999]);
    expect(scoreTiers([100, 90])).toBeUndefined();
  });

  it('is gold for the top 0.1%, orange at the top 1% and blends in between', () => {
    expect(scoreColor(2000, tiers)).toBe('rgb(255, 209, 0)');
    expect(scoreColor(1999, tiers)).toBe('rgb(255, 209, 0)');
    expect(scoreColor(1981, tiers)).toBe('rgb(255, 128, 0)');
    expect(scoreColor(1990, tiers)).toBe('rgb(255, 169, 0)');
    expect(scoreColor(0, tiers)).toBe('#9e9e9e');
    expect(scoreColor(500, undefined)).toBe('#9e9e9e');
  });
});

describe('scoreQuality', () => {
  it('maps the score relative to the best run onto item-quality tiers', () => {
    expect(scoreQuality(200, 200)).toBe('artifact');
    expect(scoreQuality(196, 200)).toBe('legendary');
    expect(scoreQuality(180, 200)).toBe('legendary');
    expect(scoreQuality(172, 200)).toBe('epic');
    expect(scoreQuality(160, 200)).toBe('rare');
    expect(scoreQuality(100, 200)).toBe('uncommon');
    expect(scoreQuality(100, 0)).toBe('uncommon');
  });
});
