using System.Buffers;
using System.Text.Json;

namespace Tauri.Core.Infrastructure;

public sealed class JsonLineWriter
{
    private static readonly byte[] NewLine = "\n"u8.ToArray();

    private readonly ArrayBufferWriter<byte> _buffer = new();
    private readonly Utf8JsonWriter _itemWriter;

    public JsonLineWriter(JsonWriterOptions options)
    {
        _itemWriter = new Utf8JsonWriter(_buffer, options);
    }

    public void WriteTo(Utf8JsonWriter writer, Action<Utf8JsonWriter> writeItem)
    {
        _buffer.ResetWrittenCount();
        _buffer.Write(NewLine);
        _itemWriter.Reset(_buffer);
        writeItem(_itemWriter);
        _itemWriter.Flush();
        writer.WriteRawValue(_buffer.WrittenSpan, skipInputValidation: true);
    }

    public static async Task FlushIfLargeAsync(
        Utf8JsonWriter writer,
        CancellationToken cancellationToken
    )
    {
        if (writer.BytesPending > 64 * 1024)
        {
            await writer.FlushAsync(cancellationToken);
        }
    }
}
