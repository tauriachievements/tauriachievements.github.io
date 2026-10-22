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
- **The `#` column** (`collectRanked` in `spa/src/app/ladder.service.ts`) is a row's place on
  the ladder being shown: the whole server, or inside the realm, faction or class filter when
  one is on. That's the same group the movement arrows measure (`buildCohortRankDeltas`).
  **A search only hides rows. It never renumbers them**, so a character looked up keeps their
  real place, as on the Mythic+ leaderboard. The order has no ties, so no two rows share a place.
- **Tests:** `scripts/player-ranking.test.js`, `ladder.service.spec.ts`.

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
- **Player score** (`rankPlayers` in `mythic-plus.ts`): the sum of the character's best run
  score in each dungeon, Raider.IO's classic model. A spec, role or class filter scores a
  character only on the runs played that way.
- **Ties** (`playerRanks`): two players share a place only with the same score and the same
  total time. Places use competition ranking (1, 1, 1, 4).
- **Colours:**
  - Player scores (`scoreTiers`): Raider.IO-style stops at the score that the top 60%, 25%,
    10%, 1% and 0.1% of players reach, from white through green, blue, purple and orange to
    gold.
  - Run scores (`scoreQuality`): the share of the best score; at least 90% is legendary, 84%
    epic, 76% rare.
  - Which scale a score uses depends on the scope: one dungeon's score is a single run, so it
    takes the run scale; "This week" places scores among this week's players; everything else
    uses the season's tiers.
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

- **Mythic+ spec chart** (`specPopularity` in `mythic-plus-stats.ts`): classes are ordered by
  their most-seen spec, then the next one, so one dominant spec outranks a class whose total is
  spread out. A minimum key level keeps that level and everything above it. Only each class's
  most-seen spec carries a value on its bar.
- **Raid spec popularity** counts player slots: a character who killed several bosses counts
  once per kill.
- **Race by spec** (`race-popularity.ts`): a character counts once per spec, however many runs
  or kills they played it in. The three Pandaren race ids (24, and 25 / 26 for the factions)
  are one race. Every spec of the role is listed in the game's order, also one nobody played,
  and a tie between races goes to the name.
- **Tests:** `mythic-plus-stats.spec.ts`, `race-popularity.spec.ts`.

## Raid leaderboard

- **Code:** `scoreCharacters` / `rankScores` in `spa/src/app/raid-logs.ts`.
- On each boss, the character's best counted kill is divided by the best anyone did there. The
  average of those shares, times `MAX_SCORE` (6969), floored, is the score. A boss the
  character hasn't killed counts as 0; a boss nobody has killed is left out of the average.
- **This reproduces tauriprogress's character score exactly.** It matched the owner's
  screenshot rank for rank. Don't "fix" the formula.
- Metric: healers are ranked on HPS, every other spec on DPS (`specMetric`), tanks included.
  HPS is healing plus absorbs.
- A spec filter scores characters only on the kills they played as that spec. The best on each
  boss is still the best anyone did there.
- Filters (class, faction, realm) only hide rows and re-rank the rest. Each score is still
  measured against everyone.
- A class or spec the tab doesn't rank (a Warrior on HPS) is cleared rather than leaving an
  empty list. A class with one spec the tab ranks gets that spec picked: on HPS that's every
  healing class but the Priest. No class has a single DPS spec.
- **Changes since the last scan:** the same ranking (metric, spec, class, realm) worked out
  again without the kills that scan didn't have, compared with today's.
- The search hides rows without renumbering them, as on every leaderboard.
- **Tests:** `raid-logs.spec.ts`.

## Raid spec performance

- **Code:** `scoresBySpec`, `topAverage` and `specPerformance` in `spa/src/app/raid-logs.ts`;
  `sortByPerformance` in `spa/src/app/raid-talents.ts`.
- Every character gets the raid leaderboard score for each spec they played, as if that spec
  were picked on the leaderboard. A spec's performance is the average of its best
  `SPEC_TOP_SCORES` (10) character scores, or of all of them when it has fewer, and 0 when
  nobody played it. Only the best ten count, so attendance doesn't drag a spec down.
- Each difficulty is scored on its own, over every boss of the raid.
- Where it shows:
  - Raid Stats → Performance draws it as bars.
  - Talent Analytics lists each role's specs by it, best first. A tie keeps the game's order,
    the order is the same whichever boss is picked, and a picked class shows its specs in the
    game's order instead.
- **Tests:** `raid-logs.spec.ts`, `raid-talents.spec.ts`.

## Talent Analytics

- **Code:** `spa/src/app/raid-talents.ts`.
- Each character counts once per boss and spec, with the talents of their best kill there by the
  spec's metric (the earlier kill on a tie), so a guild farming a boss every week doesn't
  outweigh everyone else. Members without a spec or talents are left out.
- **Top players** are the best tenth (`TOP_SHARE`) of the spec's ranking on that boss, the boss
  page's ranking filtered to the spec. The best player always counts.
- A talent is marked as picked for a boss when it's picked `NOTABLE_DIFFERENCE` (10 points)
  more there than on the other bosses, and only with at least `NOTABLE_MIN_PICKS` (10) picks on
  both sides.
- **Tests:** `raid-talents.spec.ts`.

## Arena titles

- **Code:** `ARENA_TITLES`, `getTitleCutoffs` and `getTitle` in `spa/src/app/arena-games.ts`.
  The page lists characters with 50 or more rated games this season (`MIN_GAMES`). A season
  reward needs 50 wins (`REWARD_MIN_WINS`).
- Each title covers a cumulative "top X%" of the listed players by rating:
  - 2v2: Gladiator 0.6%, Duelist 3%, Rival 10%, Challenger 35%;
  - 3v3: Season Gladiator 0.5%, Gladiator 3%, Duelist 10%, Rival 35%, Challenger 45%.
- **Places round up**, the server's rule: 1.01 places are 2. A title whose rounded places don't
  go beyond the better titles' gets no place of its own.
- **A place is a rating, not a player**: everyone on the same rating shares one place.
- 2v2 has no Season Gladiator, but its table keeps the row so both brackets' tables match.
- The season start is `RatedArenaGameCounter.SeasonStart` (2026-09-16). Changing it discards
  the saved counts.
- **Tests:** `arena-games.spec.ts`.
