export interface ScanChange {
  readonly rank: number;
  readonly value: number;
  readonly isNew: boolean;
}

export const SINCE_LAST_SCAN = 'since the last scan';

export function scanChanges<T>(
  current: readonly T[],
  previous: readonly T[],
  key: (entry: T) => string,
  value: (entry: T) => number
): Map<string, ScanChange> {
  const before = new Map(previous.map((entry, index) => [key(entry), { rank: index + 1, value: value(entry) }]));
  const changes = new Map<string, ScanChange>();

  current.forEach((entry, index) => {
    const entryKey = key(entry);
    const earlier = before.get(entryKey);
    const rank = index + 1;
    const now = value(entry);
    if (!earlier) {
      changes.set(entryKey, { rank: 0, value: 0, isNew: true });
    } else if (earlier.rank !== rank || earlier.value !== now) {
      changes.set(entryKey, { rank: earlier.rank - rank, value: now - earlier.value, isNew: false });
    }
  });

  return changes;
}

export function signedChange(change: number, format: (magnitude: number) => string = String): string {
  return `${change > 0 ? '+' : '−'}${format(Math.abs(change))}`;
}

export function rankChangeLabel(change: number, since = SINCE_LAST_SCAN): string {
  const ranks = Math.abs(change) === 1 ? 'rank' : 'ranks';
  return `${change > 0 ? 'Climbed' : 'Fell'} ${Math.abs(change)} ${ranks} ${since}`;
}

export function valueChangeLabel(
  change: number,
  unit: string,
  since = SINCE_LAST_SCAN,
  format?: (magnitude: number) => string
): string {
  return `${signedChange(change, format)} ${unit} ${since}`;
}
