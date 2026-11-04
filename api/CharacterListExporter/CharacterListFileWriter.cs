using System.Globalization;
using System.Text.Encodings.Web;
using System.Text.Json;
using Tauri.Core.Infrastructure;

namespace CharacterListExporter;

public static class CharacterListFileWriter
{
    public const int FormatVersion = 1;

    private static readonly JsonWriterOptions WriterOptions = new()
    {
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping,
    };

    public static Task WriteAsync(
        string path,
        string realm,
        IReadOnlyList<CharacterListEntry> characters,
        DateTimeOffset generatedAt,
        CancellationToken cancellationToken
    ) =>
        AtomicFile.WriteAsync(
            path,
            (stream, token) => WriteListAsync(stream, realm, characters, generatedAt, token),
            cancellationToken
        );

    private static async Task WriteListAsync(
        Stream stream,
        string realm,
        IReadOnlyList<CharacterListEntry> characters,
        DateTimeOffset generatedAt,
        CancellationToken cancellationToken
    )
    {
        await using var writer = new Utf8JsonWriter(stream, WriterOptions);
        var line = new JsonLineWriter(WriterOptions);

        writer.WriteStartObject();
        writer.WriteNumber("version", FormatVersion);
        writer.WriteString("realm", realm);
        writer.WriteString(
            "generatedAt",
            generatedAt.UtcDateTime.ToString(
                "yyyy-MM-dd'T'HH:mm:ss'Z'",
                CultureInfo.InvariantCulture
            )
        );
        writer.WriteStartArray("characters");
        foreach (var character in characters)
        {
            line.WriteTo(writer, item => WriteCharacter(item, character));
        }
        writer.WriteEndArray();
        writer.WriteEndObject();
        await writer.FlushAsync(cancellationToken);
    }

    private static void WriteCharacter(Utf8JsonWriter item, CharacterListEntry character)
    {
        item.WriteStartObject();
        item.WriteString("name", character.Name);
        item.WriteNumber("class", character.Class);
        item.WriteString("spec", character.Spec);
        item.WriteNumber("level", character.Level);
        if (character.ItemLevel is { } itemLevel)
        {
            item.WriteNumber("itemLevel", itemLevel);
        }
        else
        {
            item.WriteNull("itemLevel");
        }
        item.WriteNumber("traits", character.Traits);
        item.WriteNumber("artifactKnowledge", character.ArtifactKnowledge);
        item.WriteBoolean("campaign", character.Campaign);
        item.WriteNumber("orderHall", character.OrderHall);
        item.WriteEndObject();
    }
}
