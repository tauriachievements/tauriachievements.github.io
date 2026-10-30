# Data pipeline

The site has no server. Console apps in `api/` call the Tauri API and write data files into
`spa/src/`. Scripts commit those files to `main`, and every push to `main` rebuilds and deploys
the site.

```
Tauri API ──► api/ console apps ──► spa/src/ data files ──► commit on main ──► Pages deploy
                                            │
                            spa/scripts/prepare-app.js (npm start / npm run build)
                                            ▼
                         spa/src/assets/data/ (generated, git-ignored)
                                            ▼
                         DataFileService in the browser (file?v=<content hash>)
```

## Who writes what

| File or folder in `spa/src/` | Written by | Commit message | Read by |
|---|---|---|---|
| `Players.csv`, `lastUpdated.txt`, `RareAchievements.json` | `AchievementLadder`, `MissingPlayerFinder` | `sync data` | `prepare-app.js`, the ladder pages |
| `RareItems.json` | `AchievementLadder` | `sync data` | Rare Items page |
| `elite-pvp-items.json` | built once from TauriShoot, then kept by hand ([below](#elite-pvp-items)) | `feat:` / `chore:` | Rare Items page, `AchievementLadder` |
| `battlegrounds.json`, `battleground-collector-state.json`, `rated-battlegrounds.json` | `BattlegroundCollector` | `sync data` | Battleground and Rated Battleground pages |
| `arena-ladder-2v2.json`, `arena-ladder-3v3.json` | `ArenaLadderExporter` | `sync data` | Arena page |
| `mythic-plus-data/` | `MythicPlusExporter` | `sync data`, or `sync mythic plus data` from `Run-MythicPlus.cmd` | `/mythic-plus/*` |
| `raid-log-data/` | `RaidLogExporter` | `sync data`, or `sync raid logs data` from `Run-RaidLogs.cmd` | `/raid-logs/*` |
| `guild-analysis/<key>.json` | `GuildAnalysisExporter` through `api/guild-analysis.cmd` | `sync guilds statistics` | the hidden guild pages |
| `EmeraldNightmare.json`, `RealmFirstAchievements.json`, `ap-chest-looters.json` | edited by hand | `chore:` / `feat:` | Race to Emerald Nightmare, Realm First History, Hall of Fame |

The scan inputs live under `api/AchievementLadder/Data/`. `BattlegroundCollector` (from the
members of every match it reads, arenas included) and the two `*GuildAndCharScan` jobs append
new guilds and guildless characters to the realm lists;
`GuildCharacterExporter` removes guilds that no longer exist; `RealmFirstAchievements` rewrites
`valid-realm-first-characters.txt`. `sync data` commits these lists too. The scans only append,
and skip a name already listed, ignoring case. `guildless-characters.txt` holds one
`Name-[EN] Evermoon` line per character, always with the API realm name, whatever spelling the
source used (`GuildListFiles`). Two files there are kept
by hand: `invalid-raid-logs.txt`, the raid kills that don't count ([below](#invalid-raid-logs)),
and `rare-items.txt`, the rare items that aren't elite PvP pieces, as `Name - ID` lines.
AchievementLadder looks for those items and every piece in `spa/src/elite-pvp-items.json` in each
character's appearance collection, and writes the owners to `RareItems.json`.

## The daily update

`api/Run-DailyUpdate.cmd` runs `Run-DailyUpdate.ps1`, which builds once and then runs these
steps in order. The step names are the values `-From` accepts.

1. `MythicPlus`: MythicPlusExporter
2. `RaidLogs`: RaidLogExporter
3. `MythicPlusNames`: MythicPlusGuildAndCharScan
4. `RaidLogNames`: RaidLogGuildAndCharScan
5. `RealmFirst`: RealmFirstAchievements
6. `Battlegrounds`: BattlegroundCollector
7. `ArenaLadder`: ArenaLadderExporter
8. `GuildCharacters`: GuildCharacterExporter
9. `Ladder`: AchievementLadder
10. `MissingPlayers`: MissingPlayerFinder
11. `Publish`: one `sync data` commit of the paths in `$publishPaths`, then a push

If every step succeeded and `-NoPush` wasn't given, the `.cmd` then calls
`api/guild-analysis.cmd`, which scans every guild page and makes its own
`sync guilds statistics` commit and push.

- `-From <Step>` resumes after a failure, `-NoPush` commits without pushing, and
  `-MaxShrinkPercent` (default 2) sets the shrink gate.
- The commit message must stay exactly `sync data`: `discord-on-push.yml` matches on it.
- Retry queues (`MissingGuildsToScan.txt`, `MissingPlayersToScan.txt`) and run logs live in the
  git-ignored `api/.work/`.
- `MythicPlusNames` and `RaidLogNames` don't fail over a leaderboard or character sheet that
  didn't load. They only add names, so they warn, and the next run catches up.
- `MissingPlayers` works in rounds and stops once a round resolves nobody: characters gone from
  the realm fail every time. A character already in Players.csv only gets its rare achievements
  refreshed, which needs `character-achievements` alone.
- `Run-MythicPlus.cmd` and `Run-RaidLogs.cmd` refresh one dataset on its own. Their arguments
  go to the exporter (`Run-MythicPlus.cmd --allow-shrink` at a season reset). Before the
  export, each checks that the push at the end will be accepted: you're on `main` and level
  with `origin/main`. `Run-RaidLogs.cmd` stops when you aren't. `Run-MythicPlus.cmd` asks you
  to type `1` to fix it, by switching to `main` (only when nothing is uncommitted) or by
  pulling with `--ff-only`, and then goes on. After the switch or pull it starts itself again
  from the top, because cmd.exe reads a running script from disk by byte offset: a checkout
  or pull that changes the script would otherwise leave it running from the middle of a
  different file. Both commit with `git commit --only` on their data folder, so unrelated
  staged work never rides along.

## Publishing safety

Each job writes everything or nothing, through `AtomicFile` / `JsonLineWriter` in `Tauri.Core`.
On top of that:

- The daily update won't publish when Players.csv has shrunk by more than `-MaxShrinkPercent`
  compared with the last commit. That usually means the API was unstable.
- MythicPlusExporter and RaidLogExporter refuse to write when the run or kill count shrinks by
  more than 2%. Pass `--allow-shrink` when the drop is real, such as a new season.
- MythicPlusExporter writes nothing unless it read every leaderboard.
- MythicPlusExporter and RaidLogExporter write the dungeon or boss files first and `index.json`
  last: the index is what makes new dungeons and kills visible.
- ArenaLadderExporter writes nothing unless it read both brackets' ladders. It refuses to
  write when a bracket's games played (the season games of everyone listed, summed) fall by
  more than 2% against the file of the same season (`seasonStart`). A deleted character takes
  their games off the ladder, so a big one can trip it; pass `--allow-shrink` when the drop is
  real.
- GuildCharacterExporter removes guilds the API reports as not found (error code 13), but no
  more than 5% of all guilds per run.
- RaidLogExporter is incremental: it re-reads its own boss files and fetches only new logs.
  `--full` refetches everything. A boss file with an older format version makes the next run
  re-read every log. A boss file it can't read, or one of a newer format, makes it start over
  as if there were no earlier export.
- RaidLogExporter looks up each loot item's name once. An item TauriShoot can't give is left
  out and looked up again next run; the page shows its id meanwhile.
- RaidLogExporter looks up each talent's tooltip once and keeps it in `talent-tooltips.json`
  ([below](#talent-tooltips)). A run looks up only the spells the file lacks; `--full`, or a
  file of another `version`, looks them all up again (about 20 s). A tooltip TauriShoot can't
  give is left out and looked up again next run. When TauriShoot's talent trees can't be read,
  `talents.json` and `talent-tooltips.json` both stay as they are.

Keep these guards in any new exporter ([guides/howto-add-exporter.md](guides/howto-add-exporter.md)).

## Mythic+ files

MythicPlusExporter writes `mythic-plus-data/` for the `/mythic-plus` pages, which decode it in
`mythic-plus.ts`. Every entry goes on its own line.

- `index.json`: `version`, when the leaderboards were read (`generatedAt`, UTC ISO 8601),
  `previousGeneratedAt` once there is an earlier export, the `tables` fingerprint (below), the
  `season`, `dungeons` and `affixes`, and the tables the dungeon files point into: `specs` as
  objects and `players` as `[name, realm, guild, class, race, gender]`, sorted by realm, then
  name. `standings` is aligned with `players`: `[score, rank, scoreChange, rankChange]`, a rank
  change positive when the character climbed. A character new since the last export, and every
  character on a first export, has no two changes. The exporter works the changes out once, so
  no browser needs the previous run files.
- `<dungeon>.json`, named by the dungeon's slug: `version`, `dungeon`, `tables` and the
  dungeon's `runs`, best first (the higher score, then the faster clear, then the earlier
  finish), each `[keyLevel, clearTimeMs, completedAtUnix, score, [affixId, ...], [[player, spec], ...]]`
  with player and spec as positions in the index's tables. A dungeon nobody has run yet has no
  file and no tile.
- `tables` is a short hash of the spec table and the players' realms and names, in order. A new
  player shifts the sorted table and changes it; a known player's new guild or race doesn't, so
  an unchanged dungeon file stays byte for byte the same and still matches a newer index. The
  page uses it to never read a dungeon file against another export's index
  ([below](#caching-the-data-manifest)).

## Raid log files

RaidLogExporter writes `raid-log-data/` for the `/raid-logs` pages, which decode it in
`raid-logs.ts`. Every entry goes on its own line, and the tables grow in order of first
appearance, so a new kill is a few added lines in git.

- `index.json`: when the rankings were read (`generatedAt`, UTC ISO 8601), the raid, its
  difficulties (with kill counts, invalid logs left out) and bosses, the spec table, and every kill as
  `[realm, logId, boss, difficultyId, killedAtUnix, fightMs, guild, faction, wipes, deaths, members]`
  (boss and guild are positions in `bosses` and `guilds`, guild -1 for a pickup group, members a
  count). Once there is an earlier export to compare with, `previousGeneratedAt` and the kills
  added since it as `newLogs` (`[realm, logId]`), measured against its boss files, so `--full`
  doesn't change them. A run that finds no new kill keeps the last export's `newLogs` and
  `previousGeneratedAt`, so running twice in a row doesn't wipe the day's changes. The invalid logs
  ([below](#invalid-raid-logs)) as `invalidLogs` (`[realm, logId, reason]`). The full clears as
  `clears`: `[logRealm, difficultyId, realm, [logId, step, ...]]`, one per raid instance with a
  kill of every boss, in the order the clears ended. The log ids are the instance's kills in the
  order they died: the first id, then each next one as its difference from the one before, a
  few digits instead of seven, since every raid page loads the index. `realm` is the realm most
  of the clear's players play on, which a pickup clear shows
  ([scoring.md](scoring.md#raid-fastest-full-clears)). `guilds` as
  `[name, realm, faction, guildId]` (an empty name for a guild that couldn't be named), each
  name with a former character (below) as `formerCharacters`
  (`[name, realm, classNow, [earlierClass, ...]]`, latest first), each boss and difficulty's
  best DPS and HPS as `[name, realm, class, spec, perSecond, logRealm, logId]`
  (the earlier kill on a tie, invalid logs left out), and the loot's `items` as
  `[id, name, quality, icon]`.
- `<boss>-<difficulty>.json`: that boss's kills on that difficulty, oldest first, as
  `[realm, logId, killedAtUnix, fightMs, guild, faction, wipes, deaths, resurrects, members, [itemId, ...], instanceId]`,
  each member `[player, spec, ilvl, damage, healing, absorbs, overhealing, damageTaken, interrupts, dispels, talents, [trinket, ...]]`.
  `instanceId` is the API's `instance_uid`: the kills of one raid instance share it, which is
  how the exporter finds the full clears. `talents` holds a character per tier, top to bottom:
  the column picked (`0` to `2` from the left) or `.` for an empty tier, and is empty when the
  log has none. The file has its own `guilds` (as in the index), `players`
  (`[name, realm, class, race, gender, guild]`, below) and `trinkets`
  (`[id, itemLevel, name, quality, icon]`) tables. A boss file needs nothing from the index, so a page that loaded the index before a deploy can still read a newer boss file. A
  difficulty without kills has no file.
- `talents.json`: each spec's talent choices as `[specId, [[[spellId, name, icon], ...], ...]]`,
  tiers top to bottom and choices left to right (null where TauriShoot has none).
- `talent-tooltips.json`: [below](#talent-tooltips).

A boss file's `players` table holds one row per realm, name and class. A name played by two
classes over the season (a freed name taken by a new character) gets a row for each, and every
kill points at the row of the class it was logged as. Race and gender come from that class's
latest kill. The guild comes from Players.csv, else the latest kill that named one; a former
character (below) never takes the Players.csv guild, which belongs to whoever has the name now.

A name belongs to the class of its latest kill on any boss and difficulty. A row of any other
class is a former character with that name and ends with an extra `1`. The site leaves former
characters out of the leaderboard, boss rankings, spec performance and Talent Analytics. Their
kills still count as player slots and still set a boss's best
([scoring.md](scoring.md#raid-leaderboard)). The character page shows the current character;
a switch under the name (from `formerCharacters`) opens an earlier one at `?class=<classId>`,
on the first difficulty it has kills on, with its kills but no score or rank. The log page
links a former character's name to that view. Only the exporter sees every kill, so only it can
tell: the site loads one difficulty at a time.

RaidLogExporter rebuilds the logs it already has from the boss files, so whatever a file
doesn't store is lost for those logs until they're read again. Bump
`RaidLogFileWriter.FormatVersion` whenever a boss file's shape or meaning changes: the next run
then reads every log again from the API.

## Invalid raid logs

`api/AchievementLadder/Data/invalid-raid-logs.txt` lists the raid kills that don't count, such
as a kill won by abusing a bug. It's kept by hand, one log per line: the realm (`Tauri`,
`Evermoon` or `WoD`), the log id from the log page's URL, then the reason the site shows, for
example `Tauri 1704810 Invalid log, bug abusing`.

- RaidLogExporter reads the list on every run (`InvalidRaidLogs`) and writes the listed logs it
  has into `index.json` as `invalidLogs`. It leaves them out of the difficulties' kill counts and
  the best DPS and HPS. The logs themselves stay in the index and the boss files, so a change to
  the list needs no format bump and no API reads. It shows on the site after the next export:
  the daily update, or `Run-RaidLogs.cmd`.
- A line that isn't `<realm> <log id> <reason>` stops the export before anything is read. A
  listed log the export doesn't have is reported and skipped.
- On the site, `decodeIndex` keeps invalid kills out of `kills` and puts them in
  `invalidKills`, and `RaidLogsDataService.bossKills()` leaves them out of a boss file's kills,
  so every ranking and statistic skips them without asking. A list that shows them asks for
  `invalidBossKills()` as well. What counts where is in
  [scoring.md](scoring.md#invalid-raid-logs).


## Talent tooltips

`raid-log-data/talent-tooltips.json` holds a tooltip for every spell in `talents.json`, one per
line: `{"version": 1, "spells": [[spellId, [detail, ...], description], ...]}`, in spell id
order. RaidLogExporter turns TauriShoot's tooltip HTML into plain text (paragraphs kept as
`\n\n`) and drops what TauriShoot gets wrong ([tauri-api.md](tauri-api.md#taurishoot-legion-shoottaurihu)),
so a tooltip never shows a number it knows is wrong:

- The details keep the range, the cast time and a cooldown of 2 sec or more, in TauriShoot's
  order. Costs go, and so do "Unlimited range" and a lone "Instant" (a passive talent).
- The description loses the stand-in amount before "damage" or "healing" ("causing 375
  Physical damage" becomes "causing Physical damage"), a zero heal or rating ("for 0", "by 0
  for"), and the minus of a reduction ("by -25%" becomes "by 25%").
- A description that still holds an unresolved value (`$`, a lone `0`, `sec1`, a `%` without
  a number, a stray minus, `1.5.1`, a four-digit percentage) is written as `""`. The tooltip
  then shows the talent's name and details only. On 2026-10-22 that was 140 of 603 spells.

The rules are in `TauriShootSpellTooltipSource`. Changing them means bumping
`RaidLogFileWriter.TalentTooltipsFormatVersion`, so the next run looks every tooltip up again
with the new rules. The site decodes the file with `decodeTalentTooltips` (`raid-logs.ts`) and
loads it through `RaidLogsDataService.talentTooltips()` once a page's kills are in, so it never
holds up the page.

## Arena ladder files

ArenaLadderExporter writes `arena-ladder-2v2.json` and `arena-ladder-3v3.json` for `/arena`,
which reads them through `arena-games.ts`. Each file (format version 2) is
`{ version, bracket, seasonStart, generatedAt, previousGeneratedAt, players }`, one player per
line, best rating first (then most games, name, realm and guid). A player is
`{ guid, realm, name, class, race, gender, faction, guild, spec, games, wins, weekGames, weekWins, rating, peakRating, weekPeakRating, previousRating, previousGames }`,
taken straight from the ladder ([tauri-api.md](tauri-api.md#arena-ladder-arena-ladder)):

- `spec` is the spec of the player's latest game, 0 when the ladder has none.
- `rating` is the current personal rating and `peakRating` the season's best. The `week`
  fields are this week's games, wins and best rating as the server counts them; the page
  doesn't show them yet.
- Losses and the win rate are worked out on the page.
- `generatedAt` (UTC) is when the ladder was read, and the page header shows it.
- `seasonStart` is `ArenaSeason.Start`.
- `previousGeneratedAt`, `previousRating` and `previousGames` come from the file the export
  replaces: its `generatedAt`, and the same realm and guid's `rating` and `games` there. The
  ladder's own `prev_personal_rating` is always 0 ([tauri-api.md](tauri-api.md#arena-ladder-arena-ladder)),
  so this is the only record of the previous scan. They're left out when that file is from
  another season (`seasonStart`) or has no `generatedAt`, and a player's pair is left out when
  the player wasn't on it. The page turns them into the rank and rating changes
  ([scoring.md](scoring.md#arena-changes-since-the-last-scan)).

The comparison is with the previous export, published or not: running the exporter twice
(the whole daily update again after a failure, instead of `-From`) compares the second run with
the first, and the day's changes shrink to whatever happened in between.

A ladder entry without a name, class, known realm or games is left out, and so is a second
entry for the same realm and guid.

## Rated battleground changes

`rated-battlegrounds.json` is the archive of every rated battleground the collector has read,
oldest first; the page ranks its players from those games. To show what the latest games
changed, `battleground-collector-state.json` carries two more fields:

- `newRatedMatchIds`: the `matchid`s of the rated games the latest scan that found any added;
- `newRatedMatchesSince`: when the scan before that one ran (its `lastScanUtc`).

A scan that adds no rated game keeps both as they are. Rated battlegrounds are rare (32 games
on 12 days between 17 Sept and 26 Oct 2026), so the page keeps showing the latest games'
changes until new ones arrive. Both are `null` until the first scan after they were added finds
a rated game.

## Elite PvP items

`spa/src/elite-pvp-items.json` lists every elite PvP piece a character can collect as an
appearance: 3,046 items over 20 seasons, from Furious (Season 6) to Demonic (Legion Season 7).
It's one file for both sides: the Rare Items page reads it for its class, season and weapon
lists, and AchievementLadder adds its ids to the items it looks for
(`RareItemCatalog.LoadElitePvpItems`), so the page shows every owner after the next scan.

```
{ "version": 1,
  "seasons": [[key, name, label], ...],          oldest first: ["malevolent", "Malevolent", "Season 12"]
  "items":   [[id, season, [classId, ...], slot, name], ...] }
```

One season or item per line. `slot` is TauriShoot's (`Head`, `Back`, `Two-hand`, `Off Hand`, …);
an armour slot makes a set piece, anything else a weapon ([scoring.md](scoring.md#rare-items)).
`classes` is empty for a piece any class can use, and holds two or three classes for some Cata
and MoP boots and belts.

It was built on 2026-10-26 from TauriShoot ([tauri-api.md](tauri-api.md#taurishoot-legion-shoottaurihu)):

- every item whose name starts with a season's "<Season> Gladiator's", found by searching each
  season's name, and that name with each word that follows "Gladiator's" while a search hit the
  300-result cap;
- of those, the epic armour and weapons whose tooltip tag ends in "Elite" ("Season 12 Elite").
  The tag, not the name, gives the season: some Vicious items carry the Season 10 tag. Every
  weapon from Season 1 on and all armour from Season 5 on was checked; the armour of Seasons 1
  to 4 was only sampled (the Plate and Silk pieces), and none of it was elite;
- without necks, rings and trinkets (226 items), which have no appearance, so a scan never sees
  them.

What came out of it:

- Seasons 6 to 8 have elite weapons only. From Season 9 every class has elite armour.
- Legion lists two item ids for each piece, with the same appearance. Both are in the file.
- TauriShoot names no class on six Vindictive cloaks; the file gives them the class the same
  cloak has in the later Legion seasons (Drape of the Tracker: Hunter, Ironskin Cloak: Monk,
  Demonthread Cloak: Demon Hunter).

The seasons are over, so the list doesn't change on its own: edit it by hand, and bump `version`
in the file, `ELITE_PVP_ITEMS_VERSION` (`rare-items.ts`) and `ElitePvpItemsFormatVersion`
(`RareItemCatalog`) together if its shape changes. An id in both this file and `rare-items.txt`
counts once, under the `rare-items.txt` name.

## What `prepare-app.js` builds

`npm start` and `npm run build` run `spa/scripts/prepare-app.js` first (`prestart` /
`prebuild`). It parses Players.csv once and writes into `spa/src/assets/data/`. Those files are
git-ignored and regenerated on every build:

- `players.snapshot.json`: every player, self-describing (`c` = column names, `k` = the ranking
  rules from `scripts/player-ranking.js`), in achievement-point order, with each player's rank
  and value changes since the previous day's scan. `realm` and `faction` are indexes into the
  file's own lists, played time is in whole minutes (the app works in seconds), and a "Level 10"
  date is days since 1970-01-01 (0 when unknown). `readPlayerSnapshot` reads rows by column
  name, never by position, so a column the build adds, drops or moves can't land in the wrong
  field; a column it expects but the file lacks reads as 0 or `''` and is reported once.
- `players.head.snapshot.json`: exactly the first 25,000 rows of the full snapshot. The ladder
  starts on it and loads the full file only when a search or sort needs it. Both files carry
  the same realm and faction lists, so moving from the head to the full file keeps every row's
  realm and faction.
- `players.history.snapshot.json`, `new-players.snapshot.json`, `stats.snapshot.json`,
  `guilds.snapshot.json`: small precomputed files for Top Gainers, New Rare Characters, Stats
  and Guild Rankings.
- `stats.snapshot.json` (version 3) holds one snapshot per realm and level filter, keyed
  `realm|level` with `*` for all (`*|110`, `Tauri|*`). A snapshot has the totals (characters,
  guilds, female characters, average and median item level, total and median played hours),
  `factions`, `classes` (with each class's female, Horde and Alliance counts and its average
  item level, played hours and achievement points), `races` (with female counts), `combos` (one
  `{ race, class, count, female }` per race and class pair anyone plays), the ten biggest
  `guilds`, `realms`, and `distributions`: `itemLevel`, `achievementPoints`, `honorableKills`,
  `playedDays`, `level10Year` and `guildSize`, each `{ labels, counts }`. Every bucket's label
  says its bounds, since a label means nothing apart from the bounds that produced it, and the
  item level buckets differ per filter. Class and race names and colours stay in the page, so
  restyling a chart or renaming a class needs no new data. The counting rules are in
  [scoring.md](scoring.md#realm-stats).
- `battlegrounds-<era>.json`: one file per era, so the default Legion view never downloads the
  much larger prepatch history. `legion` holds the battlegrounds started from 2026-07-15 09:00
  (`LEGION_START`), `wod-prepatch` everything before. A file is `{ version, era, names, days }`:
  days in date order, each holding its battlegrounds as flat triples (an index into `names`, the
  start minute of the day, the duration in seconds or -1 when unknown), in the collector's
  order. The collector writes `YYYY.MM.DD HH.MM` start times and `HH:MM:SS` durations; a bare
  number is milliseconds. The daily update runs the collector just after midnight, and it stops
  at the first match still in progress, so the newest day can be a game short until the next
  scan (at most one between 18 and 26 Oct 2026). The Battlegrounds page still lets you pick
  that day: its date picker spans every day in the file.
- `raid-genders.json`: gender corrections for raid characters (the raid API reports almost
  everyone as male), taken from Players.csv: for each raid character the ladder knows, the
  ladder's gender where the two disagree. A ladder character of another class is a different
  character with the same name and is left alone. The file is
  `{ v, female: { realm: [names] }, male: { realm: [names] } }`.
- `data-manifest.json`: a content hash for every data file, generated last.

**The previous scans come from git history.** Every `sync data` commit is one scan.
`readPlayersCsvHistory()` (`scripts/player-data-utils.js`) uses `git log --follow`, so a build
needs the full history: `static1.yml` and `test.yml` check out with `fetch-depth: 0`. In a
shallow clone the deltas, Top Gainers and "new character" flags all come out empty, and nothing
fails.

- The earlier scans are one per calendar day, newest first, never from the current scan's day,
  up to 21 days in all for the history timeline (`load-player-snapshots.js`).
- The current scan's time is the later of `lastUpdated.txt` and the newest `sync data` commit.
  The file's modification time is a last resort only: in CI it's the checkout time, which
  would turn a guild-only deploy into zero deltas.
- `--name-status` records the path each commit had (the file moved from `src/` to `spa/src/`).
  A pure rename (`R100`) isn't a scan: counting it would compare the data with itself.

## Caching: the data manifest

`DataFileService` is the only way the app loads a data file. It requests `file?v=<hash>`, with
the hash taken from `data-manifest.json`, so a browser caches each file until a deploy changes
it. The manifest itself is fetched fresh once per session. Its file list comes from the
`assets` entries in `angular.json` plus everything in `assets/data/`. A new data file only
needs adding to `angular.json`.

GitHub Pages ignores `?v=`, so a tab left open across a deploy can mix old and new files. The
Mythic+ files guard against this: `index.json` and every dungeon file carry a `tables`
fingerprint. When they don't match, `MythicPlusDataService` refreshes the session and loads
again, once; a second mismatch means the deploy is still going out, and the page says so
(`NEWER_DATA_MESSAGE`) instead of retrying in a loop.
Any new data split across several files needs the same guard. Raid boss files carry their own
tables, so they don't. The page code has its own guard for a code deploy
([frontend.md](frontend.md#routing)).

## Rules

- **Never name a deployed data folder or file after a route.** On Pages a real folder wins over
  the SPA route: when the M+ data folder was named `mythic-plus/`, `/mythic-plus` served
  `index.json` raw. `ng serve` resolves app routes first and hides this. Test deep links against
  the built `dist/` with a static server that serves real files first and falls back to
  `404.html`.
- **Never hand-edit or hand-merge a generated data file.** After a format change, a merge
  conflicts with the daily data commits on `main`. Take `main`'s side and rerun the job.
- Exporters write one entry per line (`JsonLineWriter`), so the daily git diffs stay small.
- **Keep the slugs stable.** A Mythic+ dungeon's slug (`MythicPlusCatalog`) is its file name
  and the page's `?dungeon=` value; a raid boss's slug (`RaidCatalog`) is in its file name and
  page URLs.
- MythicPlusExporter and RaidLogExporter write names unescaped (`UnsafeRelaxedJsonEscaping`):
  many character and guild names are Cyrillic or accented.
- GuildAnalysisExporter's `guild-analysis/` file names drop accents ("Témérité" becomes
  "Temerite"), so their URLs never need encoding.
- MythicPlusExporter, RaidLogExporter and ArenaLadderExporter write LF. The root
  `.gitattributes` keeps their files LF on checkout, so `core.autocrlf` doesn't warn on every
  commit. A new exporter that writes LF needs a line there too.
