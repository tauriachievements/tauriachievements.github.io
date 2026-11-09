import { describe, expect, it } from 'vitest';
import { MythicPlusRun } from './mythic-plus';
import { invalidReasons } from './mythic-plus-invalid';

describe('invalidReasons', () => {
  it('counts the runs each reason sets aside, most first, then by the reason', () => {
    const runs = ['B', 'A', 'B', 'C', 'A', 'B'].map(invalid => ({ invalid }) as MythicPlusRun);

    expect(invalidReasons(runs)).toEqual([{ reason: 'B', runs: 3 }, { reason: 'A', runs: 2 }, { reason: 'C', runs: 1 }]);
  });

  it('skips the runs that count', () => {
    expect(invalidReasons([{} as MythicPlusRun])).toEqual([]);
  });
});
