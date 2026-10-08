import {
  MythicPlusDungeon,
  MythicPlusIndex,
  MythicPlusMember,
  MythicPlusRun,
  PlayerScore,
  rankPlayers,
  runIncludesCharacter,
  sortRoster
} from './mythic-plus';
import { dungeonTimers } from './mythic-plus-activity';
import { bestTimedRun, dungeonRecords } from './mythic-plus-records';

/*
 * The pure parts of rank movement on the Mythic+ leaderboard: the players view as it was at an
 * earlier moment, each character's move since then, the character a visitor marked as theirs,
 * and what changed since their last visit. Leaderboards only grow and every run carries the
 * time it finished, so the leaderboard at a moment is simply the runs finished by then.
 */

export const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Rank arrows stop below this rank, counted within the filters in use. Nearly every character
 * moves each day, so arrows further down would only be noise; the visitor's own movement shows
 * in their status bar at any rank.
 */
export const MOVEMENT_RANK_LIMIT = 500;

/** What rank movement is measured against: 24 hours before the export, or this week's reset. */
export type MovementBaseline = 'day' | 'reset';

/**
 * The moment (epoch ms) the baseline leaderboard is taken at, or undefined when it can't be
 * known (no affix week yet). `weekSince` is `AffixWeek.since`, the first moment of this week.
 */
export function baselineCutoff(baseline: MovementBaseline, exportedAtMs: number, weekSince: number | undefined): number | undefined {
  if (baseline === 'reset') {
    return weekSince === undefined ? undefined : weekSince - 1;
  }

  return exportedAtMs - DAY_MS;
}

/**
 * Runs finished at or before `cutoff` (epoch ms). `completedAt` is always `toISOString()`
 * (createRunDecoder), whose text order is time order, so this compares strings: parsing tens of
 * thousands of dates made the baseline twice as slow on a throttled phone.
 */
export function runsUpTo<T extends Pick<MythicPlusRun, 'completedAt'>>(runs: readonly T[], cutoff: number): T[] {
  const until = new Date(cutoff).toISOString();
  return runs.filter(run => run.completedAt <= until);
}

export interface RankAt {
  rank: number;
  score: number;
}

/** Each character's rank (from 1) and score in a `rankPlayers` ranking, by `characterKey`. */
export function rankIndex(ranking: readonly Pick<PlayerScore, 'key' | 'score'>[]): ReadonlyMap<string, RankAt> {
  return new Map(ranking.map((player, position) => [player.key, { rank: position + 1, score: player.score }]));
}

export interface RankMovement {
  /** Places climbed since the baseline: positive up, negative down. 0 when unchanged or new. */
  places: number;
  /** Not ranked at the baseline. */
  isNew: boolean;
  /** Score gained since the baseline; for a new character their whole score. */
  gained: number;
  /** Rank at the baseline, unless new. */
  previousRank?: number;
}

/** A character's move from `previous` (their baseline rank, if any) to `rank` with `score`. */
export function rankMovement(rank: number, score: number, previous: RankAt | undefined): RankMovement {
  if (!previous) {
    return { places: 0, isNew: true, gained: roundScore(score) };
  }

  return { places: previous.rank - rank, isNew: false, gained: roundScore(score - previous.score), previousRank: previous.rank };
}

/** `▲12`, `▼3`, `NEW`, or '' when the rank didn't change. */
export function movementLabel(movement: RankMovement): string {
  if (movement.isNew) {
    return 'NEW';
  }

  return movement.places > 0 ? `▲${movement.places}` : movement.places < 0 ? `▼${-movement.places}` : '';
}

export type MovementTone = 'up' | 'down' | 'new' | 'same';

export function movementTone(movement: RankMovement): MovementTone {
  return movement.isNew ? 'new' : movement.places > 0 ? 'up' : movement.places < 0 ? 'down' : 'same';
}

/** The baseline in words, to follow "Up 12 places": `in the last 24 hours` or `since the weekly reset`. */
export function baselinePhrase(baseline: MovementBaseline): string {
  return baseline === 'reset' ? 'since the weekly reset' : 'in the last 24 hours';
}

/** For a tooltip and screen readers: `Up 12 places in the last 24 hours (was #24), +12.4 score`. */
export function describeMovement(movement: RankMovement, baseline: MovementBaseline): string {
  const when = baselinePhrase(baseline);
  const gained = movement.gained > 0 ? `, +${movement.gained.toFixed(1)} score` : '';
  if (movement.isNew) {
    return `New on the leaderboard ${when}${gained}`;
  }

  const places = Math.abs(movement.places);
  const was = ` (was #${movement.previousRank})`;
  if (movement.places > 0) {
    return `Up ${places} ${places === 1 ? 'place' : 'places'} ${when}${was}${gained}`;
  }
  if (movement.places < 0) {
    return `Down ${places} ${places === 1 ? 'place' : 'places'} ${when}${was}${gained}`;
  }

  return `No change ${when}${gained}`;
}

/*
 * Browser storage. It can be missing or throw on any access (private mode, blocked site data,
 * a full quota), and the page has to work the same without it.
 */

export interface SafeStorage {
  get(key: string): string | undefined;
  /** False when the value couldn't be stored. */
  set(key: string, value: string): boolean;
  remove(key: string): void;
}

export function safeStorage(storage: () => Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> | null | undefined): SafeStorage {
  return {
    get: key => {
      try {
        return storage()?.getItem(key) ?? undefined;
      } catch {
        return undefined;
      }
    },
    set: (key, value) => {
      try {
        const target = storage();
        target?.setItem(key, value);
        return !!target;
      } catch {
        return false;
      }
    },
    remove: key => {
      try {
        storage()?.removeItem(key);
      } catch {
        // Nothing stored that could be removed.
      }
    }
  };
}

/** The export a visitor last saw: its season and when it was read (`MythicPlusIndex.generatedAt`). */
export interface SeenExport {
  season: string;
  generatedAt: string;
}

/** The export an index belongs to, or undefined for an older export without a timestamp. */
export function exportOf(index: Pick<MythicPlusIndex, 'season' | 'generatedAt'> | undefined): SeenExport | undefined {
  return index?.generatedAt && Number.isFinite(Date.parse(index.generatedAt))
    ? { season: index.season.id, generatedAt: index.generatedAt }
    : undefined;
}

/** Reads a stored `SeenExport`; anything else (old formats, hand edits) counts as nothing stored. */
export function parseSeenExport(raw: string | undefined): SeenExport | undefined {
  if (!raw) {
    return undefined;
  }

  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null) {
      return undefined;
    }

    const { season, generatedAt } = value as Record<string, unknown>;
    return typeof season === 'string' && typeof generatedAt === 'string' && Number.isFinite(Date.parse(generatedAt))
      ? { season, generatedAt }
      : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Up to when (epoch ms) the visitor had seen the runs, when a "since your last visit" line
 * applies: they saw an earlier export of the same season. The exporter reads every run up to
 * its `generatedAt`, so the runs finished after the seen export's are exactly the new ones.
 */
export function lastVisitCutoff(seen: SeenExport | undefined, current: SeenExport | undefined): number | undefined {
  if (!seen || !current || seen.season !== current.season) {
    return undefined;
  }

  const then = Date.parse(seen.generatedAt);
  return then < Date.parse(current.generatedAt) ? then : undefined;
}

/** Whether to store `current` as seen. Never over a newer one, e.g. from a stale cached index. */
export function shouldMarkSeen(seen: SeenExport | undefined, current: SeenExport | undefined): boolean {
  return !!current && (!seen || Date.parse(current.generatedAt) > Date.parse(seen.generatedAt));
}

export interface LastVisitKey {
  dungeon: MythicPlusDungeon;
  keyLevel: number;
}

export interface LastVisitSummary {
  /** The seen export's `generatedAt`, epoch ms. */
  since: number;
  /** The saved character's overall rank change, when they moved or are new. */
  me?: { rank: number; movement: RankMovement };
  /** A new highest timed key of the season: the record run, and who led it. */
  topKey?: LastVisitKey & { leader: MythicPlusMember; mine: boolean };
  /** New highest timed keys in dungeons the saved character has played, other than `topKey`'s. */
  playedKeys: LastVisitKey[];
  /** Dungeons whose record (highest timed key, then fastest) changed hands. */
  recordsFell: number;
}

/**
 * What changed between the runs finished by `since` and `runs` (the whole season), or undefined
 * when nothing worth a line did. `meKey` is the visitor's saved character, if any.
 */
export function lastVisitSummary(
  runs: readonly MythicPlusRun[],
  dungeons: readonly MythicPlusDungeon[],
  since: number,
  meKey?: string
): LastVisitSummary | undefined {
  const before = runsUpTo(runs, since);
  if (before.length === runs.length) {
    return undefined;
  }

  const timers = dungeonTimers(dungeons);
  const dungeonsById = new Map(dungeons.map(dungeon => [dungeon.id, dungeon]));

  let me: LastVisitSummary['me'];
  if (meKey) {
    const now = rankPlayers(runs);
    const position = now.findIndex(player => player.key === meKey);
    if (position >= 0) {
      const movement = rankMovement(position + 1, now[position].score, rankIndex(rankPlayers(before)).get(meKey));
      me = movement.isNew || movement.places !== 0 ? { rank: position + 1, movement } : undefined;
    }
  }

  let topKey: LastVisitSummary['topKey'];
  const best = bestTimedRun(runs, timers);
  const bestBefore = bestTimedRun(before, timers);
  const bestDungeon = best && dungeonsById.get(best.dungeon);
  if (best && bestDungeon && best.keyLevel > (bestBefore?.keyLevel ?? 0)) {
    topKey = {
      dungeon: bestDungeon,
      keyLevel: best.keyLevel,
      leader: sortRoster(best.roster)[0],
      mine: !!meKey && runIncludesCharacter(best, meKey)
    };
  }

  const records = dungeonRecords(runs, dungeons);
  const recordsBefore = new Map(dungeonRecords(before, dungeons).map(record => [record.dungeon.id, record.run]));
  let recordsFell = 0;
  const playedKeys: LastVisitKey[] = [];
  const played = meKey ? new Set(runs.filter(run => runIncludesCharacter(run, meKey)).map(run => run.dungeon)) : new Set<string>();
  for (const { dungeon, run } of records) {
    const previous = recordsBefore.get(dungeon.id);
    if (!run || run.id === previous?.id) {
      continue;
    }

    recordsFell++;
    if (played.has(dungeon.id) && run.keyLevel > (previous?.keyLevel ?? 0) && dungeon.id !== topKey?.dungeon.id) {
      playedKeys.push({ dungeon, keyLevel: run.keyLevel });
    }
  }

  return me || topKey || playedKeys.length || recordsFell
    ? { since, me, topKey, playedKeys, recordsFell }
    : undefined;
}

/** The summary's parts, to join with ` · `: `you moved ▲37 (#449 → #412)`, `3 dungeon records fell`, ... */
export function lastVisitParts(summary: LastVisitSummary): string[] {
  const parts: string[] = [];
  const me = summary.me;
  if (me) {
    const { movement, rank } = me;
    parts.push(movement.isNew
      ? `you're new at #${rank}`
      : `you ${movement.places > 0 ? 'moved' : 'dropped'} ${movementLabel(movement)} (#${movement.previousRank} → #${rank})`);
  }

  const top = summary.topKey;
  if (top) {
    const who = top.mine ? 'your group' : `${top.leader.name}'s group`;
    parts.push(`${who} timed the first +${top.keyLevel} (${top.dungeon.shortName})`);
  }

  if (summary.playedKeys.length) {
    const keys = summary.playedKeys.map(key => `${key.dungeon.shortName} +${key.keyLevel}`).join(', ');
    parts.push(`${summary.playedKeys.length === 1 ? 'new top key' : 'new top keys'} where you play: ${keys}`);
  }

  if (summary.recordsFell) {
    parts.push(`${summary.recordsFell} dungeon ${summary.recordsFell === 1 ? 'record' : 'records'} fell`);
  }

  return parts;
}

/** `Tue 21:03` within the last six days, `1 Oct, 21:03` before that (local time). */
export function formatVisitTime(at: number, now: number): string {
  const date = new Date(at);
  const time = date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  return now - at < 6 * DAY_MS
    ? `${date.toLocaleDateString('en-GB', { weekday: 'short' })} ${time}`
    : `${date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}, ${time}`;
}

/** Reads a saved `characterKey` (`name|realm`) back into a name and realm. */
export function parseCharacterKey(key: string | undefined): Pick<MythicPlusMember, 'name' | 'realm'> | undefined {
  const split = key?.lastIndexOf('|') ?? -1;
  return key && split > 0 && split < key.length - 1
    ? { name: key.slice(0, split), realm: key.slice(split + 1) }
    : undefined;
}

function roundScore(value: number): number {
  return Math.round(value * 10) / 10;
}
