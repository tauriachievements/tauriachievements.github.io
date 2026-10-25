using System.Globalization;
using System.Text.Json;
using Tauri.Core.Helpers;

namespace ArenaLadderExporter;

public sealed record ArenaLadderPlayer(
    int Guid,
    string Realm,
    string Name,
    int Class,
    int Race,
    int Gender,
    int Faction,
    string Guild,
    int Spec,
    int Games,
    int Wins,
    int WeekGames,
    int WeekWins,
    int Rating,
    int PeakRating,
    int WeekPeakRating
);

public sealed record ArenaLadder(IReadOnlyList<ArenaLadderPlayer> Players, int SkippedCount);

public static class ArenaLadderParser
{
    public static ArenaLadder Parse(JsonElement response)
    {
        if (
            response.ValueKind != JsonValueKind.Object
            || !response.TryGetProperty("ladder", out var ladder)
            || ladder.ValueKind != JsonValueKind.Array
        )
        {
            throw new InvalidDataException("arena-ladder returned no ladder array.");
        }

        var players = new Dictionary<(string Realm, int Guid), ArenaLadderPlayer>();
        var skipped = 0;
        foreach (var entry in ladder.EnumerateArray())
        {
            var player = ReadPlayer(entry);
            if (player is null || !players.TryAdd((player.Realm, player.Guid), player))
            {
                skipped++;
            }
        }

        return new ArenaLadder(Sort(players.Values), skipped);
    }

    public static IReadOnlyList<ArenaLadderPlayer> Sort(IEnumerable<ArenaLadderPlayer> players) =>
        players
            .OrderByDescending(player => player.Rating)
            .ThenByDescending(player => player.Games)
            .ThenBy(player => player.Name, StringComparer.Ordinal)
            .ThenBy(player => player.Realm, StringComparer.Ordinal)
            .ThenBy(player => player.Guid)
            .ToList();

    private static ArenaLadderPlayer? ReadPlayer(JsonElement entry)
    {
        if (
            entry.ValueKind != JsonValueKind.Object
            || !entry.TryGetProperty("character-minimal-data", out var character)
            || character.ValueKind != JsonValueKind.Object
        )
        {
            return null;
        }

        var guid = ReadInt(entry, "Guid");
        var name = ReadString(character, "charname");
        var classId = ReadInt(character, "class");
        var games = ReadInt(entry, "played_season");
        if (
            guid <= 0
            || name.Length == 0
            || classId <= 0
            || games <= 0
            || !CharacterHelpers.TryResolveRealm(
                ReadString(entry, "realmName"),
                out _,
                out var realm
            )
        )
        {
            return null;
        }

        return new ArenaLadderPlayer(
            guid,
            realm,
            name,
            classId,
            ReadInt(character, "race"),
            ReadInt(character, "gender"),
            ReadInt(character, "faction"),
            ReadString(character, "guildname"),
            ReadInt(entry, "lastspecid"),
            games,
            ReadInt(entry, "wons_season"),
            ReadInt(entry, "played_week"),
            ReadInt(entry, "wons_week"),
            ReadInt(entry, "personal_rating"),
            ReadInt(entry, "rating_best_season"),
            ReadInt(entry, "rating_best_weekly")
        );
    }

    private static int ReadInt(JsonElement parent, string propertyName)
    {
        if (!parent.TryGetProperty(propertyName, out var property))
        {
            return 0;
        }

        if (property.ValueKind == JsonValueKind.Number && property.TryGetInt32(out var value))
        {
            return value;
        }

        return
            property.ValueKind == JsonValueKind.String
            && int.TryParse(
                property.GetString(),
                NumberStyles.Integer,
                CultureInfo.InvariantCulture,
                out value
            )
            ? value
            : 0;
    }

    private static string ReadString(JsonElement parent, string propertyName) =>
        parent.TryGetProperty(propertyName, out var property)
        && property.ValueKind == JsonValueKind.String
            ? property.GetString()?.Trim() ?? string.Empty
            : string.Empty;
}
