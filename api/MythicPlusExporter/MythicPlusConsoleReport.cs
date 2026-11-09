using System.Globalization;

namespace MythicPlusExporter;

public static class MythicPlusConsoleReport
{
    private const int DungeonWidth = 26;
    private const int LabelWidth = 28;

    public static string Duration(TimeSpan elapsed)
    {
        var tenths = Math.Round(elapsed.TotalSeconds, 1);
        if (tenths < 60)
        {
            return Invariant($"{tenths:0.0}s");
        }

        var rounded = TimeSpan.FromSeconds(Math.Round(elapsed.TotalSeconds));
        return rounded.TotalHours >= 1
            ? Invariant($"{(int)rounded.TotalHours}h {rounded.Minutes:00}m {rounded.Seconds:00}s")
            : Invariant($"{rounded.Minutes}m {rounded.Seconds:00}s");
    }

    public static string LeaderboardRead(
        int position,
        int total,
        string dungeon,
        int runs,
        TimeSpan elapsed
    ) =>
        Invariant(
            $"{Counter(position, total)}{dungeon, -DungeonWidth} {runs, 7:N0} runs  {Duration(elapsed), 7}"
        );

    public static string LeaderboardFailed(
        int position,
        int total,
        string dungeon,
        TimeSpan elapsed
    ) => $"{Counter(position, total)}{dungeon, -DungeonWidth} failed after {Duration(elapsed)}";

    public static IReadOnlyList<string> Summary(MythicPlusExportResult result, string repoRoot)
    {
        var dataset = result.Dataset;
        var newRuns =
            result.PreviousRunCount == 0
                ? Invariant($"{dataset.RunCount:N0} (first export)")
                : Invariant($"{dataset.RunCount - result.PreviousRunCount:N0}");

        return
        [
            "",
            $"  {"Dungeon", -(DungeonWidth + 6)}{"Runs", 7}{"Best score", 12}",
            .. dataset.Dungeons.Select(dungeon =>
                Invariant(
                    $"  {dungeon.Info.ShortName, -5} {dungeon.Map.Name, -DungeonWidth}{dungeon.Runs.Count, 7:N0}{dungeon.BestScore, 12:0.0}"
                )
            ),
            Invariant($"  {"Total", -(DungeonWidth + 6)}{dataset.RunCount, 7:N0}"),
            "",
            Field("New runs since last export", newRuns),
            Field("Players", Invariant($"{dataset.Players.Count:N0}")),
            Field("Saved to", Path.GetRelativePath(repoRoot, result.OutputDirectory)),
        ];
    }

    private static string Counter(int position, int total)
    {
        var width = total.ToString(CultureInfo.InvariantCulture).Length;
        return Invariant(
            $"  [{position.ToString(CultureInfo.InvariantCulture).PadLeft(width)}/{total}]  "
        );
    }

    private static string Field(string label, string value) => $"  {label, -LabelWidth}{value}";

    private static string Invariant(FormattableString text) =>
        text.ToString(CultureInfo.InvariantCulture);
}
