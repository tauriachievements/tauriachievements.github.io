import { RaceBoss, RaidRace } from './raid-races';

export interface RaceKillEntry {
  readonly guild?: string;
  readonly realm?: string;
  readonly date?: string;
  readonly time?: string;
  readonly youtubeUrl?: string;
}

export type RaceDataset = Readonly<Record<string, readonly RaceKillEntry[] | undefined>>;

export interface RaceKill extends RaceKillEntry {
  readonly guild: string;
}

export interface RaceBossView extends RaceBoss {
  readonly guilds: readonly RaceKill[];
}

export interface TimelineCheckpoint {
  readonly boss: RaceBossView;
  readonly kill?: RaceKill;
  readonly minute?: number;
  readonly positionPercent?: number;
  readonly splitMinutes?: number;
  readonly isFirstKill: boolean;
  readonly isVisible: boolean;
}

export interface GuildTimeline {
  readonly guild: string;
  readonly realm?: string;
  readonly color: string;
  readonly completed: number;
  readonly isLeader: boolean;
  readonly totalMinutes?: number;
  readonly progressStart?: number;
  readonly progressWidth?: number;
  readonly checkpoints: readonly TimelineCheckpoint[];
}

export interface TimelineHour {
  readonly label: string;
  readonly position: number;
}

export const PLAYBACK_START_MINUTE = 10;

const RACE_SLOT_COUNT = 5;
const THREE_MINUTE_PLAYBACK_START = 60;
const DEFAULT_REALM = 'Evermoon';
const GUILD_REALMS: Readonly<Record<string, string>> = { outlaws: 'Tauri' };
const GUILD_COLORS = ['#ffb347', '#8ce6ff', '#d69cff', '#ff7897', '#91e58b', '#ffd86b', '#74a8ff'];
const MONTHS: Readonly<Record<string, string>> = {
  jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
  jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
};

export function raceSlots(entries: readonly RaceKillEntry[] | undefined): RaceKill[] {
  return Array.from({ length: RACE_SLOT_COUNT }, (_, index) => raceKill(entries?.[index]));
}

export function raceBossViews(race: RaidRace, data: RaceDataset): RaceBossView[] {
  return race.bosses.map(boss => ({ ...boss, guilds: raceSlots(data[boss.key]) }));
}

export function raceDay(bosses: readonly RaceBossView[]): string | undefined {
  const dates = bosses.flatMap(boss => boss.guilds.flatMap(kill => kill.guild && kill.date ? [kill.date] : []));
  return dates.length ? dates.reduce((earliest, date) => date < earliest ? date : earliest) : undefined;
}

export function raceDuration(race: RaidRace): number {
  return (race.endHour - race.startHour) * 60;
}

export function timelineHours(race: RaidRace): TimelineHour[] {
  const hours = race.endHour - race.startHour;
  return Array.from({ length: hours + 1 }, (_, index) => ({
    label: clock((race.startHour + index) * 60),
    position: index / hours * 100
  }));
}

export function guildTimelines(bosses: readonly RaceBossView[], race: RaidRace, playbackMinute: number): GuildTimeline[] {
  const day = raceDay(bosses);
  if (!day) {
    return [];
  }

  const excluded = new Set(race.timelineExcludedGuilds);
  const guilds = new Map<string, string>();
  bosses.forEach(boss => boss.guilds.forEach(kill => {
    if (kill.guild && kill.date === day) {
      guilds.set(guildKey(kill.guild), kill.guild);
    }
  }));

  const lanes = [...guilds.values()]
    .filter(guild => !excluded.has(guildKey(guild)))
    .map((guild, index) => guildLane(guild, GUILD_COLORS[index % GUILD_COLORS.length], bosses, race, day, playbackMinute))
    .sort(byFinalStanding);
  const [leader] = [...lanes].sort(byStandingAtPlayback);
  const leaderGuild = leader?.completed ? leader.guild : undefined;

  return lanes.map(lane => ({ ...lane, isLeader: lane.guild === leaderGuild }));
}

export function nextPlaybackMinute(minute: number): number {
  return minute + (minute >= THREE_MINUTE_PLAYBACK_START ? 3 : 1);
}

export function playbackClock(race: RaidRace, minute: number): string {
  return clock(race.startHour * 60 + minute);
}

export function raceGuildRealm(guild: string, realm?: string): string {
  return realm ?? GUILD_REALMS[guildKey(guild)] ?? DEFAULT_REALM;
}

export function formatRaceDuration(minutes: number | undefined): string {
  if (minutes === undefined) {
    return '';
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return hours ? `${hours}h ${remainingMinutes}m` : `${remainingMinutes}m`;
}

export function formatSplit(minutes: number | undefined): string {
  return minutes === undefined ? '' : `+${minutes} min`;
}

export function formatKillDate(date: string | undefined): string {
  if (!date) {
    return '';
  }

  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? date
    : new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(parsed);
}

function guildLane(
  guild: string,
  color: string,
  bosses: readonly RaceBossView[],
  race: RaidRace,
  day: string,
  playbackMinute: number
): GuildTimeline {
  let previousMinute: number | undefined;
  const checkpoints = bosses.map((boss): TimelineCheckpoint => {
    const kill = boss.guilds.find(candidate => candidate.date === day && sameGuild(candidate.guild, guild));
    const minute = kill ? raceMinute(kill, race) : undefined;
    const firstGuild = boss.guilds.find(candidate => candidate.guild)?.guild;
    const splitMinutes = minute !== undefined && previousMinute !== undefined
      ? Math.max(0, minute - previousMinute)
      : undefined;
    previousMinute = minute ?? previousMinute;

    return {
      boss,
      kill,
      minute,
      positionPercent: minute === undefined ? undefined : timelinePosition(minute, race),
      splitMinutes,
      isFirstKill: !!kill && firstGuild !== undefined && sameGuild(firstGuild, guild),
      isVisible: minute !== undefined && minute <= playbackMinute
    };
  });
  const visible = checkpoints.filter(checkpoint => checkpoint.isVisible);
  const positions = visible.flatMap(checkpoint => checkpoint.positionPercent === undefined ? [] : [checkpoint.positionPercent]);
  const minutes = visible.flatMap(checkpoint => checkpoint.minute === undefined ? [] : [checkpoint.minute]);
  const progressStart = positions.length ? Math.min(...positions) : undefined;
  const progressEnd = positions.length ? Math.max(...positions) : undefined;
  const firstMinute = minutes.at(0);
  const lastMinute = minutes.at(-1);

  return {
    guild,
    realm: bosses.flatMap(boss => boss.guilds).find(kill => kill.realm && sameGuild(kill.guild, guild))?.realm,
    color,
    completed: visible.length,
    isLeader: false,
    totalMinutes: firstMinute !== undefined && lastMinute !== undefined && visible.length > 1
      ? lastMinute - firstMinute
      : undefined,
    progressStart,
    progressWidth: progressStart !== undefined && progressEnd !== undefined
      ? Math.max(0, progressEnd - progressStart)
      : undefined,
    checkpoints
  };
}

function byFinalStanding(left: GuildTimeline, right: GuildTimeline): number {
  const leftKills = left.checkpoints.filter(checkpoint => checkpoint.kill);
  const rightKills = right.checkpoints.filter(checkpoint => checkpoint.kill);
  return rightKills.length - leftKills.length ||
    (leftKills.at(-1)?.minute ?? Number.MAX_SAFE_INTEGER) - (rightKills.at(-1)?.minute ?? Number.MAX_SAFE_INTEGER) ||
    left.guild.localeCompare(right.guild);
}

function byStandingAtPlayback(left: GuildTimeline, right: GuildTimeline): number {
  const leftLatest = left.checkpoints.filter(checkpoint => checkpoint.isVisible).at(-1)?.minute;
  const rightLatest = right.checkpoints.filter(checkpoint => checkpoint.isVisible).at(-1)?.minute;
  return right.completed - left.completed ||
    (leftLatest ?? Number.MAX_SAFE_INTEGER) - (rightLatest ?? Number.MAX_SAFE_INTEGER) ||
    left.guild.localeCompare(right.guild);
}

function raceKill(entry: RaceKillEntry | undefined): RaceKill {
  const realm = present(entry?.realm);
  const date = present(entry?.date);
  const time = present(entry?.time);
  const isOlderEntry = !!realm && !!date && !time && looksLikeDate(realm) && looksLikeTime(date);

  return {
    guild: entry?.guild?.trim() ?? '',
    realm: isOlderEntry ? undefined : realm,
    date: isOlderEntry ? normaliseDate(realm) : date && normaliseDate(date),
    time: isOlderEntry ? date : time,
    youtubeUrl: present(entry?.youtubeUrl)
  };
}

function raceMinute(kill: RaceKill, race: RaidRace): number | undefined {
  const match = /^(\d{1,2}):(\d{2})$/.exec(kill.time ?? '');
  return match ? Number(match[1]) * 60 + Number(match[2]) - race.startHour * 60 : undefined;
}

function timelinePosition(minute: number, race: RaidRace): number {
  return Math.min(100, Math.max(0, minute / raceDuration(race) * 100));
}

function clock(totalMinutes: number): string {
  return `${Math.floor(totalMinutes / 60).toString().padStart(2, '0')}:${(totalMinutes % 60).toString().padStart(2, '0')}`;
}

function present(value: string | undefined): string | undefined {
  return value?.trim() || undefined;
}

function guildKey(guild: string): string {
  return guild.toLocaleLowerCase();
}

function sameGuild(left: string, right: string): boolean {
  return guildKey(left) === guildKey(right);
}

function looksLikeDate(value: string): boolean {
  return /^\d{1,2}-[A-Za-z]{3}-\d{4}$/.test(value) || /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function looksLikeTime(value: string): boolean {
  return /^\d{1,2}:\d{2}$/.test(value);
}

function normaliseDate(value: string): string {
  const match = /^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/.exec(value);
  const month = match ? MONTHS[match[2].toLocaleLowerCase()] : undefined;
  return match && month ? `${match[3]}-${month}-${match[1].padStart(2, '0')}` : value;
}
