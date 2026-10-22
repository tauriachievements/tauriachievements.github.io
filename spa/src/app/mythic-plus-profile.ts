import { localDay } from './mythic-plus-activity';
import { MythicPlusMember, MythicPlusRun, PlayerScore, characterKey, isBetterRun, samePlace } from './mythic-plus';

type Character = Pick<MythicPlusMember, 'name' | 'realm'>;

export function realmSlug(realm: string): string {
  return realm.toLowerCase();
}

export function characterProfileLink(character: Character): string[] {
  return ['/mythic-plus', 'character', realmSlug(character.realm), character.name];
}

export function characterParam(character: Character): string {
  return `${character.name}-${character.realm}`;
}

export function parseCharacterParam(value: string | null | undefined): Character | undefined {
  const split = value?.lastIndexOf('-') ?? -1;
  if (!value || split <= 0 || split === value.length - 1) {
    return undefined;
  }

  return { name: value.slice(0, split), realm: value.slice(split + 1) };
}

export function findCharacters<T extends Character>(candidates: readonly T[], realm: string, name: string): T[] {
  const wantedRealm = realmSlug(realm);
  const onRealm = candidates.filter(candidate => realmSlug(candidate.realm) === wantedRealm);
  const exact = onRealm.filter(candidate => candidate.name === name);
  if (exact.length) {
    return exact;
  }

  const folded = foldCase(name);
  return onRealm.filter(candidate => foldCase(candidate.name) === folded);
}

export interface ScopeRank {
  rank: number;
  total: number;
  position?: number;
}

export function scopeRank(
  ranking: readonly PlayerScore[],
  key: string,
  inScope: (player: PlayerScore) => boolean = () => true
): ScopeRank | undefined {
  let total = 0;
  let place = 0;
  let previous: PlayerScore | undefined;
  let found: { rank: number; position: number } | undefined;
  for (const player of ranking) {
    if (!inScope(player)) {
      continue;
    }

    total++;
    if (!previous || !samePlace(player, previous)) {
      place = total;
    }
    previous = player;
    if (player.key === key) {
      found = { rank: place, position: total };
    }
  }

  return found === undefined ? undefined : { ...found, total };
}

export function formatTopPercent({ rank, total }: ScopeRank): string {
  if (!(total > 0)) {
    return '';
  }

  const tenths = Math.max(1, Math.ceil((rank * 1000) / total));
  return tenths < 100 ? `top ${(tenths / 10).toFixed(1)}%` : `top ${Math.ceil(tenths / 10)}%`;
}

export function pageOfRank(rank: number, pageSize: number): number {
  return Math.max(1, Math.ceil(rank / pageSize));
}

export interface ScoreDay {
  day: string;
  score: number;
  gained: number;
  runs: number;
}

export function scoreOverTime(
  runs: readonly Pick<MythicPlusRun, 'dungeon' | 'score' | 'completedAt'>[],
  from: number,
  to: number
): ScoreDay[] {
  if (!(from <= to)) {
    return [];
  }

  const replay = runs
    .map(run => ({ run, at: Date.parse(run.completedAt) }))
    .sort((a, b) => a.at - b.at);
  const best = new Map<string, number>();
  const days: ScoreDay[] = [];
  const end = localDay(new Date(to));
  const cursor = new Date(from);
  cursor.setHours(12, 0, 0, 0);
  let next = 0;
  let score = 0;

  for (;;) {
    const day = localDay(cursor);
    let finished = 0;
    while (next < replay.length && localDay(new Date(replay[next].at)) <= day) {
      const { run } = replay[next++];
      best.set(run.dungeon, Math.max(best.get(run.dungeon) ?? 0, run.score));
      finished++;
    }

    let total = 0;
    for (const value of best.values()) {
      total += value;
    }
    const rounded = Math.round(total * 10) / 10;
    days.push({ day, score: rounded, gained: Math.round((rounded - score) * 10) / 10, runs: finished });
    score = rounded;

    if (day >= end) {
      break;
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return days;
}

export interface Teammate {
  key: string;
  member: MythicPlusMember;
  runs: number;
  bestRun: MythicPlusRun;
}

export function frequentTeammates(runs: readonly MythicPlusRun[], key: string, limit: number): Teammate[] {
  const teammates = new Map<string, Teammate>();
  for (const run of runs) {
    if (!run.roster.some(member => characterKey(member) === key)) {
      continue;
    }

    for (const member of run.roster) {
      const teammateKey = characterKey(member);
      if (teammateKey === key) {
        continue;
      }

      const teammate = teammates.get(teammateKey);
      if (!teammate) {
        teammates.set(teammateKey, { key: teammateKey, member, runs: 1, bestRun: run });
      } else {
        teammate.runs++;
        if (isBetterRun(run, teammate.bestRun)) {
          teammate.bestRun = run;
          teammate.member = member;
        }
      }
    }
  }

  return [...teammates.values()]
    .sort((a, b) =>
      b.runs - a.runs
      || b.bestRun.score - a.bestRun.score
      || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0))
    .slice(0, Math.max(0, limit));
}

export interface SpecPlayed {
  class: number;
  spec: string;
  runs: number;
}

export function specsPlayed(runs: readonly MythicPlusRun[], key: string, first?: string): SpecPlayed[] {
  const specs = new Map<string, SpecPlayed>();
  for (const run of runs) {
    const member = run.roster.find(entry => characterKey(entry) === key);
    if (!member) {
      continue;
    }

    const played = specs.get(member.spec);
    if (played) {
      played.runs++;
    } else {
      specs.set(member.spec, { class: member.class, spec: member.spec, runs: 1 });
    }
  }

  return [...specs.values()].sort((a, b) =>
    Number(b.spec === first) - Number(a.spec === first)
    || b.runs - a.runs
    || (a.spec < b.spec ? -1 : a.spec > b.spec ? 1 : 0));
}

function foldCase(value: string): string {
  return value.normalize('NFC').toLocaleLowerCase();
}
