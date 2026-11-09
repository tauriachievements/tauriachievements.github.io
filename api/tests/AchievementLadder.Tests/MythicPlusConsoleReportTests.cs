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
            "  [1/9]  Halls of Valor               8,216 runs    12.4s",
            MythicPlusConsoleReport.LeaderboardRead(
                1,
                9,
                "Halls of Valor",
                8216,
                TimeSpan.FromSeconds(12.4)
            )
        );
        Assert.Equal(
            "  [ 3/12]  Maw of Souls                11,402 runs   1m 05s",
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
            "  [4/9]  Court of Stars             failed after 30.2s",
            MythicPlusConsoleReport.LeaderboardFailed(
                4,
                9,
                "Court of Stars",
                TimeSpan.FromSeconds(30.2)
            )
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
                line.StartsWith("  [")
                && line.Contains("Halls of Valor")
                && line.Contains(" 1 runs ")
        );
        Assert.Contains(
            lines,
            line =>
                line.StartsWith("  [")
                && line.Contains("Eye of Azshara")
                && line.Contains("failed after ")
        );
        Assert.Equal(["  [1/2]", "  [2/2]"], lines.Select(line => line[..7]));
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
