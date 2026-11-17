using ArenaLadderExporter;
using MythicPlusExporter;
using QuickUpdate;
using RaidLogExporter;
using static AchievementLadder.Tests.MythicPlusExportServiceTests;

namespace AchievementLadder.Tests;

public sealed class QuickUpdateTests
{
    private const int Normal = 14;
    private const int Heroic = 15;
    private const int Mythic = 16;

    [Fact]
    public void Summary_SaysHowLongItTookThenWhatEachExportAdded()
    {
        var results = new QuickUpdateResults(
            MythicPlusResult(runs: 3, previousRunCount: 1),
            RaidLogsResult(
                previousLogCount: 40,
                NewLog(1, Normal),
                NewLog(2, Heroic),
                NewLog(3, Heroic),
                NewLog(4, Mythic)
            ),
            ArenaResult((Bracket("2v2"), 47_743, 47_531), (Bracket("3v3"), 4_033, 4_033))
        );

        Assert.Equal(
            [
                "Finished in 3m 12s.",
                "",
                "New M+ runs since last export         2",
                "New raid logs since last export       4  (N 1, HC 2, M 1)",
                "New 2v2 rated arena games           212",
                "New 3v3 rated arena games             0",
            ],
            QuickUpdateReport.Summary(results, TimeSpan.FromSeconds(192))
        );
    }

    [Fact]
    public void Summary_LeavesOutTheDifficultiesWhenNoRaidLogIsNew()
    {
        var results = new QuickUpdateResults(
            MythicPlusResult(runs: 1, previousRunCount: 1),
            RaidLogsResult(previousLogCount: 40),
            ArenaResult((Bracket("2v2"), 10, 10), (Bracket("3v3"), 10, 10))
        );

        Assert.Equal(
            "New raid logs since last export       0",
            QuickUpdateReport.Summary(results, TimeSpan.Zero)[3]
        );
    }

    [Fact]
    public void Summary_SaysWhenThereWasNoEarlierExportToCompareWith()
    {
        var results = new QuickUpdateResults(
            MythicPlusResult(runs: 2, previousRunCount: 0),
            RaidLogsResult(previousLogCount: 0, NewLog(1, Heroic)),
            ArenaResult((Bracket("2v2"), 1_250, 0), (Bracket("3v3"), 30, 0))
        );

        Assert.Equal(
            [
                "New M+ runs since last export         2  (first export)",
                "New raid logs since last export       1  (first export)",
                "New 2v2 rated arena games         1,250  (first export this season)",
                "New 3v3 rated arena games            30  (first export this season)",
            ],
            QuickUpdateReport.Summary(results, TimeSpan.Zero).Skip(2)
        );
    }

    [Fact]
    public void Summary_MarksTheExportsThatFailed()
    {
        Assert.Equal(
            [
                "New M+ runs since last export    failed",
                "New raid logs since last export  failed",
                "New 2v2 rated arena games        failed",
                "New 3v3 rated arena games        failed",
            ],
            QuickUpdateReport
                .Summary(new QuickUpdateResults(null, null, null), TimeSpan.Zero)
                .Skip(2)
        );
    }

    [Theory]
    [InlineData(false, false, false, 0)]
    [InlineData(true, false, false, 2)]
    [InlineData(false, true, false, 4)]
    [InlineData(false, false, true, 8)]
    [InlineData(true, true, true, 14)]
    public void ExitCode_HasABitForEachExportThatFailedAndLeavesOneForABuildThatFailed(
        bool mythicPlusFailed,
        bool raidLogsFailed,
        bool arenaFailed,
        int expected
    )
    {
        var results = new QuickUpdateResults(
            mythicPlusFailed ? null : MythicPlusResult(1, 1),
            raidLogsFailed ? null : RaidLogsResult(1),
            arenaFailed ? null : ArenaResult()
        );

        Assert.Equal(expected, results.ExitCode);
    }

    [Fact]
    public async Task RunAsync_RunsTheExportsInOrderUnderTheirHeadings()
    {
        var output = new StringWriter();
        var error = new StringWriter();
        var mythicPlus = MythicPlusResult(1, 1);
        var raidLogs = RaidLogsResult(1);
        var arena = ArenaResult();

        var results = await new QuickUpdateRun(output, error).RunAsync(
            new QuickUpdateExports(
                _ =>
                {
                    output.WriteLine("[1/1]  Halls of Valor");
                    return Task.FromResult(mythicPlus);
                },
                _ => Task.FromResult(raidLogs),
                _ => Task.FromResult(arena)
            ),
            CancellationToken.None
        );

        Assert.Equal(
            string.Join(
                Environment.NewLine,
                "Reading the Mythic+ leaderboards...",
                "",
                "[1/1]  Halls of Valor",
                "",
                "Reading The Emerald Nightmare logs...",
                "",
                "Reading the rated arena ladders...",
                "",
                ""
            ),
            output.ToString()
        );
        Assert.Equal("", error.ToString());
        Assert.Equal(new QuickUpdateResults(mythicPlus, raidLogs, arena), results);
    }

    [Fact]
    public async Task RunAsync_ReportsAFailedExportAndGoesOnWithTheOthers()
    {
        var output = new StringWriter();
        var error = new StringWriter();
        var arena = ArenaResult();

        var results = await new QuickUpdateRun(output, error).RunAsync(
            new QuickUpdateExports(
                _ => throw new InvalidOperationException("The leaderboards shrank."),
                _ => Task.FromException<RaidLogExportResult>(new IOException("Disk full.")),
                _ => Task.FromResult(arena)
            ),
            CancellationToken.None
        );

        Assert.Equal(
            string.Join(
                Environment.NewLine,
                "Mythic+ export failed: The leaderboards shrank.",
                "Raid log export failed: Disk full.",
                ""
            ),
            error.ToString()
        );
        Assert.Equal(new QuickUpdateResults(null, null, arena), results);
    }

    [Fact]
    public async Task RunAsync_StopsWhenCancelled()
    {
        using var cancellation = new CancellationTokenSource();
        var arenaRan = false;

        await Assert.ThrowsAnyAsync<OperationCanceledException>(() =>
            new QuickUpdateRun(TextWriter.Null, TextWriter.Null).RunAsync(
                new QuickUpdateExports(
                    token =>
                    {
                        cancellation.Cancel();
                        token.ThrowIfCancellationRequested();
                        return Task.FromResult(MythicPlusResult(1, 1));
                    },
                    _ => Task.FromResult(RaidLogsResult(1)),
                    _ =>
                    {
                        arenaRan = true;
                        return Task.FromResult(ArenaResult());
                    }
                ),
                cancellation.Token
            )
        );
        Assert.False(arenaRan);
    }

    private static MythicPlusExportResult MythicPlusResult(int runs, int previousRunCount) =>
        new(
            MythicPlusDatasetBuilder.Build(
                new ChallengeIndex("legion-", [new ChallengeMap(200, "Halls of Valor", 2700)]),
                new Dictionary<int, IReadOnlyList<ChallengeRun>>
                {
                    [200] = ChallengeResponseParser.ParseLeaderboard(
                        Parse(
                            LeaderboardJson([
                                .. Enumerable
                                    .Range(1, runs)
                                    .Select(completedAt =>
                                        Run(
                                            16,
                                            2_000_000 + completedAt,
                                            completedAt,
                                            [],
                                            Member("Alpha", Evermoon, 6, "Blood", 0, "")
                                        )
                                    ),
                            ])
                        )
                    ),
                }
            ),
            previousRunCount,
            "out"
        );

    private static RaidLogExportResult RaidLogsResult(
        int previousLogCount,
        params RaidLog[] newLogs
    ) =>
        new(
            new RaidDataset([], newLogs, [], [], [], [], []),
            previousLogCount,
            newLogs.Length,
            [],
            "out",
            36,
            null,
            newLogs
        );

    private static RaidLog NewLog(int logId, int difficultyId) =>
        new(
            new RaidLogKey(RaidCatalog.Tauri, logId),
            1853,
            difficultyId,
            0,
            0,
            null,
            RaidCatalog.Alliance,
            0,
            0,
            0,
            [],
            [],
            0
        );

    private static ArenaBracket Bracket(string name) =>
        ArenaSeason.Brackets.Single(bracket => bracket.Name == name);

    private static ArenaLadderExportResult ArenaResult(
        params (ArenaBracket Bracket, int GamesPlayed, int PreviousGamesPlayed)[] brackets
    ) =>
        new(
            [
                .. brackets.Select(entry => new ArenaBracketExport(
                    entry.Bracket,
                    entry.Bracket.FileName,
                    10,
                    0,
                    entry.GamesPlayed,
                    entry.PreviousGamesPlayed,
                    10
                )),
            ],
            DateTimeOffset.UnixEpoch
        );
}
