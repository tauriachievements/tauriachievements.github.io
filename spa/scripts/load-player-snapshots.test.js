const { test } = require("node:test");
const assert = require("node:assert/strict");
const { selectEarlierDailyScans, selectLastScanBefore } = require("./load-player-snapshots");

function commit(sha, commitTimestamp) {
  return { sha, commitTimestamp, filePath: "spa/src/Players.csv" };
}

test("takes the newest scan of each earlier day and skips the current day", () => {
  const history = [
    commit("today-late", "2026-09-29T20:00:00Z"),
    commit("yesterday-late", "2026-09-28T20:00:00Z"),
    commit("yesterday-early", "2026-09-28T08:00:00Z"),
    commit("older", "2026-09-26T12:00:00Z"),
  ];

  const scans = selectEarlierDailyScans(history, "2026-09-29");

  assert.deepEqual(scans.map((scan) => scan.sha), ["yesterday-late", "older"]);
  assert.equal(scans[0].filePath, "spa/src/Players.csv");
});

test("keeps at most 20 earlier days", () => {
  const history = [];
  for (let day = 1; day <= 28; day++) {
    history.push(commit(`day-${day}`, `2026-08-${String(29 - day).padStart(2, "0")}T12:00:00Z`));
  }

  assert.equal(selectEarlierDailyScans(history, "2026-09-29").length, 20);
});

test("takes the last scan committed before a moment", () => {
  const history = [
    commit("after-launch", "2026-07-16T09:25:15+02:00"),
    commit("launch-eve", "2026-07-14T19:18:23+02:00"),
    commit("day-before", "2026-07-14T00:11:28+02:00"),
  ];

  const scan = selectLastScanBefore(history, "2026-07-15T07:00:00.000Z");

  assert.deepEqual(scan, {
    sha: "launch-eve",
    filePath: "spa/src/Players.csv",
    timestamp: "2026-07-14T17:18:23.000Z",
  });
});

test("finds no scan when every scan is later than the moment", () => {
  const history = [commit("after-launch", "2026-07-16T09:25:15+02:00")];

  assert.equal(selectLastScanBefore(history, "2026-07-15T07:00:00.000Z"), undefined);
});
