using MythicPlusExporter;
using static AchievementLadder.Tests.MythicPlusExportServiceTests;

namespace AchievementLadder.Tests;

public sealed class MythicPlusConsoleReportTests
{
    [Theory]
    [InlineData(400, "0.4s")]
    [InlineData(12_440, "12.4s")]
    [InlineData(59_960, "1m 00s")]
    [InlineData(65_400, "1m 05s")]
    [InlineData(3_725_000, "1h 02m 05s")]
    public void Duration_ShowsTenthsOfASecondUnderAMinuteAndWholeSecondsAfter(
        int milliseconds,
        string expected
    )
    {
        Assert.Equal(
            expected,
            MythicPlusConsoleReport.Duration(TimeSpan.FromMilliseconds(milliseconds))
        );
    }

    [Fact]
    public void LeaderboardRead_NumbersTheDungeonAndShowsItsRunsAndTime()
    {
        Assert.Equal(
            "[1/9]  Halls of Valor               8,216 runs    12.4s",
            MythicPlusConsoleReport.LeaderboardRead(
                1,
                9,
                "Halls of Valor",
                8216,
                TimeSpan.FromSeconds(12.4)
            )
        );
        Assert.Equal(
            "[ 3/12]  Maw of Souls                11,402 runs   1m 05s",
            MythicPlusConsoleReport.LeaderboardRead(
                3,
                12,
                "Maw of Souls",
                11402,
                TimeSpan.FromSeconds(65)
            )
        );
    }

    [Fact]
    public void LeaderboardFailed_NumbersTheDungeonAndShowsHowLongItTried()
    {
        Assert.Equal(
            "[4/9]  Court of Stars             failed after 30.2s",
            MythicPlusConsoleReport.LeaderboardFailed(
                4,
                9,
                "Court of Stars",
                TimeSpan.FromSeconds(30.2)
            )
        );
    }

    [Fact]
    public void RetryingLeaderboards_SaysHowManyWhenAndWhichRound()
    {
        Assert.Equal(
            "Retrying 2 failed leaderboards in 1m 00s (round 1 of 3)...",
            MythicPlusConsoleReport.RetryingLeaderboards(2, 1, 3, TimeSpan.FromMinutes(1))
        );
        Assert.Equal(
            "Retrying 1 failed leaderboard in 1m 00s (round 3 of 3)...",
            MythicPlusConsoleReport.RetryingLeaderboards(1, 3, 3, TimeSpan.FromMinutes(1))
        );
    }

    [Fact]
    public void Summary_TablesEachDungeonThenTheTotalsAndWhereTheFilesWent()
    {
        var repoRoot = Path.Combine(Path.GetTempPath(), "repo");
        var result = new MythicPlusExportResult(
            Dataset(),
            PreviousRunCount: 1,
            Path.Combine(repoRoot, "spa", "src", "mythic-plus-data")
        );

        Assert.Equal(
            [
                "",
                "  Dungeon                            Runs  Best score",
                "  EOA   Eye of Azshara                  1       170.0",
                "  HOV   Halls of Valor                  1       160.6",
                "  Total                                 2",
                "",
                "  New runs since last export  1",
                "  Players                     2",
                $"  Saved to                    {Path.Combine("spa", "src", "mythic-plus-data")}",
            ],
            MythicPlusConsoleReport.Summary(result, repoRoot)
        );
    }

    [Fact]
    public void Summary_SaysWhenThereIsNoEarlierExportToCompareWith()
    {
        var result = new MythicPlusExportResult(Dataset(), PreviousRunCount: 0, "out");

        Assert.Contains(
            "  New runs since last export  2 (first export)",
            MythicPlusConsoleReport.Summary(result, ".")
        );
    }

    [Fact]
    public void Summary_CountsTheInvalidRunsOnlyWhenThereAreAny()
    {
        var dataset = MythicPlusDatasetBuilder.Build(
            new ChallengeIndex("legion-", [new ChallengeMap(197, "Eye of Azshara", 1440)]),
            new Dictionary<int, IReadOnlyList<ChallengeRun>>
            {
                [197] = ChallengeResponseParser.ParseLeaderboard(
                    Parse(
                        LeaderboardJson(
                            Run(
                                17,
                                1_440_000,
                                1,
                                [],
                                Member("Alpha", Evermoon, 10, "Brewmaster", 0, "")
                            ),
                            Run(
                                16,
                                1_440_000,
                                2,
                                [],
                                Member("Alpha", Evermoon, 10, "Brewmaster", 0, "")
                            )
                        )
                    )
                ),
            }
        );

        Assert.Contains(
            "  Invalid runs                1",
            MythicPlusConsoleReport.Summary(new MythicPlusExportResult(dataset, 0, "out"), ".")
        );
        Assert.DoesNotContain(
            MythicPlusConsoleReport.Summary(new MythicPlusExportResult(Dataset(), 0, "out"), "."),
            line => line.Contains("Invalid runs")
        );
    }

    [Fact]
    public async Task ReadLeaderboards_ReportsEachDungeonAsItFinishesWithoutListingSkippedOnes()
    {
        var progress = new StringWriter();
        var reader = new ChallengeLeaderboardReader(
            new FakeChallengeApiClient(
                IndexJson(),
                new()
                {
                    [(Evermoon, 200)] = LeaderboardJson(
                        Run(16, 2_950_000, 1, [], Member("Alpha", Evermoon, 6, "Blood", 0, ""))
                    ),
                }
            ),
            progress
        );

        var index = await reader.ReadIndexAsync(Evermoon, CancellationToken.None);
        await reader.ReadLeaderboardsAsync(index, [Evermoon], CancellationToken.None);

        var lines = progress
            .ToString()
            .Split(Environment.NewLine, StringSplitOptions.RemoveEmptyEntries);
        Assert.Equal(2, lines.Length);
        Assert.Contains(
            lines,
            line =>
                line.StartsWith('[') && line.Contains("Halls of Valor") && line.Contains(" 1 runs ")
        );
        Assert.Contains(
            lines,
            line =>
                line.StartsWith('[')
                && line.Contains("Eye of Azshara")
                && line.Contains("failed after ")
        );
        Assert.Equal(["[1/2]", "[2/2]"], lines.Select(line => line[..5]));
    }

    [Fact]
    public async Task ReadLeaderboards_RetriesOnlyTheFailedDungeonsAndNumbersThemWithinTheRound()
    {
        var progress = new StringWriter();
        var reader = new ChallengeLeaderboardReader(
            new FakeChallengeApiClient(
                IndexJson(),
                new()
                {
                    [(Evermoon, 197)] = LeaderboardJson(),
                    [(Evermoon, 200)] = LeaderboardJson(
                        Run(16, 2_950_000, 1, [], Member("Alpha", Evermoon, 6, "Blood", 0, ""))
                    ),
                },
                failuresBeforeAnswer: new() { [(Evermoon, 200)] = 2 }
            ),
            progress,
            retryRounds: 3
        );

        var index = await reader.ReadIndexAsync(Evermoon, CancellationToken.None);
        var leaderboards = await reader.ReadLeaderboardsAsync(
            index,
            [Evermoon],
            CancellationToken.None
        );

        Assert.Empty(leaderboards.Failures);
        Assert.Equal([197, 200], leaderboards.RunsByChallengeId.Keys.Order());
        var lines = progress
            .ToString()
            .Split(Environment.NewLine, StringSplitOptions.RemoveEmptyEntries);
        Assert.Equal(6, lines.Length);
        Assert.Equal("Retrying 1 failed leaderboard in 0.0s (round 1 of 3)...", lines[2]);
        Assert.StartsWith("[1/1]  Halls of Valor", lines[3]);
        Assert.Contains("failed after ", lines[3]);
        Assert.Equal("Retrying 1 failed leaderboard in 0.0s (round 2 of 3)...", lines[4]);
        Assert.StartsWith("[1/1]  Halls of Valor", lines[5]);
        Assert.Contains(" 1 runs ", lines[5]);
    }

    [Fact]
    public async Task ReadLeaderboards_ReadsEachDungeonOnceWithoutRetryRounds()
    {
        var apiClient = new FakeChallengeApiClient(
            IndexJson(),
            new() { [(Evermoon, 197)] = LeaderboardJson() },
            failuresBeforeAnswer: new() { [(Evermoon, 197)] = 1 }
        );
        var reader = new ChallengeLeaderboardReader(apiClient, TextWriter.Null);

        var index = await reader.ReadIndexAsync(Evermoon, CancellationToken.None);
        var leaderboards = await reader.ReadLeaderboardsAsync(
            index,
            [Evermoon],
            CancellationToken.None
        );

        Assert.Equal(2, leaderboards.Failures.Count);
        Assert.Equal(1, apiClient.LeaderboardRequests(Evermoon, 197));
        Assert.Equal(1, apiClient.LeaderboardRequests(Evermoon, 200));
    }

    private static MythicPlusDataset Dataset() =>
        MythicPlusDatasetBuilder.Build(
            new ChallengeIndex(
                "legion-",
                [
                    new ChallengeMap(197, "Eye of Azshara", 1440),
                    new ChallengeMap(200, "Halls of Valor", 2700),
                ]
            ),
            new Dictionary<int, IReadOnlyList<ChallengeRun>>
            {
                [197] = ChallengeResponseParser.ParseLeaderboard(
                    Parse(
                        LeaderboardJson(
                            Run(16, 1_440_000, 1, [], Member("Alpha", Evermoon, 6, "Blood", 0, ""))
                        )
                    )
                ),
                [200] = ChallengeResponseParser.ParseLeaderboard(
                    Parse(
                        LeaderboardJson(
                            Run(
                                16,
                                2_950_000,
                                2,
                                [],
                                Member("Alpha", Evermoon, 6, "Blood", 0, ""),
                                Member("Beta", Evermoon, 2, "Holy", 1, "")
                            )
                        )
                    )
                ),
            }
        );
}
