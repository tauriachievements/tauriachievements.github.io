const fs = require("fs");
const path = require("path");
const {
  parsePlayersCsv,
  readGitFile,
  readPlayersCsvHistory,
  readTextIfExists,
} = require("./player-data-utils");

const SOURCE_PATH = path.join(__dirname, "..", "src", "Players.csv");
const LAST_UPDATED_PATH = path.join(__dirname, "..", "src", "lastUpdated.txt");
const SNAPSHOT_DAY_LIMIT = 21;
const LEGION_LAUNCH = "2026-07-15T07:00:00.000Z";

function loadPlayerSnapshots() {
  if (!fs.existsSync(SOURCE_PATH)) {
    throw new Error(`Missing source CSV: ${SOURCE_PATH}`);
  }

  const currentPlayers = parsePlayersCsv(fs.readFileSync(SOURCE_PATH, "utf8"));
  if (currentPlayers.length === 0) {
    throw new Error("Players.csv does not contain any data rows.");
  }

  const history = readPlayersCsvHistory();
  const currentTimestamp = getCurrentSnapshotTimestamp(history);
  const earlierScans = selectEarlierDailyScans(history, toDayKey(currentTimestamp));
  const previousScan = earlierScans[0];
  const previousPlayers = previousScan
    ? parsePlayersCsv(readGitFile(previousScan.sha, previousScan.filePath))
    : [];

  const snapshotTimestamps = [currentTimestamp, ...earlierScans.map((scan) => scan.timestamp)]
    .sort((left, right) => new Date(left).getTime() - new Date(right).getTime());
  const launchScan = selectLastScanBefore(history, LEGION_LAUNCH);
  const launchPlayers = launchScan
    ? parsePlayersCsv(readGitFile(launchScan.sha, launchScan.filePath))
    : [];

  return {
    currentPlayers,
    currentTimestamp,
    previousPlayers,
    previousScanTimestamp: previousScan?.timestamp,
    snapshotTimestamps,
    launchPlayers,
    launchScanTimestamp: launchScan?.timestamp,
  };
}

function selectEarlierDailyScans(history, currentDayKey) {
  const scans = [];
  const seenDays = new Set([currentDayKey]);

  for (const entry of history) {
    if (scans.length >= SNAPSHOT_DAY_LIMIT - 1) {
      break;
    }

    const timestamp = normalizeTimestamp(entry.commitTimestamp);
    const dayKey = toDayKey(timestamp);
    if (!dayKey || seenDays.has(dayKey)) {
      continue;
    }

    seenDays.add(dayKey);
    scans.push({ sha: entry.sha, filePath: entry.filePath, timestamp });
  }

  return scans;
}

function getCurrentSnapshotTimestamp(history) {
  const candidates = [
    normalizeTimestamp(readTextIfExists(LAST_UPDATED_PATH)),
    normalizeTimestamp(history[0]?.commitTimestamp),
  ].filter(Boolean);

  if (candidates.length > 0) {
    return candidates.sort((left, right) => new Date(left).getTime() - new Date(right).getTime())[
      candidates.length - 1
    ];
  }

  try {
    const modifiedAt = fs.statSync(SOURCE_PATH).mtime;
    if (!Number.isNaN(modifiedAt.getTime())) {
      return modifiedAt.toISOString();
    }
  } catch {
  }

  return new Date().toISOString();
}

function normalizeTimestamp(value) {
  if (!value) {
    return undefined;
  }

  const parsed = new Date(String(value).trim());
  return Number.isNaN(parsed.getTime()) ? undefined : parsed.toISOString();
}

function toDayKey(timestamp) {
  return timestamp ? timestamp.slice(0, 10) : "";
}

function selectLastScanBefore(history, timestamp) {
  const limit = new Date(timestamp).getTime();

  return history
    .map((entry) => ({ sha: entry.sha, filePath: entry.filePath, timestamp: normalizeTimestamp(entry.commitTimestamp) }))
    .filter((scan) => scan.timestamp && new Date(scan.timestamp).getTime() < limit)
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())[0];
}

module.exports = { LEGION_LAUNCH, loadPlayerSnapshots, selectEarlierDailyScans, selectLastScanBefore };
