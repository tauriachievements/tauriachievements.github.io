namespace ArenaLadderExporter;

public sealed record ArenaLadderExporterOptions(bool AllowShrink)
{
    public static string UsageText =>
        """
            ArenaLadderExporter - exports the rated 2v2 and 3v3 arena ladders for the /arena page.

            Usage:
              dotnet run --project ArenaLadderExporter
              dotnet run --project ArenaLadderExporter -- --allow-shrink

            Writes spa/src/arena-ladder-2v2.json and spa/src/arena-ladder-3v3.json.
            The ladder is shared by Evermoon, Tauri and WoD, so one request per bracket reads all three.

            Options:
              --allow-shrink   Publish even if the ladder holds fewer games than last time,
                               e.g. after a season reset.
              --help           Show this help text.
            """;

    public static bool TryParse(
        string[] args,
        out ArenaLadderExporterOptions? options,
        out string? errorMessage,
        out bool showHelp
    )
    {
        options = null;
        errorMessage = null;
        showHelp = false;

        var allowShrink = false;

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
                    errorMessage = argument.StartsWith("--", StringComparison.Ordinal)
                        ? $"Unknown option: {argument}"
                        : $"Unknown argument: {argument}";
                    return false;
            }
        }

        options = new ArenaLadderExporterOptions(allowShrink);
        return true;
    }
}
