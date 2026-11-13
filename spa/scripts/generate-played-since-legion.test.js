const { test } = require("node:test");
const assert = require("node:assert/strict");
const { buildPlayedSinceLegion } = require("./generate-played-since-legion");
const { toEpochDay } = require("./player-data-utils");

const HOUR = 3600;
const LAUNCH_SCAN = "2026-07-14T17:18:23.000Z";
const CURRENT_SCAN = "2026-11-13T04:17:25.000Z";

function launchRow(name, playedHours, extra = {}) {
  return {
    name,
    realm: "Evermoon",
    race: 1,
    gender: 0,
    playerClass: 1,
    guild: "",
    faction: "Alliance",
    playedTime: playedHours * HOUR,
    hasPlayedTime: true,
    level10Day: 0,
    hasLevel10Date: false,
    ...extra,
  };
}

function currentRow(name, playedHours, extra = {}) {
  return {
    ...launchRow(name, playedHours),
    level10Day: toEpochDay("2015-01-01"),
    hasLevel10Date: true,
    ...extra,
  };
}

function build(currentPlayers, launchPlayers, limit) {
  return buildPlayedSinceLegion(
    { currentPlayers, currentTimestamp: CURRENT_SCAN, launchPlayers, launchScanTimestamp: LAUNCH_SCAN },
    limit
  );
}

test("ranks the played time each character gained since the launch scan, most first", () => {
  const launch = [launchRow("Steady", 1000), launchRow("Grinder", 50)];
  const current = [currentRow("Steady", 1100), currentRow("Grinder", 950)];

  const { players } = build(current, launch);

  assert.deepEqual(players.map((player) => [player.name, player.played]), [
    ["Grinder", 900 * HOUR],
    ["Steady", 100 * HOUR],
  ]);
});

test("writes the launch, the launch scan and the current scan beside each character's row", () => {
  const launch = [launchRow("Vemos", 10)];
  const current = [currentRow("Vemos", 30, { realm: "Tauri", race: 6, gender: 1, playerClass: 3, guild: "Outlaws", faction: "Horde" })];
  launch[0].realm = "Tauri";
  launch[0].playerClass = 3;

  const snapshot = build(current, launch);

  assert.deepEqual(snapshot, {
    v: 1,
    launch: "2026-07-15T07:00:00.000Z",
    launchScan: LAUNCH_SCAN,
    generatedAt: CURRENT_SCAN,
    players: [
      { name: "Vemos", realm: "Tauri", faction: "Horde", race: 6, gender: 1, class: 3, guild: "Outlaws", played: 20 * HOUR },
    ],
  });
});

test("counts a character the launch scan lacks in full only when it reached level 10 on or after that scan's day", () => {
  const current = [
    currentRow("MadeOnLaunchEve", 300, { level10Day: toEpochDay("2026-07-14") }),
    currentRow("MadeAfterLaunch", 200, { level10Day: toEpochDay("2026-08-01") }),
    currentRow("FoundLater", 5000, { level10Day: toEpochDay("2026-07-13") }),
    currentRow("NoLevel10Date", 40, { level10Day: 0 }),
  ];

  const { players } = build(current, [launchRow("Someone", 1)]);

  assert.deepEqual(players.map((player) => [player.name, player.played]), [
    ["MadeOnLaunchEve", 300 * HOUR],
    ["MadeAfterLaunch", 200 * HOUR],
  ]);
});

test("treats a name now on another class as a different character", () => {
  const launch = [launchRow("Reused", 4000, { playerClass: 8 })];
  const current = [
    currentRow("Reused", 120, { playerClass: 1, level10Day: toEpochDay("2026-09-01") }),
  ];

  const { players } = build(current, launch);

  assert.deepEqual(players.map((player) => [player.name, player.class, player.played]), [["Reused", 1, 120 * HOUR]]);
});

test("leaves out characters whose played time fell, stood still or grew more than the time between the scans", () => {
  const scanGapHours = (Date.parse(CURRENT_SCAN) - Date.parse(LAUNCH_SCAN)) / 1000 / HOUR;
  const launch = [
    launchRow("Fell", 500),
    launchRow("Idle", 500),
    launchRow("Impossible", 10),
    launchRow("AtTheLimit", 10),
  ];
  const current = [
    currentRow("Fell", 400),
    currentRow("Idle", 500),
    currentRow("Impossible", 10 + scanGapHours + 1),
    currentRow("AtTheLimit", 10 + Math.floor(scanGapHours)),
  ];

  const { players } = build(current, launch);

  assert.deepEqual(players.map((player) => player.name), ["AtTheLimit"]);
});

test("breaks a tie by realm and name and keeps only the top of the list", () => {
  const launch = [
    launchRow("Bravo", 0),
    launchRow("Alpha", 0),
    launchRow("Alpha", 0, { realm: "Tauri" }),
    launchRow("Charlie", 0),
  ];
  const current = [
    currentRow("Bravo", 10),
    currentRow("Alpha", 10),
    currentRow("Alpha", 10, { realm: "Tauri" }),
    currentRow("Charlie", 5),
  ];

  const { players } = build(current, launch, 3);

  assert.deepEqual(players.map((player) => `${player.realm}::${player.name}`), [
    "Evermoon::Alpha",
    "Evermoon::Bravo",
    "Tauri::Alpha",
  ]);
});

test("lists nobody when the launch scan has no played time", () => {
  const launch = [launchRow("Old", 0, { hasPlayedTime: false })];
  const current = [currentRow("Old", 900, { level10Day: toEpochDay("2026-08-01") })];

  assert.deepEqual(build(current, launch).players, []);
  assert.deepEqual(build(current, []).players, []);
});
