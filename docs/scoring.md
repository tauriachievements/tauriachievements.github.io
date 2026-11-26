# Scoring and ranking rules

Every number the site ranks by follows a rule the owner chose. Some deliberately reproduce
another site's numbers, and players compare them. **Changing any rule here is an architectural
decision: ask first.** When a rule does change, change its tests first and see them fail
([testing.md](testing.md)), then its code and the page that explains it, in the same PR.

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

## Played Since Legion

- **Code:** `spa/scripts/generate-played-since-legion.js` ranks; `features/ladder/played-since-legion.ts`
  filters and averages for the page.
- A character's played time since launch is its PlayedTime now minus its PlayedTime in the last
  scan committed before the Legion launch (2026-07-15 09:00 server time). That scan is from the
  evening before, so time played on Jul 14 after it counts too.
- The launch scan's row counts only for the same character, by the Top Gainers rule
  ([above](#ladder-changes-and-new-characters)). That scan has no Level10Date column, so it
  compares the class only: a name now on another class is another character.
- A character the launch scan doesn't have counts in full only when it reached level 10 on or
  after that scan's day (UTC). Any other is left out: the ladder found it after launch, so its
  time at launch is unknown (12,720 characters on 2026-11-13), and counting its whole /played
  would put it at the top.
- A character is left out when its time since launch is 0 or less (the name changed hands) or
  more than the time between the two scans.
- Most time first, then the player key (`realm::name`), so no two rows share a place. The file
  keeps the top 1,000.
- A realm or class filter numbers the characters again inside it; a name or guild search only
  hides rows (case and accents ignored), as on the ladder.
- Per day is the played time over the days from the launch to the current scan, fractions of a
  day included, for every character, those made after launch too.
- Each character counts on its own: the API doesn't link characters to accounts. /played counts
  time logged in, AFK included.
- **Tests:** `scripts/generate-played-since-legion.test.js`, `scripts/load-player-snapshots.test.js`
  (`selectLastScanBefore`), `played-since-legion.spec.ts`.

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

## Rare item findings

- **Code:** `findingScans` in `spa/src/app/features/achievements/rare-item-findings.ts`. What
  counts as a finding is AchievementLadder's `RareItemFindings`
  ([data-pipeline.md](data-pipeline.md#rare-item-findings)).
- The page shows the last 7 scans, newest first, each with what it found. In a scan, new
  characters ("New") come first, then owners who collected more ("Known"); then the most items
  found, then name, then realm.
- Found counts a piece once however many of its item ids were found (as on Rare Items), and
  each other rare item once. The detail line gives the elite pieces per season, set pieces and
  weapons together, oldest season first, then the other items by name.
- **Tests:** `rare-item-findings.spec.ts`; `RareItemFindingsTests` and
  `RareItemFindingsFileTests` for what counts as found and the file.

## Guild Rankings

- **Code:** `spa/scripts/generate-guild-rankings.js`. For each limit N, it counts which guilds
  have the most members among the top N players by achievement points, and among the top N by
  honorable kills.
- The limits must match `GUILD_SOURCE_LIMIT_OPTIONS` in `guild-presence-options.ts`.

## Role filters

- **Code:** `ROLE_FILTERS`, `matchesRoleFilter` and `roleFiltersFor` in
  `spa/src/app/game/wow.ts`; each damage spec's `range` in `spa/src/app/game/wow-specs.ts`.
  Every role dropdown is `app-role-filter` ([frontend.md](frontend.md#shared-building-blocks)).
- Five roles, in this order: Tank, Healer and DPS are the spec's role; Melee DPS and Ranged DPS
  split the damage specs by their `range`. Ranged: Beast Mastery and Marksmanship Hunters,
  Shadow Priests, Elemental Shamans, Mages, Warlocks and Balance Druids. Every other damage spec
  is melee, Survival Hunters included. Tanks and healers are in neither.
- A role matches by the spec played in that run, kill or roster entry, so a character who
  played a melee and a ranged spec shows under both, each time with what they did as that kind
  of spec.
- Where a page offers fewer roles, it lists only those: a boss's Damage tab has no Healer
  (healers rank under Healing), and Talent Analytics with a class picked lists only the roles
  that class can fill. The Mythic+ Roles views need a role, so they have no "All roles".
- **Tests:** `wow.spec.ts`, `role-filter.component.spec.ts`.

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
  character only on the runs played that way; Melee DPS and Ranged DPS count the runs played
  as a damage spec of that range ([Role filters](#role-filters)).
- **Ties** (`playerRanks`): two players share a place only with the same score and the same
  total time. Places use competition ranking (1, 1, 1, 4).
- **Colours:**
  - Player scores (`scoreTiers` and `scoreColor` in `shared/score-quality.ts`, which the raid
    leaderboard uses too): Raider.IO-style stops at the score that the top 60%, 25%, 10%, 1%
    and 0.1% of players reach, from white through green, blue, purple and orange to gold, blended
    in between. Fewer than 20 scores give no stops, and everything is grey.
  - Most runs on the records page (`scoreQuality`, `shared/score-quality.ts`): the share of the
    most runs; at least 90% is legendary, 84% epic, 76% rare.
  - Which scale a score uses depends on the scope: one dungeon's score is a single run, which
    `runScoreColor` colours on the season's stops as if every dungeon had that run (score ×
    dungeons); "This week" places scores among this week's players; everything else uses the
    season's tiers.
- **"Top X%"** beside a rank is the share of players at or above it, rounded up so it never
  flatters: to a tenth of a percent below 10%, to whole percents above (`mythic-plus-profile.ts`).
- **Frequent teammates** (profile): most shared runs first, then the better best run
  together, then the name.
- **Spec pills** (profile): "All" first, then each spec played, most runs first, then the
  spec's name (`specsPlayed` in `mythic-plus-profile.ts`).
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
  Runs are ordered by `compareRuns` (`mythic-plus.ts`): higher score, then the faster time,
  then the run id, so no two runs share a place.
- **Dungeon rank** (profile, "Best run per dungeon", `dungeonRanks` in
  `mythic-plus-profile.ts`): the best run's place among every run of that dungeon this season,
  in `compareRuns` order. It is the number the runs leaderboard shows with that dungeon picked.
  A spec pill changes which run is the best, not the runs it is ranked against.
- **Changes since the last scan** (rank and score arrows) describe the overall season ranking.
  They show only in that scope (season, all dungeons, no role, class or spec) and hide in any
  other, where they would compare different things. The page works them out
  (`standingChanges` in `mythic-plus.ts`) from the index's `scores` and `departed`
  ([data-pipeline.md](data-pipeline.md#mythic-files)): it ranks this export and the previous one
  with `playerRanks`, so the ties above hold for both. The previous ranking counts the
  characters who have left since then, as the leaderboard did when it showed them. A character
  new since the previous export has no change.
- **Keys that raised the score:** on a row whose score went up, each best key finished after
  the previous scan (`previousGeneratedAt`) shows green and bold (`bestRunCells` in
  `mythic-plus-views.ts`). A row without a score gain, a new character's included, marks none.
  The key's tooltip names the best key it replaced: the character's best run in that dungeon
  finished by the previous scan, or "first key in this dungeon". `scoreGains` finds those runs
  only for the gaining rows the page shows, in one pass over the season's runs.
  The exporter stamps a scan when it has finished reading, so a key finished during the previous
  scan, after its dungeon was read, raises the score without being marked.
- An invalid run counts nowhere ([below](#invalid-mythic-runs)).
- A renamed character whose old name is listed in `MythicPlusRenames` scores the runs from
  before the rename under the old name, and only the later ones under the new name
  ([data-pipeline.md](data-pipeline.md#renamed-mythic-characters)). Tests:
  `MythicPlusRenamesTests`, `MythicPlusExportServiceTests` (`ExportAsync_ScoresARenamed…`).
- A player's spec in a run listed in `MythicPlusSpecCorrections` is the listed one, whatever
  the leaderboards say, for every spec filter, statistic and invalid-run rule
  ([data-pipeline.md](data-pipeline.md#corrected-mythic-specs)). Tests:
  `MythicPlusSpecCorrectionsTests`, `MythicPlusExportServiceTests`
  (`ExportAsync_WritesACorrectedSpec…`).
- **The scoring page** `/mythic-plus/scoring` explains all this with worked examples.
  `Score_MatchesTheScoringPageExamples` in `api/tests/AchievementLadder.Tests/MythicPlusExportServiceTests.cs`
  pins those examples, so change the page and the test together.
- **Tests:** `MythicPlusExportServiceTests`, `mythic-plus.spec.ts`, `mythic-plus-activity.spec.ts`,
  `mythic-plus-profile.spec.ts`, `mythic-plus-views.spec.ts`, `score-quality.spec.ts`.

## Mythic+ guild ladder

- **Code:** `mythic-plus-guild.ts`.
- A guild is its name on its realm: two guilds of the same name on two realms are two guilds.
  A URL's guild is matched by realm, then by exact name, then by name ignoring case, so a typed
  `/evermoon/skill issue` still finds Skill Issue.
- Scores are the leaderboard's, every run a member played counting, with guildmates or not.
  Only the ranks are counted again inside the guild; each row also shows the overall rank.
- **Rank changes inside the guild:** the previous guild ranks come from ordering the members by
  their previous overall ranks (`standingChanges`, shared on a tie).
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

## Invalid Mythic+ runs

- **Code:** `MythicPlusInvalidRuns` in MythicPlusExporter
  ([data-pipeline.md](data-pipeline.md#invalid-mythic-runs)); `splitInvalidRuns`
  (`mythic-plus.ts`) and `MythicPlusDataService` on the site.
- The owner's rules (9 November 2026) cover keys of +17 and higher finished before the server
  fixes went live, 9 November 2026 14:35 Budapest time (13:35 UTC), by the run's finish time. Such
  a run is invalid when:
  1. it's Black Rook Hold with a Death Knight in the group;
  2. it's Vault of the Wardens, Court of Stars or Darkheart Thicket with a Warlock;
  3. a Brewmaster Monk is in the group, in any dungeon;
  4. it's Court of Stars.

  A run that breaks several rules shows the reason of the first one. Eye of Azshara has no rule
  of its own (the owner dropped it on 10 November 2026), so its pre-fix +17 runs are invalid only
  with a Brewmaster Monk in the group.
- An invalid run counts nowhere, for any of its players: not in the scores, the leaderboard's
  runs and players, the guild ladder, the records, bounties, server firsts and most runs, the
  stats page, the dungeons' run counts and best scores, the dungeon ranks on the profile, or the
  rank and score changes since the last scan. The whole run is out, not only the players who
  abused something.
- The profile's run history still lists it, tagged "Invalid" in place of its score with the
  reason on hover, a dash in place of its rank, and the reason in its details. Best rank first
  puts it last. It's left out of the profile's score, best runs, spec pills, teammates and
  chart.
- `/mythic-plus/invalid` lists every invalid run, latest first, under a count of the runs
  each reason set aside. It has no menu entry: the "List of invalid runs" button left of "How
  scores work" on the leaderboard, shown only while there are any, leads to it.
- **Tests:** `MythicPlusInvalidRunsTests`, `MythicPlusExportServiceTests`
  (`ExportAsync_MarksInvalidRuns…`), `mythic-plus.spec.ts`, `mythic-plus-data.service.spec.ts`,
  `mythic-plus-invalid.spec.ts`, `mythic-plus-invalid-page.component.spec.ts`,
  `mythic-plus-profile-page.component.spec.ts`, `mythic-plus-page.component.spec.ts`.

## Spec and race popularity

- **Spec charts** (`specPopularity` in `shared/spec-charts/spec-popularity.ts`): classes are
  ordered by their most-seen spec, then the next one, so one dominant spec outranks a class
  whose total is spread out. On the Mythic+ chart, a minimum key level keeps that level and
  everything above it. Only each class's most-seen spec carries a value on its bar. A role
  ([Role filters](#role-filters)) limits both the counted slots and the listed specs to it.
- **Raid spec popularity** counts player slots: a character who killed several bosses counts
  once per kill.
- **Arena spec popularity** (`arenaSpecSamples` in `features/pvp/arena-stats.ts`, on
  `/arena/stats`) counts characters: each character on the bracket's ladder once, by the spec
  of their latest rated game there (the ladder's `spec`). A character with no spec, or a spec
  of another class, is left out. The rating switch (`?rating=`: 1500, 1750, 2000, 2200 or
  2500) keeps the characters whose current rating is at the floor or above; the season best
  doesn't count. The race-by-spec boxes follow the bracket and the rating floor but not the
  role filter, and they're hidden when nobody holds the floor.
- **Race by spec** (`shared/spec-charts/race-popularity.ts`): a character counts once per
  spec, however many runs or kills they played it in. The three Pandaren race ids (24, and
  25 / 26 for the factions) are one race. Every spec of the role is listed in the game's order,
  also one nobody played, and a tie between races goes to the name.
- **Tests:** `spec-popularity.spec.ts`, `race-popularity.spec.ts`, `arena-stats.spec.ts`,
  `arena-stats-page.component.spec.ts`.

## Mythic+ spec performance

- **Code:** `rankPlayersBySpec` in `spa/src/app/features/mythic-plus/mythic-plus.ts`;
  `summarizeSpecScores` and `topAverage` in `spa/src/app/shared/spec-charts/spec-performance.ts`.
- The Performance switch on the leaderboard's spec chart (`/mythic-plus`) ranks specs by the
  leaderboard score. Every character gets the [player score](#mythic) for each spec they
  played, worked out as if that class and spec were picked on the leaderboard: the best run per
  dungeon played as that spec, summed. `rankPlayersBySpec` shares `rankPlayers`' tally, so the
  two can't disagree. A spec's performance is the average of its best `SPEC_TOP_SCORES` (10)
  scores, rounded to a whole number, or of all of them when it has fewer, and 0 when nobody
  played it, the same rule as the [raids](#raid-spec-performance). A class shows the same
  average over each of its characters' best spec.
- It follows the chart's scope: the season or This week, all dungeons or the one picked, the
  role and the minimum key level. A minimum key level scores only the keys at or above it. The
  count switch (All runs / Unique characters) is popularity's alone, so Performance hides it,
  and Reset ignores it while hidden.
- Clicking a bar opens the leaderboard's players with that class and spec picked, ranked by
  the same scores the bar averages.
- The switch isn't kept in the URL, like the chart's key level and count switches.
- **Tests:** `mythic-plus.spec.ts` (`rankPlayersBySpec`), `spec-performance.spec.ts`,
  `mythic-plus-spec-chart.component.spec.ts`.

## Raid leaderboard

- **Code:** `scoreCharacters` / `rankScores` in `spa/src/app/features/raids/raid-scores.ts`.
- On each boss, the character's best counted kill is divided by the best on the same list
  there. The average of those shares, times `MAX_SCORE` (6969), floored, is the score. A boss
  the character hasn't killed counts as 0; a boss nobody on the list has killed is left out of
  the average.
- **The formula reproduces tauriprogress's character score exactly.** Don't "fix" it. The three
  lists below are this site's own.
- **Three lists, by the role of the spec played** (`scoreCharacters` takes the role, and
  `roleMetric` gives what it's measured on). The tabs are DPS, Tank and Healer, in that order,
  and `?role=tank` or `?role=healer` keeps the tab in the URL. An old `?metric=hps` link opens
  Healer.
  - DPS: the damage specs, on DPS.
  - Tank: the tank specs, on DPS.
  - Healer: the healer specs, on HPS (healing plus absorbs).

  A kill counts only on its spec's list, and only that list's kills set a boss's best. So a tank
  is measured against the best tank. A Brewmaster who heals more than every healer on a boss
  sets nothing on Healer, and a tank's damage never sets the best on DPS. The owner chose
  separate lists over ranking tanks on both DPS and HPS against everyone.
- A character is its realm and name (`characterKey`), and the name belongs to the class of its
  latest kill on any boss and difficulty. Kills logged on another class belong to a former
  character with that name ([data-pipeline.md](data-pipeline.md#raid-log-files)): they're left
  out of the scores, boss rankings, spec performance, Talent Analytics and Trinket Analytics, but each still sets
  the boss's best that every score is measured against, and still counts on the spec popularity
  and race charts. A former character's own view on the character page shows each boss's share
  of that best, but no score or rank.
- An invalid log counts nowhere, not even for a boss's best ([below](#invalid-raid-logs)).
- A spec filter scores characters only on the kills they played as that spec. The best on each
  boss is still the best anyone on the list did there.
- Filters (class, faction, realm) only hide rows and re-rank the rest. Each score is still
  measured against the whole list.
- A class or spec the tab doesn't rank (a Mage on Healer) is cleared rather than leaving an
  empty list. A class with one spec the tab ranks gets that spec picked: on Tank, every tank
  class; on Healer, Paladins, Monks, Druids and Shamans (Priests have two healers); on DPS,
  Paladins, Monks and Demon Hunters. The class dropdown lists only the classes the tab ranks.
  `fitClassAndSpec` and `rankedClassOptions` do this, here and on a boss's ranking tabs
  ([below](#raid-boss-rankings)).
- **Changes since the last scan:** the same ranking (list, spec, class, realm) worked out
  again without the kills that scan didn't have (`newLogs`), compared with today's. A new best
  on a boss lowers everyone else's share of it, so a score can drop. That's why the table
  shows gains in green and drops in grey, as small text: the rank change beside the rank, the
  score change beside the score.
- **Colours on the leaderboard** are Mythic+'s player-score colours ([above](#mythic)): the
  rank and the score both take the colour of where the score stands. The stops come from every
  character the tab ranks on the difficulty, before any filter, so the class, spec and realm
  filters and the search never change a colour: a score has the same colour whatever is picked.
- **Colours on the character page** ("Of best", `performanceQuality` in `raid-scores.ts`) follow
  Warcraft Logs' parse colours, on the share of the best in view: artifact for the best,
  legendary from 95%, epic from 75%, rare from 50%, uncommon from 25%.
- The search hides rows without renumbering them, as on every leaderboard.
- **Character page, per boss** (`bossStanding`): Damage and Healing count kills the way a
  boss's ranking tabs do (`countsFor`, [below](#raid-boss-rankings)), so a tank is on both.
  "Of best" and Rank put the character's best
  kill of the boss among every character's best, and the "Compare with" dropdown narrows that
  to the character's class (All Death Knights) or one of its specs (Blood). With a spec, only
  kills played as that spec count, the character's own included, so a boss they never killed
  as that spec has no rank. The dropdown lists the specs the metric ranks, and a picked spec
  the other metric doesn't rank is dropped on switching. The score tile always compares with
  all players.
- **Character page, score tile** (`leaderboardRole`): the character's score and rank on one of
  the leaderboard's lists. Healing shows Healer. Damage shows Tank or DPS, whichever the
  character has more kills as among their tank and damage specs, the latest on a tie. So a
  Protection Paladin who also plays Holy sees their Tank score on Damage, and their Healer
  score on Healing.
- **Character page, kills over time** (`killHistory`, `killChart` and `recordChange` in
  `raid-kill-history.ts`): each boss row lists the character's kills of the boss that count for
  the metric, oldest first, and with a spec picked to compare with, only the kills as that spec.
  The best kill is the highest, the earlier on a tie, as on the boss rankings.
  - **Latest vs PR** compares the latest kill with the best kill before it, so a new PR shows
    how far it beat the old one instead of 0%. The change is rounded to a whole percent; under
    half a percent keeps its arrow ("▲ <1%"). The column shows the change and the latest kill's
    date, without a "New PR" tag. With one kill there is nothing to compare yet ("First kill").
  - The character page leaves invalid kills out entirely, as if the character hadn't killed the
    boss that day: they're not in the boss rows, the charts, Latest vs PR or the kill history.
  - Every kill gets an equal column, whatever the time between kills. The chart's top line is the
    best anyone did on the boss (with a comparison picked, the best of that class or spec), and
    each dot is coloured like "Of best".
  - Every boss row starts closed; a click anywhere on a row opens its chart, except on the boss's
    name, which links to the boss page. One boss opens at a time, and which one isn't in the URL.
  - **Prediction** (`?predict=1`, off by default) adds one column after the latest kill to every
    chart: the next kill on the least-squares line through the last 6 kills (all of them when
    fewer), floored at 0. It needs 3 kills, and uses the same kills as the chart, so it follows
    Damage/Healing and the spec compared with. An open boss's chart also draws that line, from
    the first kill it fits to the prediction, and its note gives the predicted kill. The other
    columns, Latest vs PR included, stay as they are, so the toggle never moves them. The owner
    chose the trend line over polynomial interpolation after a backtest on the mythic data (Oct
    2026, 1,055 player-boss histories, the latest kill predicted from the earlier ones): the trend
    line missed by 16% at the median and went below 0 or past twice the last kill 2% of the time;
    a polynomial through every kill missed by 54% and went wild 28% of the time. Simply repeating
    the last kill missed by 13%, so week-to-week noise is that large and the page shows the
    prediction as "≈".
- **Tests:** `raid-scores.spec.ts`, `raid-kill-history.spec.ts`,
  `raid-logs-character-page.component.spec.ts`, `raid-logs-leaderboard-page.component.spec.ts`.

## Raid boss rankings

- **Code:** `rankCharacters`, `rankedSpecs`, `rankedClassOptions` and `fitClassAndSpec` in
  `spa/src/app/features/raids/raid-scores.ts`; `parseBossView` and `BOSS_DAMAGE_ROLES` in
  `raid-display.ts`.
- A boss's ranking tabs list each character's best counted kill of the boss on the difficulty;
  the earlier kill wins a tie. Damage ranks every spec but the healers, tanks included, on DPS.
  Healing ranks the healers and the tanks on HPS.
- **Damage's role dropdown** narrows it, on DPS: Tank ranks the tanks only, DPS the damage
  specs without the tanks, Melee DPS and Ranged DPS the damage specs of that range
  ([Role filters](#role-filters)). "All roles" is the plain Damage ranking. Links to the old
  Ranged and Melee tabs (`?tab=ranged`, `?tab=melee`) open Damage with that role.
- Filters (class, spec, realm) re-rank the rest; the search hides rows without renumbering
  them. Class and spec fit the tab and role as on the leaderboard (above): Ranged DPS lists no
  Rogue, a Shaman on Ranged DPS gets Elemental picked, and a Paladin on Tank gets Protection.
- The guild pages' role dropdown reads the same `range`.
- **Tests:** `raid-scores.spec.ts`, `raid-display.spec.ts`, `wow-specs.spec.ts`,
  `guild-roster.spec.ts`.

## Raid guild progression and kill speed

- **Code:** `guildProgression`, `pickupGroups`, `filterProgression`, `progressionChanges`,
  `fastestKills` and `speedRank` in `spa/src/app/features/raids/raid-progression.ts`.
- Guilds rank by most bosses down on the difficulty, then by who got there first (their latest
  first kill). A guild is its name on its realm, so one recreated under the same name keeps its
  row. Only kills the API credits to a guild count for it, so a guild run with several outsiders
  usually counts for no guild
  ([tauri-api.md](tauri-api.md#raid-logs-raid-rank-encounter-raid-log)). A faction or realm
  filter ranks the remaining rows among themselves.
- **Guilds and All groups** (`?groups=all`): by default only guilds take part. All groups adds
  every pickup group, ranked among the guilds by the same rule: a kill with no guild, or with a
  guild the API couldn't name, is a pickup kill. A pickup group is the pickup kills of one raid
  week (the This week reset below) that share at least half the players of the smaller raid,
  chained: a kill that shares half its players with any kill of the group joins it. So the same
  people raiding again the next week are a new row, and a pickup group never takes a guild's
  name, even when most of its players are in one guild. A group is named after its first kill,
  plays on the realm most of its players play on, and has the faction of most of its kills;
  those two are what the realm and faction filters read. It shows as "Pickup group" in plain
  silver, never bold or gold, with a group icon in place of the faction square, so it stands
  apart from the guilds; its 7/7 shows in the progress column. Its link opens the kill that reached its progress, where its players are
  listed. The page reads the members from the difficulty's boss files, so it loads them only
  when All groups is on. Reset goes back to Guilds.
- **This week** (`?period=week`, `raidWeekStart` in `raid-logs.ts`) ranks only the kills since
  the latest weekly raid reset: Wednesday 09:00 on the server clock, Europe/Budapest, so 07:00
  UTC in summer time and 08:00 UTC in winter time. The week is the reader's current one, from
  their clock, not the week of the last scan, so right after a reset it stays empty until the
  next scan. The reset time matches the logs: on every Wednesday since the season started the
  kills stop by about 08:00 server time and start again after 09:40. The ranking rules and
  filters work the same on the week's kills, and Reset goes back to the season. Changes since
  the last scan show only on the season: the week shows no "new" tags, "+N" or outlined
  squares, as on the Mythic+ pages.
- The progress squares show the bosses in the order raiders kill them, not the Dungeon
  Journal's order the files use.
- **Changes since the last scan:** the difficulty's progression worked out again without the
  kills that scan didn't have (`newLogs`), compared with today's. A guild that wasn't on the list
  then is tagged "new"; one that was gets "+N" for the bosses it has down now and didn't then.
  Either way, the squares of those bosses are outlined. Guilds only: a pickup group never shows
  "new", "+N" or outlined squares. Another kill of a boss the guild already
  had changes nothing, and filters don't change what counts. Both sides use today's guild names,
  so a guild the exporter has only just named isn't new because of that.
- Fastest kills: the shortest fight first; the earlier kill wins a tie. A log's speed rank is
  its place among the boss's kills on that difficulty.
- **Avg ilvl** on the boss page's Fastest kills and Latest kills (`averageItemLevel` in
  `raid-logs.ts`) is the mean item level of everyone in the log, shown to one decimal. Every
  player counts the same, a low-level character included. It doesn't change the order.
- **A kill history** (the Raids guild and character pages, `killWeeks` and `killWeekPage` in
  `raid-kill-weeks.ts`) lists a guild's kills of the difficulty, invalid ones included, or a
  character's, without its invalid ones ([below](#invalid-raid-logs)), by raid week: from one
  Wednesday reset to the next (`raidWeekStart` to `raidWeekEnd`), the latest week and the
  latest kill first. A week without kills isn't listed. The reader's current week is "This
  week" and the one before it "Last week"; older weeks show only their dates. A week's heading
  counts its valid kills and the bosses they killed, and shows the fastest full clear that
  ended in the week ([below](#raid-fastest-full-clears)), the earlier on a tie: on a guild page
  the guild's own clears (`guildClears`), on a character page every clear the character was in
  all the kills of, whichever group it was with (`characterClears`). A page holds as many whole
  weeks as fit in 25 kills, and a bigger week has a page of its own, so a week is never split
  across pages. Changing the difficulty, or switching to an earlier character with the name,
  goes back to the first page; Damage/Healing and the comparison keep it.
- **Tests:** `raid-progression.spec.ts`, `raidWeekStart`, `raidWeekEnd` and `averageItemLevel`
  in `raid-logs.spec.ts`, `raid-kill-weeks.spec.ts`, `characterClears` in
  `raid-clears.spec.ts`, the This week, All groups and pages cases in
  `raid-logs-progression-page.component.spec.ts`, `raid-logs-guild-page.component.spec.ts`,
  and the kill history cases in `raid-logs-character-page.component.spec.ts`.

## Raid fastest full clears

- **Code:** `RaidLogDatasetBuilder.Clears` in RaidLogExporter finds the clears; `clearRun`,
  `rankClears`, `clearSplits`, `clearEndedBy` and `guildClears` in
  `spa/src/app/features/raids/raid-clears.ts` time and rank them; `/raid-logs/clears` shows
  them, and the kill history on a guild or character page shows its fastest clear of each raid
  week.
- **A full clear** is one raid instance (the API's `instance_uid`,
  [tauri-api.md](tauri-api.md#raid-logs-raid-rank-encounter-raid-log)) with a kill of every boss
  on one difficulty. A raid finished in a second instance doesn't count. An instance kept open
  over several nights does, with all the time in between.
- **Clear time** runs from the pull of the first boss killed (its kill time minus its fight time)
  to the last boss's kill. Wipes before the first kill aren't in it: the API gives no time for a
  wipe. The wipes column adds up each kill's wipes.
- **A guild's clear** is one where the API credits the same named guild with every kill, as
  guild progression counts only credited kills. Otherwise it's a pickup clear, even when some
  kills are the guild's. Checked 2026-10-30: 26 Normal, 45 Heroic and 2 Mythic clears were
  credited to a guild on some kills only, and no clear mixed two guilds.
- **Guilds** ranks each guild once, by its fastest clear; **All groups** (`?groups=all`) adds
  every pickup clear as its own row. The faster clear ranks first, then the one that ended
  earlier. Faction and realm filters rank the rows left again. A guild's realm and faction are
  the guild's; a pickup clear plays on the realm most of its players play on (worked out by the
  exporter) and has the faction of most of its kills.
- A clear with an invalid log ([below](#invalid-raid-logs)) doesn't count.
- The clear time links to the last boss's log, and each block of the bosses strip, placed by
  its pull and its fight time, links to that boss's log. A log that finished a clear shows
  "View full run", linking to that clear's summary and every boss log. The full-run page links
  separately to the clears of its difficulty (with All groups for a pickup clear). A week's
  "Full clear" on a guild page links to its last boss's log.
- **Tests:** `raid-clears.spec.ts`, the clears case in `raid-logs.spec.ts`, and
  `ExportAsync_ListsEachInstanceWithEveryBossDownAsAClear` and
  `ParseLog_ReadsTheInstanceTheKillWasIn` in `RaidLogExportServiceTests`.

## Invalid raid logs

- **Code:** the hand-kept list `api/AchievementLadder/Data/invalid-raid-logs.txt`, read by
  `InvalidRaidLogs` in RaidLogExporter ([data-pipeline.md](data-pipeline.md#invalid-raid-logs));
  `decodeIndex` (`raid-logs.ts`) and `RaidLogsDataService` on the site.
- A listed log counts nowhere, for any of its players: not in the leaderboard scores or the best
  on a boss they're measured against, the boss rankings, the fastest kills and speed ranks, the
  fastest full clears, the overview's best DPS and HPS, guild progression, the kill counts, spec performance, the tier
  list, Talent Analytics, Trinket Analytics, or the spec and race charts. The whole kill is out, not only the
  players who abused something.
- It's still listed, tagged "Invalid" with the reason on hover, in the lists of latest kills:
  the overview's, a boss's Latest tab (without a number) and a guild's kill history. The
  character page leaves it out altogether, its kill history and kill charts included. Its log
  page opens with the reason, and the fight time says "Not ranked".
- `/raid-logs/invalid` lists every invalid log of every difficulty, latest first, with its
  reason. It has no menu entry: the "List of invalid logs" button on `/raid-logs`, shown only
  while there are any, links to it.


- It still decides which class a name belongs to, like any kill
  ([data-pipeline.md](data-pipeline.md#raid-log-files)): that's who played, not how well.
- **Tests:** `RaidLogExportServiceTests` (`ExportAsync_ListsInvalidLogs…`, `InvalidRaidLogs_*`),
  `raid-logs.spec.ts`, `raid-logs-data.service.spec.ts`,
  `raid-logs-character-page.component.spec.ts`.

## Raid spec performance


- **Code:** `scoresBySpec` (`scoresBySpecForKills` takes one difficulty's kills) and
  `specPerformance` in `spa/src/app/features/raids/raid-scores.ts`; `sortByPerformance` in
  `spa/src/app/features/raids/raid-analytics.ts`. The averaging and the class order are
  `topAverage`, `SPEC_TOP_SCORES` and `summarizeSpecScores` in
  `spa/src/app/shared/spec-charts/spec-performance.ts`, which the
  [Mythic+ chart](#mythic-spec-performance) shares.
- Every character gets the raid leaderboard score for each spec they played, as if that spec
  were picked on its role's list of the leaderboard ([above](#raid-leaderboard)): a damage spec
  on DPS, a tank on Tank (DPS, against the best tank), a healer on Healer (HPS, against the
  best healer). So in the all-roles chart each spec stands against the best of its own role.
  The chart and its tooltips name the scores after the list: DPS, Tank or Healer score. A
  spec's performance is the average of its best
  `SPEC_TOP_SCORES` (10) character scores, or of all of them when it has fewer, and 0 when
  nobody played it. Only the best ten count, so attendance doesn't drag a spec down.
- Each difficulty is scored on its own, over every boss of the raid.
- Where it shows:
  - Raid Stats → Performance draws it as bars, all specs or one role's
    ([Role filters](#role-filters)).
  - The Tier List page sorts it into tiers ([below](#raid-spec-tier-list)).
  - Talent Analytics and Trinket Analytics list each role's specs by it, best first. A tie keeps
    the game's order, the order is the same whichever boss is picked, and a picked class shows
    its specs in the game's order instead.
- **Tests:** `raid-scores.spec.ts`, `raid-analytics.spec.ts`, `spec-performance.spec.ts`,
  `raid-spec-popularity-chart.component.spec.ts`.

## Raid spec tier list

- **Code:** `roleTierList`, `percentOfBest` and `tierFor` in
  `spa/src/app/features/raids/raid-tier-list.ts`; the page is `/raid-logs/tier-list`.
- Three lists, DPS, Heal and Tank, each from the spec performance above on the picked
  difficulty: HPS for healers, DPS for tanks and damage dealers. A spec's icon links to its
  role's tab of the leaderboard with the spec picked, and its tooltip names the score after that
  tab (DPS, Tank or Healer score).
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

- **Code:** `spa/src/app/features/raids/raid-talents.ts`, on the rules both analytics pages
  share in `raid-analytics.ts`.
- Each character counts once per boss and spec, with the talents of their best kill there by the
  spec's metric (the earlier kill on a tie), so a guild farming a boss every week doesn't
  outweigh everyone else (`pickSamples`). Members without a spec or talents are left out.
- **Top players** are the best tenth (`TOP_SHARE`) of the spec's ranking on that boss, the boss
  page's ranking filtered to the spec. The best player always counts.
- A talent is marked as picked for a boss when it's picked `NOTABLE_DIFFERENCE` (10 points)
  more there than on the other bosses, and only with at least `NOTABLE_MIN_PICKS` (10) picks on
  both sides.
- **Agreement** is how often players take each tier's most picked talent, averaged over the
  tiers. It reads, on the whole percent shown: 80% and up "Settled", 65% and up "Mixed", below
  that "Wide open".
- **The top players' edge:** the talent the top players pick furthest above (or below)
  everyone else, shown only with at least `EDGE_MIN_TOP_PICKS` (5) top picks and a difference
  of `EDGE_POINTS` (5 points).
- **Talent changes between bosses:** without a boss, the characters with picks on two or more
  bosses who picked more than one talent on a tier; with a boss, those whose pick there isn't
  the one they made most often on the other bosses.
- **Tests:** `raid-talents.spec.ts`, `raid-analytics.spec.ts`.

## Trinket Analytics

- **Code:** `spa/src/app/features/raids/raid-trinkets.ts` and `raid-trinkets-views.ts`, on the
  rules in `raid-analytics.ts`; the page is `/raid-logs/trinkets`.
- Each character counts once per boss and spec, with the trinkets of their best kill there, and
  the top players are the best tenth of that boss's ranking, as on Talent Analytics. Members
  who wore no trinket are left out and take no place in the ranking.
- A trinket is its name: the Alliance and Horde versions of a PvP trinket count as one, and
  item levels don't matter. Its icon and link are those of its most worn item id (the lower id
  on a tie). A character wearing two copies counts once.
- **Worn by** is the share of the counted characters who wore it, so the shares add up to about
  200%. The top 10 are ordered by that, then by the top players' count, then by name. A
  **pair** is the two trinkets a character wore; its share is of every counted character, one
  trinket or two.
- **Beats** is a wearer's place in the spec's ranking on that boss, as the share of the others
  they beat (`(size − rank) / (size − 1)`), averaged over the trinket's wearers. The middle of
  every ranking is 50%, so the average over everyone is 50%. A ranking of one has no Beats.
- **Strongest showing:** the trinket with the highest Beats above 50%, among those at least
  `NOTABLE_MIN_PICKS` (10) different characters wore.
- **The top players' edge and the boss marks** follow the Talent Analytics rules above
  (`EDGE_MIN_TOP_PICKS`, `EDGE_POINTS`, `NOTABLE_DIFFERENCE`, `NOTABLE_MIN_PICKS`). The top
  players' pair is the pair most of them wore, shown with at least five top players and two of
  them wearing it.
- There's no "changed between bosses" figure: a character's best kills on two bosses can be
  weeks apart, so it would mostly count new loot. Measured on the same night instead (the data
  of 8 November 2026), only 2–5% of boss-to-boss steps swapped to a trinket the character
  already had, and what they swapped to was no particular boss's trinket.
- **Tests:** `raid-trinkets.spec.ts`, `raid-trinkets-views.spec.ts`.

## Arena titles

- **Code:** `ARENA_TITLES`, `getTitleCutoffs` and `getTitle` in
  `spa/src/app/features/pvp/arena-games.ts`. The page lists every character on the ladder,
  50 to a page (`ARENA_PAGE_SIZE`). The active players, with 50 or more rated games this season
  (`DEFAULT_MIN_GAMES`), come first in every order (`sortArenaRows`) and are the only ones
  titles count; the rest follow under an "Under 50 games" heading, and the `#` column runs on
  through them. A season reward needs 50 wins (`REWARD_MIN_WINS`).
- **A lower bar, to compare:** the games dropdown (`MIN_GAMES_OPTIONS`: 50, 45, 40, 35, 30;
  `?games=`) lowers the minimum. Who counts as active, the title cutoffs, the holders and the
  changes since the last scan all follow it. The 50 wins a reward needs stay as they are.
- **Class and spec filters** (`filterArenaRows`; `?class=`, `?spec=`) hide rows and rank the
  rest among themselves, as on the other leaderboards. The spec is the spec of the player's
  latest game, the only one the ladder gives. Titles stay those of the whole list: a heading
  reads "1 of 65 players" while filtered (`countArenaGroups`, `formatGroupCount`). Reset
  clears the class, the spec and the games minimum.
- Each title covers a cumulative "top X%" of the active players by rating:
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
  and games: the players who had the page's minimum games (50 unless lowered) or more then,
  followed by the rest, each part by rating, then more games, then the name. A player's rank
  change is their place then minus their place now (▲ climbed, ▼ fell), the same places the
  `#` column shows; the rating change is the rating now minus the rating then.
- **New** is an active player who was under the minimum then, or any player who wasn't on the
  ladder at all (also a character the ladder moved to a new GUID). New players show "new"
  and no rating change.
- A character on the previous list that has left the ladder (deleted, or moved to a new GUID)
  isn't in the previous ranking either, so it gives the players below it no climb.
- Rank changes show only in the table's default order, rating from the top, with no class
  picked, where the `#` column is that ranking. Rating changes show in every order and under
  every filter.
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

## Rated BG Picker teams

The unlisted `/rated-bg-picker` page splits the players who turned up into two teams of 10 and
puts everyone else on the bench, taking turns from match to match.

- **Code:** `rosterGroups`, `shuffleWarning`, `canShuffle`, `benchSize`, `playMatch`, `shuffleTeams`,
  `linkedMatch`, `compositionOf`, `togglePick`, `toggleFlagCarrier`, `tickedFlagCarriers`,
  `withLeader`, `parseLeaders`, `matchParams`, `parseTeams`, `teamGroups` and `averageItemLevel` in
  `spa/src/app/features/pvp/rated-bg-picker.ts`.
- The list shows three groups, side by side from 1000 px and one under the other below that:
  Melee, Ranged, then Healers. Ranged holds the ranged damage specs (`range` in `LEGION_SPECS`),
  Healers the healer specs, and Melee everyone else: the melee damage specs, tanks, and characters
  without a known spec or that the armory doesn't know. All three always show, and an empty one
  says "Nobody on the list". Each group lists its players class by class, the classes in
  alphabetical order (`CLASSES_BY_NAME`) with a gap before each new one and no heading, and
  characters the armory doesn't know last. Within a class, players go by spec in alphabetical
  order (no known spec last), then by traits, highest first, then by name, with those whose traits
  aren't known last. Each group's heading counts its ticked players, and the bar above the list
  counts all the ticked players.
- **Any number of players can be ticked.** Three dropdowns under "Each team" in the action bar set
  how many melee (1 to 5), ranged (1 to 5) and healers (1 to 4) each team gets, in that order as
  in the list's columns, 4, 3 and 3 at first (`COMPOSITION_CHOICES`, `DEFAULT_COMPOSITION`).
  Melee, ranged and healers are the list's three groups. Clear keeps the dropdowns; a reload sets
  them back to 4, 3 and 3. The dropdowns,
  ticked count and Shuffle and Clear actions share one card, on one row from 1000 px. Below that,
  where the page is at most 760 px wide and the row with Shuffle again and Change players needs
  about 907 px, the dropdowns take a row of their own above the count and the buttons, before
  and after the shuffle alike, so the bar keeps its height.
- **Shuffle needs the three to add up to 10, and enough ticked players in each group for both
  teams.** Until then Shuffle stays off and the bar says why after the count, on the same line, so
  the bar keeps its height: "11 per team, a team is 10", or "tick 2 more ranged and 1 more
  healer", naming the groups in the dropdowns' order. With nobody ticked it only checks the 10. Once Shuffle is on, the bar says how many
  will sit out: "24 ticked · 4 on the bench".
- **Each team gets exactly the healers, ranged and melee the dropdowns ask for, and the rest of the
  ticked players sit out.** In each group, the bench is the one that does best on these, in this
  order:
  1. at least two marked flag carriers play, counted over healers, ranged and melee together,
     and every marked one plays when fewer than two are ticked; beyond that, flag carriers sit
     out like anyone else;
  2. the fewest matches sat out in a row, added up over the bench: a player who played the last
     match counts 0, one who sat it out counts how many matches in a row they have sat out;
  3. each class with a second ticked player in the group plays an even number, so both teams get
     the same count of it: rather than split 3 Hunters 2–1, the third sits out. Where that can't
     hold for every class, as few classes as possible split 2–1 (or 3–2 and so on), then as few
     as possible 1–0;
  4. the fewest matches sat out so far, added up over the bench;
  5. the most players on the bench who played the last match (not ticked after it);
  6. the rest is random.

  So the last match's bench plays the next one whenever its group has enough others to sit out.
  The even class split comes before taking turns fairly: with 3 Hunters and one ranged player to
  bench, a Hunter sits out every match and the other ranged never do. A class with one player in
  its group still plays, and when that leaves the other classes an odd number of seats (a lone
  Restoration Shaman among 10 healers, 6 of them playing), one class splits 1–0 or, now and then,
  2–1. When more than half of a group sits out, some sit out two matches in a row; those who have
  sat out the most in a row play first, and the class split only chooses between equal runs. The
  page keeps the counts while it is open: Change players keeps them, and Clear and a reload start
  them again.
- The bench shows under the two teams, in the teams' order: healers, ranged, then melee, each
  class by class, with a grey bench icon after each name and in its heading. After the next
  shuffle, each player back from the bench has a green stripe beside their row and a green return
  arrow after their name, and their team's heading counts them with the same arrow: "2 back from
  the bench" (on phones on a line of its own). The icons are `app-rated-bg-mark`, inline SVGs, not
  emoji.
- **Each group is split evenly between the teams, then each class within the group, then each
  spec within its class.** Healers, ranged and melee are split separately, each class by class. So
  4 Death Knights split 2 and 2, and an Arms and a Fury Warrior one each; 3 Unholy and 1 Frost
  Death Knight become Unholy + Frost against 2 Unholy. A tank counts with its class among the
  melee. The bench (above) leaves an odd number of a class playing only where it has to. Which team
  gets the extra player of an odd-sized class or spec, and who plays on which side, is random. A character without a known spec is split with its class; one the armory
  doesn't know stays random. Item level is not balanced, and neither is a class across groups: a
  Restoration and a Feral Druid, or an Elemental and an Enhancement Shaman, can land on the same
  team.
- A player's role is the role of the spec the roster file gives them
  ([data-pipeline.md](data-pipeline.md#rated-bg-roster)): the main spec the hand list names for
  them, else the spec of their artifact with the most traits, as on the guild pages, else their
  active spec. A character the armory doesn't know has no role and counts as melee.
- **A character the list names for more than one spec has a row per spec, and one of them at a
  time can be ticked.** Each row sits in its spec's group: Keilalt as Vengeance and as Havoc both
  under Melee, Solaureus as Retribution under Melee and as Holy under Healers. Ticking another of
  a character's specs unticks the one ticked before, and drops its flag-carrier mark. The bench
  counts above follow the person (below), not the row, so a player who sat out as Havoc plays the
  next match first when ticked as Vengeance instead.
- **One person's characters can all be ticked, and at most one of them plays.** The hand list
  links them ([data-pipeline.md](data-pipeline.md#rated-bg-roster)): Zerololq and Zerolul,
  Keilalt (both specs) and Nimphel, Ticho and Zbafromtemu. A person counts once: in the bench
  counts above, in "N on the bench" (the bar's "ticked" still counts ticks), and in the check that
  each group has enough ticked players, where they count in whichever group leaves the fewest
  missing. Before the bench, the shuffle picks one character per person: it tries every
  combination of the people's ticked characters that fills both teams and keeps the one whose
  bench does best on the rules above, the most flag carriers kept playing (up to two) first. Equal
  ones are random. The person then plays or sits out as that character; their other characters
  show nowhere in the match, so a person who sits out is on the bench once. Two marked characters
  of one person count as one flag carrier.

  Because bench turns go per person, a person with characters in two groups mostly plays the one
  in the group with fewer players waiting, about as often as that group's players. On the 26 Nov
  2026 list with everyone ticked and 2, 4 and 4 per team, over 1,200 matches: Zerolul (Shadow,
  ranged) played 63% of matches and Zerololq (Frost Death Knight, melee) none, Nimphel 62% and
  Keilalt none, Zbafromtemu 10% and Ticho 33%, against 61% for the other ranged, 43% for melee and
  35% for healers. Each linked person doubles the combinations tried: a shuffle took 2.6 ms with
  the list's three, 41 ms with five more pairs and 319 ms with eight more.
- A shared link names each player as `Name-Realm`, or `Name-Realm-Spec` for a character with more
  than one row. A link that names one character or one person twice, or a player the list no
  longer has, opens no teams: the page says the link no longer matches the list.
- A shared link opens on the teams it names, with nobody on the bench, even when a respec since
  has left their groups uneven: the link records the teams as they were picked. When both teams
  have the same number of melee, ranged and healers, and each number is on its dropdown, the
  dropdowns take those numbers (`compositionOf`); otherwise they stay at 4, 3 and 3. The link's
  players count as having played the last match, so after Change players, a player ticked again
  plays the next match before them.
- A team lists its players in the list's groups, but Healers first, then Ranged, then Melee, each
  class by class, then by spec and traits, as above. A gap with no heading separates the groups,
  and a group the team has nobody in is left out. The team's heading shows the average of the
  item levels it knows, without a healer count: the Each team dropdowns already say how many
  healers each team has.
- **Each team has one group leader, who sends the invites.** The shuffle crowns the first healer
  the team lists, so the first in its Healers group, or the first player listed when the team has
  no healer. The leader's row has a gold crown after the name and a gold tint between two thin gold
  lines, all three fading out at both ends of the row. Clicking any other
  player of the team, anywhere from the class icon to the item level, moves the crown to them;
  the FC button doesn't. Every shuffle, Shuffle again included, crowns the first healer listed
  again, and a player who sits out can't lead. The leaders are in the shared link (`leaders`); a
  link without them, or naming nobody on a team, crowns that team's first healer listed.
- **Flag carriers are optional, any number can be marked, and they take turns on the bench while
  two of them play.** The `FC` button on a ticked player marks or unmarks them, in the list before
  the shuffle and in the teams after it. The bench never leaves fewer than two marked players
  playing (rule 1 above), so one or two marked play every match, and from three on they sit out in
  turn like everyone else. Because all but two at most can sit out, a few flag carriers in a group
  that benches most of its players still sit out less often than the rest of it; the more are
  marked, the closer they come to everyone else. The shuffle splits the playing flag carriers as
  evenly as it can, one each with two and 2–1 with three, drawing again until they are (at most
  1,000 tries), so every split above holds exactly as without them. One mark changes nothing about
  the shuffle. The marks stay through Shuffle again and Change players, also on a player who sat
  out, go when their player is unticked or on Clear, and aren't part of the shared link.
- Traits are the count of that spec's artifact: the guild pages' count (the artifact with the
  most traits) unless the list names a main spec. The item level is the API's `avgitemlevel`,
  the ladder's figure, not the guild pages' own average of the equipped items
  ([tauri-api.md](tauri-api.md#characters-and-guilds)).
- **Tests:** `rated-bg-picker.spec.ts`, `rated-bg-picker-page.component.spec.ts`,
  `RatedBgRosterExportServiceTests`, `CharacterArtifactReaderTests`.
