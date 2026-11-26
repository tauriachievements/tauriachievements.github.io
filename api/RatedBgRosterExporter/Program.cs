using System.Globalization;
using Tauri.Core.Configuration;
using Tauri.Core.Infrastructure;

namespace RatedBgRosterExporter;

internal static class Program
{
    private const string UsageText = """
        RatedBgRosterExporter - refreshes the players of the /rated-bg-picker page.

        Usage:
          dotnet run --project RatedBgRosterExporter

        Reads AchievementLadder/Data/rated-bg-players.txt (one Name-Realm per line, kept by hand,
        optionally followed by the player's main spec: Llýnch-Evermoon-Holy) and writes each
        player's race, class, spec, artifact traits and item level to
        spa/src/rated-bg-roster.json. A character who plays more than one spec gets a line per
        spec: Keilalt-Tauri-Vengeance and Keilalt-Tauri-Havoc. One person's characters go on one
        line, separated by commas, so the page never plays two of them in one match:
        Zerololq-Evermoon-Frost, Zerolul-Evermoon-Shadow.

        Options:
          --help   Show this help text.
        """;

    public static async Task<int> Main(string[] args)
    {
        if (args.Length > 0)
        {
            var showHelp = args is ["--help"] or ["-h"] or ["/?"];
            if (!showHelp)
            {
                Console.Error.WriteLine($"Unknown argument: {args[0]}");
                Console.Error.WriteLine();
            }

            Console.WriteLine(UsageText);
            return showHelp ? 0 : 1;
        }

        var projectRoot = ProjectPaths.FindProjectRoot(
            AppContext.BaseDirectory,
            "RatedBgRosterExporter.csproj"
        );
        var solutionRoot = ProjectPaths.FindSolutionRoot(projectRoot);
        var settingsPath = ResolveSettingsPath(projectRoot, solutionRoot);
        var listPath = Path.Combine(
            solutionRoot,
            "AchievementLadder",
            "Data",
            RatedBgRosterList.FileName
        );
        var outputDirectory = ProjectPaths.GetFrontendSrcDirectory(solutionRoot);

        using var cancellationTokenSource = new CancellationTokenSource();
        Console.CancelKeyPress += (_, eventArgs) =>
        {
            eventArgs.Cancel = true;
            cancellationTokenSource.Cancel();
        };

        try
        {
            var characters = RatedBgRosterList.Parse(await File.ReadAllLinesAsync(listPath));
            var settings = AppSettings.Load(settingsPath);
            using var apiClient = new TauriApiClient(settings.TauriApi);
            var exporter = new RatedBgRosterExportService(outputDirectory, apiClient);

            Console.WriteLine(
                $"Reading {characters.DistinctBy(character => character.Label, StringComparer.OrdinalIgnoreCase).Count()} characters from {RatedBgRosterList.FileName}..."
            );
            var result = await exporter.ExportAsync(
                characters,
                DateTimeOffset.UtcNow,
                cancellationTokenSource.Token
            );

            Console.WriteLine();
            foreach (var player in result.Players)
            {
                Console.WriteLine(Describe(player));
            }

            foreach (var warning in result.Warnings)
            {
                Console.WriteLine(warning);
            }

            Console.WriteLine();
            if (result.NotFound.Count > 0)
            {
                Console.WriteLine(
                    $"The armory doesn't know {string.Join(", ", result.NotFound.Select(player => $"{player.Name}-{player.Realm}"))}: check the name in {RatedBgRosterList.FileName}."
                );
            }
            Console.WriteLine($"Wrote {result.Players.Count} players to {result.OutputPath}");
            return 0;
        }
        catch (OperationCanceledException)
        {
            Console.Error.WriteLine("Rated BG roster export cancelled.");
            return 1;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine($"Rated BG roster export failed: {ex.Message}");
            return 1;
        }
    }

    private static string Describe(RosterPlayer player)
    {
        var label = $"{player.Name}-{player.Realm}";
        var samePlayer =
            player.Person is { } person && person != label ? $"  same player as {person}" : "";
        return $"{DescribeCharacter(player, label.PadRight(26))}{samePlayer}";
    }

    private static string DescribeCharacter(RosterPlayer player, string character)
    {
        if (!player.Found)
        {
            return $"{character}not found on the armory";
        }

        var traits = player.Traits is { } count ? $"{count} traits" : "no artifact";
        var itemLevel = player.ItemLevel is { } level
            ? $"ilvl {level.ToString(CultureInfo.InvariantCulture)}"
            : "no ilvl";
        return $"{character}{player.Specialization, -15}{traits, -12}{itemLevel}";
    }

    private static string ResolveSettingsPath(string projectRoot, string solutionRoot)
    {
        var sharedSettingsPath = Path.Combine(
            solutionRoot,
            "AchievementLadder",
            "appsettings.json"
        );
        if (File.Exists(sharedSettingsPath))
        {
            return sharedSettingsPath;
        }

        var localSettingsPath = Path.Combine(projectRoot, "appsettings.json");
        if (File.Exists(localSettingsPath))
        {
            return localSettingsPath;
        }

        throw new FileNotFoundException(
            "Could not find appsettings.json in either AchievementLadder or RatedBgRosterExporter.",
            sharedSettingsPath
        );
    }
}
