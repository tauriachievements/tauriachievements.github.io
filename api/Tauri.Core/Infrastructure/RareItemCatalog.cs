using System.Globalization;
using System.Text.Json;
using Tauri.Core.Models;

namespace Tauri.Core.Infrastructure;

public static class RareItemCatalog
{
    public static IReadOnlyList<RareItemDefinition> Load(string path)
    {
        if (!File.Exists(path))
        {
            throw new FileNotFoundException($"Could not find rare item list: {path}", path);
        }

        var items = new List<RareItemDefinition>();
        var seenIds = new HashSet<int>();

        foreach (var rawLine in File.ReadLines(path))
        {
            var line = rawLine.Trim();
            if (string.IsNullOrWhiteSpace(line) || line.StartsWith('#'))
            {
                continue;
            }

            var separatorIndex = line.LastIndexOf('-');
            if (
                separatorIndex <= 0
                || !int.TryParse(
                    line[(separatorIndex + 1)..].Trim(),
                    NumberStyles.None,
                    CultureInfo.InvariantCulture,
                    out var id
                )
                || id <= 0
            )
            {
                throw new FormatException(
                    $"Invalid rare item line: '{rawLine}'. Expected 'Name - ID'."
                );
            }

            var name = line[..separatorIndex].Trim();
            if (string.IsNullOrWhiteSpace(name))
            {
                throw new FormatException($"Rare item {id} has no name.");
            }

            if (seenIds.Add(id))
            {
                items.Add(new RareItemDefinition(id, name));
            }
        }

        return items;
    }

    public const int ElitePvpItemsFormatVersion = 1;

    public static IReadOnlyList<RareItemDefinition> LoadElitePvpItems(string path)
    {
        if (!File.Exists(path))
        {
            throw new FileNotFoundException($"Could not find elite PvP item list: {path}", path);
        }

        using var document = JsonDocument.Parse(File.ReadAllText(path));
        var root = document.RootElement;
        if (
            !root.TryGetProperty("version", out var version)
            || version.ValueKind != JsonValueKind.Number
            || version.GetInt32() != ElitePvpItemsFormatVersion
        )
        {
            throw new FormatException(
                $"Elite PvP item list {path} is not version {ElitePvpItemsFormatVersion}."
            );
        }

        if (
            !root.TryGetProperty("items", out var entries)
            || entries.ValueKind != JsonValueKind.Array
        )
        {
            throw new FormatException($"Elite PvP item list {path} has no items.");
        }

        var items = new List<RareItemDefinition>();
        var seenIds = new HashSet<int>();
        foreach (var entry in entries.EnumerateArray())
        {
            if (
                entry.ValueKind != JsonValueKind.Array
                || entry.GetArrayLength() < 5
                || entry[0].ValueKind != JsonValueKind.Number
                || !entry[0].TryGetInt32(out var id)
                || id <= 0
                || entry[4].ValueKind != JsonValueKind.String
                || string.IsNullOrWhiteSpace(entry[4].GetString())
            )
            {
                throw new FormatException(
                    $"Invalid elite PvP item: {entry.GetRawText()}. Expected [id, season, classes, slot, name]."
                );
            }

            if (seenIds.Add(id))
            {
                items.Add(new RareItemDefinition(id, entry[4].GetString()!.Trim()));
            }
        }

        return items;
    }

    public static IReadOnlyList<RareItemDefinition> Combine(
        params IReadOnlyList<RareItemDefinition>[] lists
    )
    {
        var seenIds = new HashSet<int>();
        return lists.SelectMany(list => list).Where(item => seenIds.Add(item.Id)).ToList();
    }
}
