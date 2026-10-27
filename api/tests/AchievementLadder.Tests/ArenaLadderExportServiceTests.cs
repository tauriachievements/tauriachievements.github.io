using System.Text.Json;
using ArenaLadderExporter;
using Tauri.Core.Infrastructure;

namespace AchievementLadder.Tests;

public sealed class ArenaLadderExportServiceTests
{
    private const string Evermoon = "[EN] Evermoon";
    private const string Tauri = "[HU] Tauri WoW Server";
    private const string WoD = "[HU] Warriors of Darkness";

    private static readonly DateTimeOffset Now = new(2026, 10, 26, 0, 1, 12, TimeSpan.Zero);

    [Fact]
    public void Parse_ReadsEveryFieldAndSkipsEntriesThatCannotBeListed()
    {
        var ladder = ArenaLadderParser.Parse(
            Parse(
                LadderJson(
                    Entry(
                        7,
                        Tauri,
                        "Ticho",
                        classId: 4,
                        games: 198,
                        wins: 183,
                        rating: 2656,
                        peak: 2700,
                        spec: 259,
                        weekGames: 7,
                        weekWins: 6,
                        weekPeak: 2680,
                        guild: "Outlaws"
                    ),
                    Entry(8, Evermoon, "", classId: 4, games: 10, wins: 5, rating: 1500),
                    Entry(9, Evermoon, "Classless", classId: 0, games: 10, wins: 5, rating: 1500),
                    Entry(
                        10,
                        "Elsewhere",
                        "Stranger",
                        classId: 1,
                        games: 10,
                        wins: 5,
                        rating: 1500
                    ),
                    Entry(11, Evermoon, "Idle", classId: 1, games: 0, wins: 0, rating: 1500),
                    Entry(7, Tauri, "Ticho", classId: 4, games: 1, wins: 1, rating: 100),
                    "{\"Guid\": 12, \"realmName\": \"[EN] Evermoon\"}"
                )
            )
        );

        Assert.Equal(6, ladder.SkippedCount);
        var player = Assert.Single(ladder.Players);
        Assert.Equal(
            new ArenaLadderPlayer(
                7,
                "Tauri",
                "Ticho",
                4,
                2,
                1,
                1,
                "Outlaws",
                259,
                198,
                183,
                7,
                6,
                2656,
                2700,
                2680
            ),
            player
        );
    }

    [Fact]
    public void Parse_RejectsAResponseWithoutALadder()
    {
        Assert.Throws<InvalidDataException>(() =>
            ArenaLadderParser.Parse(Parse("""{ "ts": 0, "realm": "[EN] Evermoon" }"""))
        );
    }

    [Fact]
    public async Task ExportAsync_WritesEachBracketSortedByRatingWithOnePlayerPerLine()
    {
        var outputDirectory = CreateTempDirectory();
        try
        {
            var apiClient = new FakeArenaLadderApiClient(
                new()
                {
                    [2] = LadderJson(
                        Entry(1, Evermoon, "Bravo", classId: 1, games: 60, wins: 40, rating: 2100),
                        Entry(2, WoD, "Alpha", classId: 2, games: 80, wins: 50, rating: 2100),
                        Entry(3, Tauri, "Charlie", classId: 3, games: 20, wins: 9, rating: 2300)
                    ),
                    [3] = LadderJson(
                        Entry(4, Evermoon, "Delta", classId: 5, games: 55, wins: 30, rating: 1900)
                    ),
                }
            );
            var service = new ArenaLadderExportService(
                outputDirectory,
                apiClient,
                new FixedTimeProvider(Now)
            );

            var result = await service.ExportAsync(
                new ArenaLadderExporterOptions(false),
                CancellationToken.None
            );

            Assert.Equal(
                [("2v2", 3, 160), ("3v3", 1, 55)],
                result.Brackets.Select(bracket =>
                    (bracket.Bracket.Name, bracket.PlayerCount, bracket.GamesPlayed)
                )
            );

            var twosPath = Path.Combine(outputDirectory, "arena-ladder-2v2.json");
            using var twos = JsonDocument.Parse(await File.ReadAllTextAsync(twosPath));
            var root = twos.RootElement;
            Assert.Equal(
                ArenaLadderFileWriter.FormatVersion,
                root.GetProperty("version").GetInt32()
            );
            Assert.Equal("2v2", root.GetProperty("bracket").GetString());
            Assert.Equal("2026-09-16T00:00:00+02:00", root.GetProperty("seasonStart").GetString());
            Assert.Equal("2026-10-26T00:01:12Z", root.GetProperty("generatedAt").GetString());
            Assert.Equal(
                ["Charlie", "Alpha", "Bravo"],
                root.GetProperty("players")
                    .EnumerateArray()
                    .Select(player => player.GetProperty("name").GetString())
            );
            Assert.Equal(4, (await File.ReadAllLinesAsync(twosPath)).Length);

            using var threes = JsonDocument.Parse(
                await File.ReadAllTextAsync(Path.Combine(outputDirectory, "arena-ladder-3v3.json"))
            );
            Assert.Equal("3v3", threes.RootElement.GetProperty("bracket").GetString());
            Assert.Equal(
                "Delta",
                threes.RootElement.GetProperty("players")[0].GetProperty("name").GetString()
            );
        }
        finally
        {
            Directory.Delete(outputDirectory, recursive: true);
        }
    }

    [Fact]
    public async Task ExportAsync_WritesNothingWhenABracketCannotBeRead()
    {
        var outputDirectory = CreateTempDirectory();
        try
        {
            var apiClient = new FakeArenaLadderApiClient(
                new()
                {
                    [2] = LadderJson(
                        Entry(1, Evermoon, "Bravo", classId: 1, games: 60, wins: 40, rating: 2100)
                    ),
                }
            );
            var service = new ArenaLadderExportService(outputDirectory, apiClient);

            var error = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                service.ExportAsync(new ArenaLadderExporterOptions(false), CancellationToken.None)
            );

            Assert.Contains("3v3", error.Message);
            Assert.Empty(Directory.GetFiles(outputDirectory));
        }
        finally
        {
            Directory.Delete(outputDirectory, recursive: true);
        }
    }

    [Fact]
    public async Task ExportAsync_RefusesALadderThatLostGamesUnlessAllowed()
    {
        var outputDirectory = CreateTempDirectory();
        try
        {
            var twosPath = Path.Combine(outputDirectory, "arena-ladder-2v2.json");
            var previous = PreviousFile("2026-09-16T00:00:00+02:00", 600, 400);
            await File.WriteAllTextAsync(twosPath, previous);
            var apiClient = new FakeArenaLadderApiClient(
                new()
                {
                    [2] = LadderJson(
                        Entry(
                            1,
                            Evermoon,
                            "Bravo",
                            classId: 1,
                            games: 600,
                            wins: 300,
                            rating: 2100
                        ),
                        Entry(2, Evermoon, "Alpha", classId: 1, games: 370, wins: 200, rating: 2000)
                    ),
                    [3] = LadderJson(),
                }
            );
            var service = new ArenaLadderExportService(outputDirectory, apiClient);

            var error = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                service.ExportAsync(new ArenaLadderExporterOptions(false), CancellationToken.None)
            );

            Assert.Contains("from 1000 to 970", error.Message);
            Assert.Equal(previous, await File.ReadAllTextAsync(twosPath));
            Assert.False(File.Exists(Path.Combine(outputDirectory, "arena-ladder-3v3.json")));

            var result = await service.ExportAsync(
                new ArenaLadderExporterOptions(true),
                CancellationToken.None
            );

            Assert.Equal(970, result.Brackets[0].GamesPlayed);
            Assert.NotEqual(previous, await File.ReadAllTextAsync(twosPath));
        }
        finally
        {
            Directory.Delete(outputDirectory, recursive: true);
        }
    }

    [Fact]
    public async Task ExportAsync_DoesNotCompareWithAnEarlierSeason()
    {
        var outputDirectory = CreateTempDirectory();
        try
        {
            await File.WriteAllTextAsync(
                Path.Combine(outputDirectory, "arena-ladder-2v2.json"),
                PreviousFile("2026-06-01T00:00:00+02:00", 5000, 5000)
            );
            var apiClient = new FakeArenaLadderApiClient(
                new()
                {
                    [2] = LadderJson(
                        Entry(1, Evermoon, "Bravo", classId: 1, games: 3, wins: 3, rating: 120)
                    ),
                    [3] = LadderJson(),
                }
            );
            var service = new ArenaLadderExportService(outputDirectory, apiClient);

            var result = await service.ExportAsync(
                new ArenaLadderExporterOptions(false),
                CancellationToken.None
            );

            Assert.Equal(
                (3, 0),
                (result.Brackets[0].GamesPlayed, result.Brackets[0].PreviousGamesPlayed)
            );
        }
        finally
        {
            Directory.Delete(outputDirectory, recursive: true);
        }
    }

    [Fact]
    public async Task ExportAsync_KeepsEachPlayersRatingAndGamesFromThePreviousExport()
    {
        var outputDirectory = CreateTempDirectory();
        try
        {
            await File.WriteAllTextAsync(
                Path.Combine(outputDirectory, "arena-ladder-2v2.json"),
                """
                {"version":1,"bracket":"2v2","seasonStart":"2026-09-16T00:00:00+02:00","generatedAt":"2026-10-25T00:01:05Z","players":[
                {"guid":1,"realm":"Evermoon","name":"Bravo","games":58,"rating":2140},
                {"guid":2,"realm":"WoD","name":"Alpha","games":80,"rating":2100},
                {"guid":3,"realm":"Evermoon","name":"Charlie","games":20,"rating":1900}]}
                """
            );
            await File.WriteAllTextAsync(
                Path.Combine(outputDirectory, "arena-ladder-3v3.json"),
                """
                {"version":1,"bracket":"3v3","seasonStart":"2026-06-01T00:00:00+02:00","generatedAt":"2026-10-25T00:01:05Z","players":[
                {"guid":4,"realm":"Evermoon","name":"Delta","games":50,"rating":1800}]}
                """
            );
            var apiClient = new FakeArenaLadderApiClient(
                new()
                {
                    [2] = LadderJson(
                        Entry(1, Evermoon, "Bravo", classId: 1, games: 60, wins: 40, rating: 2100),
                        Entry(2, WoD, "Alpha", classId: 2, games: 80, wins: 50, rating: 2100),
                        Entry(3, Tauri, "Charlie", classId: 3, games: 21, wins: 9, rating: 2300)
                    ),
                    [3] = LadderJson(
                        Entry(4, Evermoon, "Delta", classId: 5, games: 55, wins: 30, rating: 1900)
                    ),
                }
            );
            var service = new ArenaLadderExportService(
                outputDirectory,
                apiClient,
                new FixedTimeProvider(Now)
            );

            var result = await service.ExportAsync(
                new ArenaLadderExporterOptions(false),
                CancellationToken.None
            );

            Assert.Equal([2, 0], result.Brackets.Select(bracket => bracket.ComparedPlayerCount));

            using var twos = JsonDocument.Parse(
                await File.ReadAllTextAsync(Path.Combine(outputDirectory, "arena-ladder-2v2.json"))
            );
            Assert.Equal(
                "2026-10-25T00:01:05Z",
                twos.RootElement.GetProperty("previousGeneratedAt").GetString()
            );
            Assert.Equal(
                [("Charlie", null, null), ("Alpha", 2100, 80), ("Bravo", 2140, 58)],
                twos.RootElement.GetProperty("players")
                    .EnumerateArray()
                    .Select(player =>
                        (
                            player.GetProperty("name").GetString(),
                            ReadOptionalInt(player, "previousRating"),
                            ReadOptionalInt(player, "previousGames")
                        )
                    )
            );

            using var threes = JsonDocument.Parse(
                await File.ReadAllTextAsync(Path.Combine(outputDirectory, "arena-ladder-3v3.json"))
            );
            Assert.False(threes.RootElement.TryGetProperty("previousGeneratedAt", out _));
            Assert.False(
                threes.RootElement.GetProperty("players")[0].TryGetProperty("previousRating", out _)
            );
        }
        finally
        {
            Directory.Delete(outputDirectory, recursive: true);
        }
    }

    private static int? ReadOptionalInt(JsonElement element, string propertyName) =>
        element.TryGetProperty(propertyName, out var property) ? property.GetInt32() : null;

    private static string PreviousFile(string seasonStart, params int[] games)
    {
        var players = games.Select(
            (count, index) =>
                $"{{\"guid\":{index + 1},\"realm\":\"Evermoon\",\"name\":\"Old{index}\",\"games\":{count}}}"
        );
        return $"{{\"version\":1,\"bracket\":\"2v2\",\"seasonStart\":\"{seasonStart}\",\"players\":[\n"
            + string.Join(",\n", players)
            + "]}";
    }

    private static string LadderJson(params string[] entries) =>
        $$"""
            {
              "ts": 0,
              "resultfrom": 1,
              "resultcountperpage": 0,
              "realm": "[EN] Evermoon",
              "ladder": [{{string.Join(",", entries)}}]
            }
            """;

    private static string Entry(
        int guid,
        string realm,
        string name,
        int classId,
        int games,
        int wins,
        int rating,
        int peak = 0,
        int spec = 0,
        int weekGames = 0,
        int weekWins = 0,
        int weekPeak = 0,
        string guild = ""
    ) =>
        $$"""
            {
              "Guid": {{guid}},
              "character-minimal-data": { "charname": "{{name}}", "realm": "{{realm}}", "race": 2, "class": {{classId}}, "gender": 1, "guildname": "{{guild}}", "faction": 1 },
              "realmName": "{{realm}}",
              "Slot": 0,
              "played_week": {{weekGames}},
              "wons_week": {{weekWins}},
              "played_season": {{games}},
              "wons_season": {{wins}},
              "rating_best_weekly": {{weekPeak}},
              "rating_best_season": {{peak}},
              "personal_rating": {{rating}},
              "prev_personal_rating": 0,
              "lastspecid": {{spec}}
            }
            """;

    private static string CreateTempDirectory()
    {
        var path = Path.Combine(Path.GetTempPath(), $"arena-ladder-tests-{Guid.NewGuid():N}");
        Directory.CreateDirectory(path);
        return path;
    }

    private static JsonElement Parse(string json) => JsonDocument.Parse(json).RootElement.Clone();

    private sealed class FakeArenaLadderApiClient(Dictionary<int, string> laddersByTeamSize)
        : ITauriApiClient
    {
        public Task<TauriApiResponseResult> FetchResponseElementAsync(
            string endpoint,
            object parameters,
            string requestLabel,
            CancellationToken cancellationToken
        )
        {
            Assert.Equal("arena-ladder", endpoint);
            var request = JsonSerializer.SerializeToElement(parameters);
            Assert.Equal(Evermoon, request.GetProperty("r").GetString());
            var teamSize = request.GetProperty("ts").GetInt32();

            return Task.FromResult(
                laddersByTeamSize.TryGetValue(teamSize, out var json)
                    ? TauriApiResponseResult.Success(Parse(json))
                    : TauriApiResponseResult.Failure("No fake ladder.")
            );
        }
    }

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now;
    }
}
