using System.Text.Json;

namespace Tauri.Core.Infrastructure;

public static class CharacterSpecialization
{
    public static string Active(JsonElement characterSheet)
    {
        var activeSpec =
            characterSheet.TryGetProperty("activeSpec", out var activeSpecElement)
            && activeSpecElement.TryGetInt32(out var slot)
                ? slot
                : 0;
        if (
            !characterSheet.TryGetProperty($"talents_legion_{activeSpec}", out var specialization)
            || specialization.ValueKind != JsonValueKind.String
        )
        {
            return string.Empty;
        }

        var parts = (specialization.GetString() ?? string.Empty).Split(
            '&',
            StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries
        );
        if (parts.Length < 2)
        {
            return string.Empty;
        }

        return string.Join(
            ' ',
            parts[1]
                .Split('-', StringSplitOptions.RemoveEmptyEntries)
                .Select(word => char.ToUpperInvariant(word[0]) + word[1..])
        );
    }
}
