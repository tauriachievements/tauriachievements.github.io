import { describe, it, expect } from 'vitest';
import {
  archivedSeasonId,
  isLiveSeason,
  liveAffixWeek,
  runScoreColor,
  scoreColor,
  scoreTiers,
  seasonDataDir,
  seasonOptions,
  seasonParam,
  characterKey,
  createRunDecoder,
  currentAffixWeek,
  currentPlayers,
  exportedAt,
  formatTimerDelta,
  hasScanChanges,
  MythicPlusDepartedEntry,
  MythicPlusIndex,
  MythicPlusPlayerEntry,
  MythicPlusRunEntry,
  MythicPlusScoreEntry,
  keystoneUpgrades,
  memberNameMatches,
  sharesTables,
  rankPlayers,
  rankRuns,
  runIncludesCharacter,
  runIncludesPlayer,
  seasonScoreColors,
  sortRoster,
  standingChanges,
  upgradeCutoffs,
  upgradeStars
} from './mythic-plus';
import { CLASS_FILTER_OPTIONS } from '../../game/wow';

describe('upgradeStars', () => {
  it('draws one star per upgrade and none for a depleted key', () => {
    expect(upgradeStars(0)).toBe('');
    expect(upgradeStars(1)).toBe('★');
    expect(upgradeStars(2)).toBe('★★');
    expect(upgradeStars(3)).toBe('★★★');
  });
});

describe('CLASS_FILTER_OPTIONS', () => {
  it('lists All classes, then every class A to Z with its icon and colour', () => {
    expect(CLASS_FILTER_OPTIONS.map(option => option.label)).toEqual([
      'All classes', 'Death Knight', 'Demon Hunter', 'Druid', 'Hunter', 'Mage', 'Monk',
      'Paladin', 'Priest', 'Rogue', 'Shaman', 'Warlock', 'Warrior'
    ]);
    expect(CLASS_FILTER_OPTIONS[0].value).toBeUndefined();
    expect(CLASS_FILTER_OPTIONS.slice(1).every(option => typeof option.value === 'number' && option.icon && option.color)).toBe(true);
  });
});

describe('exportedAt', () => {
  it('reads the export time from the index', () => {
    expect(exportedAt({ generatedAt: '2026-10-07T09:30:15Z' })?.toISOString()).toBe('2026-10-07T09:30:15.000Z');
  });

  it('is undefined before the index loads, for older exports and for an invalid time', () => {
    expect(exportedAt(undefined)).toBeUndefined();
    expect(exportedAt({})).toBeUndefined();
    expect(exportedAt({ generatedAt: 'not a date' })).toBeUndefined();
  });
});

describe('currentAffixWeek', () => {
  const run = (completedAt: string, affixes: number[]) => ({ completedAt, affixes });
  const ms = (iso: string) => Date.parse(iso);

  it('takes the newest full affix set and starts the week after the last run of another week', () => {
    const week = currentAffixWeek([
      run('2026-09-29T20:00:00Z', [8, 3, 10]),
      run('2026-09-30T06:49:05Z', [8]),
      run('2026-09-30T07:40:57Z', [5, 4, 9]),
      run('2026-10-05T18:00:00Z', [5, 4, 9]),
      run('2026-10-05T19:00:00Z', [5])
    ]);

    expect(week).toEqual({ affixes: [5, 4, 9], since: ms('2026-09-30T06:49:05Z') + 1 });
  });

  it('places keys without affixes by time only', () => {
    const week = currentAffixWeek([
      run('2026-09-29T20:00:00Z', [8, 3, 10]),
      run('2026-09-30T05:00:00Z', []),
      run('2026-09-30T08:00:00Z', [5, 4, 9])
    ]);

    expect(week?.since).toBe(ms('2026-09-29T20:00:00Z') + 1);
  });

  it('covers the whole season while there has only been one week', () => {
    expect(currentAffixWeek([run('2026-09-16T12:00:00Z', [7, 1, 9])])?.since).toBe(1);
  });

  it('has no week until a run with all three affixes exists', () => {
    expect(currentAffixWeek([run('2026-09-16T12:00:00Z', [7])])).toBeUndefined();
    expect(currentAffixWeek([])).toBeUndefined();
  });
});

describe('keystoneUpgrades', () => {
  it('awards +3, +2 and +1 at the 60% / 80% / 100% cutoffs', () => {
    expect(keystoneUpgrades(1080, 1800)).toBe(3);
    expect(keystoneUpgrades(1081, 1800)).toBe(2);
    expect(keystoneUpgrades(1440, 1800)).toBe(2);
    expect(keystoneUpgrades(1441, 1800)).toBe(1);
    expect(keystoneUpgrades(1800, 1800)).toBe(1);
  });

  it('treats over-time and invalid runs as depleted', () => {
    expect(keystoneUpgrades(1801, 1800)).toBe(0);
    expect(keystoneUpgrades(0, 1800)).toBe(0);
    expect(keystoneUpgrades(1200, 0)).toBe(0);
  });
});

describe('upgradeCutoffs', () => {
  it('converts the cutoffs to seconds for a timer', () => {
    expect(upgradeCutoffs(2100)).toEqual([
      { upgrades: 3, percent: 60, seconds: 1260 },
      { upgrades: 2, percent: 80, seconds: 1680 },
      { upgrades: 1, percent: 100, seconds: 2100 }
    ]);
  });
});

const emptyIndex: MythicPlusIndex = {
  version: 2,
  season: { id: 'legion-s1', name: 'Legion Season 1', raid: 'Emerald Nightmare', startDate: '2026-09-16' },
  dungeons: [],
  affixes: [],
  specs: [],
  players: []
};

describe('seasons', () => {
  const seasons = [
    { id: 'legion-s1-1', name: 'Season 1.1 - Pre fixes' },
    { id: 'legion-s1-2', name: 'Season 1.2 - Post fixes' }
  ];
  const live: MythicPlusIndex = {
    ...emptyIndex,
    season: { id: 'legion-s1-2', name: 'Season 1.2 - Post fixes', raid: 'Emerald Nightmare', startDate: '2026-11-09' },
    seasons
  };
  const archived: MythicPlusIndex = {
    ...emptyIndex,
    season: { id: 'legion-s1-1', name: 'Season 1.1 - Pre fixes', raid: 'Emerald Nightmare', startDate: '2026-09-16' },
    seasons
  };

  it('treats the last listed season as the live one, and an index without a list as live', () => {
    expect(isLiveSeason(live)).toBe(true);
    expect(isLiveSeason(archived)).toBe(false);
    expect(isLiveSeason(emptyIndex)).toBe(true);
  });

  it('reads the live season from the data folder and a finished one from its own folder', () => {
    expect(seasonDataDir(live)).toBe('mythic-plus-data');
    expect(seasonDataDir(archived)).toBe('mythic-plus-data/legion-s1-1');
    expect(seasonDataDir(emptyIndex)).toBe('mythic-plus-data');
  });

  it('names a finished season in the URL and leaves the live one out', () => {
    expect(seasonParam(archived)).toBe('legion-s1-1');
    expect(seasonParam(live)).toBeUndefined();
  });

  it('finds the finished season a URL asks for, and the live one for anything else', () => {
    expect(archivedSeasonId(live, 'legion-s1-1')).toBe('legion-s1-1');
    expect(archivedSeasonId(live, 'legion-s1-2')).toBeUndefined();
    expect(archivedSeasonId(live, 'legion-s0')).toBeUndefined();
    expect(archivedSeasonId(live, undefined)).toBeUndefined();
    expect(archivedSeasonId(emptyIndex, 'legion-s1-1')).toBeUndefined();
  });

  it('finds the finished season from a finished season too, taking the last listed one as live', () => {
    expect(archivedSeasonId(archived, 'legion-s1-1')).toBe('legion-s1-1');
    expect(archivedSeasonId(archived, 'legion-s1-2')).toBeUndefined();
  });

  it('has an affix week only in the live season', () => {
    const runs = [{ completedAt: '2026-11-09T14:00:00Z', affixes: [7, 1, 9] }];

    expect(liveAffixWeek(live, runs)).toEqual({ affixes: [7, 1, 9], since: 1 });
    expect(liveAffixWeek(archived, runs)).toBeUndefined();
    expect(liveAffixWeek(undefined, runs)).toBeUndefined();
  });

  it('offers every listed season, or just the one an older index names', () => {
    expect(seasonOptions(archived)).toEqual(seasons);
    expect(seasonOptions(emptyIndex)).toEqual([{ id: 'legion-s1', name: 'Legion Season 1' }]);
    expect(seasonOptions(undefined)).toEqual([]);
  });
});

const scanIndex = (rows: Array<[name: string, score: MythicPlusScoreEntry]>, departed: MythicPlusDepartedEntry[] = []): MythicPlusIndex => ({
  ...emptyIndex,
  previousGeneratedAt: '2026-10-07T09:30:00Z',
  players: rows.map(([name]) => [name, 'Evermoon', '', 11, 4, 0]),
  scores: rows.map(([, score]) => score),
  departed
});

describe('hasScanChanges', () => {
  const index = scanIndex([['Exkeito', [196, 1500000, 4.5, 0]]]);

  it('needs an earlier scan and a score entry for every player', () => {
    expect(hasScanChanges(index)).toBe(true);
    expect(hasScanChanges({ ...index, previousGeneratedAt: undefined })).toBe(false);
    expect(hasScanChanges({ ...index, scores: [] })).toBe(false);
    expect(hasScanChanges(undefined)).toBe(false);
  });
});

describe('standingChanges', () => {
  const key = (name: string) => `${name}|Evermoon`;

  it('ranks both scans by score, then total time, sharing a place only on both', () => {
    const changes = standingChanges(scanIndex([
      ['Alpha', [300, 5000000, 50, 1000]],
      ['Beta', [280, 5000000, 0, 0]],
      ['Gamma', [280, 5000000, 0, 0]],
      ['Delta', [280, 5100000, 0, 0]]
    ]));

    expect(changes.get(key('Alpha'))).toEqual({ score: 50, rank: 3, previousRank: 4 });
    expect(changes.get(key('Beta'))).toEqual({ score: 0, rank: -1, previousRank: 1 });
    expect(changes.get(key('Gamma'))).toEqual({ score: 0, rank: -1, previousRank: 1 });
    expect(changes.get(key('Delta'))).toEqual({ score: 0, rank: -1, previousRank: 3 });
  });

  it('counts the players who left since the previous scan in its places', () => {
    const changes = standingChanges(scanIndex(
      [['Alpha', [300, 5000000, 0, 0]], ['Beta', []], ['Gamma', []]],
      [[1, 400, 5000000], [2, 300, 4900000]]
    ));

    expect(changes.get(key('Alpha'))).toEqual({ score: 0, rank: 2, previousRank: 3 });
    expect(changes.has(key('Beta'))).toBe(false);
  });

  it('has no change for a player new since the previous scan', () => {
    const changes = standingChanges(scanIndex([['Alpha', [300, 5000000, 0, 0]], ['Beta', [400, 5000000]]]));

    expect(changes.get(key('Alpha'))).toEqual({ score: 0, rank: -1, previousRank: 1 });
    expect(changes.has(key('Beta'))).toBe(false);
  });

  it('recovers the previous score exactly from the score change', () => {
    const changes = standingChanges(scanIndex([['Alpha', [1100.1, 5000000, 0.2, 0]], ['Beta', [1099.9, 5000000, 0, 0]]]));

    expect(changes.get(key('Alpha'))?.previousRank).toBe(1);
    expect(changes.get(key('Beta'))?.previousRank).toBe(1);
  });

  it('is empty without a complete previous scan', () => {
    const index = scanIndex([['Alpha', [300, 5000000, 0, 0]]]);

    expect(standingChanges({ ...index, previousGeneratedAt: undefined }).size).toBe(0);
    expect(standingChanges({ ...index, scores: [] }).size).toBe(0);
    expect(standingChanges(undefined).size).toBe(0);
  });
});

describe('currentPlayers', () => {
  const alpha: MythicPlusPlayerEntry = ['Alpha', 'Evermoon', '', 6, 1, 0];
  const beta: MythicPlusPlayerEntry = ['Beta', 'Tauri', '', 6, 1, 0];
  const gamma: MythicPlusPlayerEntry = ['Gamma', 'WoD', '', 6, 1, 0];

  it('lists the players with a score in this scan, leaving out the rows kept for those who left', () => {
    expect(currentPlayers({ players: [alpha, beta, gamma], scores: [[100, 1000], [], [90, 2000, 0, 0]] })).toEqual([alpha, gamma]);
    expect(currentPlayers({ players: [alpha] })).toEqual([alpha]);
    expect(currentPlayers(undefined)).toEqual([]);
  });
});

describe('formatTimerDelta', () => {
  it('signs the distance from the timer', () => {
    expect(formatTimerDelta(1747, 2100)).toBe('-5:53');
    expect(formatTimerDelta(2230, 2100)).toBe('+2:10');
    expect(formatTimerDelta(2100, 2100)).toBe('0:00');
  });
});

describe('rankRuns', () => {
  it('orders by score, breaking ties with the faster clear', () => {
    const runs = [
      { id: 'a', score: 150, clearTimeSeconds: 1500 },
      { id: 'b', score: 180, clearTimeSeconds: 1900 },
      { id: 'c', score: 150, clearTimeSeconds: 1400 }
    ];

    expect(rankRuns(runs).map(run => run.id)).toEqual(['b', 'c', 'a']);
    expect(runs.map(run => run.id)).toEqual(['a', 'b', 'c']);
  });
});

describe('runIncludesPlayer', () => {
  const run = { roster: [{ name: 'Björñ' }, { name: 'Llýnch' }, { name: 'Exa' }] };

  it('matches partial names ignoring case and accents', () => {
    expect(runIncludesPlayer(run, 'bjorn')).toBe(true);
    expect(runIncludesPlayer(run, 'LLYN')).toBe(true);
    expect(runIncludesPlayer(run, '  exa ')).toBe(true);
  });

  it('matches everything for an empty query and nothing for a stranger', () => {
    expect(runIncludesPlayer(run, '')).toBe(true);
    expect(runIncludesPlayer(run, 'Pretz')).toBe(false);
  });
});

describe('runIncludesCharacter', () => {
  const member = (name: string, realm = 'Tauri') =>
    ({ name, realm, class: 4, race: 1, gender: 0, spec: 'Outlaw', role: 'dps' as const });
  const run = (id: string, ...roster: ReturnType<typeof member>[]) =>
    ({ id, dungeon: 'hov', keyLevel: 10, clearTimeSeconds: 1500, score: 150, completedAt: '', affixes: [], roster });

  const runs = [
    run('nap', member('Nap'), member('Exa')),
    run('napim', member('Napim')),
    run('anapiel', member('Anapiel'), member('Exa')),
    run('other-realm', member('Nap', 'Evermoon')),
    run('both', member('Napim'), member('Nap'))
  ];

  it('keeps only runs of the clicked character, not of similar names or another realm', () => {
    const nap = rankPlayers(runs).find(player => player.member.name === 'Nap' && player.member.realm === 'Tauri');
    expect(nap?.key).toBe(characterKey(member('Nap')));

    const shown = runs.filter(candidate => runIncludesCharacter(candidate, nap!.key)).map(candidate => candidate.id);
    expect(shown).toEqual(['nap', 'both']);
  });

  it('leaves the typed search matching partial names', () => {
    expect(runs.filter(candidate => runIncludesPlayer(candidate, 'nap')).map(candidate => candidate.id))
      .toEqual(['nap', 'napim', 'anapiel', 'other-realm', 'both']);
  });
});

describe('sortRoster', () => {
  it('puts the tank and healer first and keeps DPS order', () => {
    const roster = [
      { name: 'A', role: 'dps' as const },
      { name: 'H', role: 'healer' as const },
      { name: 'B', role: 'dps' as const },
      { name: 'T', role: 'tank' as const }
    ];

    expect(sortRoster(roster).map(member => member.name)).toEqual(['T', 'H', 'A', 'B']);
  });
});

describe('createRunDecoder', () => {
  const index = {
    players: [
      ['Pashao', 'Evermoon', 'Хранители Вечности', 12, 4, 1],
      ['Swag', 'Tauri', '', 3, 22, 0]
    ] as Array<[string, string, string, number, number, number]>,
    specs: [
      { class: 3, name: 'Marksmanship', role: 'dps' as const },
      { class: 12, name: 'Vengeance', role: 'tank' as const }
    ]
  };

  it('expands a dungeon file into runs ranked in file order', () => {
    const decode = createRunDecoder(index);
    const [run] = decode({
      version: 1,
      dungeon: 'hov',
      runs: [[16, 1715363, 1790520370, 174.6, [8, 3, 10], [[0, 1], [1, 0]]]]
    });

    expect(run).toEqual({
      id: 'hov-1',
      dungeon: 'hov',
      keyLevel: 16,
      clearTimeSeconds: 1715.363,
      score: 174.6,
      completedAt: '2026-09-27T14:46:10.000Z',
      affixes: [8, 3, 10],
      roster: [
        { name: 'Pashao', realm: 'Evermoon', guild: 'Хранители Вечности', class: 12, race: 4, gender: 1, spec: 'Vengeance', role: 'tank' },
        { name: 'Swag', realm: 'Tauri', guild: undefined, class: 3, race: 22, gender: 0, spec: 'Marksmanship', role: 'dps', range: 'ranged' }
      ]
    });
  });

  it('shares one member object across runs and files, and skips unknown references', () => {
    const decode = createRunDecoder(index);
    const [first] = decode({ version: 1, dungeon: 'hov', runs: [[10, 1, 0, 100, [], [[0, 1], [9, 0], [1, 7]]]] });
    const [second] = decode({ version: 1, dungeon: 'eoa', runs: [[11, 1, 0, 110, [], [[0, 1]]]] });

    expect(first.roster).toHaveLength(1);
    expect(second.roster[0]).toBe(first.roster[0]);
  });
});

describe('sharesTables', () => {
  const player: MythicPlusPlayerEntry = ['Alpha', 'Evermoon', '', 6, 1, 0];
  const index = { tables: 'aaa', players: [player, player], specs: [{ class: 6, name: 'Blood', role: 'tank' as const }] };
  const file = (tables: string, roster: Array<[number, number]>) => ({ tables, runs: [[10, 1500000, 0, 100, [], roster] as MythicPlusRunEntry] });

  it('matches a dungeon file to an index of the same tables that holds every player and spec it names', () => {
    expect(sharesTables(index, file('aaa', [[1, 0]]))).toBe(true);
    expect(sharesTables({ ...index, players: [player, player, player] }, file('aaa', [[1, 0]]))).toBe(true);
    expect(sharesTables(index, file('aaa', [[2, 0]]))).toBe(false);
    expect(sharesTables(index, file('aaa', [[0, 1]]))).toBe(false);
    expect(sharesTables(index, file('bbb', [[0, 0]]))).toBe(false);
    expect(sharesTables({ ...index, tables: undefined }, file('bbb', [[0, 0]]))).toBe(false);
  });
});

describe('rankPlayers', () => {
  const member = (name: string, spec = 'Blood') =>
    ({ name, realm: 'Evermoon', class: 6, race: 1, gender: 0, spec, role: 'tank' as const });
  const run = (id: string, dungeon: string, score: number, roster: ReturnType<typeof member>[], clearTimeSeconds = 1500) =>
    ({ id, dungeon, keyLevel: 10, clearTimeSeconds, score, completedAt: '', affixes: [], roster });

  it('sums the best run per dungeon, so farming one dungeon does not count twice', () => {
    const tank = member('Pretz');
    const [pretz] = rankPlayers([
      run('a', 'hov', 150, [tank]),
      run('b', 'hov', 170.1, [tank]),
      run('c', 'eoa', 160.2, [tank])
    ]);

    expect(pretz.score).toBe(330.3);
    expect(pretz.bestRuns.get('hov')?.id).toBe('b');
    expect(pretz.bestRuns.get('eoa')?.id).toBe('c');
  });

  it('ranks by score, then name, and counts every spec of a character as one player', () => {
    const ranked = rankPlayers([
      run('a', 'hov', 180, [member('Pashao', 'Vengeance'), member('Bea')]),
      run('b', 'eoa', 190, [member('Pashao', 'Havoc')]),
      run('c', 'hov', 180, [member('Abe')])
    ]);

    expect(ranked.map(player => [player.member.name, player.score])).toEqual([
      ['Pashao', 370], ['Abe', 180], ['Bea', 180]
    ]);
    expect(ranked[0].member.spec).toBe('Havoc');
    expect(ranked[0].primarySpec).toBe('Havoc');
  });

  it('identifies the spec a character played in the most runs', () => {
    const [pashao] = rankPlayers([
      run('a', 'hov', 180, [member('Pashao', 'Vengeance')]),
      run('b', 'eoa', 210, [member('Pashao', 'Havoc')]),
      run('c', 'brh', 170, [member('Pashao', 'Vengeance')])
    ]);

    expect(pashao.member.spec).toBe('Havoc');
    expect(pashao.primarySpec).toBe('Vengeance');
  });

  it('scores a spec filter on the runs played as that spec only', () => {
    const ranked = rankPlayers([
      run('a', 'hov', 180, [member('Pashao', 'Vengeance'), member('Bea')]),
      run('b', 'eoa', 190, [member('Pashao', 'Havoc')])
    ], candidate => candidate.spec === 'Vengeance');

    expect(ranked.map(player => [player.member.name, player.score])).toEqual([['Pashao', 180]]);
  });
});

describe('memberNameMatches', () => {
  it('matches like the run search', () => {
    expect(memberNameMatches({ name: 'Björñ' }, 'bjorn')).toBe(true);
    expect(memberNameMatches({ name: 'Björñ' }, '')).toBe(true);
    expect(memberNameMatches({ name: 'Björñ' }, 'pretz')).toBe(false);
  });
});

describe('score colours', () => {
  const scores = Array.from({ length: 2000 }, (_, i) => 2000 - i);
  const tiers = scoreTiers(scores);

  it('places the stops at the top 60%, 25%, 10%, 1% and 0.1% of players', () => {
    expect(tiers).toEqual([1, 801, 1501, 1801, 1981, 1999]);
    expect(scoreTiers([100, 90])).toBeUndefined();
  });

  it('is gold for the top 0.1%, orange at the top 1% and blends in between', () => {
    expect(scoreColor(2000, tiers)).toBe('rgb(255, 209, 0)');
    expect(scoreColor(1999, tiers)).toBe('rgb(255, 209, 0)');
    expect(scoreColor(1981, tiers)).toBe('rgb(255, 128, 0)');
    expect(scoreColor(1990, tiers)).toBe('rgb(255, 169, 0)');
    expect(scoreColor(0, tiers)).toBe('#9e9e9e');
    expect(scoreColor(500, undefined)).toBe('#9e9e9e');
  });

  it('colours one run as if every dungeon had it', () => {
    expect(runScoreColor(220, { tiers, dungeons: 9 })).toBe(scoreColor(1980, tiers));
  });

  it('places the season stops among the players of this scan only', () => {
    const entries: MythicPlusScoreEntry[] = [...scores.map((score): MythicPlusScoreEntry => [score, 1000]), [], []];
    const index = { ...emptyIndex, scores: entries };

    expect(seasonScoreColors(index).tiers).toEqual(tiers);
  });
});
