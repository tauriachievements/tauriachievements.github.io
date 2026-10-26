const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  computeServerStats,
  emptyServerStats,
  AP_LABELS,
  HK_LABELS,
  PLAYED_DAY_LABELS,
  GUILD_SIZE_LABELS,
} = require("./compute-server-stats");

const HOUR = 3600;
const DAY = 86400;

function epochDay(isoDate) {
  return Date.parse(`${isoDate}T00:00:00Z`) / (DAY * 1000);
}

function player(overrides) {
  return {
    name: "Anon",
    race: 1,
    gender: 0,
    playerClass: 1,
    realm: "Tauri",
    guild: "Guild",
    faction: "Horde",
    achievementPoints: 0,
    honorableKills: 0,
    ilvl: 0,
    playedTime: 0,
    level10Day: 0,
    ...overrides,
  };
}

function sampleRoster() {
  return [
    player({ name: "P1", faction: "Horde", playerClass: 2, race: 2, realm: "Tauri", guild: "G1", achievementPoints: 500, honorableKills: 0 }),
    player({ name: "P2", faction: "Horde", playerClass: 2, race: 2, realm: "Tauri", guild: "G1", achievementPoints: 1000, honorableKills: 1000 }),
    player({ name: "P3", faction: "Alliance", playerClass: 8, race: 1, realm: "Evermoon", guild: "", achievementPoints: 20000, honorableKills: 100000 }),
    player({ name: "P4", faction: "Alliance", playerClass: 8, race: 1, realm: "Evermoon", guild: "G2", achievementPoints: 6000, honorableKills: 5000 }),
  ];
}

test("an empty roster returns zeroed stats with the fixed bucket arrays still sized", () => {
  const stats = computeServerStats([]);

  assert.equal(stats.totalPlayers, 0);
  assert.equal(stats.avgAchievementPoints, 0);
  assert.deepEqual(stats.classes, []);
  assert.deepEqual(stats.combos, []);
  assert.deepEqual(stats.distributions.achievementPoints.counts, [0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(stats.distributions.itemLevel, { labels: [], counts: [] });
  for (const distribution of Object.values(stats.distributions)) {
    assert.equal(distribution.labels.length, distribution.counts.length);
  }
});

test("computes totals, rounded averages, and maximums", () => {
  const stats = computeServerStats(sampleRoster());

  assert.equal(stats.totalPlayers, 4);
  assert.equal(stats.avgAchievementPoints, 6875);
  assert.equal(stats.maxAchievementPoints, 20000);
  assert.equal(stats.avgHonorableKills, 26500);
  assert.equal(stats.maxHonorableKills, 100000);
});

test("counts guilded players and unique guilds keyed by guild plus realm", () => {
  const stats = computeServerStats(sampleRoster());

  assert.equal(stats.guildedPlayers, 3);
  assert.equal(stats.uniqueGuilds, 2);
});

test("the same guild name on two realms counts as two guilds", () => {
  const stats = computeServerStats([
    player({ name: "A", realm: "Tauri", guild: "Twins" }),
    player({ name: "B", realm: "Evermoon", guild: "Twins" }),
  ]);

  assert.equal(stats.uniqueGuilds, 2);
});

test("orders factions Horde, Alliance, then anything else", () => {
  const stats = computeServerStats([
    ...sampleRoster(),
    player({ name: "P5", faction: "Neutral" }),
  ]);

  assert.deepEqual(stats.factions.map((entry) => entry.name), ["Horde", "Alliance", "Neutral"]);
  assert.deepEqual(stats.factions.map((entry) => entry.count), [2, 2, 1]);
});

test("buckets achievement points and honorable kills by threshold, lower bound inclusive", () => {
  const { distributions } = computeServerStats(sampleRoster());

  assert.deepEqual(distributions.achievementPoints, { labels: AP_LABELS, counts: [1, 1, 0, 1, 0, 0, 1] });
  assert.deepEqual(distributions.honorableKills, { labels: HK_LABELS, counts: [1, 1, 1, 0, 0, 0, 1] });
});

test("a value exactly on a break falls in the higher bucket", () => {
  const stats = computeServerStats([
    player({ name: "Below", achievementPoints: 2999 }),
    player({ name: "OnBreak", achievementPoints: 3000 }),
  ]);

  assert.deepEqual(stats.distributions.achievementPoints.counts, [0, 1, 1, 0, 0, 0, 0]);
});

test("counts female characters, gender 1, overall, per class and per race", () => {
  const stats = computeServerStats([
    player({ name: "F1", gender: 1, playerClass: 8, race: 1 }),
    player({ name: "F2", gender: 1, playerClass: 8, race: 4 }),
    player({ name: "M1", gender: 0, playerClass: 8, race: 1 }),
    player({ name: "M2", gender: 0, playerClass: 1, race: 1 }),
  ]);

  assert.equal(stats.femalePlayers, 2);
  assert.deepEqual(stats.classes.map(({ id, count, female }) => ({ id, count, female })), [
    { id: 8, count: 3, female: 2 },
    { id: 1, count: 1, female: 0 },
  ]);
  assert.deepEqual(stats.races, [
    { id: 1, count: 3, female: 1 },
    { id: 4, count: 1, female: 1 },
  ]);
});

test("reports classes and races by id, most populous first, ties by id", () => {
  const stats = computeServerStats([
    ...sampleRoster(),
    player({ name: "P5", playerClass: 8, race: 1 }),
    player({ name: "P6", playerClass: 3, race: 3 }),
    player({ name: "P7", playerClass: 3, race: 3 }),
  ]);

  assert.deepEqual(stats.classes.map((entry) => [entry.id, entry.count]), [[8, 3], [2, 2], [3, 2]]);
  assert.deepEqual(stats.races.map((entry) => [entry.id, entry.count]), [[1, 3], [2, 2], [3, 2]]);
});

test("splits each class by faction and averages its item level, played time and points", () => {
  const stats = computeServerStats([
    player({ name: "A", playerClass: 9, faction: "Horde", ilvl: 850, playedTime: 100 * HOUR, achievementPoints: 3000 }),
    player({ name: "B", playerClass: 9, faction: "Horde", ilvl: 0, playedTime: 50 * HOUR, achievementPoints: 1000 }),
    player({ name: "C", playerClass: 9, faction: "Alliance", ilvl: 841, playedTime: 0, achievementPoints: 2000 }),
  ]);

  assert.deepEqual(stats.classes, [{
    id: 9,
    count: 3,
    female: 0,
    horde: 2,
    alliance: 1,
    avgItemLevel: 845.5,
    avgPlayedHours: 50,
    avgAchievementPoints: 2000,
  }]);
});

test("counts every race and class pair, most played first", () => {
  const stats = computeServerStats([
    player({ name: "A", race: 10, playerClass: 12, gender: 1 }),
    player({ name: "B", race: 10, playerClass: 12 }),
    player({ name: "C", race: 4, playerClass: 11, gender: 1 }),
    player({ name: "D", race: 3, playerClass: 4 }),
  ]);

  assert.deepEqual(stats.combos, [
    { race: 10, class: 12, count: 2, female: 1 },
    { race: 3, class: 4, count: 1, female: 0 },
    { race: 4, class: 11, count: 1, female: 1 },
  ]);
});

test("item level leaves unknown (0) out of the average and the median", () => {
  const stats = computeServerStats([
    player({ name: "A", ilvl: 840 }),
    player({ name: "B", ilvl: 850 }),
    player({ name: "C", ilvl: 871 }),
    player({ name: "D", ilvl: 0 }),
  ]);

  assert.equal(stats.avgItemLevel, 853.7);
  assert.equal(stats.medianItemLevel, 850);
});

test("item level buckets start near the lowest tenth and use a round step that fits about twelve bars", () => {
  const roster = [];
  for (let level = 770; level <= 890; level++) {
    roster.push(player({ name: `L${level}`, ilvl: level }));
  }
  roster.push(player({ name: "Fresh", ilvl: 25 }));

  const { itemLevel } = computeServerStats(roster).distributions;

  assert.equal(itemLevel.labels[0], "<780");
  assert.equal(itemLevel.labels[1], "780–789");
  assert.equal(itemLevel.labels.at(-1), "890–899");
  assert.equal(itemLevel.counts[0], 11);
  assert.equal(itemLevel.counts[1], 10);
  assert.equal(itemLevel.counts.at(-1), 1);
  assert.equal(itemLevel.counts.reduce((sum, count) => sum + count, 0), roster.length);
});

test("item level buckets widen for a wide spread and need no low bucket when none falls under it", () => {
  const roster = [100, 300, 500, 700, 890].map((ilvl) => player({ name: `L${ilvl}`, ilvl }));

  const { itemLevel } = computeServerStats(roster).distributions;

  assert.deepEqual(itemLevel.labels, ["100–199", "200–299", "300–399", "400–499", "500–599", "600–699", "700–799", "800–899"]);
  assert.deepEqual(itemLevel.counts, [1, 0, 1, 0, 1, 0, 1, 1]);
});

test("one shared item level is a single one-wide bucket", () => {
  const { itemLevel } = computeServerStats([player({ ilvl: 850 }), player({ ilvl: 850 })]).distributions;

  assert.deepEqual(itemLevel, { labels: ["850"], counts: [2] });
});

test("sums played time into whole hours and buckets each character by days played", () => {
  const stats = computeServerStats([
    player({ name: "A", playedTime: 12 * HOUR }),
    player({ name: "B", playedTime: DAY }),
    player({ name: "C", playedTime: 10 * DAY }),
    player({ name: "D", playedTime: 400 * DAY }),
  ]);

  assert.equal(stats.totalPlayedHours, 12 + 24 + 240 + 9600);
  assert.equal(stats.medianPlayedHours, 132);
  assert.deepEqual(stats.distributions.playedDays, { labels: PLAYED_DAY_LABELS, counts: [1, 1, 0, 1, 0, 0, 0, 0, 1] });
});

test("counts the year each character earned Level 10, filling the years between with zero", () => {
  const stats = computeServerStats([
    player({ name: "A", level10Day: epochDay("2009-03-01") }),
    player({ name: "B", level10Day: epochDay("2011-12-31") }),
    player({ name: "C", level10Day: epochDay("2011-01-01") }),
    player({ name: "D", level10Day: 0 }),
  ]);

  assert.deepEqual(stats.distributions.level10Year, { labels: ["2009", "2010", "2011"], counts: [1, 0, 2] });
});

test("buckets guilds by how many of the characters belong to each", () => {
  const roster = [player({ name: "Solo", guild: "Alone" })];
  for (let index = 0; index < 3; index++) {
    roster.push(player({ name: `Trio${index}`, guild: "Trio" }));
  }
  for (let index = 0; index < 120; index++) {
    roster.push(player({ name: `Big${index}`, guild: "Big" }));
  }
  roster.push(player({ name: "Guildless", guild: "" }));

  const { guildSize } = computeServerStats(roster).distributions;

  assert.deepEqual(guildSize, { labels: GUILD_SIZE_LABELS, counts: [1, 1, 0, 0, 0, 0, 1] });
});

test("puts the most populous guild first and keeps at most ten", () => {
  const roster = [...sampleRoster()];
  for (let index = 0; index < 2; index++) {
    roster.push(player({ name: `Extra${index}`, realm: "Evermoon", guild: "G2" }));
  }
  for (let index = 0; index < 15; index++) {
    roster.push(player({ name: `Solo${index}`, realm: "Tauri", guild: `Guild${index}` }));
  }

  const stats = computeServerStats(roster);

  assert.equal(stats.guilds[0].name, "G2 (Evermoon)");
  assert.equal(stats.guilds[0].count, 3);
  assert.equal(stats.guilds.length, 10);
});

test("counts realms", () => {
  const stats = computeServerStats(sampleRoster());

  assert.deepEqual(stats.realms, [{ name: "Tauri", count: 2 }, { name: "Evermoon", count: 2 }]);
});

test("the empty document carries every key the populated one does", () => {
  const empty = emptyServerStats();
  const populated = computeServerStats(sampleRoster());

  assert.deepEqual(Object.keys(empty).sort(), Object.keys(populated).sort());
  assert.deepEqual(Object.keys(empty.distributions).sort(), Object.keys(populated.distributions).sort());
});
