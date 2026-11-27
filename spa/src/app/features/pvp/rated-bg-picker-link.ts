import {
  BenchHistory,
  COMPOSITION_CHOICES,
  DEFAULT_COMPOSITION,
  Match,
  NO_BENCH_HISTORY,
  RosterPlayer,
  TeamComposition,
  compositionOf,
  inTeamOrder,
  keysIn,
  linkedMatch,
  parseLeaders,
  parseTeams,
  teamLeaders,
  teamsOf
} from './rated-bg-picker';

export const PICKER_LINK_PARAM = 't';

export interface PickerState {
  readonly picked: ReadonlySet<string>;
  readonly composition: TeamComposition;
  readonly flagCarriers: ReadonlySet<string>;
  readonly match: Match | undefined;
  readonly history: BenchHistory;
}

export interface OpenedLink {
  readonly state: PickerState;
  readonly gone: number;
  readonly teamsDropped: boolean;
}

const LINK_VERSION = '1';
const TEAMS_MODE = 'T';
const PICKING_MODE = 'P';
const HEADER_LENGTH = 2 + COMPOSITION_CHOICES.length;
const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
const BITS_PER_CHARACTER = 6;
const CHARACTER_MASK = ALPHABET.length - 1;
const CODE_LENGTH = 4;
const CODE_BITS = CODE_LENGTH * BITS_PER_CHARACTER;
const CODE_MASK = 2 ** CODE_BITS - 1;
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;

const TICKED = 1;
const PLACE_SHIFT = 1;
const PLACE_MASK = 3;
const FLAG_CARRIER = 8;
const BACK_FROM_BENCH = 16;
const SAT_OUT = 32;

const NOWHERE = 0;
const FIRST_TEAM = 1;
const SECOND_TEAM = 2;
const BENCH = 3;

interface Token {
  readonly ticked: boolean;
  readonly place: number;
  readonly flagCarrier: boolean;
  readonly backFromBench: boolean;
  readonly sitOuts: number;
  readonly sitOutStreak: number;
}

const BLANK_TOKEN: Token = { ticked: false, place: NOWHERE, flagCarrier: false, backFromBench: false, sitOuts: 0, sitOutStreak: 0 };

export function playerCode(key: string): string {
  let hash = FNV_OFFSET_BASIS;
  for (const byte of new TextEncoder().encode(key)) {
    hash = Math.imul(hash ^ byte, FNV_PRIME) >>> 0;
  }
  const folded = (hash >>> CODE_BITS) ^ (hash & CODE_MASK);
  return Array.from({ length: CODE_LENGTH }, (_, index) =>
    ALPHABET[(folded >>> (index * BITS_PER_CHARACTER)) & CHARACTER_MASK]).join('');
}

export function pickerLink(state: PickerState, players: readonly RosterPlayer[]): string | null {
  const tokens = linkTokens(state, players);
  if (!state.match && !tokens.size && sameComposition(state.composition, DEFAULT_COMPOSITION)) {
    return null;
  }

  const mode = state.match ? TEAMS_MODE : PICKING_MODE;
  const composition = COMPOSITION_CHOICES.map(({ id }) => state.composition[id]).join('');
  return `${LINK_VERSION}${mode}${composition}${[...tokens].map(([key, token]) => written(key, token)).join('')}`;
}

export function openPickerLink(value: string, players: readonly RosterPlayer[]): OpenedLink | undefined {
  const header = readHeader(value);
  const tokens = readTokens(value.slice(HEADER_LENGTH));
  if (!header || !tokens) {
    return undefined;
  }

  const rowsByCode = codeLookup(players);
  const seen = new Set<string>();
  const rows: { readonly player: RosterPlayer | undefined; readonly token: Token }[] = [];
  let gone = 0;
  for (const { code, token } of tokens) {
    const player = rowsByCode.get(code) ?? undefined;
    if (!player && token.ticked) {
      gone++;
    }
    if (player && seen.has(player.key)) {
      continue;
    }
    if (player) {
      seen.add(player.key);
    }
    rows.push({ player, token });
  }

  const found = rows.flatMap(({ player, token }) => player ? [{ player, token }] : []);
  const inPlace = (place: number) => rows.filter(row => row.token.place === place).map(row => row.player);
  const teams = header.teamsShown ? teamsOf(inPlace(FIRST_TEAM), inPlace(SECOND_TEAM)) : undefined;
  const picked = new Set(found.filter(({ token }) => token.ticked).map(({ player }) => player.key));
  const match: Match | undefined = teams && {
    teams,
    leaders: teamLeaders(teams, [FIRST_TEAM, SECOND_TEAM].flatMap(place => inPlace(place)[0]?.key ?? [])),
    bench: inTeamOrder(found.filter(({ token }) => token.place === BENCH).map(({ player }) => player)),
    backFromBench: new Set(found.filter(({ token }) => token.backFromBench && isPlaying(token)).map(({ player }) => player.key))
  };

  return {
    state: {
      picked,
      composition: header.composition,
      flagCarriers: new Set(found.filter(({ token }) => token.flagCarrier && token.ticked).map(({ player }) => player.key)),
      match,
      history: {
        sitOuts: new Map(found.filter(({ token }) => token.sitOuts > 0).map(({ player, token }) => [player.person, token.sitOuts])),
        lastMatch: new Set(found.filter(({ token }) => isPlaying(token)).map(({ player }) => player.person)),
        sitOutStreaks: new Map(found
          .filter(({ token }) => token.sitOutStreak > 0)
          .map(({ player, token }) => [player.person, token.sitOutStreak]))
      }
    },
    gone,
    teamsDropped: header.teamsShown && !teams
  };
}

export function openLegacyLink(
  a: string | null,
  b: string | null,
  leaders: string | null,
  players: readonly RosterPlayer[]
): OpenedLink {
  const teams = parseTeams(a, b, players);
  if (teams) {
    const { match, history } = linkedMatch(teams, parseLeaders(leaders, teams));
    return {
      state: {
        picked: new Set([...teams[0], ...teams[1]].map(player => player.key)),
        composition: compositionOf(teams) ?? DEFAULT_COMPOSITION,
        flagCarriers: new Set(),
        match,
        history
      },
      gone: 0,
      teamsDropped: false
    };
  }

  const playersByKey = new Map(players.map(player => [player.key, player]));
  const named = [...new Set([...keysIn(a), ...keysIn(b)])];
  const found = named.flatMap(key => playersByKey.get(key) ?? []);
  return {
    state: {
      picked: new Set(found.map(player => player.key)),
      composition: DEFAULT_COMPOSITION,
      flagCarriers: new Set(),
      match: undefined,
      history: { ...NO_BENCH_HISTORY, lastMatch: new Set(found.map(player => player.person)) }
    },
    gone: named.length - found.length,
    teamsDropped: true
  };
}

export function linkNote(opened: OpenedLink | undefined): string | undefined {
  if (!opened) {
    return "That link can't be read. Tick today's players and shuffle again.";
  }

  const { gone, teamsDropped } = opened;
  if (gone > 0) {
    const players = gone === 1 ? '1 player in that link is' : `${gone} players in that link are`;
    return teamsDropped
      ? `${players} no longer on the player list, so its teams didn't open. Shuffle for new teams.`
      : `${players} no longer on the player list and ${gone === 1 ? 'is' : 'are'} left out.`;
  }
  return teamsDropped ? 'The teams in that link no longer match the player list. Shuffle for new teams.' : undefined;
}

function linkTokens(state: PickerState, players: readonly RosterPlayer[]): Map<string, Token> {
  const tokens = new Map<string, Token>();
  const rowsByKey = new Map(players.map(player => [player.key, player]));
  const update = (player: RosterPlayer, changes: Partial<Token>) =>
    tokens.set(player.key, { ...tokens.get(player.key) ?? BLANK_TOKEN, ...changes });
  const { match, history } = state;

  if (match) {
    match.teams.forEach((team, index) => {
      for (const player of leaderFirst(team, match.leaders)) {
        update(player, { place: index === 0 ? FIRST_TEAM : SECOND_TEAM, backFromBench: match.backFromBench.has(player.key) });
      }
    });
    for (const player of match.bench) {
      update(player, { place: BENCH });
    }
  }
  for (const player of players.filter(player => state.picked.has(player.key))) {
    update(player, { ticked: true, flagCarrier: state.flagCarriers.has(player.key) });
  }

  const persons = new Set([...history.sitOuts.keys(), ...history.sitOutStreaks.keys(), ...match ? [] : history.lastMatch]);
  for (const person of persons) {
    const row = [...tokens.keys()].map(key => rowsByKey.get(key)).find(player => player?.person === person)
      ?? players.find(player => player.person === person);
    if (row) {
      update(row, {
        sitOuts: history.sitOuts.get(person) ?? 0,
        sitOutStreak: history.sitOutStreaks.get(person) ?? 0,
        ...!match && history.lastMatch.has(person) ? { place: FIRST_TEAM } : {}
      });
    }
  }
  return tokens;
}

function leaderFirst(team: readonly RosterPlayer[], leaders: ReadonlySet<string>): RosterPlayer[] {
  return [...team.filter(player => leaders.has(player.key)), ...team.filter(player => !leaders.has(player.key))];
}

function written(key: string, token: Token): string {
  const satOut = token.sitOuts > 0 || token.sitOutStreak > 0;
  const state = (token.ticked ? TICKED : 0)
    | (token.place << PLACE_SHIFT)
    | (token.flagCarrier ? FLAG_CARRIER : 0)
    | (token.backFromBench ? BACK_FROM_BENCH : 0)
    | (satOut ? SAT_OUT : 0);
  const counts = satOut ? `${ALPHABET[Math.min(token.sitOuts, CHARACTER_MASK)]}${ALPHABET[Math.min(token.sitOutStreak, CHARACTER_MASK)]}` : '';
  return `${playerCode(key)}${ALPHABET[state]}${counts}`;
}

function readHeader(value: string): { readonly teamsShown: boolean; readonly composition: TeamComposition } | undefined {
  const mode = value[1];
  if (value.length < HEADER_LENGTH || value[0] !== LINK_VERSION || (mode !== TEAMS_MODE && mode !== PICKING_MODE)) {
    return undefined;
  }

  const composition = Object.fromEntries(
    COMPOSITION_CHOICES.map(({ id }, index) => [id, Number(value[2 + index])])
  ) as unknown as TeamComposition;
  return COMPOSITION_CHOICES.every(({ id, counts }) => counts.includes(composition[id]))
    ? { teamsShown: mode === TEAMS_MODE, composition }
    : undefined;
}

function readTokens(body: string): { readonly code: string; readonly token: Token }[] | undefined {
  const tokens: { readonly code: string; readonly token: Token }[] = [];
  let index = 0;
  while (index < body.length) {
    const digits = Array.from({ length: CODE_LENGTH + 1 }, (_, offset) => digitAt(body, index + offset));
    if (digits.some(digit => digit < 0)) {
      return undefined;
    }
    const code = body.slice(index, index + CODE_LENGTH);
    const state = digits[CODE_LENGTH];
    index += CODE_LENGTH + 1;

    let sitOuts = 0;
    let sitOutStreak = 0;
    if (state & SAT_OUT) {
      sitOuts = digitAt(body, index);
      sitOutStreak = digitAt(body, index + 1);
      if (sitOuts < 0 || sitOutStreak < 0) {
        return undefined;
      }
      index += 2;
    }

    tokens.push({
      code,
      token: {
        ticked: (state & TICKED) !== 0,
        place: (state >> PLACE_SHIFT) & PLACE_MASK,
        flagCarrier: (state & FLAG_CARRIER) !== 0,
        backFromBench: (state & BACK_FROM_BENCH) !== 0,
        sitOuts,
        sitOutStreak
      }
    });
  }
  return tokens;
}

function digitAt(text: string, index: number): number {
  return index < text.length ? ALPHABET.indexOf(text[index]) : -1;
}

function codeLookup(players: readonly RosterPlayer[]): Map<string, RosterPlayer | null> {
  const rowsByCode = new Map<string, RosterPlayer | null>();
  for (const player of players) {
    const code = playerCode(player.key);
    rowsByCode.set(code, rowsByCode.has(code) ? null : player);
  }
  return rowsByCode;
}

function isPlaying(token: Token): boolean {
  return token.place === FIRST_TEAM || token.place === SECOND_TEAM;
}

function sameComposition(a: TeamComposition, b: TeamComposition): boolean {
  return COMPOSITION_CHOICES.every(({ id }) => a[id] === b[id]);
}
