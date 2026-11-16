using System.Text.Encodings.Web;
using System.Text.Json;
using Tauri.Core.Infrastructure;

namespace AchievementLadder.Services;

public static class RareItemFindingsFile
{
    public const string FileName = "RareItemFindings.json";

    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    private static readonly JsonWriterOptions WriterOptions = new()
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    public static async Task<RareItemFindingsExport?> ReadAsync(
        string path,
        CancellationToken cancellationToken
    )
    {
        if (!File.Exists(path))
        {
            return null;
        }

        try
        {
            await using var stream = File.OpenRead(path);
            var findings = await JsonSerializer.DeserializeAsync<RareItemFindingsExport>(
                stream,
                SerializerOptions,
                cancellationToken
            );
            return findings?.Version == RareItemFindings.FormatVersion ? findings : null;
        }
        catch (JsonException)
        {
            return null;
        }
    }

    public static Task WriteAsync(
        string path,
        RareItemFindingsExport findings,
        CancellationToken cancellationToken
    ) =>
        AtomicFile.WriteAsync(
            path,
            (stream, token) => WriteFindingsAsync(stream, findings, token),
            cancellationToken
        );

    private static async Task WriteFindingsAsync(
        Stream stream,
        RareItemFindingsExport findings,
        CancellationToken cancellationToken
    )
    {
        await using var writer = new Utf8JsonWriter(stream, WriterOptions);
        var line = new JsonLineWriter(WriterOptions);

        writer.WriteStartObject();
        writer.WriteNumber("version", findings.Version);
        writer.WriteStartArray("scans");
        foreach (var scan in findings.Scans)
        {
            line.WriteTo(writer, item => JsonSerializer.Serialize(item, scan, SerializerOptions));
        }
        writer.WriteEndArray();
        writer.WriteStartArray("characters");
        foreach (var character in findings.Characters)
        {
            line.WriteTo(
                writer,
                item => JsonSerializer.Serialize(item, character, SerializerOptions)
            );
        }
        writer.WriteEndArray();
        writer.WriteEndObject();
        await writer.FlushAsync(cancellationToken);
    }
}
