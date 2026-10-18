/*
 * Talents each player used in a key, captured in game by Legion Key History and served by the
 * Keystone Tauri API (https://github.com/sixthxz/keystone-tauri). Only runs uploaded with the
 * addon have them; the API answers 404 for the rest.
 *
 * The API identifies a run the same way the Tauri leaderboard does: challenge id, level,
 * completedtime and completiontime, the values api/MythicPlusExporter already writes.
 */

/** Production API; a site served from localhost talks to a local backend instead. */
const PRODUCTION_API = 'https://keystone-tauri.vercel.app';
const LOCAL_API = 'http://localhost:3000';

export function keystoneApiBase(hostname: string): string {
  return hostname === 'localhost' || hostname === '127.0.0.1' ? LOCAL_API : PRODUCTION_API;
}

/** One talent option in the catalog: [talentId, spellId, name, icon]. */
export type CatalogOption = [number, number, string, string];

export interface TalentCatalog {
  version: 1;
  build: string;
  iconBase: string;
  /** Per spec id: 7 tiers x 3 columns. */
  specs: Record<string, { classId: number; name: string; icon: string; tiers: Array<Array<CatalogOption | null>> }>;
}

export interface RunTalentsResponse {
  version: 1;
  runId: string;
  path: string;
  members: Array<{
    name: string;
    realm: string;
    /** 'evermoon', 'tauri' or 'wod': this site's realm names in lower case. */
    realmSlug: string;
    classId: number;
    specId: number;
    source: 'self' | 'inspect';
    /** Chosen column per tier, tier 1 first ("2131322"); 0 = nothing picked. */
    picks: string;
  }>;
}

export interface TalentPick {
  spellId: number;
  name: string;
  icon: string;
}

export interface MemberTalents {
  /** 'self': the player's own addon; 'inspect': read by someone else in the group. */
  source: 'self' | 'inspect';
  /** Seven tiers; null where nothing was picked. */
  tiers: Array<TalentPick | null>;
}

export interface RunTalents {
  /** Keyed by memberKey(name, realm), with the realm as this site writes it ("Evermoon"). */
  members: Map<string, MemberTalents>;
}

export interface RunKey {
  challengeId: number;
  keyLevel: number;
  /** ISO date of completedtime. */
  completedAt: string;
  clearTimeMs: number;
}

export function memberKey(name: string, realm: string): string {
  return `${name.toLowerCase()}|${realm.toLowerCase()}`;
}

export function talentsPath(run: RunKey): string {
  const completed = Math.round(Date.parse(run.completedAt) / 1000);
  return `/api/v1/embed/talents?dungeon=${run.challengeId}&level=${run.keyLevel}`
    + `&completed=${completed}&duration=${run.clearTimeMs}`;
}

/** Turns the API's picks strings into icons; a spec the catalog doesn't know is left out. */
export function decodeRunTalents(response: RunTalentsResponse, catalog: TalentCatalog): RunTalents {
  const members = new Map<string, MemberTalents>();
  for (const member of response.members) {
    const spec = catalog.specs[String(member.specId)];
    if (!spec || !/^[0-3]{7}$/.test(member.picks)) {
      continue;
    }
    const tiers = [...member.picks].map((digit, tier) => {
      const option = Number(digit) > 0 ? spec.tiers[tier]?.[Number(digit) - 1] : null;
      return option ? { spellId: option[1], name: option[2], icon: option[3] } : null;
    });
    members.set(memberKey(member.name, member.realmSlug), { source: member.source, tiers });
  }
  return { members };
}
