using Tauri.Core.Helpers;

namespace RatedBgRosterExporter;

public sealed record RosterCharacter(
    string Name,
    string ApiRealm,
    string DisplayRealm,
    string? MainSpec = null,
    string? Person = null
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
        var people = new People();
        var errors = new List<string>();

        for (var index = 0; index < lines.Count; index++)
        {
            var line = lines[index].Trim();
            if (line.Length == 0 || line.StartsWith('#'))
            {
                continue;
            }

            var onLine = new List<RosterCharacter>();
            foreach (
                var part in line.Split(
                    ',',
                    StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries
                )
            )
            {
                if (ParseCharacter(part) is not { } character)
                {
                    errors.Add(
                        $"Line {index + 1}: \"{part}\" isn't Name-Realm or Name-Realm-Spec with the realm Evermoon, Tauri or WoD."
                    );
                }
                else if (DuplicateOf(character, specsByCharacter) is { } duplicate)
                {
                    errors.Add($"Line {index + 1}: {duplicate}");
                }
                else
                {
                    onLine.Add(character);
                }
            }

            people.Link(onLine.Select(character => character.Label));
            characters.AddRange(onLine);
        }

        if (errors.Count > 0)
        {
            throw new FormatException(string.Join(Environment.NewLine, errors));
        }

        if (characters.Count == 0)
        {
            throw new FormatException("The list names no players.");
        }

        return characters
            .Select(character => character with { Person = people.PersonOf(character.Label) })
            .ToList();
    }

    private static RosterCharacter? ParseCharacter(string text)
    {
        var parts = text.Split('-', StringSplitOptions.TrimEntries);
        var name = parts[0];
        var mainSpec = parts.Length == 3 ? parts[2] : null;
        return
            parts.Length is not (2 or 3)
            || name.Length == 0
            || mainSpec is ""
            || !CharacterHelpers.TryResolveRealm(parts[1], out var apiRealm, out var displayRealm)
            ? null
            : new RosterCharacter(name, apiRealm, displayRealm, mainSpec);
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

    private sealed class People
    {
        private readonly List<string> _labelsInListOrder = [];
        private readonly Dictionary<string, int> _personByLabel = new(
            StringComparer.OrdinalIgnoreCase
        );

        public void Link(IEnumerable<string> labels)
        {
            var linked = labels.Select(PersonOrNew).Distinct().ToList();
            if (linked.Count < 2)
            {
                return;
            }

            var firstListed = linked.Min();
            foreach (var label in _labelsInListOrder)
            {
                if (linked.Contains(_personByLabel[label]))
                {
                    _personByLabel[label] = firstListed;
                }
            }
        }

        public string? PersonOf(string label)
        {
            var person = _personByLabel[label];
            return _personByLabel.Values.Count(other => other == person) > 1
                ? _labelsInListOrder[person]
                : null;
        }

        private int PersonOrNew(string label)
        {
            if (!_personByLabel.TryGetValue(label, out var person))
            {
                person = _labelsInListOrder.Count;
                _labelsInListOrder.Add(label);
                _personByLabel[label] = person;
            }
            return person;
        }
    }
}
