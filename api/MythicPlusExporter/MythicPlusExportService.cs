using System.Text.Json;
using Tauri.Core.Infrastructure;

namespace MythicPlusExporter;

public sealed record MythicPlusExportResult(
    MythicPlusDataset Dataset,
    int PreviousRunCount,
    string OutputDirectory
);

internal sealed record PreviousMythicPlusSnapshot(
    int RunCount,
    string? SeasonId,
    DateTimeOffset? GeneratedAt,
    MythicPlusTables? Tables,
    IReadOnlyDictionary<(string Realm, string Name), MythicPlusStanding> Standings
);

public sealed class MythicPlusExportService(
    string outputDirectory,
    ITauriApiClient apiClient,
    TimeProvider? timeProvider = null
)
{
    private const double MaxShrinkFraction = 0.02;

    private readonly ChallengeLeaderboardReader _reader = new(apiClient);
    private readonly TimeProvider _timeProvider = timeProvider ?? TimeProvider.System;

    public async Task<MythicPlusExportResult> ExportAsync(
        MythicPlusExporterOptions options,
        CancellationToken cancellationToken
    )
    {
        var index = await _reader.ReadIndexAsync(options.Realms[0], cancellationToken);
        var leaderboards = await _reader.ReadLeaderboardsAsync(
            index,
            options.Realms,
            cancellationToken
        );
        var scannedAt = _timeProvider.GetUtcNow();

        if (leaderboards.Failures.Count > 0)
        {
            throw new InvalidOperationException(
                "Could not read every leaderboard, nothing was written:"
                    + Environment.NewLine
                    + string.Join(Environment.NewLine, leaderboards.Failures)
            );
        }

        var dataset = MythicPlusDatasetBuilder.Build(index, leaderboards.RunsByChallengeId);
        var previous = ReadPreviousSnapshot();
        var previousRunCount = previous.RunCount;

        if (
            !options.AllowShrink
            && previousRunCount > 0
            && dataset.RunCount < previousRunCount * (1 - MaxShrinkFraction)
        )
        {
            throw new InvalidOperationException(
                $"The leaderboards shrank from {previousRunCount} to {dataset.RunCount} runs, "
                    + "so the API probably answered only in part. Nothing was written. "
                    + "Run again later, or pass --allow-shrink if the drop is real (a new season)."
            );
        }

        var sameSeason = previous.SeasonId == MythicPlusCatalog.Season.Id;
        var tables = MythicPlusTables.Extend(sameSeason ? previous.Tables : null, dataset);
        var currentStandings = MythicPlusStandings.Build(dataset);
        var comparable =
            sameSeason && previous.GeneratedAt is not null && previous.Standings.Count > 0;
        var standings = comparable
            ? MythicPlusStandings.Compare(currentStandings, previous.Standings)
            : currentStandings;
        var departed = comparable
            ? MythicPlusStandings.Departed(currentStandings, previous.Standings)
            : [];

        await MythicPlusFileWriter.WriteAsync(
            outputDirectory,
            dataset,
            tables,
            standings,
            departed,
            scannedAt,
            comparable ? previous.GeneratedAt : null,
            cancellationToken
        );
        return new MythicPlusExportResult(dataset, previousRunCount, outputDirectory);
    }

    private PreviousMythicPlusSnapshot ReadPreviousSnapshot()
    {
        var indexPath = Path.Combine(outputDirectory, MythicPlusFileWriter.IndexFileName);
        if (!File.Exists(indexPath))
        {
            return EmptyPreviousSnapshot();
        }

        try
        {
            using var document = JsonDocument.Parse(File.ReadAllBytes(indexPath));
            var root = document.RootElement;
            var runCount = ReadRunCount(root);
            var seasonId =
                root.TryGetProperty("season", out var season)
                && season.TryGetProperty("id", out var id)
                    ? id.GetString()
                    : null;
            var generatedAt =
                root.TryGetProperty("generatedAt", out var generated)
                && DateTimeOffset.TryParse(generated.GetString(), out var parsedGeneratedAt)
                    ? parsedGeneratedAt
                    : (DateTimeOffset?)null;
            var version =
                root.TryGetProperty("version", out var versionElement)
                && versionElement.TryGetInt32(out var parsedVersion)
                    ? parsedVersion
                    : 1;
            var tables = version <= MythicPlusFileWriter.FormatVersion ? ReadTables(root) : null;
            if (tables is null)
            {
                return new PreviousMythicPlusSnapshot(
                    runCount,
                    seasonId,
                    generatedAt,
                    null,
                    new Dictionary<(string Realm, string Name), MythicPlusStanding>()
                );
            }

            var standings =
                version == MythicPlusFileWriter.FormatVersion
                    ? ReadScores(root, tables.Players)
                    : ReadLegacyStandings(root, tables.Players);
            return new PreviousMythicPlusSnapshot(
                runCount,
                seasonId,
                generatedAt,
                tables,
                standings
            );
        }
        catch (Exception error) when (error is JsonException or IOException)
        {
            return EmptyPreviousSnapshot();
        }
    }

    private static int ReadRunCount(JsonElement root) =>
        root.TryGetProperty("dungeons", out var dungeons)
        && dungeons.ValueKind == JsonValueKind.Array
            ? dungeons
                .EnumerateArray()
                .Sum(dungeon =>
                    dungeon.TryGetProperty("runCount", out var count)
                    && count.TryGetInt32(out var value)
                        ? value
                        : 0
                )
            : 0;

    private static MythicPlusTables? ReadTables(JsonElement root)
    {
        if (
            !root.TryGetProperty("players", out var playerRows)
            || playerRows.ValueKind != JsonValueKind.Array
            || !root.TryGetProperty("specs", out var specRows)
            || specRows.ValueKind != JsonValueKind.Array
        )
        {
            return null;
        }

        var players = new List<MythicPlusPlayer>();
        foreach (var row in playerRows.EnumerateArray())
        {
            if (row.ValueKind != JsonValueKind.Array || row.GetArrayLength() < 6)
            {
                return null;
            }

            players.Add(
                new MythicPlusPlayer(
                    row[0].GetString() ?? "",
                    row[1].GetString() ?? "",
                    row[2].GetString() ?? "",
                    row[3].GetInt32(),
                    row[4].GetInt32(),
                    row[5].GetInt32()
                )
            );
        }

        var specs = specRows
            .EnumerateArray()
            .Select(spec => new MythicPlusSpec(
                spec.GetProperty("class").GetInt32(),
                spec.GetProperty("name").GetString() ?? "",
                spec.GetProperty("role").GetString() ?? ""
            ))
            .ToList();

        if (
            players.DistinctBy(player => (player.Realm, player.Name)).Count() != players.Count
            || specs.Distinct().Count() != specs.Count
        )
        {
            return null;
        }

        var fingerprint =
            root.TryGetProperty("tables", out var tables)
            && tables.GetString() is { Length: > 0 } stored
                ? stored
                : MythicPlusTables.FingerprintOf(specs, players);
        return new MythicPlusTables(fingerprint, specs, players);
    }

    private static Dictionary<(string Realm, string Name), MythicPlusStanding> ReadScores(
        JsonElement root,
        IReadOnlyList<MythicPlusPlayer> players
    )
    {
        if (
            !root.TryGetProperty("scores", out var scores)
            || scores.ValueKind != JsonValueKind.Array
            || scores.GetArrayLength() != players.Count
        )
        {
            return [];
        }

        var result = new Dictionary<(string Realm, string Name), MythicPlusStanding>();
        var position = 0;
        foreach (var entry in scores.EnumerateArray())
        {
            var player = players[position++];
            if (entry.ValueKind != JsonValueKind.Array)
            {
                return [];
            }

            if (entry.GetArrayLength() >= 2)
            {
                result[(player.Realm, player.Name)] = new MythicPlusStanding(
                    player.Name,
                    player.Realm,
                    entry[0].GetDouble(),
                    entry[1].GetInt64()
                );
            }
        }

        return result;
    }

    private Dictionary<(string Realm, string Name), MythicPlusStanding> ReadLegacyStandings(
        JsonElement root,
        IReadOnlyList<MythicPlusPlayer> tablePlayers
    )
    {
        var players = tablePlayers.Select(player => (player.Realm, player.Name)).ToList();
        if (
            !root.TryGetProperty("dungeons", out var dungeons)
            || dungeons.ValueKind != JsonValueKind.Array
        )
        {
            return [];
        }

        var expectedTables = root.TryGetProperty("tables", out var tables)
            ? tables.GetString()
            : null;
        var best = new MythicPlusStandings.BestRuns(players.Count);

        foreach (var dungeon in dungeons.EnumerateArray())
        {
            var slug = dungeon.TryGetProperty("id", out var id) ? id.GetString() : null;
            if (string.IsNullOrWhiteSpace(slug))
            {
                return [];
            }

            var path = Path.Combine(outputDirectory, slug + ".json");
            if (!File.Exists(path))
            {
                return [];
            }

            using var document = JsonDocument.Parse(File.ReadAllBytes(path));
            var file = document.RootElement;
            if (
                expectedTables is not null
                && (
                    !file.TryGetProperty("tables", out var fileTables)
                    || fileTables.GetString() != expectedTables
                )
            )
            {
                return [];
            }
            if (!file.TryGetProperty("runs", out var runs) || runs.ValueKind != JsonValueKind.Array)
            {
                return [];
            }

            best.StartDungeon();
            foreach (var run in runs.EnumerateArray())
            {
                if (run.ValueKind != JsonValueKind.Array || run.GetArrayLength() < 6)
                {
                    continue;
                }

                var score = run[3].GetDouble();
                var clearTime = run[1].GetInt64();
                foreach (var member in run[5].EnumerateArray())
                {
                    if (
                        member.ValueKind == JsonValueKind.Array
                        && member.GetArrayLength() >= 1
                        && member[0].TryGetInt32(out var playerIndex)
                        && playerIndex >= 0
                        && playerIndex < players.Count
                    )
                    {
                        best.Add(playerIndex, score, clearTime);
                    }
                }
            }
            best.EndDungeon();
        }

        return MythicPlusStandings
            .Totals(players, best.Scores, best.Times)
            .ToDictionary(standing => (standing.Realm, standing.Name), standing => standing);
    }

    private static PreviousMythicPlusSnapshot EmptyPreviousSnapshot() =>
        new(0, null, null, null, new Dictionary<(string Realm, string Name), MythicPlusStanding>());
}
