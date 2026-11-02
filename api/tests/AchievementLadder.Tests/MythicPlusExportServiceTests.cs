using System.Globalization;
using System.Text.Json;
using System.Text.Json.Nodes;
using MythicPlusExporter;
using Tauri.Core.Infrastructure;

namespace AchievementLadder.Tests;

public sealed class MythicPlusExportServiceTests
{
    internal const string Evermoon = "[EN] Evermoon";
    internal const string WoD = "[HU] Warriors of Darkness";

    [Theory]
    [InlineData(18, 1_245_000, 1440, 186.7)]
    [InlineData(16, 982_000, 1440, 174.0)]
    [InlineData(16, 1_440_000, 1440, 170.0)]
    [InlineData(16, 2_950_000, 2700, 160.6)]
    [InlineData(16, 2_016_000, 1440, 154.5)]
    [InlineData(16, 2_016_001, 1440, 0.0)]
    [InlineData(20, 3_510_000, 2340, 0.0)]
    [InlineData(2, 9_000_000, 1440, 0.0)]
    public void Score_RewardsLevelFirstAndTimeSecond(
        int keyLevel,
        long clearTimeMilliseconds,
        int timerSeconds,
        double expected
    )
    {
        Assert.Equal(
            expected,
            MythicPlusScore.Calculate(keyLevel, clearTimeMilliseconds, timerSeconds)
        );
    }

    [Theory]
    [InlineData(20, 1_837_000, 2340, 202.7)]
    [InlineData(20, 1_623_000, 1800, 201.2)]
    [InlineData(18, 1_860_000, 2100, 186.4)]
    [InlineData(18, 1_980_000, 2100, 185.7)]
    [InlineData(17, 1_530_000, 1440, 168.8)]
    [InlineData(20, 2_460_000, 2340, 191.5)]
    [InlineData(19, 2_339_000, 2340, 192.5)]
    [InlineData(19, 1_404_000, 2340, 197.5)]
    public void Score_MatchesTheScoringPageExamples(
        int keyLevel,
        long clearTimeMilliseconds,
        int timerSeconds,
        double expected
    )
    {
        Assert.Equal(
            expected,
            MythicPlusScore.Calculate(keyLevel, clearTimeMilliseconds, timerSeconds)
        );
    }

    [Fact]
    public void ParseLeaderboard_DropsEmptyAffixSlotsAndUnknownCharacters()
    {
        var response = Parse(
            LeaderboardJson(
                Run(
                    9,
                    1_500_000,
                    100,
                    affixIds: [7, 0, 0],
                    Member("Pashao", Evermoon, 12, "Vengeance", 0, "Хранители Вечности"),
                    "{}",
                    Member("Swag", "[HU] Tauri WoW Server", 3, "Marksmanship", 2, "")
                )
            )
        );

        var run = Assert.Single(ChallengeResponseParser.ParseLeaderboard(response));

        var affix = Assert.Single(run.Affixes);
        Assert.Equal((7, 4), (affix.Id, affix.Level));
        Assert.Collection(
            run.Members,
            tank =>
            {
                Assert.Equal(("Pashao", "Evermoon", "tank"), (tank.Name, tank.Realm, tank.Role));
                Assert.Equal("Хранители Вечности", tank.Guild);
            },
            dps => Assert.Equal(("Swag", "Tauri", "dps"), (dps.Name, dps.Realm, dps.Role))
        );
    }

    [Fact]
    public async Task ExportAsync_MergesRealmLeaderboardsIntoRankedDungeonFiles()
    {
        var outputDirectory = CreateTempDirectory();
        try
        {
            File.WriteAllText(Path.Combine(outputDirectory, "old-dungeon.json"), "{}");

            var shared = Run(
                15,
                2_000_000,
                300,
                [8, 3, 10],
                Member("Alpha", Evermoon, 6, "Blood", 0, "Outlaws"),
                Member("Beta", Evermoon, 2, "Holy", 1, "")
            );
            var apiClient = new FakeChallengeApiClient(
                IndexJson(),
                new()
                {
                    [(Evermoon, 200)] = LeaderboardJson(
                        Run(
                            14,
                            1_500_000,
                            200,
                            [8, 3, 10],
                            Member("Gamma", Evermoon, 10, "Windwalker", 2, "")
                        ),
                        shared
                    ),
                    [(WoD, 200)] = LeaderboardJson(shared),
                    [(Evermoon, 197)] = LeaderboardJson(
                        Run(
                            10,
                            2_500_000,
                            100,
                            [5, 0, 0],
                            Member("Alpha", Evermoon, 6, "Blood", 0, "Outlaws")
                        )
                    ),
                    [(WoD, 197)] = LeaderboardJson(),
                }
            );
            var scannedAt = new DateTimeOffset(2026, 10, 7, 11, 30, 15, TimeSpan.FromHours(2));
            var service = new MythicPlusExportService(
                outputDirectory,
                apiClient,
                new FixedTimeProvider(scannedAt)
            );

            var result = await service.ExportAsync(
                new MythicPlusExporterOptions([Evermoon, WoD], AllowShrink: false),
                CancellationToken.None
            );

            Assert.Equal(1, result.Dataset.DuplicateRunCount);
            Assert.Equal(3, result.Dataset.RunCount);
            Assert.Equal(
                ["eoa.json", "hov.json", "index.json"],
                Directory
                    .EnumerateFiles(outputDirectory)
                    .Select(Path.GetFileName)
                    .Order(StringComparer.Ordinal)
            );

            using var index = JsonDocument.Parse(
                File.ReadAllText(Path.Combine(outputDirectory, "index.json"))
            );
            var root = index.RootElement;
            Assert.Equal("2026-10-07T09:30:15Z", root.GetProperty("generatedAt").GetString());
            Assert.Equal(
                ["eoa", "hov"],
                root.GetProperty("dungeons")
                    .EnumerateArray()
                    .Select(dungeon => dungeon.GetProperty("id").GetString())
            );
            Assert.Equal(
                ["Alpha", "Beta", "Gamma"],
                root.GetProperty("players").EnumerateArray().Select(player => player[0].GetString())
            );
            Assert.Equal(
                [5, 8, 3, 10],
                root.GetProperty("affixes")
                    .EnumerateArray()
                    .Select(affix => affix.GetProperty("id").GetInt32())
            );

            using var hov = JsonDocument.Parse(
                File.ReadAllText(Path.Combine(outputDirectory, "hov.json"))
            );
            var runs = hov.RootElement.GetProperty("runs").EnumerateArray().ToList();
            Assert.Equal([15, 14], runs.Select(run => run[0].GetInt32()));
            Assert.Equal(0, runs[0][5][0][0].GetInt32());

            var tables = root.GetProperty("tables").GetString();
            Assert.Matches("^[0-9a-f]{12}$", tables);
            Assert.Equal(tables, hov.RootElement.GetProperty("tables").GetString());
        }
        finally
        {
            Directory.Delete(outputDirectory, recursive: true);
        }
    }

    [Fact]
    public async Task ExportAsync_WritesScoreAndTimeChangesAgainstThePreviousScan()
    {
        var outputDirectory = CreateTempDirectory();
        try
        {
            var alpha = Run(10, 2_000_000, 100, [], Member("Alpha", Evermoon, 6, "Blood", 0, ""));
            var beta = Run(
                9,
                2_000_000,
                101,
                [],
                Member("Beta", Evermoon, 10, "Brewmaster", 0, "")
            );
            var firstAt = new DateTimeOffset(2026, 10, 7, 9, 30, 0, TimeSpan.Zero);
            await ExportHallsAsync(outputDirectory, firstAt, alpha, beta);

            var first = ReadJson(outputDirectory, "index.json");
            Assert.Equal(2, first.GetProperty("version").GetInt32());
            Assert.False(first.TryGetProperty("previousGeneratedAt", out _));
            Assert.False(first.TryGetProperty("departed", out _));
            Assert.Equal([HallsScore(10, 2_000_000), 2_000_000], Values(ScoresOf(first, "Alpha")));
            Assert.Equal([HallsScore(9, 2_000_000), 2_000_000], Values(ScoresOf(first, "Beta")));

            await ExportHallsAsync(
                outputDirectory,
                firstAt.AddDays(1),
                alpha,
                beta,
                Run(11, 1_900_000, 102, [], Member("Beta", Evermoon, 10, "Brewmaster", 0, ""))
            );

            var second = ReadJson(outputDirectory, "index.json");
            Assert.Equal(
                "2026-10-07T09:30:00Z",
                second.GetProperty("previousGeneratedAt").GetString()
            );
            Assert.Equal(
                [HallsScore(10, 2_000_000), 2_000_000, 0, 0],
                Values(ScoresOf(second, "Alpha"))
            );
            Assert.Equal(
                [
                    HallsScore(11, 1_900_000),
                    1_900_000,
                    RoundScore(HallsScore(11, 1_900_000) - HallsScore(9, 2_000_000)),
                    -100_000,
                ],
                Values(ScoresOf(second, "Beta"))
            );
            Assert.Empty(second.GetProperty("departed").EnumerateArray());
        }
        finally
        {
            Directory.Delete(outputDirectory, recursive: true);
        }
    }

    [Fact]
    public async Task ExportAsync_ScoresEachPlayerOnTheirBestRunInEachDungeon()
    {
        var outputDirectory = CreateTempDirectory();
        try
        {
            var service = new MythicPlusExportService(
                outputDirectory,
                new FakeChallengeApiClient(
                    IndexJson(),
                    new()
                    {
                        [(Evermoon, 197)] = LeaderboardJson(
                            Run(8, 1_800_000, 100, [], Member("Alpha", Evermoon, 6, "Blood", 0, ""))
                        ),
                        [(Evermoon, 200)] = LeaderboardJson(
                            Run(
                                9,
                                1_500_000,
                                101,
                                [],
                                Member("Alpha", Evermoon, 6, "Blood", 0, "")
                            ),
                            Run(
                                10,
                                2_000_000,
                                102,
                                [],
                                Member("Alpha", Evermoon, 6, "Blood", 0, "")
                            )
                        ),
                    }
                ),
                new FixedTimeProvider(new DateTimeOffset(2026, 10, 7, 9, 30, 0, TimeSpan.Zero))
            );
            await service.ExportAsync(
                new MythicPlusExporterOptions([Evermoon], AllowShrink: false),
                CancellationToken.None
            );

            var index = ReadJson(outputDirectory, "index.json");
            Assert.Equal(
                [
                    RoundScore(
                        MythicPlusScore.Calculate(8, 1_800_000, 2100) + HallsScore(10, 2_000_000)
                    ),
                    3_800_000,
                ],
                Values(ScoresOf(index, "Alpha"))
            );
        }
        finally
        {
            Directory.Delete(outputDirectory, recursive: true);
        }
    }

    [Fact]
    public async Task ExportAsync_KeepsEveryPlayerInPlaceAndAddsNewPlayersAtTheEnd()
    {
        var outputDirectory = CreateTempDirectory();
        try
        {
            var delta = Run(
                9,
                2_000_000,
                101,
                [],
                Member("Delta", Evermoon, 10, "Brewmaster", 0, "")
            );
            var firstAt = new DateTimeOffset(2026, 10, 7, 9, 30, 0, TimeSpan.Zero);
            await ExportHallsAsync(
                outputDirectory,
                firstAt,
                Run(10, 2_000_000, 100, [], Member("Beta", Evermoon, 6, "Blood", 0, "Outlaws")),
                delta
            );
            var firstTables = ReadJson(outputDirectory, "index.json")
                .GetProperty("tables")
                .GetString();
            var firstDeltaLine = Assert.Single(
                RunLines(outputDirectory, "hov"),
                line => line.Contains("[[1,1]]")
            );

            await ExportHallsAsync(
                outputDirectory,
                firstAt.AddDays(1),
                Run(10, 2_000_000, 100, [], Member("Beta", Evermoon, 6, "Blood", 0, "Lawmen")),
                delta,
                Run(12, 2_000_000, 102, [], Member("Alpha", Evermoon, 6, "Blood", 0, "")),
                Run(11, 2_000_000, 103, [], Member("Gamma", Evermoon, 6, "Blood", 0, ""))
            );

            var second = ReadJson(outputDirectory, "index.json");
            Assert.Equal(["Beta", "Delta", "Alpha", "Gamma"], PlayerNames(second));
            Assert.Equal("Lawmen", second.GetProperty("players")[0][2].GetString());
            Assert.Equal(firstTables, second.GetProperty("tables").GetString());
            Assert.Equal(
                firstTables,
                ReadJson(outputDirectory, "hov.json").GetProperty("tables").GetString()
            );
            Assert.Contains(firstDeltaLine, RunLines(outputDirectory, "hov"));
        }
        finally
        {
            Directory.Delete(outputDirectory, recursive: true);
        }
    }

    [Fact]
    public async Task ExportAsync_KeepsTheRowOfAPlayerWhoLeftAndListsThemAsDeparted()
    {
        var outputDirectory = CreateTempDirectory();
        try
        {
            var alpha = Run(10, 2_000_000, 100, [], Member("Alpha", Evermoon, 6, "Blood", 0, ""));
            var beta = Run(
                9,
                2_100_000,
                101,
                [],
                Member("Beta", Evermoon, 10, "Brewmaster", 0, "")
            );
            var firstAt = new DateTimeOffset(2026, 10, 7, 9, 30, 0, TimeSpan.Zero);
            await ExportHallsAsync(outputDirectory, firstAt, alpha, beta);

            await ExportHallsAsync(outputDirectory, firstAt.AddDays(1), allowShrink: true, alpha);

            var second = ReadJson(outputDirectory, "index.json");
            Assert.Equal(["Alpha", "Beta"], PlayerNames(second));
            Assert.Equal(0, ScoresOf(second, "Beta").GetArrayLength());
            var departed = Assert.Single(second.GetProperty("departed").EnumerateArray());
            Assert.Equal([1, HallsScore(9, 2_100_000), 2_100_000], Values(departed));

            await ExportHallsAsync(outputDirectory, firstAt.AddDays(2), alpha, beta);

            var third = ReadJson(outputDirectory, "index.json");
            Assert.Equal(["Alpha", "Beta"], PlayerNames(third));
            Assert.Equal([HallsScore(9, 2_100_000), 2_100_000], Values(ScoresOf(third, "Beta")));
            Assert.Empty(third.GetProperty("departed").EnumerateArray());
        }
        finally
        {
            Directory.Delete(outputDirectory, recursive: true);
        }
    }

    [Fact]
    public async Task ExportAsync_ContinuesTheTablesOfAFormatOneExport()
    {
        var outputDirectory = CreateTempDirectory();
        try
        {
            var betaScore = Invariant(HallsScore(10, 2_000_000));
            var zetaScore = Invariant(HallsScore(9, 2_100_000));
            File.WriteAllText(
                Path.Combine(outputDirectory, "index.json"),
                $$"""
                {"version":1,"generatedAt":"2026-10-07T09:30:00Z","tables":"0123456789ab",
                "season":{"id":"{{MythicPlusCatalog.Season.Id}}"},
                "dungeons":[{"id":"hov","runCount":2}],
                "specs":[{"class":6,"name":"Blood","role":"tank"},{"class":10,"name":"Brewmaster","role":"tank"}],
                "players":[["Beta","Evermoon","",6,1,0],["Zeta","Evermoon","",10,1,0]],
                "standings":[[{{betaScore}},1],[{{zetaScore}},2]]}
                """
            );
            File.WriteAllText(
                Path.Combine(outputDirectory, "hov.json"),
                $$"""
                {"version":1,"dungeon":"hov","tables":"0123456789ab","runs":[
                [10,2000000,100,{{betaScore}},[],[[0,0]]],
                [9,2100000,101,{{zetaScore}},[],[[1,1]]]]}
                """
            );

            await ExportHallsAsync(
                outputDirectory,
                new DateTimeOffset(2026, 10, 8, 9, 30, 0, TimeSpan.Zero),
                Run(10, 2_000_000, 100, [], Member("Beta", Evermoon, 6, "Blood", 0, "")),
                Run(9, 2_100_000, 101, [], Member("Zeta", Evermoon, 10, "Brewmaster", 0, "")),
                Run(12, 2_000_000, 102, [], Member("Alpha", Evermoon, 6, "Blood", 0, ""))
            );

            var index = ReadJson(outputDirectory, "index.json");
            Assert.Equal(2, index.GetProperty("version").GetInt32());
            Assert.Equal("0123456789ab", index.GetProperty("tables").GetString());
            Assert.Equal(["Beta", "Zeta", "Alpha"], PlayerNames(index));
            Assert.Equal(
                "2026-10-07T09:30:00Z",
                index.GetProperty("previousGeneratedAt").GetString()
            );
            Assert.Equal(
                [HallsScore(10, 2_000_000), 2_000_000, 0, 0],
                Values(ScoresOf(index, "Beta"))
            );
            Assert.Equal([HallsScore(12, 2_000_000), 2_000_000], Values(ScoresOf(index, "Alpha")));

            var halls = RunLines(outputDirectory, "hov");
            Assert.Contains($"[10,2000000,100,{betaScore},[],[[0,0]]],", halls);
            Assert.Contains($"[9,2100000,101,{zetaScore},[],[[1,1]]]]}}", halls);
        }
        finally
        {
            Directory.Delete(outputDirectory, recursive: true);
        }
    }

    [Theory]
    [InlineData(true, 2)]
    [InlineData(false, 99)]
    public async Task ExportAsync_StartsNewTablesForANewSeasonOrANewerFormat(
        bool newSeason,
        int version
    )
    {
        var outputDirectory = CreateTempDirectory();
        try
        {
            var seasonId = newSeason ? "legion-s0" : MythicPlusCatalog.Season.Id;
            File.WriteAllText(
                Path.Combine(outputDirectory, "index.json"),
                $$"""
                {"version":{{version}},"generatedAt":"2026-10-07T09:30:00Z","tables":"0123456789ab",
                "season":{"id":"{{seasonId}}"},
                "dungeons":[{"id":"hov","runCount":1}],
                "specs":[{"class":6,"name":"Blood","role":"tank"}],
                "players":[["Zeta","Evermoon","",6,1,0]],
                "scores":[[100,2000000]]}
                """
            );

            await ExportHallsAsync(
                outputDirectory,
                new DateTimeOffset(2026, 10, 8, 9, 30, 0, TimeSpan.Zero),
                Run(10, 2_000_000, 100, [], Member("Alpha", Evermoon, 6, "Blood", 0, ""))
            );

            var index = ReadJson(outputDirectory, "index.json");
            Assert.Equal(["Alpha"], PlayerNames(index));
            Assert.NotEqual("0123456789ab", index.GetProperty("tables").GetString());
            Assert.False(index.TryGetProperty("previousGeneratedAt", out _));
        }
        finally
        {
            Directory.Delete(outputDirectory, recursive: true);
        }
    }

    [Fact]
    public void FingerprintOf_ChangesWhenPositionsShiftOnly()
    {
        IReadOnlyList<MythicPlusSpec> specs = [new MythicPlusSpec(6, "Blood", "tank")];
        var alpha = new MythicPlusPlayer("Alpha", Evermoon, "Outlaws", 6, 1, 0);
        var gamma = new MythicPlusPlayer("Gamma", Evermoon, "", 10, 2, 1);
        var original = MythicPlusTables.FingerprintOf(specs, [alpha, gamma]);

        Assert.Equal(
            original,
            MythicPlusTables.FingerprintOf(specs, [alpha with { Guild = "" }, gamma])
        );
        Assert.NotEqual(
            original,
            MythicPlusTables.FingerprintOf(
                specs,
                [alpha, new MythicPlusPlayer("Beta", Evermoon, "", 2, 1, 1), gamma]
            )
        );
    }

    [Fact]
    public async Task ExportAsync_WritesNothingWhenALeaderboardFails()
    {
        var outputDirectory = CreateTempDirectory();
        try
        {
            var apiClient = new FakeChallengeApiClient(
                IndexJson(),
                new() { [(Evermoon, 197)] = LeaderboardJson() }
            );
            var service = new MythicPlusExportService(outputDirectory, apiClient);

            var error = await Assert.ThrowsAsync<InvalidOperationException>(() =>
                service.ExportAsync(
                    new MythicPlusExporterOptions([Evermoon], AllowShrink: false),
                    CancellationToken.None
                )
            );

            Assert.Contains("Halls of Valor", error.Message);
            Assert.Empty(Directory.EnumerateFiles(outputDirectory));
        }
        finally
        {
            Directory.Delete(outputDirectory, recursive: true);
        }
    }

    [Fact]
    public async Task ExportAsync_RefusesToPublishAShrunkenLeaderboardUnlessAllowed()
    {
        var outputDirectory = CreateTempDirectory();
        try
        {
            var previousIndex = """{"dungeons":[{"id":"hov","runCount":100}]}""";
            var indexPath = Path.Combine(outputDirectory, "index.json");
            File.WriteAllText(indexPath, previousIndex);

            var apiClient = new FakeChallengeApiClient(
                IndexJson(),
                new()
                {
                    [(Evermoon, 197)] = LeaderboardJson(),
                    [(Evermoon, 200)] = LeaderboardJson(
                        Run(10, 1_000_000, 1, [], Member("Alpha", Evermoon, 6, "Blood", 0, ""))
                    ),
                }
            );
            var service = new MythicPlusExportService(outputDirectory, apiClient);

            await Assert.ThrowsAsync<InvalidOperationException>(() =>
                service.ExportAsync(
                    new MythicPlusExporterOptions([Evermoon], AllowShrink: false),
                    CancellationToken.None
                )
            );
            Assert.Equal(previousIndex, File.ReadAllText(indexPath));

            var result = await service.ExportAsync(
                new MythicPlusExporterOptions([Evermoon], AllowShrink: true),
                CancellationToken.None
            );
            Assert.Equal((100, 1), (result.PreviousRunCount, result.Dataset.RunCount));
        }
        finally
        {
            Directory.Delete(outputDirectory, recursive: true);
        }
    }

    private static Task<MythicPlusExportResult> ExportHallsAsync(
        string outputDirectory,
        DateTimeOffset scannedAt,
        params string[] hallsRuns
    ) => ExportHallsAsync(outputDirectory, scannedAt, allowShrink: false, hallsRuns);

    private static Task<MythicPlusExportResult> ExportHallsAsync(
        string outputDirectory,
        DateTimeOffset scannedAt,
        bool allowShrink,
        params string[] hallsRuns
    ) =>
        new MythicPlusExportService(
            outputDirectory,
            new FakeChallengeApiClient(
                IndexJson(),
                new()
                {
                    [(Evermoon, 197)] = LeaderboardJson(),
                    [(Evermoon, 200)] = LeaderboardJson(hallsRuns),
                }
            ),
            new FixedTimeProvider(scannedAt)
        ).ExportAsync(
            new MythicPlusExporterOptions([Evermoon], AllowShrink: allowShrink),
            CancellationToken.None
        );

    private static double HallsScore(int keyLevel, long clearTimeMilliseconds) =>
        MythicPlusScore.Calculate(keyLevel, clearTimeMilliseconds, 2700);

    private static double RoundScore(double score) =>
        Math.Round(score, 1, MidpointRounding.AwayFromZero);

    private static string Invariant(double value) => value.ToString(CultureInfo.InvariantCulture);

    private static JsonElement ReadJson(string outputDirectory, string fileName) =>
        Parse(File.ReadAllText(Path.Combine(outputDirectory, fileName)));

    private static string[] RunLines(string outputDirectory, string dungeon) =>
        File.ReadAllLines(Path.Combine(outputDirectory, dungeon + ".json"));

    private static List<string?> PlayerNames(JsonElement index) =>
        index
            .GetProperty("players")
            .EnumerateArray()
            .Select(player => player[0].GetString())
            .ToList();

    private static JsonElement ScoresOf(JsonElement index, string name) =>
        index.GetProperty("scores")[PlayerNames(index).IndexOf(name)];

    private static double[] Values(JsonElement entry) =>
        entry.EnumerateArray().Select(value => value.GetDouble()).ToArray();

    internal static string CreateTempDirectory()
    {
        var path = Path.Combine(Path.GetTempPath(), $"mythic-plus-tests-{Guid.NewGuid():N}");
        Directory.CreateDirectory(path);
        return path;
    }

    internal static JsonElement Parse(string json) => JsonDocument.Parse(json).RootElement.Clone();

    internal static string IndexJson() =>
        """
            {
              "dataUrlPrefix": "legion-",
              "challengemodemaps": {
                "239": { "challengeid": 239, "challengemapname": "Seat of the Triumvirate", "bronzemedaltime": 2100 },
                "200": { "challengeid": 200, "challengemapname": "Halls of Valor", "bronzemedaltime": 2700 },
                "197": { "challengeid": 197, "challengemapname": "Eye of Azshara", "bronzemedaltime": 2100 }
              }
            }
            """;

    internal static string LeaderboardJson(params string[] runs) =>
        $$"""{ "challengesdata": [{{string.Join(",", runs)}}] }""";

    internal static string Run(
        int level,
        long clearTimeMilliseconds,
        long completedAt,
        int[] affixIds,
        params string[] members
    ) =>
        $$"""
            {
              "completiontime": {{clearTimeMilliseconds}},
              "completedtime": {{completedAt}},
              "level": {{level}},
              "affixes": [{{string.Join(
                ",",
                affixIds.Select(id =>
                    $$"""{ "id": {{id}}, "name": "Affix {{id}}", "description": "", "icon": "icon_{{id}}" }"""
                )
            )}}],
              "players": [{{string.Join(",", members)}}]
            }
            """;

    internal static string Member(
        string name,
        string realm,
        int classId,
        string spec,
        int role,
        string guild
    ) =>
        $$"""
            {
              "specializationid": 1,
              "specializationrole": {{role}},
              "specializationname": "{{spec}}",
              "playerinfo": {
                "charname": "{{name}}", "realm": "{{realm}}", "guildname": "{{guild}}",
                "class": {{classId}}, "race": 1, "gender": 0
              }
            }
            """;

    internal sealed class FakeChallengeApiClient(
        string indexJson,
        Dictionary<(string Realm, int ChallengeId), string> leaderboards
    ) : ITauriApiClient
    {
        public Task<TauriApiResponseResult> FetchResponseElementAsync(
            string endpoint,
            object parameters,
            string requestLabel,
            CancellationToken cancellationToken
        )
        {
            var request = JsonSerializer.SerializeToElement(parameters);
            var realm = request.GetProperty("r").GetString()!;

            if (endpoint == "challenge-index")
            {
                return Task.FromResult(TauriApiResponseResult.Success(Parse(indexJson)));
            }

            Assert.Equal("challenge-leaderboard", endpoint);
            var challengeId = request.GetProperty("id").GetInt32();
            return Task.FromResult(
                leaderboards.TryGetValue((realm, challengeId), out var json)
                    ? TauriApiResponseResult.Success(Parse(json))
                    : TauriApiResponseResult.Failure("No fake leaderboard.")
            );
        }
    }

    private sealed class FixedTimeProvider(DateTimeOffset now) : TimeProvider
    {
        public override DateTimeOffset GetUtcNow() => now.ToUniversalTime();
    }
}
