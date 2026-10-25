using System.Text.Json;
using Tauri.Core.Infrastructure;

namespace ArenaLadderExporter;

public sealed record ArenaBracketExport(
    ArenaBracket Bracket,
    string Path,
    int PlayerCount,
    int SkippedCount,
    int GamesPlayed,
    int PreviousGamesPlayed
);

public sealed record ArenaLadderExportResult(
    IReadOnlyList<ArenaBracketExport> Brackets,
    DateTimeOffset GeneratedAt
);

public sealed class ArenaLadderExportService(
    string outputDirectory,
    ITauriApiClient apiClient,
    TimeProvider? timeProvider = null
)
{
    public const string Endpoint = "arena-ladder";

    private const double MaxShrinkFraction = 0.02;

    private readonly TimeProvider _timeProvider = timeProvider ?? TimeProvider.System;

    public async Task<ArenaLadderExportResult> ExportAsync(
        ArenaLadderExporterOptions options,
        CancellationToken cancellationToken
    )
    {
        var ladders = new List<(ArenaBracket Bracket, ArenaLadder Ladder)>();
        foreach (var bracket in ArenaSeason.Brackets)
        {
            ladders.Add((bracket, await ReadLadderAsync(bracket, cancellationToken)));
        }

        var generatedAt = _timeProvider.GetUtcNow();
        var exports = ladders
            .Select(entry =>
            {
                var path = Path.Combine(outputDirectory, entry.Bracket.FileName);
                return new ArenaBracketExport(
                    entry.Bracket,
                    path,
                    entry.Ladder.Players.Count,
                    entry.Ladder.SkippedCount,
                    CountGamesPlayed(entry.Ladder.Players),
                    ReadPreviousGamesPlayed(path)
                );
            })
            .ToList();

        var shrunk = exports
            .Where(export =>
                export.PreviousGamesPlayed > 0
                && export.GamesPlayed < export.PreviousGamesPlayed * (1 - MaxShrinkFraction)
            )
            .ToList();
        if (!options.AllowShrink && shrunk.Count > 0)
        {
            throw new InvalidOperationException(
                string.Join(
                    " ",
                    shrunk.Select(export =>
                        $"The {export.Bracket.Name} ladder's games played shrank from {export.PreviousGamesPlayed} to {export.GamesPlayed}."
                    )
                )
                    + " The API probably answered only in part. Nothing was written. "
                    + "Run again later, or pass --allow-shrink if the drop is real (a new season)."
            );
        }

        foreach (var (bracket, ladder) in ladders)
        {
            await ArenaLadderFileWriter.WriteAsync(
                Path.Combine(outputDirectory, bracket.FileName),
                bracket,
                ladder.Players,
                generatedAt,
                cancellationToken
            );
        }

        return new ArenaLadderExportResult(exports, generatedAt);
    }

    private async Task<ArenaLadder> ReadLadderAsync(
        ArenaBracket bracket,
        CancellationToken cancellationToken
    )
    {
        var result = await apiClient.FetchResponseElementAsync(
            Endpoint,
            new { r = ArenaSeason.LadderRealm, ts = bracket.TeamSize },
            $"arena ladder ({bracket.Name})",
            cancellationToken
        );

        if (!result.Succeeded || result.ResponseElement is not { } response)
        {
            throw new InvalidOperationException(
                $"Could not read the {bracket.Name} arena ladder, nothing was written: {result.FailureMessage}"
            );
        }

        return ArenaLadderParser.Parse(response);
    }

    private static int CountGamesPlayed(IEnumerable<ArenaLadderPlayer> players) =>
        players.Sum(player => player.Games);

    private static int ReadPreviousGamesPlayed(string path)
    {
        if (!File.Exists(path))
        {
            return 0;
        }

        try
        {
            using var document = JsonDocument.Parse(File.ReadAllBytes(path));
            var root = document.RootElement;
            var sameSeason =
                root.TryGetProperty("seasonStart", out var seasonStart)
                && seasonStart.GetString()
                    == ArenaLadderFileWriter.FormatSeasonStart(ArenaSeason.Start);
            if (
                !sameSeason
                || !root.TryGetProperty("players", out var players)
                || players.ValueKind != JsonValueKind.Array
            )
            {
                return 0;
            }

            return players
                .EnumerateArray()
                .Sum(player =>
                    player.TryGetProperty("games", out var games)
                    && games.TryGetInt32(out var value)
                        ? value
                        : 0
                );
        }
        catch (Exception error) when (error is JsonException or IOException)
        {
            return 0;
        }
    }
}
