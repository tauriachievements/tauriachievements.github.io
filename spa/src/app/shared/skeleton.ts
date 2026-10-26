export type SkeletonKind = 'hero' | 'intro' | 'switch' | 'tiles' | 'icons' | 'toolbar' | 'rows' | 'cards' | 'chart';

export type SkeletonBlock = SkeletonKind | `${SkeletonKind}:${number}`;

export interface SkeletonSection {
  readonly kind: SkeletonKind;
  readonly items: readonly number[];
}

const DEFAULT_COUNTS: Record<SkeletonKind, number> = {
  hero: 1,
  intro: 1,
  switch: 3,
  tiles: 4,
  icons: 8,
  toolbar: 3,
  rows: 10,
  cards: 4,
  chart: 16
};

const NAME_WIDTHS = [62, 48, 74, 55, 68, 44, 58, 71, 51, 64];

export function skeletonSections(blocks: readonly SkeletonBlock[]): SkeletonSection[] {
  return blocks.map(block => {
    const [kind, count] = block.split(':') as [SkeletonKind, string | undefined];
    const length = count === undefined ? DEFAULT_COUNTS[kind] : Math.max(0, Math.floor(Number(count)));
    return { kind, items: Array.from({ length }, (_, index) => index) };
  });
}

export function nameWidth(index: number): number {
  return NAME_WIDTHS[index % NAME_WIDTHS.length];
}

export function iconColumns(count: number): number {
  return count <= 7 ? Math.max(1, count) : Math.ceil(count / 2);
}

export function barShare(index: number, count: number): number {
  return Math.round(96 - (index * 78) / Math.max(1, count - 1));
}
