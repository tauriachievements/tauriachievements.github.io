const AP_BREAKS = [0, 1000, 3000, 6000, 10000, 15000, 20000, Infinity];
const AP_LABELS = ["<1k", "1k–3k", "3k–6k", "6k–10k", "10k–15k", "15k–20k", "20k+"];

const HK_BREAKS = [0, 1000, 5000, 10000, 25000, 50000, 100000, Infinity];
const HK_LABELS = ["<1k", "1k–5k", "5k–10k", "10k–25k", "25k–50k", "50k–100k", "100k+"];

const PLAYED_DAY_BREAKS = [0, 1, 3, 7, 14, 30, 60, 120, 365, Infinity];
const PLAYED_DAY_LABELS = ["<1", "1–3", "3–7", "7–14", "14–30", "30–60", "60–120", "120–365", "365+"];

const GUILD_SIZE_BREAKS = [1, 2, 5, 10, 25, 50, 100, Infinity];
const GUILD_SIZE_LABELS = ["1", "2–4", "5–9", "10–24", "25–49", "50–99", "100+"];

const ITEM_LEVEL_STEPS = [1, 2, 5, 10, 20, 25, 50, 100];
const ITEM_LEVEL_TARGET_BUCKETS = 12;
const ITEM_LEVEL_FLOOR_QUANTILE = 0.1;

const SECONDS_PER_HOUR = 3600;
const SECONDS_PER_DAY = 86400;
const MS_PER_DAY = 86400000;
const FEMALE = 1;

const FACTION_ORDER = ["Horde", "Alliance", "Neutral"];
const TOP_GUILD_COUNT = 10;

function computeServerStats(players) {
  if (!players.length) {
    return emptyServerStats();
  }

  const factionCounts = new Map();
  const classTotals = new Map();
  const raceTotals = new Map();
  const comboTotals = new Map();
  const guildCounts = new Map();
  const realmCounts = new Map();
  const level10Years = new Map();
  const itemLevels = [];
  const playedSeconds = [];

  const apBuckets = new Array(AP_LABELS.length).fill(0);
  const hkBuckets = new Array(HK_LABELS.length).fill(0);
  const playedBuckets = new Array(PLAYED_DAY_LABELS.length).fill(0);

  let totalAchievementPoints = 0;
  let maxAchievementPoints = 0;
  let totalHonorableKills = 0;
  let maxHonorableKills = 0;
  let totalPlayedSeconds = 0;
  let guildedPlayers = 0;
  let femalePlayers = 0;

  for (const player of players) {
    const female = player.gender === FEMALE;
    increment(factionCounts, player.faction);
    increment(realmCounts, player.realm);
    addClass(classTotals, player, female);
    addRace(raceTotals, player.race, female);
    addCombo(comboTotals, player, female);

    if (female) {
      femalePlayers++;
    }

    if (player.guild) {
      guildedPlayers++;
      increment(guildCounts, `${player.guild} (${player.realm})`);
    }

    if (player.ilvl > 0) {
      itemLevels.push(player.ilvl);
    }

    if (player.level10Day > 0) {
      increment(level10Years, new Date(player.level10Day * MS_PER_DAY).getUTCFullYear());
    }

    totalAchievementPoints += player.achievementPoints;
    maxAchievementPoints = Math.max(maxAchievementPoints, player.achievementPoints);
    totalHonorableKills += player.honorableKills;
    maxHonorableKills = Math.max(maxHonorableKills, player.honorableKills);
    totalPlayedSeconds += player.playedTime;
    playedSeconds.push(player.playedTime);

    apBuckets[bucketIndex(AP_BREAKS, player.achievementPoints)]++;
    hkBuckets[bucketIndex(HK_BREAKS, player.honorableKills)]++;
    playedBuckets[bucketIndex(PLAYED_DAY_BREAKS, player.playedTime / SECONDS_PER_DAY)]++;
  }

  itemLevels.sort((left, right) => left - right);
  playedSeconds.sort((left, right) => left - right);

  return {
    totalPlayers: players.length,
    guildedPlayers,
    uniqueGuilds: guildCounts.size,
    femalePlayers,
    avgAchievementPoints: Math.round(totalAchievementPoints / players.length),
    maxAchievementPoints,
    avgHonorableKills: Math.round(totalHonorableKills / players.length),
    maxHonorableKills,
    avgItemLevel: roundTo(average(itemLevels), 1),
    medianItemLevel: median(itemLevels),
    totalPlayedHours: Math.round(totalPlayedSeconds / SECONDS_PER_HOUR),
    medianPlayedHours: Math.round(median(playedSeconds) / SECONDS_PER_HOUR),
    factions: orderedFactions(factionCounts),
    classes: [...classTotals.values()].sort(byDescendingCountThenId).map(classSummary),
    races: [...raceTotals.values()].sort(byDescendingCountThenId),
    combos: [...comboTotals.values()].sort(
      (left, right) => right.count - left.count || left.race - right.race || left.class - right.class
    ),
    guilds: byDescendingCount(guildCounts)
      .slice(0, TOP_GUILD_COUNT)
      .map(([name, count]) => ({ name, count })),
    realms: byDescendingCount(realmCounts).map(([name, count]) => ({ name, count })),
    distributions: {
      itemLevel: itemLevelDistribution(itemLevels),
      achievementPoints: { labels: [...AP_LABELS], counts: apBuckets },
      honorableKills: { labels: [...HK_LABELS], counts: hkBuckets },
      playedDays: { labels: [...PLAYED_DAY_LABELS], counts: playedBuckets },
      level10Year: yearDistribution(level10Years),
      guildSize: guildSizeDistribution(guildCounts),
    },
  };
}

function emptyServerStats() {
  return {
    totalPlayers: 0,
    guildedPlayers: 0,
    uniqueGuilds: 0,
    femalePlayers: 0,
    avgAchievementPoints: 0,
    maxAchievementPoints: 0,
    avgHonorableKills: 0,
    maxHonorableKills: 0,
    avgItemLevel: 0,
    medianItemLevel: 0,
    totalPlayedHours: 0,
    medianPlayedHours: 0,
    factions: [],
    classes: [],
    races: [],
    combos: [],
    guilds: [],
    realms: [],
    distributions: {
      itemLevel: { labels: [], counts: [] },
      achievementPoints: { labels: [...AP_LABELS], counts: new Array(AP_LABELS.length).fill(0) },
      honorableKills: { labels: [...HK_LABELS], counts: new Array(HK_LABELS.length).fill(0) },
      playedDays: { labels: [...PLAYED_DAY_LABELS], counts: new Array(PLAYED_DAY_LABELS.length).fill(0) },
      level10Year: { labels: [], counts: [] },
      guildSize: { labels: [...GUILD_SIZE_LABELS], counts: new Array(GUILD_SIZE_LABELS.length).fill(0) },
    },
  };
}

function addClass(classTotals, player, female) {
  let entry = classTotals.get(player.playerClass);
  if (!entry) {
    entry = {
      id: player.playerClass,
      count: 0,
      female: 0,
      horde: 0,
      alliance: 0,
      itemLevelTotal: 0,
      itemLevelCount: 0,
      playedSeconds: 0,
      achievementPoints: 0,
    };
    classTotals.set(player.playerClass, entry);
  }

  entry.count++;
  entry.female += female ? 1 : 0;
  entry.horde += player.faction === "Horde" ? 1 : 0;
  entry.alliance += player.faction === "Alliance" ? 1 : 0;
  entry.playedSeconds += player.playedTime;
  entry.achievementPoints += player.achievementPoints;

  if (player.ilvl > 0) {
    entry.itemLevelTotal += player.ilvl;
    entry.itemLevelCount++;
  }
}

function classSummary(entry) {
  return {
    id: entry.id,
    count: entry.count,
    female: entry.female,
    horde: entry.horde,
    alliance: entry.alliance,
    avgItemLevel: entry.itemLevelCount ? roundTo(entry.itemLevelTotal / entry.itemLevelCount, 1) : 0,
    avgPlayedHours: Math.round(entry.playedSeconds / entry.count / SECONDS_PER_HOUR),
    avgAchievementPoints: Math.round(entry.achievementPoints / entry.count),
  };
}

function addRace(raceTotals, race, female) {
  const entry = raceTotals.get(race) ?? { id: race, count: 0, female: 0 };
  entry.count++;
  entry.female += female ? 1 : 0;
  raceTotals.set(race, entry);
}

function addCombo(comboTotals, player, female) {
  const key = `${player.race}:${player.playerClass}`;
  const entry = comboTotals.get(key) ?? { race: player.race, class: player.playerClass, count: 0, female: 0 };
  entry.count++;
  entry.female += female ? 1 : 0;
  comboTotals.set(key, entry);
}

function itemLevelDistribution(sortedLevels) {
  if (!sortedLevels.length) {
    return { labels: [], counts: [] };
  }

  const floor = sortedLevels[Math.floor(ITEM_LEVEL_FLOOR_QUANTILE * (sortedLevels.length - 1))];
  const max = sortedLevels[sortedLevels.length - 1];
  const roughStep = (max - floor) / ITEM_LEVEL_TARGET_BUCKETS;
  const step = ITEM_LEVEL_STEPS.find((candidate) => candidate >= roughStep) ?? ITEM_LEVEL_STEPS[ITEM_LEVEL_STEPS.length - 1];
  const start = Math.floor(floor / step) * step;
  const bucketCount = Math.floor((max - start) / step) + 1;
  const hasLowBucket = sortedLevels[0] < start;
  const labels = hasLowBucket ? [`<${start}`] : [];
  const counts = new Array(bucketCount + (hasLowBucket ? 1 : 0)).fill(0);

  for (let bucket = 0; bucket < bucketCount; bucket++) {
    const low = start + bucket * step;
    labels.push(step === 1 ? `${low}` : `${low}–${low + step - 1}`);
  }

  for (const level of sortedLevels) {
    const index = level < start ? 0 : Math.floor((level - start) / step) + (hasLowBucket ? 1 : 0);
    counts[index]++;
  }

  return { labels, counts };
}

function yearDistribution(yearCounts) {
  if (!yearCounts.size) {
    return { labels: [], counts: [] };
  }

  const years = [...yearCounts.keys()];
  const first = Math.min(...years);
  const last = Math.max(...years);
  const labels = [];
  const counts = [];

  for (let year = first; year <= last; year++) {
    labels.push(String(year));
    counts.push(yearCounts.get(year) ?? 0);
  }

  return { labels, counts };
}

function guildSizeDistribution(guildCounts) {
  const counts = new Array(GUILD_SIZE_LABELS.length).fill(0);
  for (const size of guildCounts.values()) {
    counts[bucketIndex(GUILD_SIZE_BREAKS, size)]++;
  }

  return { labels: [...GUILD_SIZE_LABELS], counts };
}

function increment(counts, key) {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function bucketIndex(breaks, value) {
  for (let index = breaks.length - 2; index >= 0; index--) {
    if (value >= breaks[index]) {
      return index;
    }
  }

  return 0;
}

function average(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}

function median(sortedValues) {
  if (!sortedValues.length) {
    return 0;
  }

  const middle = Math.floor(sortedValues.length / 2);
  return sortedValues.length % 2
    ? sortedValues[middle]
    : Math.round((sortedValues[middle - 1] + sortedValues[middle]) / 2);
}

function roundTo(value, decimals) {
  const scale = 10 ** decimals;
  return Math.round(value * scale) / scale;
}

function byDescendingCount(counts) {
  return [...counts.entries()].sort((left, right) => right[1] - left[1]);
}

function byDescendingCountThenId(left, right) {
  return right.count - left.count || left.id - right.id;
}

function orderedFactions(factionCounts) {
  const known = FACTION_ORDER.filter((faction) => factionCounts.has(faction));
  const rest = [...factionCounts.keys()].filter((faction) => !FACTION_ORDER.includes(faction));

  return [...known, ...rest].map((name) => ({ name, count: factionCounts.get(name) ?? 0 }));
}

module.exports = {
  computeServerStats,
  emptyServerStats,
  AP_LABELS,
  HK_LABELS,
  PLAYED_DAY_LABELS,
  GUILD_SIZE_LABELS,
};
