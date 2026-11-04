# How to add a guild page

Guild pages are unlisted statistics pages, one per guild, at `/<key>-<guid>` (for example
`/endless-9f4c446e-5fef-4265-b4c6-2fc5d61e5e59`). All of them are `GuildAnalysisPageComponent`, reading
`spa/src/guild-analysis/<key>.json`, which `api/GuildAnalysisExporter` writes. `GUILD_PAGES` in
`spa/src/app/features/guild-analysis/guild-analysis.ts` lists them, and
`guild-analysis.routes.ts` makes one route per entry.

The owner asks for these by guild name and realm. They're routine and don't need an
architecture discussion.

## Steps

1. **Pick the key.** It's the guild name, lowercased and kebab-cased, with accents dropped
   ("Témérité" → `temerite`). GuildAnalysisExporter names the JSON file the same way. Check
   the first run's output file name before you rely on it.
2. **`GUILD_PAGES` in `spa/src/app/features/guild-analysis/guild-analysis.ts`:** add one
   line. The page's address is the key, a hyphen and `guid`, a new random lowercase GUID, so
   it can't be guessed. `name` and `realm` show until the scan's own guild details load:

   ```ts
   { key: '<key>', guid: '<guid>', name: '<Guild Name>', realm: '<Realm>' },
   ```

   Generate the GUID with `node -p "crypto.randomUUID()"`. `guild-analysis.spec.ts` fails on
   anything else, or on a GUID another guild already has. Nothing else in the app changes: the
   route comes from the table.
3. **`spa/e2e/visual-pages.ts`:** add the page, so the visual check covers it.
4. **`$guildAnalysisGuilds` in `api/Run-DailyUpdate.ps1`:** add
   `@{ Realm = '<Realm>'; Name = '<Guild Name>' }`, so the daily update keeps the page fresh.
   The realm is `Evermoon`, `Tauri` or `WoD`. The script is saved as UTF-8 with a BOM, which
   Windows PowerShell needs to read an accented guild name; keep it that way.
5. **Scan it once by hand** (from `api/`):

   ```powershell
   dotnet run --project GuildAnalysisExporter -- <Realm> "<Guild Name>" --output-directory ../spa/src/guild-analysis
   ```

   The data manifest picks the new JSON up on the next build, so no `angular.json` change is
   needed.
6. **Check it:** `npm start`, open `/<key>-<hex>`, and check the roster, filters and phone
   layout.

Don't add the page to `nav-sections.ts`. Give the owner the URL; they share it with the
guild.

## A guild of named characters

A page can also show characters that aren't one guild in the game, such as the owner's own
characters (the Xyhop page). Follow the same steps, with these differences:

- In `$guildAnalysisGuilds`, give the entry a `Members` list:
  `@{ Realm = 'Evermoon'; Name = 'Xyhop'; Members = @('Xyhop', 'Xyhopwarrior', …) }`. The
  daily update passes it as `--members Xyhop,Xyhopwarrior,…`.
- Scan it by hand the same way, adding `--members` with the names joined by commas.
- With `--members`, GuildAnalysisExporter doesn't ask `guild-info`. The named characters are
  the roster, all at one rank, "Member"; the guild's faction is the one most of them have
  (`faction_string_class` on their character sheets). `Name` only names the page and its file.
- Everything else is as for any guild: only level 110 characters are listed, and a name the
  realm doesn't know is left out of that night's scan.
