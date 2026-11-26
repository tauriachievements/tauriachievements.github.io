using System.Globalization;
using System.Text.Encodings.Web;
using System.Text.Json;
using Tauri.Core.Infrastructure;

namespace RatedBgRosterExporter;

public static class RatedBgRosterFileWriter
{
    public const int FormatVersion = 1;

    private static readonly JsonWriterOptions WriterOptions = new()
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    public static Task WriteAsync(
        string path,
        IReadOnlyList<RosterPlayer> players,
        DateTimeOffset generatedAt,
        CancellationToken cancellationToken
    ) =>
        AtomicFile.WriteAsync(
            path,
            (stream, token) => WriteRosterAsync(stream, players, generatedAt, token),
            cancellationToken
        );

    private static async Task WriteRosterAsync(
        Stream stream,
        IReadOnlyList<RosterPlayer> players,
        DateTimeOffset generatedAt,
        CancellationToken cancellationToken
    )
    {
        await using var writer = new Utf8JsonWriter(stream, WriterOptions);
        var line = new JsonLineWriter(WriterOptions);

        writer.WriteStartObject();
        writer.WriteNumber("version", FormatVersion);
        writer.WriteString(
            "generatedAt",
            generatedAt.UtcDateTime.ToString(
                "yyyy-MM-dd'T'HH:mm:ss'Z'",
                CultureInfo.InvariantCulture
            )
        );
        writer.WriteStartArray("players");
        foreach (var player in players)
        {
            line.WriteTo(writer, item => WritePlayer(item, player));
        }
        writer.WriteEndArray();
        writer.WriteEndObject();
        await writer.FlushAsync(cancellationToken);
    }

    private static void WritePlayer(Utf8JsonWriter item, RosterPlayer player)
    {
        item.WriteStartObject();
        item.WriteString("name", player.Name);
        item.WriteString("realm", player.Realm);
        if (player.Person is { } person)
        {
            item.WriteString("person", person);
        }
        if (!player.Found)
        {
            item.WriteBoolean("notFound", true);
            item.WriteEndObject();
            return;
        }

        item.WriteNumber("race", player.Race);
        item.WriteNumber("gender", player.Gender);
        item.WriteNumber("class", player.Class);
        if (!string.IsNullOrWhiteSpace(player.Specialization))
        {
            item.WriteString("spec", player.Specialization);
        }
        if (player.Traits is { } traits)
        {
            item.WriteNumber("traits", traits);
        }
        if (player.ItemLevel is { } itemLevel)
        {
            item.WriteNumber("itemLevel", itemLevel);
        }
        item.WriteEndObject();
    }
}
