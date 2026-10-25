using System.Globalization;
using System.Text.Encodings.Web;
using System.Text.Json;
using Tauri.Core.Infrastructure;

namespace ArenaLadderExporter;

public static class ArenaLadderFileWriter
{
    public const int FormatVersion = 1;

    private static readonly JsonWriterOptions WriterOptions = new()
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    public static Task WriteAsync(
        string path,
        ArenaBracket bracket,
        IReadOnlyList<ArenaLadderPlayer> players,
        DateTimeOffset generatedAt,
        CancellationToken cancellationToken
    ) =>
        AtomicFile.WriteAsync(
            path,
            (stream, token) => WriteLadderAsync(stream, bracket, players, generatedAt, token),
            cancellationToken
        );

    public static string FormatSeasonStart(DateTimeOffset seasonStart) =>
        seasonStart.ToString("yyyy-MM-dd'T'HH:mm:sszzz", CultureInfo.InvariantCulture);

    private static async Task WriteLadderAsync(
        Stream stream,
        ArenaBracket bracket,
        IReadOnlyList<ArenaLadderPlayer> players,
        DateTimeOffset generatedAt,
        CancellationToken cancellationToken
    )
    {
        await using var writer = new Utf8JsonWriter(stream, WriterOptions);
        var line = new JsonLineWriter(WriterOptions);

        writer.WriteStartObject();
        writer.WriteNumber("version", FormatVersion);
        writer.WriteString("bracket", bracket.Name);
        writer.WriteString("seasonStart", FormatSeasonStart(ArenaSeason.Start));
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
            await JsonLineWriter.FlushIfLargeAsync(writer, cancellationToken);
        }
        writer.WriteEndArray();
        writer.WriteEndObject();
        await writer.FlushAsync(cancellationToken);
    }

    private static void WritePlayer(Utf8JsonWriter item, ArenaLadderPlayer player)
    {
        item.WriteStartObject();
        item.WriteNumber("guid", player.Guid);
        item.WriteString("realm", player.Realm);
        item.WriteString("name", player.Name);
        item.WriteNumber("class", player.Class);
        item.WriteNumber("race", player.Race);
        item.WriteNumber("gender", player.Gender);
        item.WriteNumber("faction", player.Faction);
        item.WriteString("guild", player.Guild);
        item.WriteNumber("spec", player.Spec);
        item.WriteNumber("games", player.Games);
        item.WriteNumber("wins", player.Wins);
        item.WriteNumber("weekGames", player.WeekGames);
        item.WriteNumber("weekWins", player.WeekWins);
        item.WriteNumber("rating", player.Rating);
        item.WriteNumber("peakRating", player.PeakRating);
        item.WriteNumber("weekPeakRating", player.WeekPeakRating);
        item.WriteEndObject();
    }
}
