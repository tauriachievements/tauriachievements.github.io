const fs = require("fs");
const path = require("path");
const { parsePlayersCsv } = require("./player-data-utils");

const sourcePath = path.join(__dirname, "..", "src", "Players.csv");
const outputDir = path.join(__dirname, "..", "src", "assets", "data");
const outputPath = path.join(outputDir, "players.snapshot.json");

function generatePlayerSnapshot() {
  if (!fs.existsSync(sourcePath)) {
    throw new Error(`Missing source CSV: ${sourcePath}`);
  }

  const csvText = fs.readFileSync(sourcePath, "utf8");
  const normalizedRows = parsePlayersCsv(csvText);

  if (normalizedRows.length === 0) {
    throw new Error("Players.csv does not contain any data rows.");
  }

  const realms = new Set();
  const factions = new Set();

  for (const row of normalizedRows) {
    realms.add(row.realm);
    factions.add(row.faction);
  }

  const realmList = Array.from(realms).sort((left, right) => left.localeCompare(right));
  const factionList = Array.from(factions).sort((left, right) => left.localeCompare(right));
  const realmIndex = new Map(realmList.map((realm, idx) => [realm, idx]));
  const factionIndex = new Map(factionList.map((faction, idx) => [faction, idx]));

  const snapshot = {
    v: 1,
    r: realmList,
    f: factionList,
    p: normalizedRows.map((player) => [
      player.name,
      player.race,
      player.gender,
      player.playerClass,
      realmIndex.get(player.realm),
      player.guild,
      player.achievementPoints,
      player.honorableKills,
      factionIndex.get(player.faction),
    ]),
  };

  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(snapshot));

  const sizeKb = (fs.statSync(outputPath).size / 1024).toFixed(1);
  console.log(`Generated ${path.relative(process.cwd(), outputPath)} (${sizeKb} kB)`);
}

if (require.main === module) {
  generatePlayerSnapshot();
}

module.exports = {
  generatePlayerSnapshot,
};
