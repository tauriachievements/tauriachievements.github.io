const fs = require("fs");
const path = require("path");
const { LEGION_LAUNCH } = require("./load-player-snapshots");
const { buildPreviousCharacterLookup } = require("./player-data-utils");
const { getPlayerKey } = require("./player-ranking");

const outputDir = path.join(__dirname, "..", "src", "assets", "data");
const outputPath = path.join(outputDir, "played-since-legion.snapshot.json");

const PLAYED_SINCE_LEGION_LIMIT = 1000;
const MS_PER_SECOND = 1000;
const MS_PER_DAY = 24 * 60 * 60 * MS_PER_SECOND;

function buildPlayedSinceLegion(
  { currentPlayers, currentTimestamp, launchPlayers, launchScanTimestamp },
  limit = PLAYED_SINCE_LEGION_LIMIT
) {
  return {
    v: 1,
    launch: LEGION_LAUNCH,
    launchScan: launchScanTimestamp ?? null,
    generatedAt: currentTimestamp ?? null,
    players: rankPlayedSinceLaunchScan(currentPlayers, currentTimestamp, launchPlayers, launchScanTimestamp)
      .slice(0, limit)
      .map(({ player, played }) => ({
        name: player.name,
        realm: player.realm,
        faction: player.faction,
        race: player.race,
        gender: player.gender,
        class: player.playerClass,
        guild: player.guild,
        played,
      })),
  };
}

function rankPlayedSinceLaunchScan(currentPlayers, currentTimestamp, launchPlayers, launchScanTimestamp) {
  if (launchPlayers.length === 0 || !launchPlayers[0].hasPlayedTime || !launchScanTimestamp || !currentTimestamp) {
    return [];
  }

  const findLaunchRow = buildPreviousCharacterLookup(launchPlayers, launchScanTimestamp);
  const launchScanTime = Date.parse(launchScanTimestamp);
  const launchScanDay = Math.floor(launchScanTime / MS_PER_DAY);
  const longestPossible = (Date.parse(currentTimestamp) - launchScanTime) / MS_PER_SECOND;
  const ranked = [];

  for (const player of currentPlayers) {
    const launchRow = findLaunchRow(player);
    if (!launchRow && !(player.level10Day >= launchScanDay)) {
      continue;
    }

    const played = player.playedTime - (launchRow?.playedTime ?? 0);
    if (played > 0 && played <= longestPossible) {
      ranked.push({ player, played, key: getPlayerKey(player) });
    }
  }

  return ranked.sort((left, right) =>
    right.played - left.played || (left.key < right.key ? -1 : left.key > right.key ? 1 : 0)
  );
}

function generatePlayedSinceLegionSnapshot(snapshots) {
  const payload = buildPlayedSinceLegion(snapshots);

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(payload));

  const sizeKb = (fs.statSync(outputPath).size / 1024).toFixed(1);
  console.log(`Generated ${path.relative(process.cwd(), outputPath)} (${sizeKb} kB, ${payload.players.length} characters)`);
}

module.exports = { PLAYED_SINCE_LEGION_LIMIT, buildPlayedSinceLegion, generatePlayedSinceLegionSnapshot };
