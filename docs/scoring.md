# Scoring and ranking rules

Every number the site ranks by follows a rule the owner chose. Some deliberately reproduce
another site's numbers, and players compare them. **Changing any rule here is an architectural
decision: ask first.** When a rule does change, update its code, its tests and the page that
explains it together.

## Achievement ladder

- **Code:** `spa/scripts/player-ranking.js` (`RANKINGS`). It is the one definition. The build
  ranks with it and ships it inside the player snapshot (`k`), so the browser sorts by the same
  rules.
- Each ranking compares numeric fields from highest to lowest: achievement points, then
  honorable kills; or honorable kills, then achievement points; or achievements, played time,
  appearances or item level, then achievement points and honorable kills.
- What's still tied falls back to the achievement-point order, which ends on the player key
  (`realm::name`). That's only correct because every ranking also compares achievement points
  and honorable kills, and the module asserts this when it loads.
- **The `#` column** (`collectRanked` in `spa/src/app/features/ladder/ladder.service.ts`) is a
  row's place on the ladder being shown: the whole server, or inside the realm, faction or
  class filter when one is on. That's the same group the movement arrows measure
  (`buildCohortRankDeltas`).
  **A search only hides rows. It never renumbers them**, so a character looked up keeps their
  real place, as on the Mythic+ leaderboard. The order has no ties, so no two rows share a place.
- **Tests:** `scripts/player-ranking.test.js`, `ladder.service.spec.ts`.

## Ladder changes and new characters

- **Code:** `spa/scripts/generate-player-snapshot.js`, `spa/scripts/generate-player-history.js`,
  and `buildPreviousCharacterLookup` in `spa/scripts/player-data-utils.js`.
- Changes compare with the most recent earlier scan from another day
  ([data-pipeline.md](data-pipeline.md#what-prepare-appjs-builds)).
- **A row compares only with the same character.** The earlier row with the same realm and
  name counts only when the class is the same and the Level 10 dates agree: the same date, or
  no date earlier and now none or one no older than the day before that scan's commit. The
  ladder scan starts the evening before its commit, so a character can reach level 10 on that
  day after being read. Otherwise the name has changed hands (a rename onto a freed name, or a
  deleted and recreated character), and the row gets no value or rank change and no place on
  Top Gainers. Race, gender and faction can be bought, so they don't count. An earlier scan
  without the Level10Date column compares the class only.
- Played time ranks on whole minutes, in the build and in the browser, so players in the same
  minute tie in both places and the rank changes agree with the ladder.
- An earlier scan that lacks a column (appearances, account-wide achievements, played time)
  gives no value or rank change for that ranking.
- Top Gainers on appearances skips a character whose earlier count was 0: the data may have
  been missing in that scan, so the first positive count is a baseline, not a one-day gain.
- **A new character** is one whose name and class no earlier scan had (the name ignoring case).
  Realm, race and faction are left out on purpose: transfers and faction changes aren't new.
- **Tests:** `scripts/generate-player-snapshot.test.js`, `scripts/generate-player-history.test.js`,
  `scripts/player-data-utils.test.js`.

## Realm Stats

- **Code:** `spa/scripts/compute-server-stats.js` counts; `features/realm-stats/realm-stats-views.ts`
  turns the counts into what the page shows.
- Every number counts only the characters the realm and level filters pick. A guild's size is how
  many of those characters it holds (guild and realm together name a guild).
- A value falls in the highest bucket whose lower bound it reaches (bounds inclusive).
- Factions list Horde, Alliance and Neutral in that order, then anything else. A class's faction
  balance leaves Neutral out.
- Gender 1 is female. A race's icon shows the gender at least half of its characters play,
  female on a tie.
- An item level of 0 means unknown and is left out of the item level average, median and chart.
  The item level buckets adapt to the filter: they start at the round step below the lowest
  tenth of the characters, the step is the smallest of 1, 2, 5, 10, 20, 25, 50 and 100 that
  fits the rest of the spread into about twelve bars, and everyone under the first step shares
  one "<" bucket.
- The character age chart counts the year (UTC) of the Level 10 achievement. A character
  without one is left out; the years between the first and the last are all shown, empty or not.
- A distribution's gold bar is the bucket where the running count reaches half the characters.
- Most played pairings: count, then race id, then class id. Rarest pairings: the fewest
  characters first, leaving out any pair already in the most played ten.
- The race and class grid shades each square by the square root of its value over the
  strongest square of the mode (count, share of the class, share of the race), so small pairs
  still show.
- The item level class averages draw their bars from a baseline below the lowest class, the
  lowest average minus the spread (at least 10), rounded down to a multiple of 10, and the page
  says where it starts. Played time and points start at zero.
- Split bars (faction, female share) show whole percentages, the second being 100 minus the
  first, so the two always add up.
- **Tests:** `scripts/compute-server-stats.test.js`, `realm-stats-views.spec.ts`.

## Rare Achievements

- **Code:** `rankMatchingCharacters` in
  `spa/src/app/features/achievements/rare-achievement-matches.ts`.
- Heroic: Nefarian and Heroic: Maloriak count as rare only for a character who earned both on
  3 May 2015. The character scan applies this (`RareScanCatalog.RareAchievementDateRequirements`,
  through `CharacterScanner`).
- One achievement: newest first. A group ("All Gladiator Titles", "All Gladiator Mounts", "All
  Rated Battleground Titles") lists each character once, dated by their latest achievement in
  the group.
- "Most Rank 1 Gladiator Titles" and "Most Gladiator Mounts" rank by the count in the rare
  achievement summary, then newest first. A character without a count isn't listed.
- An achievement without a date comes after every dated one; ties go to realm, then name.
- The side comes from the race: Alliance races are Alliance, everything else reads Horde.
- The search matches the name or the guild, ignoring case (not accents).
- **Tests:** `rare-achievement-matches.spec.ts`.

## Rare Items

- **Code:** `findOwners`, `eliteSeasonOptions` and `otherItemOptions` in
  `spa/src/app/features/achievements/rare-items.ts`; the items come from `elite-pvp-items.json`
  and `rare-items.txt` ([data-pipeline.md](data-pipeline.md#elite-pvp-items)).
- An elite piece in an armour slot (head, shoulders, chest, hands, legs, waist, feet, wrists,
  back) is a set piece; every other elite piece (weapons, shields, off-hands) is a season's
  elite weapons, whatever classes it names.
- The class and realm filters pick characters by their own class and realm, for every list.
  Owners of a class's elite pieces have always been that class (observed, [tauri-api.md](tauri-api.md#characters-and-guilds)).
- The set pieces list everyone with at least one piece of the picked season (any season by
  default). The season list offers only the seasons with a set piece for the picked class:
  Season 9 to Legion Season 7, Legion only for Demon Hunters.
- "Other items" lists the rare items of `RareItems.json` that aren't elite pieces, in the
  file's order, then each season's elite weapons (Seasons 6 to Warlords Season 3). Picking one
  replaces the season.
- A piece counts once, however many of its item ids a character has (Legion's two per piece).
  Two different pieces in one slot (Cata and MoP boots of two stat kinds) count as two.
- Order: most pieces first, then name, then realm. The detail line under a name gives the
  seasons and their counts when no season is picked, the slots in a season, the weapons for
  elite weapons, and nothing for a single rare item, whose list has no Pieces column.
- **Tests:** `rare-items.spec.ts`.

## Guild Rankings

- **Code:** `spa/scripts/generate-guild-rankings.js`. For each limit N, it counts which guilds
  have the most members among the top N players by achievement points, and among the top N by
  honorable kills.
- The limits must match `GUILD_SOURCE_LIMIT_OPTIONS` in `guild-presence-options.ts`.

## Mythic+

- **Run score** (`api/MythicPlusExporter/MythicPlusScore.cs`), modelled on Raider.IO:
  - timed: `50 + 7.5 × level + 12.5 × (1 − time / timer)`;
  - over time: `50 + 7.5 × (level − 1) − 20 × (time / timer − 1)`;
  - more than 40% over the timer: 0 (exactly 40% still scores);
  - rounded to one decimal.

  So a depleted key sits just below a barely timed key one level lower.
- **Keystone upgrades** (the stars, `keystoneUpgrades` in `mythic-plus.ts`), Legion's rule:
  +3 within 60% of the timer, +2 within 80%, +1 within the timer. The comparison is in whole
  numbers, so the 60% and 80% boundaries are exact.
- **Player score** (`rankPlayers` in `mythic-plus.ts`): the sum of the character's best run
  score in each dungeon, Raider.IO's classic model. A spec, role or class filter scores a
  character only on the runs played that way.
- **Ties** (`playerRanks`): two players share a place only with the same score and the same
  total time. Places use competition ranking (1, 1, 1, 4).
- **Colours:**
  - Player scores (`scoreTiers`): Raider.IO-style stops at the score that the top 60%, 25%,
    10%, 1% and 0.1% of players reach, from white through green, blue, purple and orange to
    gold.
  - Run scores (`scoreQuality`, `shared/score-quality.ts`, which the raid leaderboard uses
    too): the share of the best score; at least 90% is legendary, 84% epic, 76% rare.
  - Which scale a score uses depends on the scope: one dungeon's score is a single run, which
    `runScoreColor` colours on the season's stops as if every dungeon had that run (score ×
    dungeons); "This week" places scores among this week's players; everything else uses the
    season's tiers.
- **"Top X%"** beside a rank is the share of players at or above it, rounded up so it never
  flatters: to a tenth of a percent below 10%, to whole percents above (`mythic-plus-profile.ts`).
- **Frequent teammates** (profile): most shared runs first, then the better best run
  together, then the name.
- **"Timed"** is `isTimed` (`mythic-plus-activity.ts`) everywhere: the leaderboard, the stats
  page and the records agree on it.
- **Weeks** (`currentAffixWeek` in `mythic-plus.ts`, `affixWeeks` in
  `mythic-plus-activity.ts`): "This week" means the runs with the current week's affixes. The
  data has no calendar of weeks, so a week is a stretch in which every run with all three
  affixes shares one set. It starts just after the last earlier run whose affixes contradict
  it, so +2/+3 keys (no affixes) and +4 to +9 keys (one or two) still land in the right week;
  the first week covers everything before. Keys below +10 don't carry Fortified or Tyrannical,
  so they take it from their week. The stats page puts a day in the week it's in at midday,
  because resets happen in the morning.
- **Leaderboard ranks** are counted per dungeon filter, as on Raider.IO. The player search
  hides rows and never renumbers them, and "Latest" order keeps each run's score rank.
- **Changes since the last scan** (rank and score arrows) describe the overall season ranking.
  They show only in that scope (season, all dungeons, no role, class or spec) and hide in any
  other, where they would compare different things.
- **Compare page** (`/mythic-plus/compare`): in each row the highest value is best (the lowest
  for a rank); ties are all best, and 0 or a missing value never is. Up to 4 characters
  (`COMPARE_LIMIT`), the most that fit side by side.
- **The scoring page** `/mythic-plus/scoring` explains all this with worked examples.
  `Score_MatchesTheScoringPageExamples` in `api/tests/AchievementLadder.Tests/MythicPlusExportServiceTests.cs`
  pins those examples, so change the page and the test together.
- **Tests:** `MythicPlusExportServiceTests`, `mythic-plus.spec.ts`, `mythic-plus-activity.spec.ts`.

## Mythic+ guild ladder

- **Code:** `mythic-plus-guild.ts`.
- A guild is its name on its realm: two guilds of the same name on two realms are two guilds.
  A URL's guild is matched by realm, then by exact name, then by name ignoring case, so a typed
  `/evermoon/skill issue` still finds Skill Issue.
- Scores are the leaderboard's, every run a member played counting, with guildmates or not.
  Only the ranks are counted again inside the guild; each row also shows the overall rank.
- **Rank changes inside the guild:** the standings only keep overall changes, so the previous
  guild ranks come from ordering the members by their previous overall ranks (shared on a tie).
  Members new since the last scan have no change and are left out of that order. The guild is
  today's roster: someone who joined since the last scan counts as if they were in it then.
- The header counts members in the leaderboard's top 100 (`TOP_OVERALL`).
- **Tests:** `mythic-plus-guild.spec.ts`, `mythic-plus-guild-page.component.spec.ts`.

## Mythic+ records

- **Code:** `mythic-plus-records.ts`. Every realm shares one records board.
- **Record:** a dungeon's highest timed key; at the same key the faster clear, then the
  earlier one. Dungeons are listed by their record, the one that used less of its timer first
  at the same key; untimed dungeons come last.
- **Server firsts** start at +10 (`FIRSTS_FROM_LEVEL`): every level below fell on the season's
  first evening. Of two firsts finished in the same second, the faster clear wins.
- **Bounties:** the level one above a dungeon's highest timed key, with the attempt that came
  closest (the smallest overtime; then the higher key; then the earlier run). A claimed bounty
  stays on the page for a week (`CLAIM_SHOWN_FOR_MS`).
- **Most runs:** every finished run counts, timed or not; ties go to more timed runs, then the
  name. A character shows in their most-played spec.
- **Tests:** `mythic-plus-records.spec.ts`.

## Spec and race popularity

- **Spec charts** (`specPopularity` in `shared/spec-charts/spec-popularity.ts`): classes are
  ordered by their most-seen spec, then the next one, so one dominant spec outranks a class
  whose total is spread out. On the Mythic+ chart, a minimum key level keeps that level and
  everything above it. Only each class's most-seen spec carries a value on its bar.
- **Raid spec popularity** counts player slots: a character who killed several bosses counts
  once per kill.
- **Race by spec** (`shared/spec-charts/race-popularity.ts`): a character counts once per
  spec, however many runs or kills they played it in. The three Pandaren race ids (24, and
  25 / 26 for the factions) are one race. Every spec of the role is listed in the game's order,
  also one nobody played, and a tie between races goes to the name.
- **Tests:** `spec-popularity.spec.ts`, `race-popularity.spec.ts`.

## Raid leaderboard

- **Code:** `scoreCharacters` / `rankScores` in `spa/src/app/features/raids/raid-scores.ts`.
- On each boss, the character's best counted kill is divided by the best anyone did there. The
  average of those shares, times `MAX_SCORE` (6969), floored, is the score. A boss the
  character hasn't killed counts as 0; a boss nobody has killed is left out of the average.
- **This reproduces tauriprogress's character score exactly.** It matched the owner's
  screenshot rank for rank. Don't "fix" the formula.
- Metric: healers are ranked on HPS, every other spec on DPS (`specMetric`), tanks included.
  HPS is healing plus absorbs.
- A character is its realm and name (`characterKey`), and the name belongs to the class of its
  latest kill on any boss and difficulty. Kills logged on another class belong to a former
  character with that name ([data-pipeline.md](data-pipeline.md#raid-log-files)): they're left
  out of the scores, boss rankings, spec performance and Talent Analytics, but each still sets
  the boss's best that every score is measured against, and still counts on the spec popularity
  and race charts. A former character's own view on the character page shows each boss's share
  of that best, but no score or rank.
- An invalid log counts nowhere, not even for a boss's best ([below](#invalid-raid-logs)).
- A spec filter scores characters only on the kills they played as that spec. The best on each
  boss is still the best anyone did there.
- Filters (class, faction, realm) only hide rows and re-rank the rest. Each score is still
  measured against everyone.
- A class or spec the tab doesn't rank (a Warrior on HPS) is cleared rather than leaving an
  empty list. A class with one spec the tab ranks gets that spec picked: on HPS that's every
  healing class but the Priest. No class has a single DPS spec. The class dropdown lists only
  the classes the tab ranks. `fitClassAndSpec` and `rankedClassOptions` do this, here and on a
  boss's ranking tabs.
- **Changes since the last scan:** the same ranking (metric, spec, class, realm) worked out
  again without the kills that scan didn't have (`newLogs`), compared with today's. A new best
  on a boss lowers everyone else's share of it, so a score can drop. That's why the table
  shows gains in green and drops in grey, as small text: the rank change beside the rank, the
  score change beside the score.
- **Colours** (`performanceQuality` in `raid-scores.ts`) follow Warcraft Logs' parse colours,
  on the share of the best in view: artifact for the best, legendary from 95%, epic from 75%,
  rare from 50%, uncommon from 25%.
- The search hides rows without renumbering them, as on every leaderboard.
- **Character page, per boss** (`bossStanding`): "Of best" and Rank put the character's best
  kill of the boss among every character's best, and the "Compare with" dropdown narrows that
  to the character's class (All Death Knights) or one of its specs (Blood). With a spec, only
  kills played as that spec count, the character's own included, so a boss they never killed
  as that spec has no rank. The dropdown lists the specs the metric ranks, and a picked spec
  the other metric doesn't rank is dropped on switching. The score tile always compares with
  all players.
- **Tests:** `raid-scores.spec.ts`, `raid-logs-character-page.component.spec.ts`.

## Raid boss rankings

- **Code:** `rankCharacters`, `rankedSpecs`, `rankedClassOptions` and `fitClassAndSpec` in
  `spa/src/app/features/raids/raid-scores.ts`; each damage spec's `range` in
  `spa/src/app/game/wow-specs.ts`.
- A boss's ranking tabs list each character's best counted kill of the boss on the difficulty;
  the earlier kill wins a tie. Damage ranks every spec but the healers, tanks included, on DPS.
  Healing ranks the healers on HPS.
- **Ranged and Melee** rank damage specs only, on DPS, split by the spec's `range`. Ranged:
  Beast Mastery and Marksmanship Hunters, Shadow Priests, Elemental Shamans, Mages, Warlocks
  and Balance Druids. Every other damage spec is melee, Survival Hunters included. Tanks are in
  neither, only under Damage. A character who played a ranged and a melee spec shows on both
  tabs, each time with their best kill as that kind of spec.
- Filters (class, spec, realm) re-rank the rest; the search hides rows without renumbering
  them. Class and spec fit the tab as on the leaderboard (above): Ranged lists no Rogue, and a
  Shaman on Ranged gets Elemental picked.
- The guild pages' Melee and Ranged roles (`combatRole`) read the same `range`.
- **Tests:** `raid-scores.spec.ts`, `wow-specs.spec.ts`, `guild-roster.spec.ts`.

## Raid guild progression and kill speed

- **Code:** `guildProgression`, `filterProgression`, `progressionChanges`, `fastestKills` and
  `speedRank` in `spa/src/app/features/raids/raid-progression.ts`.
- Guilds rank by most bosses down on the difficulty, then by who got there first (their latest
  first kill). Pickup groups and guilds the API couldn't name don't take part. A guild is its
  name on its realm, so one recreated under the same name keeps its row. A faction or realm
  filter ranks the remaining guilds among themselves.
- The progress squares show the bosses in the order raiders kill them, not the Dungeon
  Journal's order the files use.
- **Changes since the last scan:** the difficulty's progression worked out again without the
  kills that scan didn't have (`newLogs`), compared with today's. A guild that wasn't on the list
  then is tagged "new"; one that was gets "+N" for the bosses it has down now and didn't then.
  Either way, the squares of those bosses are outlined. Another kill of a boss the guild already
  had changes nothing, and filters don't change what counts. Both sides use today's guild names,
  so a guild the exporter has only just named isn't new because of that.
- Fastest kills: the shortest fight first; the earlier kill wins a tie. A log's speed rank is
  its place among the boss's kills on that difficulty.
- **Tests:** `raid-progression.spec.ts`.

## Invalid raid logs

- **Code:** the hand-kept list `api/AchievementLadder/Data/invalid-raid-logs.txt`, read by
  `InvalidRaidLogs` in RaidLogExporter ([data-pipeline.md](data-pipeline.md#invalid-raid-logs));
  `decodeIndex` (`raid-logs.ts`) and `RaidLogsDataService` on the site.
- A listed log counts nowhere, for any of its players: not in the leaderboard scores or the best
  on a boss they're measured against, the boss rankings, the fastest kills and speed ranks, the
  overview's best DPS and HPS, guild progression, the kill counts, spec performance, the tier
  list, Talent Analytics, or the spec and race charts. The whole kill is out, not only the
  players who abused something.
- It's still listed, tagged "Invalid" with the reason on hover, in the lists of latest kills:
  the overview's, a boss's Latest tab (without a number), a guild's kill history and a
  character's latest kills. Its log page opens with the reason, and the fight time says "Not
  ranked".
- `/raid-logs/invalid` lists every invalid log of every difficulty, latest first, with its
  reason. It has no menu entry: the "List of invalid logs" button on `/raid-logs`, shown only
  while there are any, links to it.


- It still decides which class a name belongs to, like any kill
  ([data-pipeline.md](data-pipeline.md#raid-log-files)): that's who played, not how well.
- **Tests:** `RaidLogExportServiceTests` (`ExportAsync_ListsInvalidLogs…`, `InvalidRaidLogs_*`),
  `raid-logs.spec.ts`, `raid-logs-data.service.spec.ts`,
  `raid-logs-character-page.component.spec.ts`.

## Raid spec performance


- **Code:** `scoresBySpec` (`scoresBySpecForKills` takes one difficulty's kills), `topAverage`
  and `specPerformance` in `spa/src/app/features/raids/raid-scores.ts`; `sortByPerformance` in
  `spa/src/app/features/raids/raid-talents.ts`.
- Every character gets the raid leaderboard score for each spec they played, as if that spec
  were picked on the leaderboard. A spec's performance is the average of its best
  `SPEC_TOP_SCORES` (10) character scores, or of all of them when it has fewer, and 0 when
  nobody played it. Only the best ten count, so attendance doesn't drag a spec down.
- Each difficulty is scored on its own, over every boss of the raid.
- Where it shows:
  - Raid Stats → Performance draws it as bars.
  - The Tier List page sorts it into tiers ([below](#raid-spec-tier-list)).
  - Talent Analytics lists each role's specs by it, best first. A tie keeps the game's order,
    the order is the same whichever boss is picked, and a picked class shows its specs in the
    game's order instead.
- **Tests:** `raid-scores.spec.ts`, `raid-talents.spec.ts`.

## Raid spec tier list

- **Code:** `roleTierList`, `percentOfBest` and `tierFor` in
  `spa/src/app/features/raids/raid-tier-list.ts`; the page is `/raid-logs/tier-list`.
- Three lists, DPS, Heal and Tank, each from the spec performance above on the picked
  difficulty: HPS for healers, DPS for tanks and damage dealers.
- A spec's share is its performance against the best spec in its role, as a whole percent
  rounded down, so 94.8% shows and counts as 94%. The tier is the highest it reaches
  (`SPEC_TIERS`): S from 95%, A from 85%, B from 75%, C from 60%, F below. Every tier is
  listed, even an empty one.
- Inside a tier, the higher share comes first; a tie keeps the game's order.
- A spec fewer than `FEW_PLAYERS` (10, the same as `SPEC_TOP_SCORES`) characters played keeps
  its tier, with its character count on the icon. A spec nobody played gets no tier and is
  listed by name under the role's list.
- **Tests:** `raid-tier-list.spec.ts`.

## Talent Analytics

- **Code:** `spa/src/app/features/raids/raid-talents.ts`.
- Each character counts once per boss and spec, with the talents of their best kill there by the
  spec's metric (the earlier kill on a tie), so a guild farming a boss every week doesn't
  outweigh everyone else. Members without a spec or talents are left out.
- **Top players** are the best tenth (`TOP_SHARE`) of the spec's ranking on that boss, the boss
  page's ranking filtered to the spec. The best player always counts.
- A talent is marked as picked for a boss when it's picked `NOTABLE_DIFFERENCE` (10 points)
  more there than on the other bosses, and only with at least `NOTABLE_MIN_PICKS` (10) picks on
  both sides.
- **Agreement** is how often players take each tier's most picked talent, averaged over the
  tiers. It reads, on the whole percent shown: 80% and up "Settled", 65% and up "Mixed", below
  that "Wide open".
- **The top players' edge:** the talent the top players pick furthest above (or below)
  everyone else, shown only with at least five top picks and a difference of five points.
- **Talent changes between bosses:** without a boss, the characters with picks on two or more
  bosses who picked more than one talent on a tier; with a boss, those whose pick there isn't
  the one they made most often on the other bosses.
- **Tests:** `raid-talents.spec.ts`.

## Arena titles

- **Code:** `ARENA_TITLES`, `getTitleCutoffs` and `getTitle` in
  `spa/src/app/features/pvp/arena-games.ts`. The page lists characters with 50 or more rated
  games this season (`DEFAULT_MIN_GAMES`). A season reward needs 50 wins (`REWARD_MIN_WINS`).
- **A lower bar, to compare:** the games dropdown (`MIN_GAMES_OPTIONS`: 50, 45, 40, 35, 30;
  `?games=`) lowers the minimum. The listed players, the title cutoffs, the holders and the
  changes since the last scan all follow it. The 50 wins a reward needs stay as they are.
- Each title covers a cumulative "top X%" of the listed players by rating:
  - 2v2: Gladiator 0.6%, Duelist 3%, Rival 10%, Challenger 35%;
  - 3v3: Season Gladiator 0.5%, Gladiator 3%, Duelist 10%, Rival 35%, Challenger 45%.
- **Places round up**, the server's rule: 1.01 places are 2. A title whose rounded places don't
  go beyond the better titles' gets no place of its own.
- **A place is a rating, not a player**: everyone on the same rating shares one place.
- 2v2 has no Season Gladiator, but its table keeps the row so both brackets' tables match.
- Games, wins and rating are the server's own, from the arena ladder
  ([tauri-api.md](tauri-api.md#arena-ladder-arena-ladder)); losses are games minus wins.
- The season start is `ArenaSeason.Start` in `api/ArenaLadderExporter` (2026-09-16). Edit it
  for a new season, so the first export doesn't compare its games with the old season's file
  ([data-pipeline.md](data-pipeline.md#publishing-safety)).
- **Tests:** `arena-games.spec.ts`.

## Arena changes since the last scan

- **Code:** `arenaRatingChanges` in `spa/src/app/features/pvp/arena-games.ts`, on
  `scanChanges` in `spa/src/app/shared/scan-change.ts`; the previous values come from the
  exporter ([data-pipeline.md](data-pipeline.md#arena-ladder-files)).
- The previous ranking is the table's own ranking worked out on each player's previous rating
  and games: the players who had the page's minimum games (50 unless lowered) or more then, by
  rating, then more games, then the name. A player's rank change is their place then minus
  their place now (▲ climbed, ▼ fell); the rating change is the rating now minus the rating
  then.
- **New** is a player in today's list who wasn't in that one: under the minimum then, or not on
  the ladder at all (also a character the ladder moved to a new GUID). New players show "new"
  and no rating change.
- A character on the previous list that has left the ladder (deleted, or moved to a new GUID)
  isn't in the previous ranking either, so it gives the players below it no climb.
- Rank changes show only in the table's default order, rating from the top, where the `#`
  column is that ranking. Rating changes show in every order.
- Gains are green and drops red: unlike a raid score, a rating only drops when its player
  loses.
- **Tests:** `arena-games.spec.ts`, `scan-change.spec.ts`, `ArenaLadderExportServiceTests`.

## Rated battleground leaderboard

- **Code:** `buildRatedBattlegroundAnalytics`, `rankRatedPlayers` and `ratedPlayerChanges` in
  `spa/src/app/features/pvp/rated-battleground-stats.ts`.
- Players rank by the picked metric over the games in view (all battlegrounds, or one), most
  first, then more wins, then the name. "Net rating change" adds up every game's
  `personal_rating_change`.
- **Changes:** the same ranking (metric and battleground) worked out again without the games
  the latest scan that found rated games added (`newRatedMatchIds`,
  [data-pipeline.md](data-pipeline.md#rated-battleground-changes)), compared with today's. The
  rank change sits beside the rank, and beside the metric what those games added to it.
  Players those games brought onto the list are "new".
- The changes stay until a scan finds more rated games, and the note above the table says
  since which scan and how many games in view that is. A battleground the new games weren't
  played on shows no changes.
- Gains are green and drops red, as on the Arena page.
- **Tests:** `rated-battleground-stats.spec.ts`, `BattlegroundCollectorServiceTests`.
