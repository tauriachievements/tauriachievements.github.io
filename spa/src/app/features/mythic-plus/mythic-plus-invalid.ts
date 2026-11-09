import { MythicPlusRun } from './mythic-plus';

export interface InvalidReason {
  reason: string;
  runs: number;
}

export function invalidReasons(runs: readonly Pick<MythicPlusRun, 'invalid'>[]): InvalidReason[] {
  const counts = new Map<string, number>();
  for (const { invalid } of runs) {
    if (invalid !== undefined) {
      counts.set(invalid, (counts.get(invalid) ?? 0) + 1);
    }
  }

  return [...counts]
    .map(([reason, count]) => ({ reason, runs: count }))
    .sort((a, b) => b.runs - a.runs || a.reason.localeCompare(b.reason));
}
