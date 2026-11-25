using Tauri.Core.Helpers;

namespace RatedBgRosterExporter;

public sealed record RosterCharacter(
    string Name,
    string ApiRealm,
    string DisplayRealm,
    string? MainSpec = null
)
{
    public string Label => $"{Name}-{DisplayRealm}";
}

public static class RatedBgRosterList
{
    public const string FileName = "rated-bg-players.txt";

    public static IReadOnlyList<RosterCharacter> Parse(IReadOnlyList<string> lines)
    {
        var characters = new List<RosterCharacter>();
        var specsByCharacter = new Dictionary<string, List<string?>>(
            StringComparer.OrdinalIgnoreCase
        );
        var errors = new List<string>();

        for (var index = 0; index < lines.Count; index++)
        {
            var line = lines[index].Trim().TrimEnd(',').Trim();
            if (line.Length == 0 || line.StartsWith('#'))
            {
                continue;
            }

            var parts = line.Split('-', StringSplitOptions.TrimEntries);
            var name = parts[0];
            var mainSpec = parts.Length == 3 ? parts[2] : null;
            if (
                parts.Length is not (2 or 3)
                || name.Length == 0
                || mainSpec is ""
                || !CharacterHelpers.TryResolveRealm(
                    parts[1],
                    out var apiRealm,
                    out var displayRealm
                )
            )
            {
                errors.Add(
                    $"Line {index + 1}: \"{line}\" isn't Name-Realm or Name-Realm-Spec with the realm Evermoon, Tauri or WoD."
                );
                continue;
            }

            var character = new RosterCharacter(name, apiRealm, displayRealm, mainSpec);
            if (DuplicateOf(character, specsByCharacter) is { } duplicate)
            {
                errors.Add($"Line {index + 1}: {duplicate}");
                continue;
            }

            characters.Add(character);
        }

        if (errors.Count > 0)
        {
            throw new FormatException(string.Join(Environment.NewLine, errors));
        }

        if (characters.Count == 0)
        {
            throw new FormatException("The list names no players.");
        }

        return characters;
    }

    private static string? DuplicateOf(
        RosterCharacter character,
        Dictionary<string, List<string?>> specsByCharacter
    )
    {
        if (!specsByCharacter.TryGetValue(character.Label, out var specs))
        {
            specsByCharacter[character.Label] = [character.MainSpec];
            return null;
        }

        if (character.MainSpec is not { } mainSpec || specs.Contains(null))
        {
            return $"{character.Label} is already listed. To list a character for more than one spec, name the spec on each of its lines: Name-Realm-Spec.";
        }

        if (specs.Contains(mainSpec, StringComparer.OrdinalIgnoreCase))
        {
            return $"{character.Label}-{mainSpec} is already listed.";
        }

        specs.Add(mainSpec);
        return null;
    }
}
