import { RatedBattlegroundMatch, RatedBattlegroundMember } from './rated-battleground-stats';

export function member(overrides: Partial<RatedBattlegroundMember> = {}): RatedBattlegroundMember {
  return {
    guid: 1,
    'character-minimal-data': {
      charname: 'Player', race: 1, class: 1, gender: 0, guildname: 'Guild',
      played_time: 86_400, achievements: 100, achievements_total: 200, level: 110, faction: 0
    },
    realmid: 9,
    realmName: '[EN] Evermoon',
    side: 0,
    killing_blows: 2,
    deaths: 1,
    damage_done: 100,
    healing_done: 50,
    damage_taken: 75,
    healing_taken: 40,
    bg_data0: 1,
    bg_data1: 2,
    bg_data2: 0,
    bg_data3: 0,
    bg_data4: 0,
    personal_rating: 1000,
    personal_rating_change: 10,
    mmr_rating: 1500,
    mmr_rating_change: 20,
    israndom: false,
    honor: 30,
    specid: 71,
    ...overrides
  };
}

export function match(overrides: Partial<RatedBattlegroundMatch> = {}): RatedBattlegroundMatch {
  return {
    expansion: 6,
    dataUrlPrefix: 'legion-',
    matchid: 10,
    mapid: 489,
    mapname: 'Warsong Gulch',
    winner: 1,
    bgtype: 0,
    isranked: true,
    losermmravg: 1400,
    winnermmravg: 1500,
    loserpersonalavg: 900,
    winnerpersonalavg: 1000,
    starttime: 1_789_600_000,
    length: 600_000,
    side0: 1,
    side1: 1,
    members: [member(), member({ guid: 2, side: 1 })],
    ...overrides
  };
}
