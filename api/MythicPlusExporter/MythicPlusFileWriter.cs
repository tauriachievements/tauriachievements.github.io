using System.Globalization;
using System.Text.Encodings.Web;
using System.Text.Json;
using Tauri.Core.Infrastructure;

namespace MythicPlusExporter;

public static class MythicPlusFileWriter
{
    public const int FormatVersion = 2;
    public const string IndexFileName = "index.json";

    private static readonly JsonWriterOptions WriterOptions = new()
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    public static async Task WriteAsync(
        string outputDirectory,
        MythicPlusDataset dataset,
        MythicPlusTables tables,
        IReadOnlyList<MythicPlusStanding> standings,
        IReadOnlyList<MythicPlusStanding> departed,
        DateTimeOffset generatedAt,
        DateTimeOffset? previousGeneratedAt,
        CancellationToken cancellationToken
    )
    {
        Directory.CreateDirectory(outputDirectory);

        var playerIndexes = tables
            .Players.Select((player, index) => (player, index))
            .ToDictionary(entry => (entry.player.Realm, entry.player.Name), entry => entry.index);
        var specIndexes = tables
            .Specs.Select((spec, index) => (spec, index))
            .ToDictionary(entry => entry.spec, entry => entry.index);

        foreach (var dungeon in dataset.Dungeons)
        {
            await AtomicFile.WriteAsync(
                Path.Combine(outputDirectory, dungeon.Info.Slug + ".json"),
                (stream, token) =>
                    WriteDungeonAsync(
                        stream,
                        dungeon,
                        tables.Fingerprint,
                        playerIndexes,
                        specIndexes,
                        token
                    ),
                cancellationToken
            );
        }

        await AtomicFile.WriteAsync(
            Path.Combine(outputDirectory, IndexFileName),
            (stream, token) =>
                WriteIndexAsync(
                    stream,
                    dataset,
                    tables,
                    standings,
                    departed,
                    playerIndexes,
                    generatedAt,
                    previousGeneratedAt,
                    token
                ),
            cancellationToken
        );

        RemoveStaleFiles(outputDirectory, dataset);
    }

    private static async Task WriteIndexAsync(
        Stream stream,
        MythicPlusDataset dataset,
        MythicPlusTables tables,
        IReadOnlyList<MythicPlusStanding> standings,
        IReadOnlyList<MythicPlusStanding> departed,
        IReadOnlyDictionary<(string Realm, string Name), int> playerIndexes,
        DateTimeOffset generatedAt,
        DateTimeOffset? previousGeneratedAt,
        CancellationToken cancellationToken
    )
    {
        var season = MythicPlusCatalog.Season;
        await using var writer = new Utf8JsonWriter(stream, WriterOptions);
        var line = new JsonLineWriter(WriterOptions);

        writer.WriteStartObject();
        writer.WriteNumber("version", FormatVersion);
        writer.WriteString("generatedAt", FormatTimestamp(generatedAt));
        if (previousGeneratedAt is not null)
        {
            writer.WriteString("previousGeneratedAt", FormatTimestamp(previousGeneratedAt.Value));
        }
        writer.WriteString("tables", tables.Fingerprint);
        writer.WriteStartObject("season");
        writer.WriteString("id", season.Id);
        writer.WriteString("name", season.Name);
        writer.WriteString("raid", season.Raid);
        writer.WriteString("startDate", season.StartDate);
        writer.WriteEndObject();

        writer.WriteStartArray("dungeons");
        foreach (var dungeon in dataset.Dungeons)
        {
            line.WriteTo(
                writer,
                item =>
                {
                    item.WriteStartObject();
                    item.WriteString("id", dungeon.Info.Slug);
                    item.WriteNumber("challengeId", dungeon.Map.ChallengeId);
                    item.WriteString("shortName", dungeon.Info.ShortName);
                    item.WriteString("name", dungeon.Map.Name);
                    item.WriteNumber("timerSeconds", dungeon.Map.TimerSeconds);
                    item.WriteString(
                        "icon",
                        MythicPlusCatalog.IconUrl(dataset.DataUrlPrefix, dungeon.Info.IconName)
                    );
                    item.WriteNumber("runCount", dungeon.Runs.Count);
                    item.WriteNumber("bestScore", dungeon.BestScore);
                    item.WriteEndObject();
                }
            );
        }
        writer.WriteEndArray();

        writer.WriteStartArray("affixes");
        foreach (var affix in dataset.Affixes)
        {
            line.WriteTo(
                writer,
                item =>
                {
                    item.WriteStartObject();
                    item.WriteNumber("id", affix.Id);
                    item.WriteString("name", affix.Name);
                    item.WriteNumber("level", affix.Level);
                    item.WriteString(
                        "icon",
                        MythicPlusCatalog.IconUrl(dataset.DataUrlPrefix, affix.Icon)
                    );
                    item.WriteString("description", affix.Description);
                    item.WriteEndObject();
                }
            );
        }
        writer.WriteEndArray();

        writer.WriteStartArray("specs");
        foreach (var spec in tables.Specs)
        {
            line.WriteTo(
                writer,
                item =>
                {
                    item.WriteStartObject();
                    item.WriteNumber("class", spec.ClassId);
                    item.WriteString("name", spec.Name);
                    item.WriteString("role", spec.Role);
                    item.WriteEndObject();
                }
            );
        }
        writer.WriteEndArray();

        writer.WriteStartArray("players");
        foreach (var player in tables.Players)
        {
            line.WriteTo(
                writer,
                item =>
                {
                    item.WriteStartArray();
                    item.WriteStringValue(player.Name);
                    item.WriteStringValue(player.Realm);
                    item.WriteStringValue(player.Guild);
                    item.WriteNumberValue(player.ClassId);
                    item.WriteNumberValue(player.Race);
                    item.WriteNumberValue(player.Gender);
                    item.WriteEndArray();
                }
            );
            await JsonLineWriter.FlushIfLargeAsync(writer, cancellationToken);
        }
        writer.WriteEndArray();

        var standingsByPlayer = standings.ToDictionary(standing => (standing.Realm, standing.Name));
        writer.WriteStartArray("scores");
        foreach (var player in tables.Players)
        {
            var standing = standingsByPlayer.GetValueOrDefault((player.Realm, player.Name));
            line.WriteTo(
                writer,
                item =>
                {
                    item.WriteStartArray();
                    if (standing is not null)
                    {
                        item.WriteNumberValue(standing.Score);
                        item.WriteNumberValue(standing.TimeMilliseconds);
                        if (
                            standing.ScoreChange is not null
                            && standing.TimeChangeMilliseconds is not null
                        )
                        {
                            item.WriteNumberValue(standing.ScoreChange.Value);
                            item.WriteNumberValue(standing.TimeChangeMilliseconds.Value);
                        }
                    }
                    item.WriteEndArray();
                }
            );
            await JsonLineWriter.FlushIfLargeAsync(writer, cancellationToken);
        }
        writer.WriteEndArray();

        if (previousGeneratedAt is not null)
        {
            writer.WriteStartArray("departed");
            foreach (
                var (position, standing) in departed
                    .Select(standing => (playerIndexes[(standing.Realm, standing.Name)], standing))
                    .OrderBy(entry => entry.Item1)
            )
            {
                line.WriteTo(
                    writer,
                    item =>
                    {
                        item.WriteStartArray();
                        item.WriteNumberValue(position);
                        item.WriteNumberValue(standing.Score);
                        item.WriteNumberValue(standing.TimeMilliseconds);
                        item.WriteEndArray();
                    }
                );
            }
            writer.WriteEndArray();
        }

        writer.WriteEndObject();
        await writer.FlushAsync(cancellationToken);
    }

    private static async Task WriteDungeonAsync(
        Stream stream,
        MythicPlusDungeon dungeon,
        string tables,
        IReadOnlyDictionary<(string Realm, string Name), int> playerIndexes,
        IReadOnlyDictionary<MythicPlusSpec, int> specIndexes,
        CancellationToken cancellationToken
    )
    {
        await using var writer = new Utf8JsonWriter(stream, WriterOptions);
        var line = new JsonLineWriter(WriterOptions);

        writer.WriteStartObject();
        writer.WriteNumber("version", FormatVersion);
        writer.WriteString("dungeon", dungeon.Info.Slug);
        writer.WriteString("tables", tables);
        writer.WriteStartArray("runs");

        foreach (var (run, score) in dungeon.Runs)
        {
            line.WriteTo(
                writer,
                item =>
                {
                    item.WriteStartArray();
                    item.WriteNumberValue(run.KeyLevel);
                    item.WriteNumberValue(run.ClearTimeMilliseconds);
                    item.WriteNumberValue(run.CompletedAt);
                    item.WriteNumberValue(score);

                    item.WriteStartArray();
                    foreach (var affix in run.Affixes)
                    {
                        item.WriteNumberValue(affix.Id);
                    }
                    item.WriteEndArray();

                    item.WriteStartArray();
                    foreach (var member in run.Members)
                    {
                        item.WriteStartArray();
                        item.WriteNumberValue(playerIndexes[(member.Realm, member.Name)]);
                        item.WriteNumberValue(
                            specIndexes[
                                new MythicPlusSpec(member.ClassId, member.SpecName, member.Role)
                            ]
                        );
                        item.WriteEndArray();
                    }
                    item.WriteEndArray();

                    item.WriteEndArray();
                }
            );
            await JsonLineWriter.FlushIfLargeAsync(writer, cancellationToken);
        }

        writer.WriteEndArray();
        writer.WriteEndObject();
        await writer.FlushAsync(cancellationToken);
    }

    private static void RemoveStaleFiles(string outputDirectory, MythicPlusDataset dataset)
    {
        var expected = dataset
            .Dungeons.Select(dungeon => dungeon.Info.Slug + ".json")
            .Append(IndexFileName)
            .ToHashSet(StringComparer.OrdinalIgnoreCase);

        foreach (var path in Directory.EnumerateFiles(outputDirectory, "*.json"))
        {
            if (!expected.Contains(Path.GetFileName(path)))
            {
                File.Delete(path);
            }
        }
    }

    private static string FormatTimestamp(DateTimeOffset timestamp) =>
        timestamp.UtcDateTime.ToString("yyyy-MM-dd'T'HH:mm:ss'Z'", CultureInfo.InvariantCulture);
}
