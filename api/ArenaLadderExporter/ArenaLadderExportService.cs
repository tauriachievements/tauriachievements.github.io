using System.Text.Json;
using Tauri.Core.Infrastructure;

namespace ArenaLadderExporter;

public sealed record ArenaBracketExport(
    ArenaBracket Bracket,
    string Path,
    int PlayerCount,
    int SkippedCount,
    int GamesPlayed,
    int PreviousGamesPlayed,
    int ComparedPlayerCount
);

public sealed record ArenaLadderExportResult(
    IReadOnlyList<ArenaBracketExport> Brackets,
    DateTimeOffset GeneratedAt
);

public sealed record PreviousArenaStanding(int Rating, int Games);

public sealed record PreviousArenaLadder(
    int GamesPlayed,
    string? GeneratedAt,
    IReadOnlyDictionary<(string Realm, int Guid), PreviousArenaStanding> Standings
)
{
    public static readonly PreviousArenaLadder None = new(
        0,
        null,
        new Dictionary<(string Realm, int Guid), PreviousArenaStanding>()
    );
}

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
                var previous = ReadPreviousLadder(path);
                return (
                    entry.Ladder,
                    Previous: previous,
                    Export: new ArenaBracketExport(
                        entry.Bracket,
                        path,
                        entry.Ladder.Players.Count,
                        entry.Ladder.SkippedCount,
                        CountGamesPlayed(entry.Ladder.Players),
                        previous.GamesPlayed,
                        entry.Ladder.Players.Count(player =>
                            previous.Standings.ContainsKey((player.Realm, player.Guid))
                        )
                    )
                );
            })
            .ToList();

        var shrunk = exports
            .Select(entry => entry.Export)
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

        foreach (var (ladder, previous, export) in exports)
        {
            await ArenaLadderFileWriter.WriteAsync(
                export.Path,
                export.Bracket,
                ladder.Players,
                previous,
                generatedAt,
                cancellationToken
            );
        }

        return new ArenaLadderExportResult(
            exports.Select(entry => entry.Export).ToList(),
            generatedAt
        );
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

    private static PreviousArenaLadder ReadPreviousLadder(string path)
    {
        if (!File.Exists(path))
        {
            return PreviousArenaLadder.None;
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
                return PreviousArenaLadder.None;
            }

            var gamesPlayed = players.EnumerateArray().Sum(player => ReadInt(player, "games"));
            if (
                !root.TryGetProperty("generatedAt", out var generatedAt)
                || generatedAt.ValueKind != JsonValueKind.String
                || string.IsNullOrEmpty(generatedAt.GetString())
            )
            {
                return PreviousArenaLadder.None with { GamesPlayed = gamesPlayed };
            }

            var standings = new Dictionary<(string Realm, int Guid), PreviousArenaStanding>();
            foreach (var player in players.EnumerateArray())
            {
                if (
                    player.TryGetProperty("realm", out var realm)
                    && realm.ValueKind == JsonValueKind.String
                    && ReadInt(player, "guid") is var guid and > 0
                )
                {
                    standings.TryAdd(
                        (realm.GetString()!, guid),
                        new PreviousArenaStanding(
                            ReadInt(player, "rating"),
                            ReadInt(player, "games")
                        )
                    );
                }
            }

            return new PreviousArenaLadder(gamesPlayed, generatedAt.GetString(), standings);
        }
        catch (Exception error) when (error is JsonException or IOException)
        {
            return PreviousArenaLadder.None;
        }
    }

    private static int ReadInt(JsonElement player, string propertyName) =>
        player.ValueKind == JsonValueKind.Object
        && player.TryGetProperty(propertyName, out var property)
        && property.ValueKind == JsonValueKind.Number
        && property.TryGetInt32(out var value)
            ? value
            : 0;
}
