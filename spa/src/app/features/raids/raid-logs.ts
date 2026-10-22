import { getClassColor } from '../../game/class-colors';
import { formatClock } from '../../shared/time-format';
import { compareSpecLists } from '../../shared/spec-charts/spec-popularity';
import { CLASS_NAMES, parseRole, raceFaction, realmSlug, Role } from '../../game/wow';
import { LEGION_SPECS, SpecDefinition } from '../../game/wow-specs';

export const RAID_LOGS_DATA_DIR = 'raid-log-data';

export const RAID_TALENTS_PATH = `${RAID_LOGS_DATA_DIR}/talents.json`;

export const RAID_TALENT_TOOLTIPS_PATH = `${RAID_LOGS_DATA_DIR}/talent-tooltips.json`;

export const RAID_GENDERS_PATH = 'assets/data/raid-genders.json';

export type RaidMetric = 'dps' | 'hps';
export type RoleFilter = Role | 'all';

export interface RaidDifficultyEntry {
  id: number;
  slug: string;
  name: string;
  shortName: string;
  kills: number;
}

export interface RaidBossEntry {
  id: number;
  slug: string;
  name: string;
}

export interface RaidSpecEntry {
  id: number;
  class: number;
  name: string;
  role: Role;
}

export type RaidGuildEntry = [name: string, realm: string, faction: number, id: number];

export type RaidIndexLogEntry = [
  realm: string,
  logId: number,
  boss: number,
  difficulty: number,
  killedAt: number,
  fightMs: number,
  guild: number,
  faction: number,
  wipes: number,
  deaths: number,
  members: number
];

export type RaidPerformerEntry = [
  name: string,
  realm: string,
  classId: number,
  specId: number,
  perSecond: number,
  logRealm: string,
  logId: number
];

export interface RaidTopEntry {
  boss: string;
  difficulty: string;
  dps: RaidPerformerEntry | null;
  hps: RaidPerformerEntry | null;
}

export type RaidItemEntry = [id: number, name: string, quality: number, icon: string];

export interface RaidLogsIndexFile {
  version: number;
  generatedAt: string;
  previousGeneratedAt?: string;
  raid: { id: number; slug: string; name: string };
  difficulties: RaidDifficultyEntry[];
  bosses: RaidBossEntry[];
  specs: RaidSpecEntry[];
  guilds: RaidGuildEntry[];
  logs: RaidIndexLogEntry[];
  newLogs?: Array<[realm: string, logId: number]>;
  top: RaidTopEntry[];
  items: RaidItemEntry[];
}

export type RaidPlayerEntry = [name: string, realm: string, classId: number, race: number, gender: number, guild: string];

export type RaidMemberEntry = [
  player: number,
  spec: number,
  itemLevel: number,
  damage: number,
  healing: number,
  absorbs: number,
  overhealing: number,
  damageTaken: number,
  interrupts: number,
  dispels: number,
  talents?: string,
  trinkets?: number[]
];

export type RaidTrinketEntry = [id: number, itemLevel: number, name: string, quality: number, icon: string];

export type RaidTalentEntry = [spellId: number, name: string, icon: string];

export interface RaidTalentsFile {
  version: number;
  specs: Array<[specId: number, tiers: Array<Array<RaidTalentEntry | null>>]>;
}

export type RaidTalentTooltipEntry = [spellId: number, details: string[], description: string];

export interface RaidTalentTooltipsFile {
  version: number;
  spells: RaidTalentTooltipEntry[];
}

export type RaidBossLogEntry = [
  realm: string,
  logId: number,
  killedAt: number,
  fightMs: number,
  guild: number,
  faction: number,
  wipes: number,
  deaths: number,
  resurrects: number,
  members: RaidMemberEntry[],
  items: number[]
];

export interface RaidGendersFile {
  v: number;
  female: Record<string, string[]>;
  male: Record<string, string[]>;
}

export interface RaidBossFile {
  version: number;
  boss: string;
  difficulty: string;
  guilds: RaidGuildEntry[];
  players: RaidPlayerEntry[];
  trinkets?: RaidTrinketEntry[];
  logs: RaidBossLogEntry[];
}

export interface RaidDifficulty extends RaidDifficultyEntry {}

export interface RaidBoss {
  id: number;
  slug: string;
  name: string;
  shortName: string;
  index: number;
  portrait: string;
}

export interface RaidSpec {
  id: number;
  classId: number;
  name: string;
  role: Role;
  icon?: string;
}

export interface RaidGuild {
  name: string;
  realm: string;
  faction: number;
  id: number;
}

export interface RaidPerformer {
  name: string;
  realm: string;
  classId: number;
  spec?: RaidSpec;
  perSecond: number;
  logRealm: string;
  logId: number;
}

export interface RaidItem {
  id: number;
  name: string;
  quality: number;
  icon: string;
}

export interface RaidTrinket extends RaidItem {
  itemLevel: number;
}

export interface RaidTalent {
  id: number;
  name: string;
  icon: string;
}

export type RaidTalentTable = ReadonlyMap<number, ReadonlyArray<ReadonlyArray<RaidTalent | undefined>>>;

export interface RaidTalentTooltip {
  details: string;
  description: string;
}

export type RaidTalentTooltips = ReadonlyMap<number, RaidTalentTooltip>;

export interface RaidKill {
  realm: string;
  logId: number;
  boss: RaidBoss;
  difficulty: RaidDifficulty;
  killedAt: number;
  fightMs: number;
  guild?: RaidGuild;
  faction: number;
  wipes: number;
  deaths: number;
  memberCount: number;
}

export interface RaidCharacter {
  name: string;
  realm: string;
  classId: number;
  race: number;
  gender: number;
  guild: string;
}

export interface RaidMember {
  character: RaidCharacter;
  spec?: RaidSpec;
  itemLevel: number;
  damage: number;
  healing: number;
  absorbs: number;
  overhealing: number;
  damageTaken: number;
  interrupts: number;
  dispels: number;
  dps: number;
  hps: number;
  talents: string;
  trinkets: RaidTrinket[];
}

export interface RaidKillDetails extends Omit<RaidKill, 'memberCount'> {
  resurrects: number;
  members: RaidMember[];
  items: number[];
}

export interface RaidLogsIndex {
  generatedAt?: Date;
  previousGeneratedAt?: Date;
  newLogs: ReadonlySet<string>;
  raid: { id: number; slug: string; name: string };
  difficulties: RaidDifficulty[];
  bosses: RaidBoss[];
  specs: ReadonlyMap<number, RaidSpec>;
  kills: RaidKill[];
  items: ReadonlyMap<number, RaidItem>;
  top: ReadonlyMap<string, { dps?: RaidPerformer; hps?: RaidPerformer }>;
}

const BOSS_PORTRAITS: Readonly<Record<string, string>> = {
  nythendra: 'assets/emerald-nightmare/01-nythendra.png',
  ilgynoth: "assets/emerald-nightmare/02-il'gunoth.png",
  'elerethe-renferal': 'assets/emerald-nightmare/03-elerethe.png',
  ursoc: 'assets/emerald-nightmare/04-ursoc.png',
  'dragons-of-nightmare': 'assets/emerald-nightmare/05-dragons-of-nightmare.png',
  cenarius: 'assets/emerald-nightmare/06-cenarius.png',
  xavius: 'assets/emerald-nightmare/07-xavious.png'
};

const BOSS_SHORT_NAMES: Readonly<Record<string, string>> = {
  'elerethe-renferal': 'Elerethe',
  'dragons-of-nightmare': 'Dragons'
};

export function bossShortName(boss: { slug: string; name: string }): string {
  return BOSS_SHORT_NAMES[boss.slug] ?? boss.name.split(',')[0].trim();
}

const KILL_ORDER: ReadonlyArray<string> = ['nythendra', 'ursoc', 'dragons-of-nightmare', 'elerethe-renferal', 'ilgynoth', 'cenarius', 'xavius'];

export function bossesInKillOrder<T extends Pick<RaidBoss, 'slug' | 'index'>>(bosses: readonly T[]): T[] {
  const place = (boss: T) => {
    const position = KILL_ORDER.indexOf(boss.slug);
    return position < 0 ? KILL_ORDER.length + boss.index : position;
  };
  return [...bosses].sort((a, b) => place(a) - place(b));
}

export const FACTION_NAMES: Readonly<Record<number, string>> = { 0: 'Alliance', 1: 'Horde' };


export const ROLE_NAMES: Readonly<Record<Role, string>> = { tank: 'Tank', healer: 'Healer', dps: 'Damage' };

export const ITEM_QUALITY_COLORS: ReadonlyArray<string> = [
  '#9d9d9d', '#ffffff', '#1eff00', '#0070dd', '#a335ee', '#ff8000', '#e6cc80', '#00ccff'
];

const ICON_BASE = 'https://legion-static.tauri.hu/images/icons/';

export function itemIconUrl(icon: string, size: 'medium' | 'large' = 'large'): string {
  return `${ICON_BASE}${size}/${icon || 'inv_misc_questionmark'}.png`;
}

export function iconSrcset(icon: string): string {
  return `${itemIconUrl(icon, 'medium')} 36w, ${itemIconUrl(icon)} 56w`;
}

export function itemUrl(itemId: number): string {
  return `https://legion-shoot.tauri.hu/?item=${itemId}`;
}

export function spellUrl(spellId: number): string {
  return `https://legion-shoot.tauri.hu/?spell=${spellId}`;
}

export function decodeIndex(file: RaidLogsIndexFile): RaidLogsIndex {
  const generatedAt = new Date(file.generatedAt);
  const previousGeneratedAt = new Date(file.previousGeneratedAt ?? NaN);
  const difficulties = file.difficulties.map(difficulty => ({ ...difficulty }));
  const difficultiesById = new Map(difficulties.map(difficulty => [difficulty.id, difficulty]));
  const bosses = file.bosses.map((boss, index): RaidBoss => ({
    id: boss.id,
    slug: boss.slug,
    name: boss.name,
    shortName: bossShortName(boss),
    index,
    portrait: BOSS_PORTRAITS[boss.slug] ?? ''
  }));
  const specs = decodeSpecs(file.specs);
  const guilds = file.guilds.map(decodeGuild);

  const kills: RaidKill[] = [];
  for (const [realm, logId, boss, difficultyId, killedAt, fightMs, guild, faction, wipes, deaths, members] of file.logs) {
    const difficulty = difficultiesById.get(difficultyId);
    if (!bosses[boss] || !difficulty) {
      continue;
    }

    kills.push({
      realm,
      logId,
      boss: bosses[boss],
      difficulty,
      killedAt: killedAt * 1000,
      fightMs,
      guild: guilds[guild],
      faction,
      wipes,
      deaths,
      memberCount: members
    });
  }

  const top = new Map<string, { dps?: RaidPerformer; hps?: RaidPerformer }>();
  for (const entry of file.top) {
    top.set(encounterKey(entry.boss, entry.difficulty), {
      dps: entry.dps ? decodePerformer(entry.dps, specs) : undefined,
      hps: entry.hps ? decodePerformer(entry.hps, specs) : undefined
    });
  }

  const hasPrevious = !Number.isNaN(previousGeneratedAt.getTime());
  return {
    generatedAt: Number.isNaN(generatedAt.getTime()) ? undefined : generatedAt,
    previousGeneratedAt: hasPrevious ? previousGeneratedAt : undefined,
    newLogs: new Set(hasPrevious ? (file.newLogs ?? []).map(([realm, logId]) => logKey({ realm, logId })) : []),
    raid: file.raid,
    difficulties,
    bosses,
    specs,
    kills,
    items: new Map(file.items.map(([id, name, quality, icon]) => [id, { id, name, quality, icon }])),
    top
  };
}

export function decodeBossFile(
  file: RaidBossFile,
  boss: RaidBoss,
  difficulty: RaidDifficulty,
  specs: ReadonlyMap<number, RaidSpec>
): RaidKillDetails[] {
  const guilds = file.guilds.map(decodeGuild);
  const characters = file.players.map(([name, realm, classId, race, gender, guild]): RaidCharacter =>
    ({ name, realm, classId, race, gender, guild }));
  const trinkets = (file.trinkets ?? []).map(([id, itemLevel, name, quality, icon]): RaidTrinket =>
    ({ id, itemLevel, name, quality, icon }));

  return file.logs.map(([realm, logId, killedAt, fightMs, guild, faction, wipes, deaths, resurrects, members, items]) => {
    const seconds = fightMs > 0 ? fightMs / 1000 : 0;
    return {
      realm,
      logId,
      boss,
      difficulty,
      killedAt: killedAt * 1000,
      fightMs,
      guild: guilds[guild],
      faction,
      wipes,
      deaths,
      resurrects,
      items,
      members: members.flatMap(([player, spec, itemLevel, damage, healing, absorbs, overhealing, damageTaken, interrupts, dispels, talents, worn]) => {
        const character = characters[player];
        return character ? [{
          character,
          spec: specs.get(spec),
          itemLevel,
          damage,
          healing,
          absorbs,
          overhealing,
          damageTaken,
          interrupts,
          dispels,
          dps: seconds ? damage / seconds : 0,
          hps: seconds ? (healing + absorbs) / seconds : 0,
          talents: talents ?? '',
          trinkets: (worn ?? []).flatMap(position => trinkets[position] ?? [])
        }] : [];
      })
    };
  });
}

export function bossFilePath(boss: Pick<RaidBoss, 'slug'>, difficulty: Pick<RaidDifficulty, 'slug'>): string {
  return `${RAID_LOGS_DATA_DIR}/${boss.slug}-${difficulty.slug}.json`;
}

export function encounterKey(bossSlug: string, difficultySlug: string): string {
  return `${bossSlug}|${difficultySlug}`;
}

export function decodeTalents(file: RaidTalentsFile): RaidTalentTable {
  return new Map(file.specs.map(([specId, tiers]) => [
    specId,
    tiers.map(choices => choices.map(choice => choice ? { id: choice[0], name: choice[1], icon: choice[2] } : undefined))
  ]));
}

export function decodeTalentTooltips(file: RaidTalentTooltipsFile): RaidTalentTooltips {
  return new Map(file.spells.map(([spellId, details, description]) => [spellId, { details: details.join(' · '), description }]));
}

export function memberTalents(member: Pick<RaidMember, 'spec' | 'talents'>, table: RaidTalentTable): Array<RaidTalent | undefined> {
  const tiers = member.spec ? table.get(member.spec.id) : undefined;
  if (!tiers || !member.talents) {
    return [];
  }

  return [...member.talents].map((column, tier) => tiers[tier]?.[Number(column)]);
}

export function decodeGenders(file: RaidGendersFile): Map<string, number> {
  const genders = new Map<string, number>();
  for (const [gender, byRealm] of [[0, file.male], [1, file.female]] as const) {
    for (const [realm, names] of Object.entries(byRealm ?? {})) {
      for (const name of names) {
        genders.set(characterKey({ name, realm }), gender);
      }
    }
  }
  return genders;
}

function decodeSpecs(entries: readonly RaidSpecEntry[]): Map<number, RaidSpec> {
  const icons = new Map(LEGION_SPECS.map(spec => [`${spec.classId}|${spec.spec}`, spec.icon]));
  return new Map(entries.map(entry => [entry.id, {
    id: entry.id,
    classId: entry.class,
    name: entry.name,
    role: entry.role,
    icon: icons.get(`${entry.class}|${entry.name}`)
  }]));
}

function decodeGuild([name, realm, faction, id]: RaidGuildEntry): RaidGuild {
  return { name, realm, faction, id };
}

function decodePerformer(
  [name, realm, classId, specId, perSecond, logRealm, logId]: RaidPerformerEntry,
  specs: ReadonlyMap<number, RaidSpec>
): RaidPerformer {
  return { name, realm, classId, spec: specs.get(specId), perSecond, logRealm, logId };
}

export interface RankingFilter {
  classId?: number;
  specId?: number;
  realm?: string;
  role?: Role;
}

export interface RankedPerformance {
  rank: number;
  member: RaidMember;
  kill: RaidKillDetails;
  value: number;
}

export function countsFor(metric: RaidMetric, spec: RaidSpec | undefined): boolean {
  if (!spec) {
    return false;
  }

  return metric === 'hps' ? spec.role === 'healer' : spec.role !== 'healer';
}

export function rankCharacters(
  kills: readonly RaidKillDetails[],
  metric: RaidMetric,
  filter: RankingFilter = {}
): RankedPerformance[] {
  const best = new Map<RaidCharacter, Omit<RankedPerformance, 'rank'>>();

  for (const kill of kills) {
    for (const member of kill.members) {
      if (!countsFor(metric, member.spec) || !matchesFilter(member, filter)) {
        continue;
      }

      const value = member[metric];
      const known = best.get(member.character);
      if (!known || value > known.value || (value === known.value && kill.killedAt < known.kill.killedAt)) {
        best.set(member.character, { member, kill, value });
      }
    }
  }

  return [...best.values()]
    .sort((a, b) => b.value - a.value || a.kill.killedAt - b.kill.killedAt)
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

function matchesFilter(member: RaidMember, filter: RankingFilter): boolean {
  return (filter.classId === undefined || member.character.classId === filter.classId)
    && (filter.specId === undefined || member.spec?.id === filter.specId)
    && (filter.role === undefined || member.spec?.role === filter.role)
    && (filter.realm === undefined || realmSlug(member.character.realm) === filter.realm);
}

export interface BossStanding {
  rank?: number;
  ranked: number;
  relative: number;
}

export function bossStanding(
  kills: readonly RaidKillDetails[],
  metric: RaidMetric,
  key: string,
  filter: RankingFilter = {}
): BossStanding {
  const ranking = rankCharacters(kills, metric, filter);
  const own = ranking.find(entry => characterKey(entry.member.character) === key);
  const top = ranking[0]?.value ?? 0;
  return { rank: own?.rank, ranked: ranking.length, relative: own && top > 0 ? own.value / top : 0 };
}

export const MAX_SCORE = 6969;

interface Appearance {
  member: RaidMember;
  kill: RaidKillDetails;
}

const characterKeys = new WeakMap<RaidCharacter, string>();

function cachedCharacterKey(character: RaidCharacter): string {
  let key = characterKeys.get(character);
  if (key === undefined) {
    key = characterKey(character);
    characterKeys.set(character, key);
  }
  return key;
}

export interface BossPerformance {
  boss: RaidBoss;
  best?: Appearance;
  value: number;
  relative: number;
}

export interface CharacterScore {
  character: RaidCharacter;
  spec?: RaidSpec;
  faction: number;
  itemLevel: number;
  bosses: BossPerformance[];
  killed: number;
  performance: number;
  score: number;
}

export interface RankedScore extends CharacterScore {
  rank: number;
}

export function scoreCharacters(
  bosses: readonly RaidBoss[],
  bossKills: ReadonlyArray<readonly RaidKillDetails[]>,
  metric: RaidMetric,
  specId?: number
): CharacterScore[] {
  interface Tally {
    latest: Appearance;
    specs: Map<RaidSpec, { count: number; at: number }>;
    bests: Array<Appearance | undefined>;
  }

  const tallies = new Map<string, Tally>();
  const tops = bosses.map(() => 0);

  bosses.forEach((boss, bossIndex) => {
    for (const kill of bossKills[bossIndex] ?? []) {
      for (const member of kill.members) {
        if (!member.spec || !countsFor(metric, member.spec)) {
          continue;
        }

        const value = member[metric];
        tops[bossIndex] = Math.max(tops[bossIndex], value);
        if (specId !== undefined && member.spec.id !== specId) {
          continue;
        }

        const key = cachedCharacterKey(member.character);
        let tally = tallies.get(key);
        if (!tally) {
          tally = { latest: { member, kill }, specs: new Map(), bests: bosses.map(() => undefined) };
          tallies.set(key, tally);
        }

        if (kill.killedAt > tally.latest.kill.killedAt) {
          tally.latest = { member, kill };
        }

        const spec = tally.specs.get(member.spec) ?? { count: 0, at: 0 };
        tally.specs.set(member.spec, { count: spec.count + 1, at: Math.max(spec.at, kill.killedAt) });

        const best = tally.bests[bossIndex];
        if (!best || value > best.member[metric] || (value === best.member[metric] && kill.killedAt < best.kill.killedAt)) {
          tally.bests[bossIndex] = { member, kill };
        }
      }
    }
  });

  const scoredBosses = tops.filter(top => top > 0).length;
  if (!scoredBosses) {
    return [];
  }

  const scores = [...tallies.values()].map((tally): CharacterScore => {
    const performances = bosses.map((boss, bossIndex): BossPerformance => {
      const best = tally.bests[bossIndex];
      const value = best ? best.member[metric] : 0;
      return { boss, best, value, relative: tops[bossIndex] > 0 ? value / tops[bossIndex] : 0 };
    });
    const performance = performances.reduce((sum, entry) => sum + entry.relative, 0) / scoredBosses;
    const { member, kill } = tally.latest;
    const spec = [...tally.specs.entries()].sort((a, b) => b[1].count - a[1].count || b[1].at - a[1].at)[0]?.[0];

    return {
      character: member.character,
      spec,
      faction: raceFaction(member.character.race) ?? kill.faction,
      itemLevel: member.itemLevel,
      bosses: performances,
      killed: performances.filter(entry => entry.best).length,
      performance,
      score: toScore(performance)
    };
  });

  return scores.sort((a, b) =>
    b.performance - a.performance || b.killed - a.killed || a.character.name.localeCompare(b.character.name));
}

function toScore(performance: number): number {
  return Math.floor(MAX_SCORE * performance + 1e-9);
}

export function specMetric(spec: RaidSpec): RaidMetric {
  return spec.role === 'healer' ? 'hps' : 'dps';
}

export interface SpecCharacterScore {
  character: RaidCharacter;
  score: number;
}

export function scoresBySpec(
  bosses: readonly RaidBoss[],
  bossKills: ReadonlyArray<readonly RaidKillDetails[]>
): Map<RaidSpec, SpecCharacterScore[]> {
  const tops: Record<RaidMetric, number[]> = { dps: bosses.map(() => 0), hps: bosses.map(() => 0) };
  const bests = new Map<RaidSpec, Map<string, { character: RaidCharacter; values: number[] }>>();

  bosses.forEach((boss, bossIndex) => {
    for (const kill of bossKills[bossIndex] ?? []) {
      for (const member of kill.members) {
        if (!member.spec) {
          continue;
        }

        const metric = specMetric(member.spec);
        const value = member[metric];
        tops[metric][bossIndex] = Math.max(tops[metric][bossIndex], value);

        let characters = bests.get(member.spec);
        if (!characters) {
          characters = new Map();
          bests.set(member.spec, characters);
        }

        const key = cachedCharacterKey(member.character);
        let entry = characters.get(key);
        if (!entry) {
          entry = { character: member.character, values: bosses.map(() => 0) };
          characters.set(key, entry);
        }
        entry.values[bossIndex] = Math.max(entry.values[bossIndex], value);
      }
    }
  });

  const scoredBosses = { dps: tops.dps.filter(top => top > 0).length, hps: tops.hps.filter(top => top > 0).length };
  const scores = new Map<RaidSpec, SpecCharacterScore[]>();
  for (const [spec, characters] of bests) {
    const metric = specMetric(spec);
    const top = tops[metric];
    if (!scoredBosses[metric]) {
      continue;
    }

    scores.set(spec, [...characters.values()]
      .map(({ character, values }) => ({
        character,
        score: toScore(values.reduce((sum, value, bossIndex) => sum + (top[bossIndex] > 0 ? value / top[bossIndex] : 0), 0) / scoredBosses[metric])
      }))
      .sort((a, b) => b.score - a.score || a.character.name.localeCompare(b.character.name)));
  }

  return scores;
}

export const SPEC_TOP_SCORES = 10;

export function topAverage(scores: readonly number[], count: number = SPEC_TOP_SCORES): number {
  const top = [...scores].sort((a, b) => b - a).slice(0, count);
  return top.length ? Math.round(top.reduce((sum, score) => sum + score, 0) / top.length) : 0;
}

export interface SpecPerformance extends SpecDefinition {
  count: number;
  score: number;
  best?: SpecCharacterScore;
}

export interface ClassPerformance {
  classId: number;
  className: string;
  color: string;
  count: number;
  score: number;
  specs: SpecPerformance[];
}

export interface SpecPerformanceSummary {
  characterCount: number;
  classes: ClassPerformance[];
}

export function specPerformance(
  scores: ReadonlyMap<RaidSpec, readonly SpecCharacterScore[]>,
  role?: Role
): SpecPerformanceSummary {
  const bySpec = new Map([...scores].map(([spec, entries]) => [`${spec.classId}|${spec.name}`, entries]));
  const groups = new Map<number, { group: ClassPerformance; characters: Map<string, number> }>();
  const characters = new Set<string>();

  for (const definition of LEGION_SPECS) {
    if (role && definition.role !== role) {
      continue;
    }

    let entry = groups.get(definition.classId);
    if (!entry) {
      entry = {
        group: {
          classId: definition.classId,
          className: CLASS_NAMES[definition.classId] ?? 'Unknown',
          color: getClassColor(definition.classId) ?? '#9a9a9a',
          count: 0,
          score: 0,
          specs: []
        },
        characters: new Map()
      };
      groups.set(definition.classId, entry);
    }

    const specScores = bySpec.get(`${definition.classId}|${definition.spec}`) ?? [];
    entry.group.specs.push({
      ...definition,
      count: specScores.length,
      score: topAverage(specScores.map(score => score.score)),
      best: specScores[0]
    });

    for (const { character, score } of specScores) {
      const key = cachedCharacterKey(character);
      characters.add(key);
      entry.characters.set(key, Math.max(entry.characters.get(key) ?? 0, score));
    }
  }

  const classes = [...groups.values()].map(({ group, characters: classCharacters }) => {
    group.count = classCharacters.size;
    group.score = topAverage([...classCharacters.values()]);
    group.specs.sort((a, b) => b.score - a.score);
    return group;
  });
  classes.sort((a, b) => compareSpecLists(a.specs, b.specs, spec => spec.score) || a.classId - b.classId);

  return { characterCount: characters.size, classes };
}

export function scoreTicks(maxScore: number): number[] {
  const step = [100, 200, 250, 500, 1000, 2000].find(candidate => maxScore / candidate <= 5) ?? 2000;
  const top = Math.max(step, Math.ceil(maxScore / step) * step);
  return Array.from({ length: top / step + 1 }, (_, index) => index * step);
}

export function formatScoreTick(score: number): string {
  return score >= 1000 ? `${score / 1000}k` : String(score);
}

export interface ScoreFilter {
  classId?: number;
  realm?: string;
}

export function rankScores(scores: readonly CharacterScore[], filter: ScoreFilter = {}): RankedScore[] {
  return scores
    .filter(entry => (filter.classId === undefined || entry.character.classId === filter.classId)
      && (filter.realm === undefined || realmSlug(entry.character.realm) === filter.realm))
    .map((entry, index) => ({ ...entry, rank: index + 1 }));
}

export function killsBefore(
  bossKills: ReadonlyArray<readonly RaidKillDetails[]>,
  newLogs: ReadonlySet<string>
): RaidKillDetails[][] {
  return bossKills.map(kills => kills.filter(kill => !newLogs.has(logKey(kill))));
}

export interface ScoreChange {
  rank: number;
  score: number;
  isNew: boolean;
}

export function scoreChanges(current: readonly RankedScore[], previous: readonly RankedScore[]): Map<string, ScoreChange> {
  const before = new Map(previous.map(entry => [cachedCharacterKey(entry.character), entry]));
  const changes = new Map<string, ScoreChange>();

  for (const entry of current) {
    const key = cachedCharacterKey(entry.character);
    const earlier = before.get(key);
    if (!earlier) {
      changes.set(key, { rank: 0, score: 0, isNew: true });
    } else if (earlier.rank !== entry.rank || earlier.score !== entry.score) {
      changes.set(key, { rank: earlier.rank - entry.rank, score: entry.score - earlier.score, isNew: false });
    }
  }

  return changes;
}

export function performanceQuality(relative: number): number {
  if (relative >= 1) {
    return 6;
  }
  if (relative >= .95) {
    return 5;
  }
  if (relative >= .75) {
    return 4;
  }
  if (relative >= .5) {
    return 3;
  }
  return relative >= .25 ? 2 : 0;
}

export function fastestKills<T extends Pick<RaidKill, 'fightMs' | 'killedAt'>>(kills: readonly T[]): T[] {
  return [...kills].sort((a, b) => a.fightMs - b.fightMs || a.killedAt - b.killedAt);
}

export function latestKills<T extends Pick<RaidKill, 'killedAt'>>(kills: readonly T[]): T[] {
  return [...kills].sort((a, b) => b.killedAt - a.killedAt);
}

export interface GuildProgress {
  rank: number;
  guild: RaidGuild;
  firsts: Array<RaidKill | undefined>;
  killed: number;
  progressedAt: number;
  kills: number;
}

export function guildProgression(
  kills: readonly RaidKill[],
  difficultyId: number,
  bossCount: number
): GuildProgress[] {
  const rows = new Map<string, Omit<GuildProgress, 'rank'>>();

  for (const kill of kills) {
    const guild = kill.guild;
    if (kill.difficulty.id !== difficultyId || !guild?.name) {
      continue;
    }

    const key = guildKey(guild);
    let row = rows.get(key);
    if (!row) {
      row = { guild, firsts: Array.from({ length: bossCount }, () => undefined), killed: 0, progressedAt: 0, kills: 0 };
      rows.set(key, row);
    }

    row.kills++;
    const first = row.firsts[kill.boss.index];
    if (!first || kill.killedAt < first.killedAt) {
      row.firsts[kill.boss.index] = kill;
    }
  }

  for (const row of rows.values()) {
    const firsts = row.firsts.filter((kill): kill is RaidKill => !!kill);
    row.killed = firsts.length;
    row.progressedAt = Math.max(0, ...firsts.map(kill => kill.killedAt));
  }

  return [...rows.values()]
    .sort((a, b) => b.killed - a.killed || a.progressedAt - b.progressedAt || a.guild.name.localeCompare(b.guild.name))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export interface ProgressionFilter {
  faction?: number;
  realm?: string;
}

export function filterProgression(rows: readonly GuildProgress[], filter: ProgressionFilter = {}): GuildProgress[] {
  return rows
    .filter(row => (filter.faction === undefined || row.guild.faction === filter.faction)
      && (filter.realm === undefined || realmSlug(row.guild.realm) === filter.realm))
    .map((row, index) => ({ ...row, rank: index + 1 }));
}

export function speedRank(kill: Pick<RaidKill, 'realm' | 'logId'>, kills: readonly RaidKill[]): number {
  const fastest = fastestKills(kills);
  return fastest.findIndex(other => other.realm === kill.realm && other.logId === kill.logId) + 1;
}

export function defaultDifficulty(difficulties: readonly RaidDifficulty[]): RaidDifficulty | undefined {
  return [...difficulties].reverse().find(difficulty => difficulty.kills > 0) ?? difficulties[0];
}

export function parseRoleFilter(value: string | null | undefined): RoleFilter {
  return parseRole(value) ?? 'all';
}

export function guildKey(guild: Pick<RaidGuild, 'name' | 'realm'>): string {
  return `${realmSlug(guild.realm)}/${guild.name}`;
}

export function characterKey(character: Pick<RaidCharacter, 'name' | 'realm'>): string {
  return `${realmSlug(character.realm)}/${character.name}`;
}

export function logKey(kill: Pick<RaidKill, 'realm' | 'logId'>): string {
  return `${realmSlug(kill.realm)}/${kill.logId}`;
}

export function raidLogLink(kill: Pick<RaidKill, 'realm' | 'logId'>): Array<string | number> {
  return ['/raid-logs', 'log', realmSlug(kill.realm), kill.logId];
}

export function raidBossLink(boss: Pick<RaidBoss, 'slug'>): string[] {
  return ['/raid-logs', 'boss', boss.slug];
}

export function raidGuildLink(guild: Pick<RaidGuild, 'name' | 'realm'>): string[] {
  return ['/raid-logs', 'guild', realmSlug(guild.realm), guild.name];
}

export function raidCharacterLink(character: Pick<RaidCharacter, 'name' | 'realm'>): string[] {
  return ['/raid-logs', 'character', realmSlug(character.realm), character.name];
}

export function formatFightTime(milliseconds: number): string {
  return formatClock(Math.round(milliseconds / 1000));
}

export function formatPerSecond(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '0';
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }
  return String(Math.round(value));
}

export function formatAmount(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return '0';
  }
  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `${Math.round(value / 1_000)}k`;
  }
  return String(Math.round(value));
}

export function formatAgo(at: number, now: number): string {
  const minutes = Math.max(0, Math.floor((now - at) / 60_000));
  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes} min ago`;
  }

  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours} h ago` : `${Math.floor(hours / 24)} d ago`;
}

export function nameMatches(name: string, query: string): boolean {
  const wanted = foldText(query.trim());
  return !wanted || foldText(name).includes(wanted);
}

function foldText(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase();
}

export const RAID_PAGE_SIZE = 50;

export function pageCount(total: number, pageSize: number = RAID_PAGE_SIZE): number {
  return Math.max(1, Math.ceil(total / pageSize));
}
