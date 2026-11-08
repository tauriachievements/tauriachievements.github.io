import { RaidBoss, RaidCharacter, RaidKillDetails, RaidMember, RaidSpec } from './raid-logs.types';
import { RoleFilter, matchesRoleFilter } from '../../game/wow';
import { SpecCharacterScore, specMetric, topAverage } from './raid-scores';
import { characterKey } from './raid-logs';

const TOP_SHARE = 0.1;

export const NOTABLE_DIFFERENCE = 0.1;

export const NOTABLE_MIN_PICKS = 10;

export const EDGE_MIN_TOP_PICKS = 5;

export const EDGE_POINTS = .05;

export interface PickSample {
  boss: RaidBoss;
  spec: RaidSpec;
  character: RaidCharacter;
  key: string;
  member: RaidMember;
  kill: RaidKillDetails;
  value: number;
  relative: number;
  rank: number;
  isTop: boolean;
}

export function pickSamples(kills: readonly RaidKillDetails[], counts: (member: RaidMember) => boolean): PickSample[] {
  type Best = Omit<PickSample, 'relative' | 'rank' | 'isTop'>;
  const best = new Map<string, Best>();

  for (const kill of kills) {
    for (const member of kill.members) {
      const spec = member.spec;
      if (!spec || member.character.former || !counts(member)) {
        continue;
      }

      const value = member[specMetric(spec)];
      const key = characterKey(member.character);
      const slot = `${kill.boss.index}|${spec.id}|${key}`;
      const known = best.get(slot);
      if (!known || value > known.value || (value === known.value && kill.killedAt < known.kill.killedAt)) {
        best.set(slot, { boss: kill.boss, spec, character: member.character, key, member, kill, value });
      }
    }
  }

  const rankings = new Map<string, Best[]>();
  for (const entry of best.values()) {
    const group = `${entry.boss.index}|${entry.spec.id}`;
    const ranking = rankings.get(group);
    if (ranking) {
      ranking.push(entry);
    } else {
      rankings.set(group, [entry]);
    }
  }

  const samples: PickSample[] = [];
  for (const ranking of rankings.values()) {
    ranking.sort((a, b) => b.value - a.value || a.kill.killedAt - b.kill.killedAt);
    const top = ranking[0].value;
    const topCount = topPlayerCount(ranking.length);
    ranking.forEach((entry, index) => samples.push({
      ...entry,
      relative: top > 0 ? entry.value / top : 0,
      rank: index + 1,
      isTop: index < topCount
    }));
  }
  return samples;
}

export function topPlayerCount(ranked: number): number {
  return ranked > 0 ? Math.max(1, Math.ceil(ranked * TOP_SHARE)) : 0;
}

export function specsMatching(specs: readonly RaidSpec[], classId: number | undefined, role: RoleFilter | undefined): RaidSpec[] {
  return specs.filter(spec => (classId === undefined || spec.classId === classId) && matchesRoleFilter(spec, role));
}

export function sortByPerformance<T extends { spec: RaidSpec }>(
  items: readonly T[],
  scores: ReadonlyMap<RaidSpec, readonly SpecCharacterScore[]>
): T[] {
  const performance = new Map([...scores].map(([spec, entries]) => [spec, topAverage(entries.map(entry => entry.score))]));
  return [...items].sort((a, b) => (performance.get(b.spec) ?? 0) - (performance.get(a.spec) ?? 0));
}

export function formatShare(share: number): string {
  if (!(share > 0)) {
    return '0%';
  }
  const percent = Math.round(share * 100);
  return percent < 1 ? '<1%' : `${percent}%`;
}

export function formatPoints(difference: number): string {
  const points = Math.round(difference * 100);
  return points > 0 ? `+${points}` : points < 0 ? `−${-points}` : '0';
}

export function heatColor(share: number): string {
  return `rgba(247, 181, 0, ${(.04 + share * .5).toFixed(3)})`;
}
