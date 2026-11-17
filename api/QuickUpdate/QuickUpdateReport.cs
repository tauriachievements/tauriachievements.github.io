using System.Globalization;
using ArenaLadderExporter;
using MythicPlusExporter;
using RaidLogExporter;

namespace QuickUpdate;

public static class QuickUpdateReport
{
    public const string ReadingMythicPlus = "Reading the Mythic+ leaderboards...";
    public const string ReadingRaidLogs = $"Reading {RaidCatalog.Name} logs...";
    public const string ReadingArena = "Reading the rated arena ladders...";

    private const int LabelWidth = 33;
    private const int ValueWidth = 6;
    private const string Failed = "failed";

    public static IReadOnlyList<string> Summary(QuickUpdateResults results, TimeSpan elapsed) =>
        [
            $"Finished in {MythicPlusConsoleReport.Duration(elapsed)}.",
            "",
            Line("New M+ runs since last export", MythicPlusValue(results.MythicPlus)),
            Line("New raid logs since last export", RaidLogsValue(results.RaidLogs)),
            .. ArenaSeason.Brackets.Select(bracket =>
                Line($"New {bracket.Name} rated arena games", ArenaValue(results.Arena, bracket))
            ),
        ];

    private static (string Count, string Note) MythicPlusValue(MythicPlusExportResult? result) =>
        result switch
        {
            null => (Failed, ""),
            { PreviousRunCount: 0 } => (Count(result.Dataset.RunCount), "first export"),
            _ => (Count(result.Dataset.RunCount - result.PreviousRunCount), ""),
        };

    private static (string Count, string Note) RaidLogsValue(RaidLogExportResult? result) =>
        result switch
        {
            null => (Failed, ""),
            { PreviousLogCount: 0 } => (Count(result.NewLogs.Count), "first export"),
            _ => (Count(result.NewLogs.Count), Difficulties(result.NewLogs)),
        };

    private static (string Count, string Note) ArenaValue(
        ArenaLadderExportResult? result,
        ArenaBracket bracket
    ) =>
        result?.Brackets.FirstOrDefault(export => export.Bracket == bracket) switch
        {
            null => (Failed, ""),
            { PreviousGamesPlayed: 0 } export => (
                Count(export.GamesPlayed),
                "first export this season"
            ),
            var export => (Count(export.GamesPlayed - export.PreviousGamesPlayed), ""),
        };

    private static string Difficulties(IReadOnlyList<RaidLog> logs) =>
        string.Join(
            ", ",
            RaidCatalog
                .Difficulties.Select(difficulty =>
                    (
                        difficulty.ShortName,
                        Count: logs.Count(log => log.DifficultyId == difficulty.Id)
                    )
                )
                .Where(difficulty => difficulty.Count > 0)
                .Select(difficulty => $"{difficulty.ShortName} {Count(difficulty.Count)}")
        );

    private static string Line(string label, (string Count, string Note) value) =>
        $"{label, -LabelWidth}{value.Count, ValueWidth}"
        + (value.Note.Length > 0 ? $"  ({value.Note})" : "");

    private static string Count(int value) => value.ToString("N0", CultureInfo.InvariantCulture);
}
