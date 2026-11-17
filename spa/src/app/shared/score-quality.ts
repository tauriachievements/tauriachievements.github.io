export type RunQuality = 'artifact' | 'legendary' | 'epic' | 'rare' | 'uncommon';

export function scoreQuality(score: number, bestScore: number): RunQuality {
  if (!(bestScore > 0)) {
    return 'uncommon';
  }

  if (score >= bestScore) {
    return 'artifact';
  }

  const ratio = score / bestScore;
  if (ratio >= 0.9) {
    return 'legendary';
  }

  if (ratio >= 0.84) {
    return 'epic';
  }

  return ratio >= 0.76 ? 'rare' : 'uncommon';
}

export function scoreTiers(scores: readonly number[]): number[] | undefined {
  const sorted = scores.filter(score => score > 0).sort((a, b) => b - a);
  const n = sorted.length;
  if (n < 20) {
    return undefined;
  }

  const top = (share: number) => sorted[Math.max(1, Math.ceil(n * share)) - 1];
  return [sorted[n - 1], top(0.6), top(0.25), top(0.1), top(0.01), top(0.001)];
}

const TIER_COLORS: ReadonlyArray<readonly [number, number, number]> = [
  [255, 255, 255], [31, 255, 0], [0, 112, 222], [163, 54, 237], [255, 128, 0], [255, 209, 0]
];

export function scoreColor(score: number, tiers: readonly number[] | undefined): string {
  if (!tiers || !(score > 0)) {
    return '#9e9e9e';
  }

  const last = tiers.length - 1;
  if (score >= tiers[last]) {
    return `rgb(${TIER_COLORS[last].join(', ')})`;
  }

  if (score < tiers[0]) {
    return '#9e9e9e';
  }

  for (let i = 0; i < last; i++) {
    if (score < tiers[i + 1]) {
      const t = (score - tiers[i]) / Math.max(tiers[i + 1] - tiers[i], 0.001);
      const [a, b] = [TIER_COLORS[i], TIER_COLORS[i + 1]];
      return `rgb(${a.map((value, k) => Math.round(value + (b[k] - value) * t)).join(', ')})`;
    }
  }

  return `rgb(${TIER_COLORS[last].join(', ')})`;
}
