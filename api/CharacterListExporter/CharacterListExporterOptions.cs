namespace CharacterListExporter;

public sealed record CharacterListExporterOptions(
    string Realm,
    string ApiRealm,
    string List,
    IReadOnlyList<string> Names,
    bool AllowShrink
)
{
    public static string UsageText =>
        """
            CharacterListExporter - exports a hand-picked list of characters for its hidden page.

            Usage:
              dotnet run --project CharacterListExporter -- <realm> <list> <character> [<character> ...]
              dotnet run --project CharacterListExporter -- Evermoon xyhop Xyhop Xyhopwarrior --allow-shrink

            Writes spa/src/character-lists/<list>.json: each character's level, current spec,
            item level, artifact traits, Artifact Knowledge, class campaign and order hall upgrades.
            Every character must load, or nothing is written.

            Arguments:
              <realm>          Evermoon, Tauri or WoD.
              <list>           The list's name, in lower case letters, digits and hyphens.
              <character>      One or more character names on that realm.

            Options:
              --allow-shrink   Publish even if the list holds fewer characters than last time.
              --help           Show this help text.
            """;

    public static bool TryParse(
        string[] args,
        out CharacterListExporterOptions? options,
        out string? errorMessage,
        out bool showHelp
    )
    {
        options = null;
        errorMessage = null;
        showHelp = false;

        var allowShrink = false;
        var positional = new List<string>();
        foreach (var argument in args)
        {
            switch (argument)
            {
                case "--help":
                case "-h":
                case "/?":
                    showHelp = true;
                    return false;

                case "--allow-shrink":
                    allowShrink = true;
                    break;

                default:
                    if (argument.StartsWith("--", StringComparison.Ordinal))
                    {
                        errorMessage = $"Unknown option: {argument}";
                        return false;
                    }

                    positional.Add(argument.Trim());
                    break;
            }
        }

        if (positional.Count < 3)
        {
            errorMessage = "Expected a realm, a list name and at least one character.";
            return false;
        }

        var realm = Realms.FirstOrDefault(entry =>
            string.Equals(entry.Name, positional[0], StringComparison.OrdinalIgnoreCase)
        );
        if (realm.Name is null)
        {
            errorMessage =
                $"Unknown realm: {positional[0]}. Use {string.Join(", ", Realms.Select(entry => entry.Name))}.";
            return false;
        }

        var list = positional[1];
        if (!IsListName(list))
        {
            errorMessage =
                $"The list name '{list}' must be lower case letters and digits, joined by hyphens.";
            return false;
        }

        var names = positional
            .Skip(2)
            .Where(name => name.Length > 0)
            .DistinctBy(name => name, StringComparer.OrdinalIgnoreCase)
            .ToList();
        options = new CharacterListExporterOptions(
            realm.Name,
            realm.ApiName,
            list,
            names,
            allowShrink
        );
        return true;
    }

    private static readonly (string Name, string ApiName)[] Realms =
    [
        ("Evermoon", "[EN] Evermoon"),
        ("Tauri", "[HU] Tauri WoW Server"),
        ("WoD", "[HU] Warriors of Darkness"),
    ];

    private static bool IsListName(string list) =>
        list.Split('-')
            .All(part =>
                part.Length > 0
                && part.All(character =>
                    char.IsAsciiLetterLower(character) || char.IsAsciiDigit(character)
                )
            );
}
